import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { publicPagePaths } from '../cloud/seo.js';

const origin = 'https://kotoba.uk';
const endpoint = 'https://api.indexnow.org/IndexNow';
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;

// 只接受已上线的规范页面；查询参数、账户接口和任意外站都不能提交。
export function submission(paths, key) {
  if (!/^[a-f0-9]{32}$/.test(key || '')) throw new Error('缺少有效 INDEXNOW_KEY，请从本机 .env.indexnow 加载。');
  if (!paths.length || paths.some(path => !publicPagePaths.includes(path))) throw new Error('请明确提供 sitemap 中的规范页面路径，例如 /en；不接受 URL、查询参数或接口。');
  return { host: 'kotoba.uk', key, keyLocation: `${origin}/${key}.txt`, urlList: [...new Set(paths)].map(path => origin + path) };
}

export async function notifyIndexNow(paths, { key, submit = false, request = fetch } = {}) {
  const payload = submission(paths, key);
  // 所有检查先完成，任一失败均不发送 POST；禁止跟随重定向到非规范地址。
  const get = async url => {
    const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (response.status !== 200) throw new Error(`线上检查失败：HTTP ${response.status}`);
    return { response, body: await response.text() };
  };
  const ownership = await get(payload.keyLocation);
  if (ownership.body.trim() !== key) throw new Error('线上 IndexNow 验证文件与本机不一致。');
  const sitemap = await get(origin + '/sitemap.xml');
  const published = new Set([...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
  for (const url of payload.urlList) {
    if (!published.has(url)) throw new Error(`页面尚未进入线上 sitemap：${url}`);
    const { response, body } = await get(url);
    const all = nodes(parse(body));
    const canonical = all.filter(node => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
    const robots = all.filter(node => node.tagName === 'meta' && ['robots', 'bingbot'].includes(attr(node, 'name')?.toLowerCase())).map(node => attr(node, 'content')).join(',');
    if (!response.headers.get('content-type')?.includes('text/html') || /\b(noindex|none)\b/i.test(robots + ',' + response.headers.get('x-robots-tag')) || canonical.length !== 1 || attr(canonical[0], 'href') !== url) {
      throw new Error(`页面不满足可索引 HTML / 自引用 canonical 条件：${url}`);
    }
  }
  if (!submit) return { submitted: false, checked: true, urls: payload.urlList, message: '预检通过；加 --submit 才发送通知。' };
  const response = await request(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload),
  });
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow HTTP ${response.status}；没有自动重试，请先核查原因。`);
  return { submitted: true, status: response.status, urls: payload.urlList, message: response.status === 202 ? '通知已接收，所有权验证待处理；不代表已收录。' : '通知提交成功；不代表已抓取或收录。' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    const result = await notifyIndexNow(args.filter(arg => arg !== '--submit'), { key: process.env.INDEXNOW_KEY, submit: args.includes('--submit') });
    console.log(JSON.stringify({ time: new Date().toISOString(), ...result }, null, 2));
  } catch (error) {
    console.error(error.message.replaceAll(process.env.INDEXNOW_KEY || '___unset___', '[redacted]'));
    process.exitCode = 1;
  }
}
