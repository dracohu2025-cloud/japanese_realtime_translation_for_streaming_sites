import { AppError } from './config.js';

export const SAMPLE_RATE = 16_000;
const priority = { monthly: 0, monthpass: 0, trial: 1, topup: 2 };
export const remainingSamples = grant => {
  if (grant.suspended) return 0;
  const samples = Math.round(grant.seconds * SAMPLE_RATE);
  const revoked = grant.paidAmount ? Math.ceil(samples * (grant.refundedAmount || 0) / grant.paidAmount) : 0;
  return Math.max(0, samples - revoked - (grant.usedSamples || 0));
};
export const activeGrants = (state, now) => state.grants.filter(g => g.startsAt <= now && (!g.expiresAt || g.expiresAt > now));
export const balanceSamples = (state, now) => activeGrants(state, now).reduce((sum, g) => sum + remainingSamples(g), 0);

function restoreUnprocessed(state, session, confirmedSamples = 0) {
  if (session.compensatedSamples !== undefined) return;
  let remaining = Math.max(0, session.samples - Math.max(0, Math.min(session.samples, confirmedSamples)));
  const missing = remaining;
  for (const debit of [...(session.debits || [])].reverse()) {
    const grant = state.grants.find(g => g.id === debit.grant);
    const restore = Math.min(remaining, debit.samples, grant?.usedSamples || 0);
    if (grant) grant.usedSamples -= restore;
    remaining -= restore;
    if (!remaining) break;
  }
  session.compensatedSamples = missing - remaining;
}

// 单账户协调：同一账户只允许一个音频源，所有扣时复用支付账本的串行事务。
export function createQuota(store, now = () => Date.now()) {
  let active = null;
  return {
    async start(id) {
      if (active) throw new AppError('SESSION_ACTIVE', '此账户已有翻译正在进行，请先停止另一处翻译', 409);
      active = id;
      try {
        await store.transact(state => {
          for (const previous of state.audioSessions || []) if (!previous.endedAt) {
            restoreUnprocessed(state, previous, previous.confirmedSamples);
            previous.endedAt = now(); previous.recovered = true;
          }
          if (!balanceSamples(state, now())) throw new AppError('QUOTA_EXHAUSTED', '翻译时长已用完，请先领取试用或购买时长', 402);
          state.audioSessions ||= [];
          state.audioSessions.push({ id, samples: 0, lastSequence: -1, startedAt: now() });
          state.audioSessions = state.audioSessions.slice(-100);
        });
      } catch (error) { if (active === id) active = null; throw error; }
    },
    async write(id, sequence, audio, forward, confirmedSamples) {
      if (!Buffer.isBuffer(audio) || !audio.length || audio.length % 2 || audio.length > 16_000 || !Number.isSafeInteger(sequence) || sequence < 0) {
        throw new AppError('BAD_AUDIO', '音频格式异常');
      }
      return store.transact(state => {
        const timestamp = now();
        if (active !== id) throw new AppError('SESSION_CLOSED', '翻译会话已结束');
        const session = state.audioSessions?.find(s => s.id === id);
        if (!session || session.endedAt) throw new AppError('SESSION_CLOSED', '翻译会话已结束');
        // 相同序号的内部重试既不重复转发，也不重复扣时；用户回放是新的音频帧。
        if (sequence <= session.lastSequence) return { duplicate: true, remainingSeconds: balanceSamples(state, now()) / SAMPLE_RATE };
        if (sequence !== session.lastSequence + 1) throw new AppError('AUDIO_SEQUENCE', '音频序号不连续');
        const count = Math.min(audio.length / 2, balanceSamples(state, timestamp));
        if (!count) return { acceptedSamples: 0, remainingSeconds: 0, exhausted: true };
        const grants = activeGrants(state, timestamp).sort((a, b) => priority[a.kind] - priority[b.kind] || (a.expiresAt || Infinity) - (b.expiresAt || Infinity));
        let needed = count;
        for (const grant of grants) {
          const debit = Math.min(needed, remainingSamples(grant));
          grant.usedSamples = (grant.usedSamples || 0) + debit;
          if (debit) {
            session.debits ||= [];
            const last = session.debits.at(-1);
            if (last?.grant === grant.id) last.samples += debit;
            else session.debits.push({ grant: grant.id, samples: debit });
          }
          needed -= debit;
          if (!needed) break;
        }
        // 仅本地上游写入队列接受后保存账本；同步失败会回滚整个草稿。
        // 不代表 Soniox 已确认处理，供应商结算仍是独立的成本账。
        if (forward(audio.subarray(0, count * 2)) === false) throw new AppError('UPSTREAM_CLOSED', '语音服务未接收音频，本帧未扣时', 502);
        session.samples += count;
        if (Number.isFinite(confirmedSamples)) session.confirmedSamples = Math.max(session.confirmedSamples || 0, Math.min(session.samples, confirmedSamples));
        session.lastSequence = sequence;
        const remainingSeconds = balanceSamples(state, timestamp) / SAMPLE_RATE;
        return { acceptedSamples: count, remainingSeconds, exhausted: remainingSeconds === 0 };
      });
    },
    async stop(id, { compensate = false, confirmedSamples = 0 } = {}) {
      if (active !== id) return;
      try {
        await store.transact(state => {
          const session = state.audioSessions?.find(s => s.id === id);
          if (session) { if (compensate) restoreUnprocessed(state, session, confirmedSamples); session.endedAt = now(); }
        });
      } finally { if (active === id) active = null; }
    },
  };
}
