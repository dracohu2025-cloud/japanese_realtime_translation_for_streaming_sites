import { AppError } from './config.js';

export async function queryUsage(config, references, fetcher = fetch, now = Date.now()) {
  if (!Array.isArray(references) || !references.length || references.length > 200 || references.some(r =>
    !/^[a-f0-9-]{36}$/.test(r.id || '') || !Number.isFinite(r.startedAt) || r.startedAt > now + 60_000)) {
    throw new AppError('BAD_USAGE', '费用查询参数无效');
  }
  const start = Math.min(...references.map(r => r.startedAt)) - 60_000;
  if (now - start > 30 * 86400_000) throw new AppError('USAGE_EXPIRED', '本次记录超过 30 天，请到 Soniox 控制台核对');
  const wanted = new Set(references.map(r => `kotoba:${r.id}`));
  const found = new Set();
  const seen = new Set();
  let amount = 0n;
  let cursor;
  const signal = AbortSignal.timeout(15_000);
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.soniox.com/v1/usage-logs');
    url.search = new URLSearchParams({ start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(), limit: '1000', sort: 'end_time_desc', ...(cursor ? { cursor } : {}) });
    let response;
    try { response = await fetcher(url, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal }); }
    catch { throw new AppError('USAGE_NETWORK', '费用查询超时或网络异常；金额未知，请稍后重试'); }
    if (!response.ok) throw new AppError('USAGE_FAILED', `Soniox 费用查询失败（HTTP ${response.status}），请检查密钥权限`);
    const data = await response.json();
    if (!Array.isArray(data.usage_logs)) throw new AppError('USAGE_FORMAT', '费用记录格式异常，暂时无法确认金额');
    for (const row of data.usage_logs) {
      if (!wanted.has(row.client_reference_id) || seen.has(row.uuid)) continue;
      if (!row.uuid || !/^\d+(\.\d{1,10})?$/.test(row.cost_usd)) throw new AppError('USAGE_FORMAT', '费用金额格式异常');
      const [whole, fraction = ''] = row.cost_usd.split('.');
      amount += BigInt(whole) * 10_000_000_000n + BigInt(fraction.padEnd(10, '0'));
      seen.add(row.uuid); found.add(row.client_reference_id);
    }
    cursor = data.next_page_cursor;
    if (!cursor) return { actualUsd: found.size ? `${amount / 10_000_000_000n}.${String(amount % 10_000_000_000n).padStart(10, '0')}` : null, reported: found.size, total: wanted.size, checkedAt: now };
  }
  throw new AppError('USAGE_LIMIT', '费用记录较多，查询未完整完成；请在 Soniox 控制台核对');
}
