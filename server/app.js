import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { AppError, validateStart } from './config.js';
import { connectSoniox } from './soniox.js';
import { queryUsage } from './usage.js';
import { plans } from './payment-catalog.js';

const files = new Map([
  ['/', ['../web/index.html', 'text/html']],
  ['/app.js', ['../web/app.js', 'text/javascript']],
  ['/style.css', ['../web/style.css', 'text/css']],
  ['/pricing', ['../web/pricing.html', 'text/html']],
  ['/pricing.css', ['../web/pricing.css', 'text/css']],
  ['/pricing.js', ['../web/pricing.js', 'text/javascript']],
  ['/account.js', ['../web/account.js', 'text/javascript']],
  ...['messages.js', 'i18n-core.js', 'i18n.js', 'ui-locale.js'].map(file => [`/shared/${file}`, [`../extension/shared/${file}`, 'text/javascript']]),
  ['/captions.js', ['../extension/shared/captions.js', 'text/javascript']],
]);
const sameToken = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createApp(config, providerFactory = connectSoniox, payments = null, accounts = null) {
  const localOrigin = () => `http://127.0.0.1:${config.port}`;
  const validHost = host => host === `127.0.0.1:${config.port}` || host === `localhost:${config.port}`;
  const validOrigin = origin => origin === localOrigin() || origin === `http://localhost:${config.port}` || /^chrome-extension:\/\/[a-p]{32}$/.test(origin || '');
  const log = (event, fields = {}) => process.stdout.write(JSON.stringify({ time: new Date().toISOString(), event, ...fields }) + '\n');
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const headers = {
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
    };
    try {
      const path = new URL(req.url, localOrigin()).pathname;
      const oauthCallback = accounts && req.method === 'GET' && path === '/api/auth/callback/google';
      if (!validHost(req.headers.host) || (req.headers['sec-fetch-site'] === 'cross-site' && !oauthCallback)) throw new AppError('FORBIDDEN', '仅允许本机直接访问', 403);
      if (accounts) {
        const { handleAccountHttp } = await import('./account-http.js');
        if (await handleAccountHttp(accounts, req, res, path, localOrigin(), headers, readBody)) return;
      }
      if (path.startsWith('/api/payments')) {
        if (!payments && !accounts) throw new AppError('PAYMENTS_DISABLED', '支付测试服务未启动，请运行 npm run billing:test', 503);
        if (path === '/api/payments/webhook' && req.method === 'POST') {
          const raw = await readBody(req, 256_000);
          try { await (accounts?.billing || payments).webhook(raw, req.headers['stripe-signature']); }
          catch (error) {
            if (error.type === 'StripeSignatureVerificationError' || error.message === '拒绝真实支付事件') throw new AppError('SIGNATURE', '支付回调验证失败', 400);
            throw error; // 非签名错误返回 500，让 Stripe 重试，不能误报已处理。
          }
          res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end('{"received":true}'); return;
        }
        if (accounts) {
          if (req.method !== 'GET' && req.headers.origin !== localOrigin()) throw new AppError('FORBIDDEN', '请在账户页面操作', 403);
        } else if (!sameToken(req.headers.authorization?.replace(/^Bearer /, ''), config.token) || (req.headers.origin && !validOrigin(req.headers.origin))) throw new AppError('AUTH', '本机支付测试验证失败', 401);
        const accountPayments = accounts ? await accounts.payments(req) : payments;
        let result;
        if (path === '/api/payments' && req.method === 'GET') result = await accountPayments.status();
        else if (req.method === 'POST' && ['/api/payments/trial', '/api/payments/checkout', '/api/payments/cancel'].includes(path)) {
          const input = JSON.parse((await readBody(req, 4096)).toString() || '{}');
          if (path.endsWith('/checkout')) result = await accountPayments.checkout(input.plan);
          else if (path.endsWith('/trial')) await accountPayments.trial();
          else await accountPayments.cancel();
          result ||= await accountPayments.status();
        } else throw new AppError('NOT_FOUND', '支付接口不存在', 404);
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); return;
      }
      if (req.method !== 'GET') throw new AppError('METHOD', '请求方法不支持', 405);
      if (path === '/api/plans') {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ plans, testPaymentsAvailable: Boolean(payments || accounts), accountsEnabled: Boolean(accounts) }));
      } else if (path === '/favicon.ico') {
        res.writeHead(204, headers); res.end();
      } else if (path === '/health' || path === '/ready') {
        const ready = Boolean(config.apiKey);
        res.writeHead(path === '/ready' && !ready ? 503 : 200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ready, provider: 'soniox', model: config.model }));
      } else if (path === '/api/setup') {
        if (req.headers.origin && !validOrigin(req.headers.origin)) throw new AppError('FORBIDDEN', '请在本机设置页查看配对码', 403);
        const connection = accounts ? await accounts.issueToken(req) : { token: config.token };
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ relayUrl: `ws://127.0.0.1:${config.port}/stream`, ...connection, ready: Boolean(config.apiKey), model: config.model }));
      } else if (files.has(path)) {
        const [file, mime] = files.get(path);
        const body = await readFile(new URL(file, import.meta.url));
        res.writeHead(200, { ...headers, 'Content-Type': `${mime}; charset=utf-8` });
        res.end(body);
      } else throw new AppError('NOT_FOUND', '页面不存在', 404);
    } catch (error) {
      res.writeHead(error instanceof AppError ? error.status : 500, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: error.code || 'INTERNAL', message: error instanceof AppError ? error.message : '服务暂时不可用', requestId }));
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const cleanups = new Set();
  server.on('upgrade', (req, socket, head) => {
    if (!validHost(req.headers.host) || !validOrigin(req.headers.origin) || req.url !== '/stream' || wss.clients.size >= config.maxConnections) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', client => {
    const id = randomUUID();
    let state = 'auth';
    let provider;
    let deadline;
    let idle;
    let quota;
    let credentialTimer;
    let sequence = 0;
    let receivedBytes = 0;
    let queue = Promise.resolve();
    let pendingBytes = 0;
    let bytes = 0;
    let started = Date.now();
    const send = data => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount > 256_000) { client.terminate(); return; }
      client.send(JSON.stringify(data));
    };
    const fail = (code, message) => { state = 'failed'; send({ type: 'error', code, message }); client.close(1008); };
    const authTimer = setTimeout(() => fail('AUTH_TIMEOUT', '连接验证超时'), 5000);
    const handle = async (raw, binary) => {
      if (client.readyState !== WebSocket.OPEN) return;
      try {
        if (state === 'auth') {
          state = 'connecting';
          if (binary) throw new AppError('AUTH', '请先连接并验证');
          const value = JSON.parse(raw.toString());
          if (accounts) quota = accounts.authenticateStream(value.token).quota;
          else if (!sameToken(value.token, config.token)) throw new AppError('AUTH', '配对码无效，请重新复制');
          if (!config.apiKey) throw new AppError('NOT_CONFIGURED', '尚未配置 SONIOX_API_KEY，请先完成本机服务设置');
          clearTimeout(authTimer);
          if (value.type === 'usage') {
            if (accounts) throw new AppError('FORBIDDEN', '账户模式请在方案页查看剩余时长；供应商账单不向用户开放', 403);
            state = 'usage';
            send({ type: 'usage', ...await queryUsage(config, value.references) });
            client.close();
            return;
          }
          const options = { ...validateStart(value), clientReferenceId: `kotoba:${id}` };
          if (quota) {
            await quota.start(id);
            credentialTimer = setInterval(() => {
              try { accounts.authenticateStream(value.token); }
              catch (error) { fail(error.code, error.message); }
            }, 5000);
          }
          provider = providerFactory(config, options, data => {
            if (data.type === 'closed') {
              if (state !== 'stopping') send({ type: 'error', code: 'UPSTREAM_CLOSED', message: '语音服务已断开，请重新开始' });
              client.close();
            } else { send(data); if (data.type === 'error') client.close(); }
          });
          await provider.ready;
          if (client.readyState !== WebSocket.OPEN) { provider.close(); return; }
          state = 'streaming';
          started = Date.now();
          deadline = setTimeout(() => fail('TIME_LIMIT', '已达到本次会话时长上限，请重新开始'), config.maxSessionMs);
          idle = setTimeout(() => fail('AUDIO_TIMEOUT', '没有收到音频，会话已停止'), 15_000);
          send({ type: 'ready', requestId: id, startedAt: started, model: config.model });
          log('session_started', { requestId: id });
        } else if (binary && state === 'streaming') {
          if (!raw.length || raw.length % 2 || raw.length > 16_000) throw new AppError('BAD_AUDIO', '音频格式异常');
          receivedBytes += raw.length;
          if (receivedBytes > ((Date.now() - started) / 1000 + 5) * 32_000) throw new AppError('RATE_LIMIT', '音频发送过快');
          idle.refresh();
          if (quota) {
            const result = await quota.write(id, sequence++, raw, audio => provider.write(audio));
            bytes += (result.acceptedSamples || 0) * 2;
            send({ type: 'quota', remainingSeconds: result.remainingSeconds });
            if (result.exhausted) { provider.finish(); fail('QUOTA_EXHAUSTED', '翻译时长已用完，已停止采集；不会自动加购'); }
          } else { provider.write(raw); bytes += raw.length; }
        } else if (!binary && state === 'streaming' && JSON.parse(raw.toString()).type === 'stop') {
          state = 'stopping';
          clearTimeout(idle);
          provider.finish();
        } else throw new AppError('PROTOCOL', '会话状态不匹配，请重新开始');
      } catch (error) {
        fail(error instanceof AppError ? error.code : 'BAD_REQUEST', error instanceof AppError ? error.message : '连接请求格式错误');
      }
    };
    client.on('message', (raw, binary) => {
      pendingBytes += raw.length;
      if (pendingBytes > 256_000) { fail('SLOW_NETWORK', '音频处理积压，请重新开始'); return; }
      queue = queue.then(() => handle(raw, binary)).finally(() => { pendingBytes -= raw.length; });
    });
    client.on('error', () => client.terminate());
    client.on('close', () => {
      clearTimeout(authTimer); clearTimeout(deadline); clearTimeout(idle); clearInterval(credentialTimer);
      if (state === 'streaming' || state === 'stopping') provider?.finish();
      else provider?.close();
      const cleanup = queue.then(() => quota?.stop(id)).catch(() => log('quota_release_failed', { requestId: id }));
      cleanups.add(cleanup);
      cleanup.finally(() => cleanups.delete(cleanup));
      log('session_closed', { requestId: id, audioSeconds: bytes / 32_000 });
    });
  });
  return {
    server,
    async close() {
      for (const client of wss.clients) client.terminate();
      wss.close();
      await new Promise(resolve => server.close(resolve));
      await Promise.allSettled([...cleanups]);
    },
  };
}

async function readBody(req, limit) {
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw new AppError('TOO_LARGE', '请求过大', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
