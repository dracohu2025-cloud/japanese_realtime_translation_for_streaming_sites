import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { queryUsage } from '../server/usage.js';
import { validateStart } from '../server/config.js';
import { estimateBilling, countTokenCharacters } from '../extension/shared/billing.js';

test('语言白名单接受英文、韩文等目标，拒绝未支持的代码', () => {
  assert.equal(validateStart({ type: 'start', token: 'x', targetLanguage: 'en' }).targetLanguage, 'en');
  assert.throws(() => validateStart({ type: 'start', token: 'x', targetLanguage: 'zh-TW' }));
});

test('费用估算累计多段、暂停冻结、临时文本修订不重复累计', () => {
  const segment = { model: 'stt-rt-v5', startedAt: 1000, endedAt: 3601000, audioSeconds: 3600, finalChars: 0, partialChars: 0, inputChars: 0 };
  countTokenCharacters(segment, [{ text: '测试', is_final: false }]);
  countTokenCharacters(segment, [{ text: '测试内容', is_final: false }]);
  assert.equal(segment.partialChars, 4);
  countTokenCharacters(segment, [{ text: '测试内容', is_final: true }, { text: '<end>', is_final: true }]);
  assert.equal(segment.finalChars, 4);
  assert.equal(segment.partialChars, 0);
  assert.equal(estimateBilling([segment], 8000000), estimateBilling([segment], 9000000));
  assert(Math.abs(estimateBilling([segment]) - .0600048) < 1e-10);
  assert.equal(estimateBilling([segment, segment]), estimateBilling([segment]) * 2);
  assert.equal(estimateBilling([{ ...segment, model: 'unknown' }]), null);
});

test('真实费用翻页匹配会话编号、按 UUID 去重、使用精确十进制求和', async () => {
  const id = randomUUID();
  const now = Date.now();
  const rows = [{ uuid: 'a', client_reference_id: `kotoba:${id}`, cost_usd: '0.0000000001' }, { uuid: 'b', client_reference_id: `kotoba:${id}`, cost_usd: '0.1000000000' }];
  let page = 0;
  const result = await queryUsage({ apiKey: 'fake' }, [{ id, startedAt: now - 10000 }, { id: randomUUID(), startedAt: now - 5000 }], async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fake');
    if (page++) assert.equal(url.searchParams.get('cursor'), 'next');
    return { ok: true, json: async () => page === 1 ? { usage_logs: [rows[0], { uuid: 'other', client_reference_id: 'unrelated', cost_usd: '99' }], next_page_cursor: 'next' } : { usage_logs: rows } };
  }, now);
  assert.equal(result.actualUsd, '0.1000000001');
  assert.equal(result.reported, 1);
  assert.equal(result.total, 2);
});

test('未归账不是零，查询错误与超出范围不会伪装成成功', async () => {
  const refs = [{ id: randomUUID(), startedAt: Date.now() - 10000 }];
  const result = await queryUsage({}, refs, async () => ({ ok: true, json: async () => ({ usage_logs: [] }) }));
  assert.equal(result.actualUsd, null);
  await assert.rejects(queryUsage({}, refs, async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(queryUsage({}, [{ ...refs[0], startedAt: Date.now() - 32 * 86400000 }]), /30 天/);
  await assert.rejects(queryUsage({}, refs, async () => ({ ok: true, json: async () => ({ usage_logs: [], next_page_cursor: 'more' }) })), /未完整完成/);
});
