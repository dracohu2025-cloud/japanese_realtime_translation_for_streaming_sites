import http from 'node:http';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { protocol } from 'electron';

const execFileAsync = promisify(execFile);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ALLOWED = /^https:\/\/(?:[\w-]+\.)*(?:surrit\.com|fourhoi\.com)(?::\d+)?\//i;
const CURL = ['/usr/bin/curl', '/opt/homebrew/bin/curl', 'curl'].find(p => p === 'curl' || existsSync(p)) || 'curl';
const CDN_SCHEME = 'kotoba-cdn';

let hits = 0;
let lastError = '';

function proxyUrl(target) {
  return `${CDN_SCHEME}://local/proxy?u=${encodeURIComponent(target)}`;
}

function rewriteM3u8(text, sourceUrl) {
  return text.split(/\r?\n/).map(line => {
    if (!line) return line;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
        try { return `URI="${proxyUrl(new URL(uri, sourceUrl).href)}"`; }
        catch { return `URI="${uri}"`; }
      });
    }
    try { return proxyUrl(new URL(line.trim(), sourceUrl).href); }
    catch { return line; }
  }).join('\n');
}

async function curlGet(targetUrl) {
  const { stdout } = await execFileAsync(CURL, [
    '-sL', '--compressed',
    '-A', UA,
    '-e', 'https://missav.ai/',
    '-H', 'Accept: */*',
    '-H', 'Origin: https://missav.ai',
    '--max-time', '45',
    '-w', '\n__HTTP_STATUS__:%{http_code}',
    targetUrl,
  ], { encoding: 'buffer', maxBuffer: 40 * 1024 * 1024 });
  const raw = stdout.toString('binary');
  const marker = '\n__HTTP_STATUS__:';
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return stdout;
  const status = Number(raw.slice(idx + marker.length).replace(/\D/g, '') || '0');
  const body = Buffer.from(raw.slice(0, idx), 'binary');
  if (status && status >= 400) {
    const err = new Error(`CDN HTTP ${status}`);
    err.status = status;
    throw err;
  }
  return body;
}

async function fetchCdnBody(target) {
  if (!ALLOWED.test(target)) {
    const err = new Error('host not allowed');
    err.status = 403;
    throw err;
  }
  hits += 1;
  const body = await curlGet(target);
  const asText = body.toString('utf8');
  const isPlaylist = /\.m3u8(\?|$)/i.test(target) || asText.startsWith('#EXTM3U');
  const out = isPlaylist ? Buffer.from(rewriteM3u8(asText, target), 'utf8') : body;
  return {
    body: out,
    contentType: isPlaylist ? 'application/vnd.apple.mpegurl' : 'application/octet-stream',
    isPlaylist,
  };
}

/** 必须在 app.ready 之前调用。 */
export function registerCdnScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: CDN_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  }]);
}

/**
 * 用特权协议代拉 CDN：HTTPS 页可安全请求 kotoba-cdn://，不会被混合内容拦住。
 * 比 http://127.0.0.1 代理更稳。
 */
export function attachCdnProtocol(session) {
  session.protocol.handle(CDN_SCHEME, async (request) => {
    try {
      const target = new URL(request.url).searchParams.get('u') || '';
      const { body, contentType } = await fetchCdnBody(target);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      lastError = String(error?.message || error);
      return new Response(lastError, {
        status: error?.status || 502,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' },
      });
    }
  });

  session.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    if (!ALLOWED.test(url)) {
      callback({});
      return;
    }
    callback({ redirectURL: proxyUrl(url) });
  });
}

/** 兼容：保留本机 http 健康检查 / 调试入口（可选）。 */
export function createCdnProxy() {
  let port = 0;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
      }
      const incoming = new URL(req.url || '/', 'http://127.0.0.1');
      if (incoming.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, port, hits, lastError, curl: CURL, scheme: CDN_SCHEME }));
        return;
      }
      if (incoming.pathname !== '/proxy') {
        res.writeHead(404).end('not found');
        return;
      }
      const target = incoming.searchParams.get('u') || '';
      const { body, contentType } = await fetchCdnBody(target);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (error) {
      lastError = String(error?.message || error);
      res.writeHead(error?.status || 502, { 'Access-Control-Allow-Origin': '*' });
      res.end(lastError);
    }
  });

  return {
    server,
    get port() { return port; },
    get stats() { return { port, hits, lastError, curl: CURL, scheme: CDN_SCHEME }; },
    listen(preferred = 8791) {
      return new Promise((resolve, reject) => {
        const tryListen = (p) => {
          const onError = (error) => {
            server.off('error', onError);
            if (error.code === 'EADDRINUSE' && p < preferred + 30) tryListen(p + 1);
            else reject(error);
          };
          server.once('error', onError);
          server.listen(p, '127.0.0.1', () => {
            server.off('error', onError);
            port = server.address().port;
            resolve(port);
          });
        };
        tryListen(preferred);
      });
    },
    async close() {
      await new Promise(resolve => server.close(() => resolve()));
    },
  };
}

/** @deprecated 用 attachCdnProtocol；保留导出名以免旧引用报错。 */
export function attachCdnProxyRedirect(session, _port) {
  attachCdnProtocol(session);
}

/** 注入备份钩子：直接把 CDN URL 改成特权协议。 */
export function buildCdnProxyInject(_port) {
  return `(() => {
    if (window.__kotobaCdnProxy) return;
    window.__kotobaCdnProxy = true;
    const wrap = (u) => {
      const s = String(u || '');
      if (!/https?:\\/\\/(?:[\\w-]+\\.)*(?:surrit\\.com|fourhoi\\.com)\\//i.test(s)) return s;
      if (s.startsWith('${CDN_SCHEME}:')) return s;
      return '${CDN_SCHEME}://local/proxy?u=' + encodeURIComponent(s);
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      return open.call(this, method, wrap(url), ...rest);
    };
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      if (typeof input === 'string') input = wrap(input);
      else if (input && typeof input.url === 'string') input = new Request(wrap(input.url), input);
      return origFetch.call(this, input, init);
    };
  })();`;
}

export { CDN_SCHEME, ALLOWED, curlGet };
