import { randomUUID } from 'node:crypto';
import { createPayments } from './payments.js';
import { createQuota } from './quota.js';
import { requirePaymentMode } from './payment-catalog.js';

// 新的本机多账户内测数据库；不迁移或认领旧的共用测试余额。
export function createAccountPayments({ database, stripe, key, webhookSecret, prices, legacyPrices = {}, baseUrl, mode = 'test' }) {
  const live = requirePaymentMode(key, mode);
  const table = live ? 'kotoba_billing_live' : 'kotoba_billing';
  database.exec('CREATE TABLE IF NOT EXISTS ' + table + ' (user_id TEXT PRIMARY KEY, state TEXT NOT NULL)');
  const get = database.prepare('SELECT state FROM ' + table + ' WHERE user_id = ?');
  const insert = database.prepare('INSERT OR IGNORE INTO ' + table + ' (user_id, state) VALUES (?, ?)');
  const save = database.prepare('UPDATE ' + table + ' SET state = ? WHERE user_id = ? AND state = ?');
  const services = new Map();
  return {
    forUser(userId) {
      if (typeof userId !== 'string' || !userId) throw new Error('缺少账户标识');
      if (services.has(userId)) return services.get(userId);
      insert.run(userId, JSON.stringify({ version: 1, instance: randomUUID(), customer: null, subscription: null, checkout: null, trialClaimed: false, grants: [] }));
      let queue = Promise.resolve();
      const store = {
        snapshot: () => JSON.parse(get.get(userId).state),
        transact(fn) {
          const job = queue.then(async () => {
            const previous = get.get(userId).state;
            const draft = JSON.parse(previous);
            const result = await fn(draft);
            if (save.run(JSON.stringify(draft), userId, previous).changes !== 1) throw new Error('账本被其他进程修改，请停止多进程运行');
            return result;
          });
          queue = job.catch(() => {});
          return job;
        },
      };
      const service = { payments: createPayments({ stripe, key, webhookSecret, prices, legacyPrices, baseUrl, store, mode }), quota: createQuota(store), store };
      services.set(userId, service);
      return service;
    },
    async webhook(body, signature) {
      const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      if (event.livemode !== live) throw new Error('支付事件环境不匹配');
      const object = event.data.object;
      let value = object.customer;
      if (event.type.startsWith('charge.dispute.') || event.type.startsWith('refund.')) {
        const charge = await stripe.charges.retrieve(typeof object.charge === 'string' ? object.charge : object.charge?.id);
        if (charge.livemode !== live) throw new Error('支付事件环境不匹配');
        value = charge.customer;
      }
      const customer = typeof value === 'string' ? value : value?.id;
      if (!customer) return;
      const row = database.prepare("SELECT user_id FROM " + table + " WHERE json_extract(state, '$.customer') = ?").get(customer);
      if (row) await this.forUser(row.user_id).payments.webhook(body, signature);
    },
  };
}
