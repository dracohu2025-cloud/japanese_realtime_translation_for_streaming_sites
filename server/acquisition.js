// 只保存已登录账户的首次可观察来源；不保存访客 ID、完整 URL、搜索词或浏览历史。
export const acquisitionSources = ['direct', 'google', 'bing', 'chatgpt', 'claude', 'perplexity', 'producthunt', 'alternativeto', 'community', 'referral', 'unknown'];
export function createAcquisition(database, { live, now = () => Date.now() }) {
  database.exec('CREATE TABLE IF NOT EXISTS kotoba_acquisition (user_id TEXT PRIMARY KEY, source TEXT NOT NULL, observed_at INTEGER NOT NULL)');
  const insert = database.prepare('INSERT OR IGNORE INTO kotoba_acquisition (user_id, source, observed_at) VALUES (?, ?, ?)');
  const rows = database.prepare(`SELECT u.id, u.createdAt, a.source, a.observed_at, b.state FROM user u LEFT JOIN kotoba_acquisition a ON a.user_id = u.id LEFT JOIN ${live ? 'kotoba_billing_live' : 'kotoba_billing'} b ON b.user_id = u.id WHERE u.emailVerified = 1 LIMIT 10001`);
  return {
    record(userId, source) {
      if (!acquisitionSources.includes(source)) return false;
      insert.run(userId, source, now()); return true;
    },
    report() {
      const entries = rows.all();
      if (entries.length > 10000) throw new Error('Report requires pagination');
      const groups = new Map();
      for (const row of entries) {
        const source = row.source || 'unattributed';
        const group = groups.get(source) || { source, verifiedAccounts: 0, trialClaimedAccounts: 0, accountsWithNetAudioUsage: 0, accountsWithPaidGrant: 0, accountsWithRetainedPaidGrant: 0, netAudioHours: 0 };
        group.verifiedAccounts++;
        const state = row.state ? JSON.parse(row.state) : { grants: [] };
        if (state.trialClaimed) group.trialClaimedAccounts++;
        const used = state.grants.reduce((sum, g) => sum + Math.max(0, g.usedSamples || 0), 0);
        if (used > 0) group.accountsWithNetAudioUsage++;
        group.netAudioHours += used / 16000 / 3600;
        const paid = state.grants.filter(g => g.kind !== 'trial' && g.paidAmount > 0);
        if (paid.length) group.accountsWithPaidGrant++;
        if (paid.some(g => !g.suspended && (g.refundedAmount || 0) < g.paidAmount)) group.accountsWithRetainedPaidGrant++;
        groups.set(source, group);
      }
      return { generatedAt: now(), scope: 'all-time verified-account snapshot', groups: [...groups.values()], definitions: {
        attribution: 'First observed source after login; client-reported and not independently verified. Existing accounts can be attributed after launch. Unattributed means no source was recorded.',
        usage: 'Net audio usage in the quota ledger, after compensation. Not proof of accurate captions, first successful translation, or provider cost.',
        paid: 'At least one paid grant issued from verified payment processing. Retained excludes fully refunded or suspended grants; expired grants still count as historical purchases.',
        limits: 'Not a visitor-to-payment funnel. No unique visitor, download/install, first-caption, or time-to-conversion measurement. Counts are per account, not per person; stages need not occur in order.',
      } };
    },
  };
}
