import Stripe from 'stripe';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { plans, requireTestKey } from '../server/payment-catalog.js';

export async function stripeTestClient() {
  // 只读取默认 profile 的测试密钥，不导出、不打印、不使用 live 密钥。
  const config = await readFile(join(homedir(), '.config/stripe/config.toml'), 'utf8');
  const profile = config.split(/^\[default\]\s*$/m)[1]?.split(/^\[/m)[0] || '';
  const key = profile.match(/^test_mode_api_key\s*=\s*["']([^"']+)["']/m)?.[1];
  requireTestKey(key);
  const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });
  const balance = await stripe.balance.retrieve();
  if (balance.livemode !== false) throw new Error('Stripe 环境检查失败');
  return { stripe, key };
}

export async function ensureTestPrices(stripe) {
  const prices = {};
  for (const name of ['monthly', 'topup']) {
    const plan = plans[name];
    const lookup = `kotoba_v1_${name}_usd`;
    const existing = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
    if (existing.data.length) { prices[name] = existing.data[0].id; continue; }
    const product = await stripe.products.create({ name: plan.name, metadata: { app: 'kotoba-billing-v1', plan: name } }, { idempotencyKey: `${lookup}:product` });
    const price = await stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: plan.amount, lookup_key: lookup,
      ...(name === 'monthly' ? { recurring: { interval: 'month' } } : {}), metadata: { app: 'kotoba-billing-v1' },
    }, { idempotencyKey: `${lookup}:price` });
    if (price.livemode !== false) throw new Error('创建了非测试价格');
    prices[name] = price.id;
  }
  return prices;
}

export async function listenForStripe(baseUrl, key) {
  requireTestKey(key);
  const listener = spawn('stripe', ['listen', '--skip-update', '--project-name', 'default', '--events',
    'invoice.paid,checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.updated,customer.subscription.deleted',
    '--forward-to', `${baseUrl}/api/payments/webhook`], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, STRIPE_API_KEY: key } });
  try {
    const webhookSecret = await new Promise((accept, reject) => {
      const deadline = setTimeout(() => reject(new Error('Stripe CLI 连接超时')), 30_000);
      let buffer = '';
      const read = chunk => {
        buffer = (buffer + chunk.toString()).slice(-4096);
        const secret = buffer.match(/whsec_[A-Za-z0-9]+/);
        if (secret) { clearTimeout(deadline); accept(secret[0]); }
      };
      listener.stdout.on('data', read); listener.stderr.on('data', read);
      listener.once('error', error => { clearTimeout(deadline); reject(error); });
      listener.once('exit', () => { clearTimeout(deadline); reject(new Error('Stripe CLI 监听已结束')); });
    });
    return { listener, webhookSecret };
  } catch (error) { listener.kill('SIGTERM'); throw error; }
}
