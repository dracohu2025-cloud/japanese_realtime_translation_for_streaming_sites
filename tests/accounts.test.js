import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import Stripe from 'stripe';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { createAccounts } from '../server/accounts.js';
import { createAccountPayments } from '../server/account-payments.js';
import { createQuota, balanceSamples } from '../server/quota.js';

const key = 'sk_test_accounts_unit_only', secret = 'whsec_accounts_unit_only';
async function fixture(t, authOptions = {}) {
  const database = new DatabaseSync(':memory:');
  let written = 0, providerConnections = 0;
  const stripe = { webhooks: new Stripe(key).webhooks };
  const accounts = {};
  const config = { ...loadConfig({ SONIOX_API_KEY: 'fake', RELAY_TOKEN: 'legacy-token-is-not-an-account' }), port: 0 };
  const app = createApp(config, () => { providerConnections++; return { ready: Promise.resolve(), write(raw) { written += raw.length; return true; }, finish() {}, close() {} }; }, null, accounts);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening'); config.port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${config.port}`;
  const billing = createAccountPayments({ database, stripe, key, webhookSecret: secret, baseUrl, prices: { monthly: 'price_monthly', topup: 'price_topup' } });
  Object.assign(accounts, await createAccounts({ database, baseUrl, secret: 'only-for-automated-tests-long-secret-123', billing, developmentInbox: true, initialize: true, ...authOptions }));
  t.after(async () => { await app.close(); database.close(); });
  async function request(path, body, cookie = '', extraHeaders = {}) {
    return fetch(baseUrl + path, { method: body ? 'POST' : 'GET', headers: { Origin: baseUrl, Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function login(email) {
    const sent = await request('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    assert.equal(sent.status, 200);
    const { otp } = accounts.readTestCode(email);
    const response = await request('/api/auth/sign-in/email-otp', { email, otp });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const body = await response.json();
    return { cookie, userId: body.user.id, otp };
  }
  async function socket(token) {
    const ws = new WebSocket(baseUrl.replace('http', 'ws') + '/stream', { origin: baseUrl });
    const messages = []; ws.on('message', raw => messages.push(JSON.parse(raw.toString())));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'start', token, targetLanguage: 'zh', terms: [] }));
    t.after(() => ws.terminate());
    return { ws, messages };
  }
  return { database, billing, accounts, request, login, socket, stripe, config, written: () => written, connections: () => providerConnections };
}
async function until(fn) {
  for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('等待测试条件超时');
}

test('邮箱验证码建立真实会话，验证码只用一次，账户额度相互隔离', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/payments')).status, 401);
  assert.equal((await f.request('/api/setup')).status, 401);
  const alice = await f.login('alice@kotoba.test');
  const bob = await f.login('bob@kotoba.test');
  const replay = await f.request('/api/auth/sign-in/email-otp', { email: 'alice@kotoba.test', otp: alice.otp });
  assert.notEqual(replay.status, 200);
  assert.equal((await f.request('/api/payments/trial', {}, alice.cookie)).status, 200);
  assert.equal((await (await f.request('/api/payments', undefined, alice.cookie)).json()).seconds, 1200);
  assert.equal((await (await f.request('/api/payments', undefined, bob.cookie)).json()).seconds, 0);
  assert.equal((await f.request('/api/payments/trial', {}, bob.cookie, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/api/auth/sign-out', {}, bob.cookie, { Origin: 'https://evil.example' })).status, 403);
  const stored = f.database.prepare('SELECT value FROM verification').all();
  assert(!JSON.stringify(stored).includes(alice.otp), '验证码不以明文保存到数据库');
});

test('登录码错误次数受限，测试邮箱不能冒充真实邮箱，测试收件箱禁止混入真实认证', async t => {
  const f = await fixture(t);
  assert.notEqual((await f.request('/api/auth/email-otp/send-verification-otp', { email: 'alice@example.com', type: 'sign-in' })).status, 200);
  await f.request('/api/auth/email-otp/send-verification-otp', { email: 'attempt@kotoba.test', type: 'sign-in' });
  const { otp } = f.accounts.readTestCode('attempt@kotoba.test');
  const wrong = otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 3; i++) assert.notEqual((await f.request('/api/auth/sign-in/email-otp', { email: 'attempt@kotoba.test', otp: wrong })).status, 200);
  assert.notEqual((await f.request('/api/auth/sign-in/email-otp', { email: 'attempt@kotoba.test', otp })).status, 200);
  await assert.rejects(createAccounts({ database: f.database, baseUrl: 'https://example.com', developmentInbox: true }));
  await assert.rejects(createAccounts({ database: f.database, baseUrl: 'http://127.0.0.1:8791', developmentInbox: true, google: {} }));
});

test('账户连接码与登录会话绑定，退出后失效，旧的共用配对码无法绕过', async t => {
  const f = await fixture(t), alice = await f.login('token@kotoba.test');
  const connection = await (await f.request('/api/account/connection', {}, alice.cookie)).json();
  assert.equal(f.accounts.authenticateStream(connection.token), f.billing.forUser(alice.userId));
  assert.throws(() => f.accounts.authenticateStream(f.config.token));
  await f.request('/api/auth/sign-out', {}, alice.cookie);
  assert.throws(() => f.accounts.authenticateStream(connection.token));
  assert.equal((await f.request('/api/payments', undefined, alice.cookie)).status, 401);
});

test('连接码仅存哈希，认证实例重建后保留，凭据和会话到期仍会失效', async t => {
  const f = await fixture(t), alice = await f.login('restart@kotoba.test');
  const issue = async () => (await f.request('/api/account/connection', {}, alice.cookie)).json();
  const connection = await issue();
  const hash = createHash('sha256').update(connection.token).digest('hex');
  const rows = f.database.prepare('SELECT * FROM kotoba_connection_tokens').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hash, hash);
  assert(!JSON.stringify(rows).includes(connection.token));
  assert(connection.expiresAt > Date.now() + 3590_000 && connection.expiresAt <= Date.now() + 3600_000);
  const restored = await createAccounts({ database: f.database, baseUrl: `http://127.0.0.1:${f.config.port}`,
    secret: 'only-for-automated-tests-long-secret-123', billing: f.billing, developmentInbox: true });
  assert.equal(restored.authenticateStream(connection.token), f.billing.forUser(alice.userId));
  f.database.prepare('UPDATE kotoba_connection_tokens SET expiresAt = ? WHERE hash = ?').run(Date.now() - 1, hash);
  assert.throws(() => restored.authenticateStream(connection.token), { code: 'LOGIN_REQUIRED' });
  const next = await issue();
  assert.equal(f.database.prepare('SELECT COUNT(*) AS count FROM kotoba_connection_tokens').get().count, 1, '重新签发清理已过期凭据');
  f.database.prepare('UPDATE session SET expiresAt = ? WHERE userId = ?').run(Date.now() - 1, alice.userId);
  assert.throws(() => restored.authenticateStream(next.token), { code: 'LOGIN_REQUIRED' });
});

test('Stripe 签名事件按客户路由，只给所属用户加时，重复事件不会加倍', async t => {
  const f = await fixture(t);
  const alice = f.billing.forUser('payment-alice'), bob = f.billing.forUser('payment-bob');
  await alice.store.transact(s => { s.customer = 'cus_alice'; });
  await bob.store.transact(s => { s.customer = 'cus_bob'; });
  const checkout = { id: 'cs_alice', customer: 'cus_alice', livemode: false, payment_status: 'paid', mode: 'payment', currency: 'usd', amount_total: 499, metadata: { app: 'kotoba-billing-v1', instance: alice.store.snapshot().instance, plan: 'topup' } };
  f.stripe.checkout = { sessions: { retrieve: async () => checkout, listLineItems: async () => ({ has_more: false, data: [{ price: 'price_topup', quantity: 1 }] }) } };
  const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', livemode: false, created: Math.floor(Date.now() / 1000), data: { object: checkout } });
  const signature = f.stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  await Promise.all([f.billing.webhook(Buffer.from(body), signature), f.billing.webhook(Buffer.from(body), signature)]);
  assert.equal((await alice.payments.status()).seconds, 18000);
  assert.equal((await bob.payments.status()).seconds, 0);
  await assert.rejects(f.billing.webhook(Buffer.from(body), 'invalid'));
});

test('音频按采样数扣时、按优先级使用、重复序号不重传、失败回滚与最后一帧截断', async t => {
  const f = await fixture(t), account = f.billing.forUser('quota');
  const now = Date.now();
  await account.store.transact(s => {
    s.grants = [
      { id: 'topup-late', kind: 'topup', seconds: .1, startsAt: 0, expiresAt: now + 20000 },
      { id: 'trial', kind: 'trial', seconds: .1, startsAt: 0, expiresAt: null },
      { id: 'topup-early', kind: 'topup', seconds: .1, startsAt: 0, expiresAt: now + 10000 },
      { id: 'monthly', kind: 'monthly', seconds: .1, startsAt: 0, expiresAt: now + 30000 },
      { id: 'expired', kind: 'monthly', seconds: 100, startsAt: 0, expiresAt: now - 1 },
      { id: 'future', kind: 'monthly', seconds: 100, startsAt: now + 50000, expiresAt: now + 100000 },
    ];
  });
  const quota = createQuota(account.store, () => now);
  await quota.start('s1');
  await assert.rejects(quota.start('s2'), { code: 'SESSION_ACTIVE' });
  let bytes = 0; const forward = raw => { bytes += raw.length; return true; };
  await assert.rejects(quota.write('s1', 0, Buffer.alloc(3200), () => false), { code: 'UPSTREAM_CLOSED' });
  assert.equal(balanceSamples(account.store.snapshot(), now), 6400);
  await quota.write('s1', 0, Buffer.alloc(3200), forward);
  assert.equal(account.store.snapshot().grants.find(g => g.id === 'monthly').usedSamples, 1600);
  await quota.write('s1', 0, Buffer.alloc(3200), forward); assert.equal(bytes, 3200);
  await quota.write('s1', 1, Buffer.alloc(4800), forward);
  assert.equal(account.store.snapshot().grants.find(g => g.id === 'trial').usedSamples, 1600);
  assert.equal(account.store.snapshot().grants.find(g => g.id === 'topup-early').usedSamples, 800);
  const last = await quota.write('s1', 2, Buffer.alloc(16000), forward);
  assert.equal(bytes, 12800); assert.equal(last.exhausted, true);
  await quota.stop('s1');
  await assert.rejects(quota.start('s3'), { code: 'QUOTA_EXHAUSTED' });
});

test('WebSocket 串行扣时，余额耗尽停止，上游收到的音频不会超过余额', async t => {
  const f = await fixture(t), alice = await f.login('stream@kotoba.test');
  const account = f.billing.forUser(alice.userId);
  const { token } = await (await f.request('/api/account/connection', {}, alice.cookie)).json();
  const empty = await f.socket(token);
  await until(() => empty.messages.some(m => m.code === 'QUOTA_EXHAUSTED'));
  assert.equal(f.connections(), 0, '无额度时不连接供应商');
  await account.store.transact(s => { s.grants.push({ id: 'short', kind: 'trial', seconds: .15, startsAt: 0, expiresAt: null }); });
  const first = await f.socket(token); await until(() => first.messages.some(m => m.type === 'ready'));
  const second = await f.socket(token); await until(() => second.messages.some(m => m.code === 'SESSION_ACTIVE'));
  // 第二个连接失败不能释放第一个连接持有的额度锁。
  first.ws.send(Buffer.alloc(3200)); first.ws.send(Buffer.alloc(3200)); first.ws.send(Buffer.alloc(3200));
  await until(() => first.messages.some(m => m.code === 'QUOTA_EXHAUSTED'));
  assert.equal(f.written(), 4800);
  assert.equal((await account.payments.status()).seconds, 0);
  assert.equal(f.connections(), 1);
});

test('真实邮箱模式不暴露验证码；限频拒绝重发后原验证码仍可登录', async t => {
  const sent = [];
  const f = await fixture(t, { developmentInbox: false, sendOTP: async value => { sent.push(value); } });
  const email = 'reader@example.com';
  const response = await f.request('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert(!JSON.stringify(await response.json()).includes(sent[0].otp));
  assert.equal((await f.request(`/api/account/test-code?email=${email}`)).status, 404);
  assert.equal((await (await f.request('/api/account')).json()).developmentInbox, false);
  const throttled = await f.request('/api/auth/email-otp/send-verification-otp', { email: email.toUpperCase(), type: 'sign-in' });
  assert.equal(throttled.status, 429); assert(Number(throttled.headers.get('retry-after')) > 0);
  assert.equal(sent.length, 1);
  const loggedIn = await f.request('/api/auth/sign-in/email-otp', { email, otp: sent[0].otp });
  assert.equal(loggedIn.status, 200);
  assert(loggedIn.headers.getSetCookie().some(value => value.startsWith('kotoba.session_token=')));
  const replay = await f.request('/api/auth/sign-in/email-otp', { email, otp: sent[0].otp });
  assert.notEqual(replay.status, 200);
});

test('真实邮件发送失败不伪报成功，并发请求的发送结果互不混淆', async t => {
  const f = await fixture(t, { developmentInbox: false, sendOTP: async ({ email }) => {
    if (email.startsWith('fail')) { await new Promise(resolve => setTimeout(resolve, 20)); throw new Error('sensitive-provider-response'); }
  } });
  const [failed, success] = await Promise.all([
    f.request('/api/auth/email-otp/send-verification-otp', { email: 'fail@example.com', type: 'sign-in' }),
    f.request('/api/auth/email-otp/send-verification-otp', { email: 'ok@example.com', type: 'sign-in' }),
  ]);
  assert.equal(failed.status, 503); assert.equal(success.status, 200);
  const body = await failed.text();
  assert(body.includes('EMAIL_SEND_FAILED')); assert(!body.includes('sensitive-provider-response'));
  assert.equal((await f.request('/api/auth/email-otp/send-verification-otp', { email: 'new@example.com', type: 'forget-password' })).status, 400);
});

test('到期的邮件验证码不能建立登录会话', async t => {
  let code;
  const f = await fixture(t, { developmentInbox: false, sendOTP: async ({ otp }) => { code = otp; } });
  await f.request('/api/auth/email-otp/send-verification-otp', { email: 'expiry@example.com', type: 'sign-in' });
  f.database.prepare('UPDATE verification SET expiresAt = ?').run(Date.now() - 1000);
  const response = await f.request('/api/auth/sign-in/email-otp', { email: 'expiry@example.com', otp: code });
  assert.notEqual(response.status, 200); assert.equal(f.database.prepare('SELECT COUNT(*) AS count FROM session').get().count, 0);
});

test('并发验证码邮件使用各自请求的界面语言，语言不影响登录验证', async t => {
  const sent = [];
  const f = await fixture(t, { developmentInbox: false, sendOTP: async value => {
    await new Promise(resolve => setTimeout(resolve, value.locale === 'en' ? 10 : 1)); sent.push(value);
  } });
  const responses = await Promise.all([
    f.request('/api/auth/email-otp/send-verification-otp', { email: 'english@example.com', type: 'sign-in' }, '', { 'Accept-Language': 'en' }),
    f.request('/api/auth/email-otp/send-verification-otp', { email: 'chinese@example.com', type: 'sign-in' }, '', { 'Accept-Language': 'zh-CN' }),
  ]);
  assert(responses.every(response => response.ok));
  assert.equal(sent.find(value => value.email === 'english@example.com').locale, 'en');
  assert.equal(sent.find(value => value.email === 'chinese@example.com').locale, 'zh-CN');
  for (const { email, otp } of sent) assert.equal((await f.request('/api/auth/sign-in/email-otp', { email, otp })).status, 200);
});
