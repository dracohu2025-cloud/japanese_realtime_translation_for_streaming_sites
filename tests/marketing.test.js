import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createMarketing } from '../cloud/marketing.js';

test('每日汇总仅接受枚举，保留90个UTC日，过期数据清理', async () => {
  let stamp = Date.parse('2026-09-09T23:59:00Z');
  const database = new DatabaseSync(':memory:');
  database.transactionSync = fn => { database.exec('BEGIN'); try { const value = fn(); database.exec('COMMIT'); return value; } catch (error) { database.exec('ROLLBACK'); throw error; } };
  const metrics = createMarketing(database, () => stamp);
  for (const input of [null, {}, {event:'video_play',locale:'fr'}, {event:'video_play',locale:'en',user:'x'}]) assert.equal(await metrics.record(input), false);
  await metrics.record({event:'video_play',locale:'en'});
  stamp += 120_000;
  await metrics.record({event:'download_click',locale:'zh-CN'});
  assert.equal(Object.keys((await metrics.report()).daily).length, 2);
  stamp = Date.parse('2026-12-08T00:00:00Z');
  const report = await metrics.report();
  assert.deepEqual(Object.keys(report.daily), ['2026-09-10']);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM kotoba_marketing_daily').get().total, 1);
  database.close();
});
