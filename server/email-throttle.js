import { createHash } from 'node:crypto';

// 与验证码分开保存，只存邮箱哈希和计数；重启不能绕过发送限频。
export function createEmailThrottle(database, now = () => Date.now()) {
  database.exec('CREATE TABLE IF NOT EXISTS kotoba_email_limits (key TEXT PRIMARY KEY, last_at INTEGER NOT NULL, window_at INTEGER NOT NULL, count INTEGER NOT NULL)');
  const read = database.prepare('SELECT * FROM kotoba_email_limits WHERE key = ?');
  const save = database.prepare('INSERT INTO kotoba_email_limits (key, last_at, window_at, count) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET last_at=excluded.last_at, window_at=excluded.window_at, count=excluded.count');
  return email => {
    const timestamp = now(), hour = 3600_000;
    const rules = [{ key: createHash('sha256').update(email.toLowerCase()).digest('hex'), max: 5, cooldown: 60_000 }, { key: 'global', max: 100, cooldown: 0 }];
    const reserve = () => {
      const values = rules.map(rule => {
        const row = read.get(rule.key);
        const current = row && timestamp - row.window_at < hour ? row : { last_at: 0, window_at: timestamp, count: 0 };
        const wait = Math.max(row ? row.last_at + rule.cooldown - timestamp : 0, current.count >= rule.max ? current.window_at + hour - timestamp : 0);
        return { ...rule, ...current, wait };
      });
      const wait = Math.max(0, ...values.map(value => value.wait));
      if (!wait) {
        for (const value of values) save.run(value.key, timestamp, value.window_at, value.count + 1);
        database.prepare('DELETE FROM kotoba_email_limits WHERE last_at < ?').run(timestamp - 24 * hour);
      }
      return Math.ceil(wait / 1000);
    };
    if (database.transactionSync) return database.transactionSync(reserve);
    database.exec('BEGIN IMMEDIATE');
    try { const result = reserve(); database.exec('COMMIT'); return result; }
    catch (error) { database.exec('ROLLBACK'); throw error; }
  };
}
