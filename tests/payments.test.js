import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import Stripe from 'stripe';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openPaymentStore } from '../server/payment-store.js';
import { createPayments } from '../server/payments.js';
import { requireTestKey } from '../server/payment-catalog.js';

const key = 'sk_test_unit_test_only';
const secret = 'whsec_unit_test_only';
async function fixture(mode = 'test') {
  const live = mode === 'live';
  const key = live ? 'sk_live_unit_test_only' : 'sk_test_unit_test_only';
  const path = join(await mkdtemp(join(tmpdir(), 'kotoba-payments-')), 'ledger.json');
  const store = await openPaymentStore(path);
  await store.transact(state => { state.customer = 'cus_owned'; });
  const metadata = { app: 'kotoba-billing-v1', instance: store.snapshot().instance };
  const now = Math.floor(Date.now() / 1000);
  const subscription = { id: 'sub_owned', customer: 'cus_owned', livemode: live, metadata, status: 'active', cancel_at_period_end: false };
  const invoice = { id: 'in_owned', customer: 'cus_owned', livemode: live, status: 'paid', currency: 'usd', amount_paid: 999,
    billing_reason: 'subscription_create', parent: { subscription_details: { subscription: 'sub_owned' } } };
  const line = { pricing: { price_details: { price: 'price_monthly' } }, quantity: 1, period: { start: now - 5, end: now + 86400 * 30 } };
  const checkout = { id: 'cs_topup', customer: 'cus_owned', livemode: live, metadata: { ...metadata, plan: 'topup' }, payment_status: 'paid', mode: 'payment', currency: 'usd', amount_total: 499 };
  checkout.payment_intent = live ? 'pi_topup' : undefined;
  const charges = {
    ch_pi_topup: { id: 'ch_pi_topup', payment_intent: 'pi_topup', customer: 'cus_owned', livemode: live, paid: true, currency: 'usd', amount: 499, amount_refunded: 0 },
    ch_pi_monthly: { id: 'ch_pi_monthly', payment_intent: 'pi_monthly', customer: 'cus_owned', livemode: live, paid: true, currency: 'usd', amount: 999, amount_refunded: 0 },
  };
  let disputeStatus = null;
  const checkoutCalls = [];
  const stripe = {
    webhooks: new Stripe(key).webhooks,
    charges: { retrieve: async id => charges[id] },
    disputes: { list: async () => ({ has_more: false, data: disputeStatus ? [{ status: disputeStatus }] : [] }) },
    paymentIntents: { retrieve: async id => ({ id, livemode: live, customer: 'cus_owned', status: 'succeeded', latest_charge: 'ch_' + id }) },
    ...(live ? { invoicePayments: { list: async () => ({ has_more: false, data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_monthly' } }] }) } } : {}),
    subscriptions: { retrieve: async () => subscription, update: async (_id, values) => Object.assign(subscription, values) },
    invoices: { retrieve: async () => invoice, listLineItems: async () => ({ data: [line], has_more: false }) },
    prices: { retrieve: async id => ({ livemode: live, active: true, currency: 'usd', unit_amount: id === 'price_monthly' ? 999 : 499,
      recurring: id === 'price_monthly' ? { interval: 'month', interval_count: 1 } : null }) },
    checkout: { sessions: { retrieve: async () => checkout,
      listLineItems: async () => ({ has_more: false, data: [{ price: { id: 'price_topup' }, quantity: 1 }] }),
      create: async (body, options) => { checkoutCalls.push({ body, options }); return { id: `cs_${checkoutCalls.length}`, livemode: live, url: 'https://checkout.stripe.com/c/pay/cs_test_example' }; },
    } },
  };
  const payments = createPayments({ stripe, key, webhookSecret: secret, store, prices: { monthly: 'price_monthly', topup: 'price_topup' }, mode, baseUrl: live ? 'https://kotoba.test' : 'http://127.0.0.1:8790' });
  const signed = (type, options = {}) => {
    const body = JSON.stringify({ id: `evt_${type}`, type, livemode: live, created: now, data: { object: { id: type.startsWith('invoice') ? invoice.id : checkout.id } }, ...options });
    return [Buffer.from(body), stripe.webhooks.generateTestHeaderString({ payload: body, secret })];
  };
  return { charges, setDispute: value => { disputeStatus = value; }, store, path, payments, stripe, invoice, line, checkout, subscription, checkoutCalls, signed };
}

test('支付测试拒绝 live 密钥、伪造签名和真实事件', async () => {
  assert.throws(() => requireTestKey('sk_live_not_allowed'));
  const f = await fixture();
  await assert.rejects(f.payments.webhook(Buffer.from('{}'), 'bad'));
  await assert.rejects(f.payments.webhook(...f.signed('invoice.paid', { livemode: true })));
  assert.equal((await f.payments.status()).seconds, 0);
});

test('并发领取试用只发放一次，重启后仍保留记录', async () => {
  const f = await fixture();
  await Promise.all([f.payments.trial(), f.payments.trial(), f.payments.trial()]);
  assert.equal((await f.payments.status()).seconds, 1200);
  const reopened = await openPaymentStore(f.path);
  assert.equal(reopened.snapshot().trialClaimed, true);
  assert.equal(reopened.snapshot().grants.length, 1);
});

test('月费按已付账单周期发放，重复事件和同周期不同账单不重复发放', async () => {
  const f = await fixture();
  await Promise.all([f.payments.webhook(...f.signed('invoice.paid')), f.payments.webhook(...f.signed('invoice.paid'))]);
  assert.equal((await f.payments.status()).seconds, 36000);
  f.invoice.id = 'in_duplicate_period';
  await f.payments.webhook(...f.signed('invoice.paid', { id: 'evt_different' }));
  assert.equal((await f.payments.status()).seconds, 36000);
  f.line.period.start += 86400 * 30; f.line.period.end += 86400 * 30;
  f.invoice.billing_reason = 'subscription_cycle';
  await f.payments.webhook(...f.signed('invoice.paid'));
  assert.equal(f.store.snapshot().grants.length, 2);
  assert.equal((await f.payments.status()).seconds, 36000, '未来周期不能提前使用');
});

test('外部客户、未付款、错误金额、错误价格都不会发放月度额度', async () => {
  const f = await fixture();
  f.invoice.customer = 'cus_other'; await f.payments.webhook(...f.signed('invoice.paid'));
  f.invoice.customer = 'cus_owned'; f.invoice.status = 'open'; await f.payments.webhook(...f.signed('invoice.paid'));
  f.invoice.status = 'paid'; f.invoice.amount_paid = 99; await f.payments.webhook(...f.signed('invoice.paid'));
  f.invoice.amount_paid = 999; f.line.pricing.price_details.price = 'price_other'; await f.payments.webhook(...f.signed('invoice.paid'));
  assert.equal((await f.payments.status()).seconds, 0);
});

test('加时包以支付对象去重，有效期为 90 天，未付与过期额度不生效', async () => {
  const f = await fixture();
  f.checkout.payment_status = 'unpaid'; await f.payments.webhook(...f.signed('checkout.session.completed'));
  assert.equal((await f.payments.status()).seconds, 0);
  f.checkout.payment_status = 'paid';
  await f.payments.webhook(...f.signed('checkout.session.completed'));
  await f.payments.webhook(...f.signed('checkout.session.async_payment_succeeded', { id: 'evt_other' }));
  assert.equal((await f.payments.status()).seconds, 18000);
  const grant = f.store.snapshot().grants[0];
  assert.equal(grant.expiresAt - grant.startsAt, 90 * 86400000);
  await f.store.transact(state => { state.grants[0].expiresAt = Date.now() - 1; });
  assert.equal((await f.payments.status()).seconds, 0);
});

test('订阅 Checkout 不发月度额度；取消续订保留已付额度且阻止重复订阅', async () => {
  const f = await fixture();
  Object.assign(f.checkout, { mode: 'subscription', subscription: 'sub_owned' });
  await f.payments.webhook(...f.signed('checkout.session.completed'));
  assert.equal((await f.payments.status()).seconds, 0);
  await assert.rejects(f.payments.checkout('monthly'));
  await f.payments.webhook(...f.signed('invoice.paid'));
  await f.payments.cancel();
  assert.equal((await f.payments.status()).subscription.cancelAtPeriodEnd, true);
  assert.equal((await f.payments.status()).seconds, 36000);
});

test('服务端锁定价格，连续加购使用不同的 Stripe 幂等键', async () => {
  const f = await fixture();
  await assert.rejects(f.payments.checkout('unknown'));
  await f.payments.checkout('topup');
  await f.store.transact(state => { state.checkout = null; });
  await f.payments.checkout('topup');
  assert.notEqual(f.checkoutCalls[0].options.idempotencyKey, f.checkoutCalls[1].options.idempotencyKey);
  assert.deepEqual(f.checkoutCalls[0].body.line_items, [{ price: 'price_topup', quantity: 1 }]);
  assert.deepEqual(f.checkoutCalls[0].body.adaptive_pricing, { enabled: false });
});

test('Stripe 查询暂时失败不发额度，重试恢复后正常发放', async () => {
  const f = await fixture();
  f.stripe.invoices.retrieve = async () => { throw new Error('transient upstream error'); };
  await assert.rejects(f.payments.webhook(...f.signed('invoice.paid')));
  assert.equal((await f.payments.status()).seconds, 0);
  f.stripe.invoices.retrieve = async () => f.invoice;
  await f.payments.webhook(...f.signed('invoice.paid'));
  assert.equal((await f.payments.status()).seconds, 36000);
});

test('支付 HTTP 接口要求本机授权，回调验签，页面返回参数不发放额度', async t => {
  const f = await fixture();
  const config = { ...loadConfig({}), port: 0 };
  const app = createApp(config, undefined, f.payments);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  config.port = app.server.address().port;
  t.after(() => app.close());
  const base = `http://127.0.0.1:${config.port}`;
  assert.equal((await fetch(`${base}/api/payments`)).status, 401);
  assert.equal((await fetch(`${base}/api/payments/trial`, { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/api/payments/webhook`, { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await fetch(`${base}/pricing?checkout=returned`)).status, 200);
  assert.equal((await f.payments.status()).seconds, 0);
  const [body, signature] = f.signed('invoice.paid');
  assert.equal((await fetch(`${base}/api/payments/webhook`, { method: 'POST', body, headers: { 'Stripe-Signature': signature } })).status, 200);
  const status = await (await fetch(`${base}/api/payments`, { headers: { Authorization: `Bearer ${config.token}` } })).json();
  assert.equal(status.seconds, 36000);
  assert.equal(status.testMode, true);
});

test('正式支付接受匹配模式，拒绝测试回调；部分退款与重复回调不产生负额度', async () => {
  const f = await fixture('live');
  await assert.rejects(f.payments.webhook(...f.signed('invoice.paid', { livemode: false })));
  await f.payments.webhook(...f.signed('checkout.session.completed'));
  assert.equal((await f.payments.status()).testMode, false);
  await f.store.transact(state => { state.grants[0].usedSamples = 1000 * 16000; });
  f.charges.ch_pi_topup.amount_refunded = 250;
  const event = f.signed('charge.refunded', { data: { object: { id: 'ch_pi_topup' } } });
  await f.payments.webhook(...event);
  const remaining = (await f.payments.status()).seconds;
  assert(remaining > 7000 && remaining < 8100);
  await f.payments.webhook(...event);
  assert.equal((await f.payments.status()).seconds, remaining);
  f.charges.ch_pi_topup.amount_refunded = 499;
  await f.payments.webhook(...event);
  assert.equal((await f.payments.status()).seconds, 0);
});
test('退款先于付款回调不会恢复额度；争议冻结及胜诉只恢复未退款部分', async () => {
  const f = await fixture('live');
  f.charges.ch_pi_topup.amount_refunded = 100;
  await f.payments.webhook(...f.signed('charge.refunded', { data: { object: { id: 'ch_pi_topup' } } }));
  await f.payments.webhook(...f.signed('checkout.session.completed'));
  const remaining = (await f.payments.status()).seconds;
  f.setDispute('needs_response');
  const event = f.signed('charge.dispute.created', { data: { object: { charge: 'ch_pi_topup' } } });
  await f.payments.webhook(...event);
  assert.equal((await f.payments.status()).seconds, 0);
  f.setDispute('won');
  await f.payments.webhook(...event);
  assert.equal((await f.payments.status()).seconds, remaining);
});
test('正式月费记录付款关联，月底取消保留有效额度', async () => {
  const f = await fixture('live');
  await f.payments.webhook(...f.signed('invoice.paid'));
  assert.equal(f.store.snapshot().grants[0].paymentIntent, 'pi_monthly');
  await f.payments.cancel();
  assert.equal((await f.payments.status()).seconds, 36000);
});

test('首次月费回调丢失时，主动对账在一次操作内恢复订阅与额度', async () => {
  const f = await fixture('live');
  Object.assign(f.checkout, { status: 'complete', mode: 'subscription', subscription: 'sub_owned', created: Math.floor(Date.now() / 1000) });
  await f.store.transact(state => { state.checkout = { id: f.checkout.id, plan: 'monthly' }; });
  f.stripe.invoices.list = async () => ({ data: [f.invoice], has_more: false });
  await f.payments.reconcile();
  assert.equal((await f.payments.status()).seconds, 36000);
  assert.equal(f.store.snapshot().checkout, null);
  await f.payments.reconcile();
  assert.equal(f.store.snapshot().grants.length, 1);
});

test('并发退款回调等待前一个状态读取完成，最终额度采用最新退款金额', async () => {
  const f = await fixture('live');
  await f.payments.webhook(...f.signed('checkout.session.completed'));
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const firstRead = new Promise(resolve => { started = resolve; });
  let calls = 0;
  f.stripe.charges.retrieve = async id => {
    const charge = structuredClone(f.charges[id]);
    if (++calls === 1) { started(); await gate; }
    return charge;
  };
  const event = { livemode: true, type: 'charge.refunded', data: { object: { id: 'ch_pi_topup' } } };
  const first = f.payments.applyEvent(event);
  await firstRead;
  f.charges.ch_pi_topup.amount_refunded = 499;
  const second = f.payments.applyEvent(event);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  release(); await Promise.all([first, second]);
  assert.equal((await f.payments.status()).seconds, 0);
});
