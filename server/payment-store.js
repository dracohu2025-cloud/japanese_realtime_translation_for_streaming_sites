import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

// 仅供单进程、本机支付内测；云端多用户版本必须迁移到事务数据库。
export async function openPaymentStore(path) {
  let state;
  try { state = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { version: 1, instance: randomUUID(), customer: null, subscription: null, checkout: null, trialClaimed: false, grants: [] };
  }
  if (state.version !== 1 || !Array.isArray(state.grants)) throw new Error('支付测试账本格式不支持');
  let queue = Promise.resolve();
  return {
    snapshot: () => structuredClone(state),
    transact(fn) {
      const job = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await fn(draft);
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(draft, null, 2), { mode: 0o600 });
        await rename(temporary, path);
        state = draft;
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}

export function grantOnce(state, grant) {
  if (state.grants.some(item => item.id === grant.id)) return false;
  state.grants.push(grant);
  return true;
}
