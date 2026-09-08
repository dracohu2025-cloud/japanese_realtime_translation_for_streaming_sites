import { createHmac } from 'node:crypto';
import { AppError } from '../server/config.js';

// 计数持久化，IP 仅保存带密钥的摘要；实例重建不会重置限额。
export function publicAccess(database, env, now = () => Date.now()) {
  database.exec('CREATE TABLE IF NOT EXISTS kotoba_public_limits (key TEXT PRIMARY KEY, until_at INTEGER NOT NULL, count INTEGER NOT NULL)');
  return {
    reserve(request, action, maximum, windowMs) {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) throw new AppError('FORBIDDEN', '无法验证请求来源', 403);
      const key = createHmac('sha256', env.BETTER_AUTH_SECRET).update(action + ':' + ip).digest('hex');
      database.transactionSync(() => {
        const stamp = now();
        const old = database.prepare('SELECT * FROM kotoba_public_limits WHERE key = ?').get(key);
        const current = old && old.until_at > stamp ? old : { count: 0, until_at: stamp + windowMs };
        if (current.count >= maximum) throw new AppError('RATE_LIMIT', '操作频繁，请稍后重试。', 429);
        database.prepare('INSERT INTO kotoba_public_limits (key, until_at, count) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET until_at=excluded.until_at, count=excluded.count').run(key, current.until_at, current.count + 1);
        database.prepare('DELETE FROM kotoba_public_limits WHERE until_at <= ?').run(stamp);
      });
    },
    async verify(request, token) {
      if (typeof token !== 'string' || !token || token.length > 2048) throw new AppError('CHALLENGE', '请先完成人机验证。', 400);
      let data;
      try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.headers.get('CF-Connecting-IP') }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error();
        data = await response.json();
      } catch { throw new AppError('CHALLENGE', '人机验证暂时不可用，请稍后重试。', 503); }
      if (!data.success || data.hostname !== new URL(env.PUBLIC_ORIGIN).hostname || data.action !== 'login') throw new AppError('CHALLENGE', '人机验证已过期，请重试。', 400);
    },
  };
}
