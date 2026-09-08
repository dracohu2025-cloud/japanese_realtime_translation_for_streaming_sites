import { cloudRelay } from './relay.js';

// 只读查询复用账户连接码；不启动音频会话，也不占用账户的翻译锁。
export function fetchBalance(relayUrl, token, Socket = WebSocket) {
  if (!token) return Promise.reject(new Error('请先保存账户连接码，即可查看剩余时长。'));
  if (relayUrl !== cloudRelay) return Promise.reject(new Error('当前使用自定义连接，在线账户余额请到账户页查看。'));
  return new Promise((resolve, reject) => {
    const socket = new Socket(cloudRelay);
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer);
      socket.onclose = null; socket.onerror = null; socket.onmessage = null;
      socket.close();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('余额查询超时，请稍后刷新。')), 10_000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'balance', token }));
    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'balance' && Number.isFinite(data.remainingSeconds) && data.remainingSeconds >= 0) finish(null, data.remainingSeconds);
        else finish(Object.assign(new Error(data.code === 'LOGIN_REQUIRED' ? '连接码已失效，请重新获取并保存。' : '暂时无法查询余额，请稍后刷新。'), { code: data.code }));
      } catch { finish(new Error('暂时无法查询余额，请稍后刷新。')); }
    };
    socket.onerror = () => finish(new Error('暂时无法连接，请检查网络后刷新。'));
    socket.onclose = () => finish(new Error('余额查询中断，请稍后刷新。'));
  });
}
