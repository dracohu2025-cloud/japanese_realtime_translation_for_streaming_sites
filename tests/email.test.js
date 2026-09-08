import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createEmailSender } from '../server/email.js';
import { createEmailThrottle } from '../server/email-throttle.js';

const config = { RESEND_API_KEY: 're_unit_test_only', KOTOBA_EMAIL_FROM: 'login@auth.example.com' };
test('邮件主题、纯文本、HTML 使用同一语言，外部语言值不会进入 HTML', async () => {
  const mails = [];
  const send = createEmailSender(config, async (_, options) => { mails.push(JSON.parse(options.body)); return Response.json({ id: 'mail_locale' }); });
  for (const locale of ['en', 'zh-CN', '"><script>']) await send({ email: 'reader@example.com', otp: '123456', locale });
  assert.equal(mails[0].subject, 'Your Kotoba Live sign-in code');
  assert.match(mails[0].text, /5 minutes/);
  assert.match(mails[0].html, /lang="en"/);
  assert(!/\p{Script=Han}/u.test(mails[0].html));
  assert.match(mails[1].subject, /登录验证码/);
  assert.match(mails[1].html, /lang="zh-CN"/);
  assert.match(mails[2].html, /lang="en"/);
  assert(!mails[2].html.includes('<script>'));
});
test('发送模块固定 API 地址和邮件模板，不把密钥/收件地址写进正文', async () => {
  const calls = [];
  const send = createEmailSender(config, async (url, options) => { calls.push({ url, options }); return Response.json({ id: 'mail_test' }); });
  assert.deepEqual(await send({ email: 'reader@example.com', otp: '123456' }), { id: 'mail_test' });
  const { url, options } = calls[0], body = JSON.parse(options.body);
  assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.redirect, 'manual');
  assert.equal(options.headers.Authorization, 'Bearer re_unit_test_only');
  assert(options.headers['Idempotency-Key']); assert(options.signal instanceof AbortSignal);
  assert.deepEqual(body.to, ['reader@example.com']); assert.equal(body.from, 'Kotoba Live <login@auth.example.com>');
  assert(body.text.includes('123456')); assert(body.html.includes('123456'));
  assert(!body.html.includes('reader@example.com')); assert(!options.body.includes(config.RESEND_API_KEY));
  await assert.rejects(send({ email: 'reader@example.com', otp: '<script>' }));
  assert.equal(calls.length, 1);
});

test('邮件配置、超时、供应商拒绝与异常响应均明确失败且不外泄响应', async () => {
  assert.throws(() => createEmailSender({}));
  assert.throws(() => createEmailSender({ ...config, KOTOBA_EMAIL_FROM: 'x@example.com\nBcc:other@example.com' }));
  for (const fetcher of [
    async () => new Response(null, { status: 302, headers: { Location: 'https://other.example.com' } }),
    async () => new Response('sensitive-provider-body', { status: 403 }),
    async () => { throw new Error('sensitive-key-in-timeout'); },
    async () => Response.json({ error: 'unexpected' }),
  ]) await assert.rejects(createEmailSender(config, fetcher)({ email: 'reader@example.com', otp: '123456' }), { message: 'EMAIL_SEND_FAILED' });
});

test('发送限频按邮箱持久保存，支持 60 秒冷却、每小时 5 次和全局预算', () => {
  const db = new DatabaseSync(':memory:');
  let time = 1_000_000;
  let reserve = createEmailThrottle(db, () => time);
  assert.equal(reserve('reader@example.com'), 0);
  reserve = createEmailThrottle(db, () => time);
  assert.equal(reserve('READER@example.com'), 60);
  for (let i = 0; i < 4; i++) { time += 60_000; assert.equal(reserve('reader@example.com'), 0); }
  time += 60_000; assert.equal(reserve('reader@example.com'), 3300);
  assert(!JSON.stringify(db.prepare('SELECT * FROM kotoba_email_limits').all()).includes('reader@example.com'));
  for (let i = 0; i < 95; i++) assert.equal(reserve(`user${i}@example.com`), 0);
  assert(reserve('overflow@example.com') > 0);
  time += 3600_000; assert.equal(reserve('reader@example.com'), 0);
  db.close();
});
