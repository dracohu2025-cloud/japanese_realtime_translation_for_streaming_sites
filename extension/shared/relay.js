export const cloudRelay = 'wss://kotoba-beta.dracohu2025.workers.dev/stream';
export function validateRelay(value) {
  const url = new URL(value);
  const local = url.protocol === 'ws:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if ((!local && url.href !== cloudRelay) || url.pathname !== '/stream' || url.search || url.hash || url.username || url.password) throw new Error('请使用本机服务地址或 Kotoba 线上内测页面提供的服务地址');
  return url.href;
}
