import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { createAccounts } from '../server/accounts.js';
import { createAccountPayments } from '../server/account-payments.js';
import { stripeTestClient, ensureTestPrices, listenForStripe } from './stripe-test.js';
import { createEmailSender } from '../server/email.js';

const realEmail = process.argv.includes('--email');
const config = loadConfig({ PORT: realEmail ? process.env.ACCOUNT_EMAIL_PORT || '8792' : process.env.ACCOUNT_TEST_PORT || '8791', SONIOX_API_KEY: process.env.SONIOX_API_KEY, SONIOX_MODEL: process.env.SONIOX_MODEL });
const baseUrl = `http://127.0.0.1:${config.port}`;
let listener; let app; let database; let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  listener?.kill('SIGTERM');
  if (app?.server.listening) await app.close();
  database?.close();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
try {
  // 缺少邮件配置立即失败，不回退到在页面显示验证码的开发模式。
  const sendOTP = realEmail ? createEmailSender() : undefined;
  const directory = resolve(realEmail ? 'output/account-email' : 'output/account-test');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const secretPath = resolve(directory, 'auth-secret');
  try { await writeFile(secretPath, randomBytes(32).toString('base64url'), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const dbPath = resolve(directory, 'accounts.sqlite');
  database = new DatabaseSync(dbPath);
  const initialize = !database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'").get();
  database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const { stripe, key } = await stripeTestClient();
  const prices = await ensureTestPrices(stripe);
  const running = await listenForStripe(baseUrl, key);
  listener = running.listener;
  const billing = createAccountPayments({ database, stripe, key, prices, webhookSecret: running.webhookSecret, baseUrl });
  const accounts = await createAccounts({ database, baseUrl, secret: await readFile(secretPath, 'utf8'), billing, developmentInbox: !realEmail, sendOTP, initialize });
  app = createApp(config, undefined, null, accounts);
  listener.once('exit', () => { if (!closing) { process.stderr.write('Stripe 回调监听停止，账户测试服务随之关闭。\n'); close(); } });
  app.server.listen(config.port, config.host);
  await once(app.server, 'listening');
  process.stdout.write(JSON.stringify({ mode: realEmail ? 'real-email-stripe-test' : 'local-accounts-test-only', url: `${baseUrl}/pricing`, translationReady: Boolean(config.apiKey), login: realEmail ? '真实邮箱验证码登录；Stripe 仍为测试模式' : '仅 .test 邮箱，验证码在页面显示，不发送真实邮件' }) + '\n');
} catch (error) {
  process.stderr.write(error.message?.startsWith('EMAIL_CONFIG:') ? `${error.message}\n` : `账户测试启动失败：${error.code || error.type || 'CONFIG_OR_CONNECTION'}。请检查 Stripe 登录、端口和测试数据库。\n`);
  await close(); process.exitCode = 1;
}
