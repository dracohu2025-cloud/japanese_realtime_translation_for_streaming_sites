import { once } from 'node:events';
import { resolve } from 'node:path';
import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { createPayments } from '../server/payments.js';
import { openPaymentStore } from '../server/payment-store.js';
import { stripeTestClient, ensureTestPrices, listenForStripe } from './stripe-test.js';

const config = loadConfig({ PORT: process.env.BILLING_TEST_PORT || '8790' });
const baseUrl = `http://127.0.0.1:${config.port}`;
let listener; let app;
async function close() { listener?.kill('SIGTERM'); if (app?.server.listening) await app.close(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => close());
try {
  const { stripe, key } = await stripeTestClient();
  const prices = await ensureTestPrices(stripe);
  const store = await openPaymentStore(resolve('output/billing-test/ledger.json'));
  const running = await listenForStripe(baseUrl, key);
  listener = running.listener;
  const { webhookSecret } = running;
  const payments = createPayments({ stripe, key, webhookSecret, store, prices, baseUrl });
  app = createApp(config, undefined, payments);
  listener.once('exit', () => { process.stderr.write('Stripe 回调监听停止，支付测试服务随之关闭。\n'); if (app.server.listening) app.close(); });
  app.server.listen(config.port, config.host);
  await once(app.server, 'listening');
  process.stdout.write(JSON.stringify({ mode: 'test-only', url: `${baseUrl}/pricing`, prices, ledger: 'output/billing-test/ledger.json' }) + '\n');
} catch (error) {
  // SDK 错误可能携带请求信息，因此仅显示分类。
  process.stderr.write(`支付测试启动失败：${error.code || error.type || 'CONFIG_OR_CONNECTION'}。请检查 stripe login 与端口占用。\n`);
  await close(); process.exitCode = 1;
}
