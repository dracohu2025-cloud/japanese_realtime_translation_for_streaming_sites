import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions, Response as MFResponse, WebSocketPair } from 'miniflare';
import Stripe from 'stripe';

const origin = 'https://kotoba.test';
const production = process.argv.includes('--production');
const testEmail = production ? 'public@example.com' : 'owner@example.com';
const objectName = production ? 'production-v1' : 'closed-beta-v1';
let otp, mailLanguage, sent = 0, forwardedBytes = 0, upstreamConnections = 0;
const mf = new Miniflare({ ...convertV4MiniflareOptions({
  name: 'kotoba-beta', modules: true, scriptPath: 'output/cloud-bundle/worker.js',
  compatibilityDate: '2026-09-07', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { BETA: { className: 'KotobaBeta', useSQLite: true } },
  bindings: {
    PUBLIC_ORIGIN: origin, BETTER_AUTH_SECRET: 'cloud-test-auth-secret-at-least-32-characters',
    STRIPE_SECRET_KEY: production ? 'sk_live_cloud_fixture' : 'sk_test_cloud_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_cloud_fixture',
    STRIPE_MONTHLY_PRICE: 'price_monthly', STRIPE_TOPUP_PRICE: 'price_topup',
    ...(production ? { PAYMENT_MODE: 'live', REGISTRATION_MODE: 'public', TURNSTILE_SITE_KEY: 'fixture', TURNSTILE_SECRET_KEY: 'fixture', SUPPORT_EMAIL: 'support@kotoba.test', LEGAL_ENTITY: 'Fixture' } : {}),
    BETA_EMAILS: 'owner@example.com', KOTOBA_EMAIL_FROM: 'login@example.com',
    RESEND_API_KEY: 're_cloud_fixture', SONIOX_API_KEY: 'cloud_fixture', SONIOX_MODEL: 'stt-rt-v5',
  },
  outboundService: async request => {
    if (request.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      const challenge = await request.json();
      return new Response(JSON.stringify({ success: challenge.response === 'valid-fixture', hostname: 'kotoba.test', action: 'login' }));
    }
    if (request.url === 'https://stt-rt.soniox.com/transcribe-websocket') {
      upstreamConnections++;
      const pair = new WebSocketPair(); pair[1].accept();
      pair[1].addEventListener('message', event => { if (typeof event.data !== 'string') forwardedBytes += event.data.byteLength; });
      return new MFResponse(null, { status: 101, webSocket: pair[0] });
    }
    if (request.url !== 'https://api.resend.com/emails') throw new Error('测试禁止访问真实供应商');
    const email = await request.json(); sent++; otp = email.text.match(/\b\d{6}\b/)[0];
    mailLanguage = email.html.match(/lang="([^"]+)"/)[1];
    return new Response(JSON.stringify({ id: 'fixture-email-id' }), {headers:{'Content-Type':'application/json'}});
  },
}), unsafeInspectDurableObjects: true });
let cookie = '';
const call = (path, data, extra = {}) => mf.dispatchFetch(origin + path, {
  method: data ? 'POST' : 'GET', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...extra },
  ...(data ? { body: JSON.stringify(production && path.includes('send-verification-otp') ? { challengeToken: 'valid-fixture', ...data } : data) } : {}),
});
try {
  assert.equal((await call('/api/account')).status, 200);
  assert.equal((await call('/api/account/test-code')).status, 404);
  assert.equal((await call('/api/payments/trial', {})).status, 401);
  assert.equal((await call('/api/auth/email-otp/send-verification-otp', { email: 'outsider@example.com', type: 'sign-in', challengeToken: 'invalid' })).status, production ? 400 : 403);
  assert.equal((await call('/api/auth/email-otp/send-verification-otp', { email: testEmail, type: 'sign-in' }, { Origin: 'https://evil.test' })).status, 403);
  assert.equal(sent, 0);
  const delivered=await call('/api/auth/email-otp/send-verification-otp', { email: testEmail, type: 'sign-in' }, { 'Accept-Language': 'en' }); assert.equal(delivered.status,200);
  assert.equal(mailLanguage, 'en', '云端验证码邮件跟随请求的界面语言');
  assert.equal(sent, 1);
  assert.equal((await call('/api/auth/email-otp/send-verification-otp', { email: testEmail, type: 'sign-in' })).status, 429);
  const attempts = await Promise.all([call('/api/auth/sign-in/email-otp', { email: testEmail, otp }), call('/api/auth/sign-in/email-otp', { email: testEmail, otp })]);
  assert.equal(attempts.filter(r => r.ok).length, 1, '同一验证码并发登录只能成功一次');
  const success = attempts.find(r => r.ok);
  assert.match(success.headers.get('set-cookie'), /HttpOnly/);
  assert.match(success.headers.get('set-cookie'), /Secure/);
  cookie = success.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
  assert.equal((await (await call('/api/account')).json()).user.email, testEmail);
  await Promise.all([call('/api/payments/trial', {}), call('/api/payments/trial', {})]);
  assert.equal((await (await call('/api/payments')).json()).seconds, 1200);
  const token = await (await call('/api/account/connection', {})).json();
  assert.equal(token.relayUrl, 'wss://kotoba.test/stream'); assert.ok(token.token.length > 24);
  assert.equal((await call('/api/payments/webhook', {})).status, 400);
  const stripe = new Stripe(production ? 'sk_live_cloud_fixture' : 'sk_test_cloud_fixture');
  const event = { id: 'evt_fixture', livemode: production, type: 'unhandled', data: { object: {} } };
  const signature = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(event), secret: 'whsec_cloud_fixture' });
  assert.equal((await call('/api/payments/webhook', event, { 'stripe-signature': signature })).status, 200);
  await mf.unsafeEvictDurableObject('kotoba-beta', 'KotobaBeta', { name: objectName });
  assert.equal((await (await call('/api/account')).json()).user.email, testEmail, '对象重建后登录会话仍然有效');
  assert.equal((await (await call('/api/payments')).json()).seconds, 1200, '对象重建后余额保留');
  assert.equal((await call('/api/auth/email-otp/send-verification-otp', { email: testEmail, type: 'sign-in' })).status, 429, '对象重建不会清空邮件限频');
  const db = await mf.unsafeGetDurableObjectStorage('kotoba-beta', 'KotobaBeta', { name: objectName });
  await db.exec("UPDATE " + (production ? "kotoba_billing_live" : "kotoba_billing") + " SET state = json_set(state, '$.grants[0].usedSamples', 19199200)");
  // 必须沿用对象回收前签发的凭据，重新签发会掩盖内存凭据丢失的问题。
  const activeToken = token.token;
  const connect = async () => {
    const response = await call('/stream', undefined, { Upgrade: 'websocket' });
    assert.equal(response.status, 101); response.webSocket.accept(); return response.webSocket;
  };
  const nextMessage = socket => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('测试 WebSocket 超时')), 3000);
    socket.addEventListener('message', event => { clearTimeout(timer); resolve(JSON.parse(event.data)); }, { once: true });
  });
  const queryBalance = async credential => {
    const socket = await connect();
    const result = nextMessage(socket);
    socket.send(JSON.stringify({ type: 'balance', token: credential }));
    const value = await result; socket.close(); return value;
  };
  assert.equal((await queryBalance('invalid-token')).code, 'LOGIN_REQUIRED');
  const beforeBalance = await queryBalance(activeToken);
  assert.equal(beforeBalance.type, 'balance', '对象重建后原连接码仍能查询余额');
  assert.equal(beforeBalance.remainingSeconds, 0.05);
  assert.equal(upstreamConnections, 0, '余额查询不能连接语音供应商');
  assert.equal((await (await call('/api/payments')).json()).seconds, 0.05, '余额查询不扣时');
  const first = await connect(); let next = nextMessage(first);
  first.send(JSON.stringify({ type: 'start', token: activeToken, targetLanguage: 'zh' }));
  assert.equal((await next).type, 'ready');
  let closedDuringHandshakeWindow = false;
  first.addEventListener('close', () => { closedDuringHandshakeWindow = true; });
  await new Promise(resolve => setTimeout(resolve, 11_000));
  assert.equal(closedDuringHandshakeWindow, false, '握手成功后连接必须跨过 10 秒握手超时继续存活');
  assert.equal((await queryBalance(activeToken)).remainingSeconds, 0.05, '翻译中也能查询余额');
  assert.equal(upstreamConnections, 1, '余额查询不能启动第二条音频连接');
  const second = await connect(); next = nextMessage(second);
  second.send(JSON.stringify({ type: 'start', token: activeToken, targetLanguage: 'zh' }));
  assert.equal((await next).code, 'SESSION_ACTIVE'); second.close();
  const messages = [];
  const ended = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('未在额度耗尽后停止')), 3000);
    first.addEventListener('message', event => messages.push(JSON.parse(event.data)));
    first.addEventListener('close', () => { clearTimeout(timer); resolve(); });
  });
  first.send(new Uint8Array(3200)); await ended;
  assert.equal(forwardedBytes, 1600, '最后一帧仅转发余额可覆盖的 0.05 秒');
  assert(messages.some(x => x.code === 'QUOTA_EXHAUSTED'));
  assert.equal((await (await call('/api/payments')).json()).seconds, 0);
  assert.equal((await queryBalance(activeToken)).remainingSeconds, 0, '零余额仍可查询');
  await call('/api/auth/sign-out', {});
  assert.equal((await queryBalance(activeToken)).code, 'LOGIN_REQUIRED', '退出登录立即撤销余额查询权限');
  assert.equal((await (await call('/api/account')).json()).user, null);
  console.log((production ? '正式模式（公开邮箱、人机验证）' : '测试模式') + ' Cloudflare workerd 集成验证通过：建表、邮箱、同源限制、发送限频、OTP 单次消费、安全 Cookie、账户、试用幂等、连接码、回调签名、重建后持久化、并发音频互斥、末帧截断、零额度停止、退出登录。');
} finally { await mf.dispose(); }
