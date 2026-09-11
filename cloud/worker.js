import { DurableObject } from 'cloudflare:workers';
import Stripe from 'stripe';
import { createAccounts } from '../server/accounts.js';
import { createAccountPayments } from '../server/account-payments.js';
import { createEmailSender } from '../server/email.js';
import { plans } from '../server/payment-catalog.js';
import { AppError } from '../server/config.js';
import { cloudDatabase } from './database.js';
import { openStream } from './stream.js';
import { publicAccess } from './public-access.js';
import { canonicalLocation, discovery } from './seo.js';
import { createAcquisition } from '../server/acquisition.js';
import { createMarketing } from './marketing.js';

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; frame-src https://challenges.cloudflare.com; style-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com; object-src 'none'; frame-ancestors 'none'",
};
const json = (data, status = 200) => Response.json(data, { status, headers });
const authRoutes = new Set(['/api/auth/email-otp/send-verification-otp', '/api/auth/sign-in/email-otp', '/api/auth/sign-out', '/api/auth/get-session']);
const secure = response => { const result = new Response(response.body, response); for (const [key, value] of Object.entries(headers)) result.headers.set(key, value); return result; };
async function body(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new AppError('TOO_LARGE', '请求过大', 413);
  const reader = request.body?.getReader();
  if (!reader) return '';
  let length = 0; const parts = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw new AppError('TOO_LARGE', '请求过大', 413); }
    parts.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canonical = canonicalLocation(request.url, env.PUBLIC_ORIGIN);
    if (canonical) return Response.redirect(canonical, 301);
    if (!env.PUBLIC_ORIGIN || url.origin !== env.PUBLIC_ORIGIN) return json({ code: 'NOT_CONFIGURED' }, 503);
    if (url.pathname.startsWith('/api/') || url.pathname === '/stream') return env.BETA.get(env.BETA.idFromName(env.PAYMENT_MODE === 'live' ? 'production-v1' : 'closed-beta-v1')).fetch(request);
    if (url.pathname === '/health') return json({ ok: true, environment: env.PAYMENT_MODE === 'live' ? 'production' : 'cloud-beta', payments: env.PAYMENT_MODE === 'live' ? 'stripe-live' : 'stripe-test' });
    if (!['GET', 'HEAD'].includes(request.method)) return json({ code: 'METHOD' }, 405);
    const found = discovery(url, env);
    if (found) return new Response(found.body, { status: found.status || 200, headers: { ...headers, 'Content-Type': found.type, 'Cache-Control': 'public, max-age=3600', ...(env.PAYMENT_MODE !== 'live' ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) } });
    const path = ({ '/': '/pricing.html', '/pricing': '/pricing.html', '/en': '/en.html', '/demo': '/demo.html', '/en/demo': '/demo.en.html', '/how-it-works': '/how-it-works.html', '/en/how-it-works': '/how-it-works.en.html', '/sample': '/sample.html', '/en/sample': '/sample.en.html', '/subtitle-guide': '/subtitle-guide.html', '/en/subtitle-guide': '/subtitle-guide.en.html', '/faq': '/faq.html', '/en/faq': '/faq.en.html', '/en/policies.html': '/policies.en.html', '/favicon.ico': '/brand/favicon.ico' })[url.pathname] || url.pathname;
    if (!['/demo.html', '/demo.en.html', '/marketing/kotoba-real-ja-zh-v1.mp4', '/marketing/kotoba-real-ja-zh-v1.jpg', '/marketing.js', '/marketing/kotoba-ja-zh-v1.mp4', '/marketing/kotoba-ja-en-v1.mp4', '/marketing/kotoba-zh-v1.jpg', '/marketing/kotoba-en-v1.jpg', '/sample.html', '/sample.en.html', '/demo/japanese-study.wav', '/subtitle-guide.html', '/subtitle-guide.en.html', '/en.html', '/how-it-works.html', '/how-it-works.en.html', '/faq.html', '/faq.en.html', '/guides.css', '/policies.en.html', '/brand/favicon.ico', '/brand/favicon-32.png', '/brand/apple-touch-icon.png', '/brand/social-card.png', '/pricing.html', '/pricing.css', '/pricing.js', '/account.js', '/acquisition.js', '/challenge.js', '/production-copy.js', '/policies.html', '/downloads/kotoba-live.zip', '/shared/messages.js', '/shared/i18n-core.js', '/shared/i18n.js', '/shared/ui-locale.js'].includes(path)) return json({ code: 'NOT_FOUND' }, 404);
    url.pathname = path;
    const page = secure(await env.ASSETS.fetch(new Request(url, request)));
    if (path.startsWith('/marketing/') && page.ok) page.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (env.PAYMENT_MODE !== 'live') page.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return page;
  },
};

// 封闭内测使用一个协调对象；账户账本分别保存，消费仍按账户串行，禁止多实例共享本机锁。
export class KotobaBeta extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.env = env; this.connections = 0; this.authQueue = Promise.resolve();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      if (!env.BETTER_AUTH_SECRET || (!env.BETA_EMAILS && env.REGISTRATION_MODE !== 'public') || !env.PUBLIC_ORIGIN) throw new Error('缺少内测配置');
      const { database, authDatabase } = cloudDatabase(ctx.storage);
      this.publicRegistration = env.REGISTRATION_MODE === 'public';
      this.live = env.PAYMENT_MODE === 'live';
      if (this.live && (!this.publicRegistration || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY || !env.SUPPORT_EMAIL || !env.LEGAL_ENTITY)) throw new Error('正式环境配置不完整');
      this.access = publicAccess(database, env);
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1, timeout: 10_000 });
      this.billing = createAccountPayments({ database, stripe, key: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        legacyPrices: env.STRIPE_LEGACY_PRICES || {},
        prices: { monthly: env.STRIPE_MONTHLY_PRICE, topup: env.STRIPE_TOPUP_PRICE, monthpass: env.STRIPE_MONTHPASS_PRICE }, baseUrl: env.PUBLIC_ORIGIN, mode: env.PAYMENT_MODE || 'test' });
      const initialize = !database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'").get();
      this.accounts = await createAccounts({ database, authDatabase, baseUrl: env.PUBLIC_ORIGIN, secret: env.BETTER_AUTH_SECRET, billing: this.billing,
        sendOTP: createEmailSender(env), initialize });
      this.acquisition = createAcquisition(database, { live: this.live });
      this.marketing = createMarketing(database);
    });
  }
  async fetch(request) {
    try {
      await this.ready;
      const url = new URL(request.url), path = url.pathname, origin = this.env.PUBLIC_ORIGIN;
      if (url.origin !== origin) throw new AppError('FORBIDDEN', '访问地址不正确', 403);
      if (path === '/stream') {
        if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || url.search) throw new AppError('PROTOCOL', '需要 WebSocket 连接');
        const from = request.headers.get('Origin');
        if (from !== origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(from || '')) throw new AppError('FORBIDDEN', '连接来源不允许', 403);
        if (this.publicRegistration) this.access.reserve(request, 'stream', 120, 60_000);
        if (this.connections >= Math.min(50, Math.max(1, Number(this.env.MAX_STREAMS) || 3))) throw new AppError('BUSY', '当前翻译连接已满，请稍后重试', 429);
        const pair = new WebSocketPair(); pair[1].accept(); this.connections++;
        openStream(pair[1], this.accounts, this.env, () => { this.connections--; });
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      if (path === '/api/payments/webhook' && request.method === 'POST') {
        try { await this.billing.webhook(await body(request, 256_000), request.headers.get('stripe-signature')); }
        catch (error) { if (error.type === 'StripeSignatureVerificationError' || error.message === '支付事件环境不匹配') throw new AppError('SIGNATURE', '回调签名验证失败', 400); throw error; }
        return json({ received: true });
      }
      if (request.headers.get('Origin') && request.headers.get('Origin') !== origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new AppError('FORBIDDEN', '请在账户页面操作', 403);
      if (!['GET', 'POST'].includes(request.method)) throw new AppError('METHOD', '请求方法不支持', 405);
      if (request.method === 'POST' && request.headers.get('Origin') !== origin) throw new AppError('FORBIDDEN', '缺少同源验证', 403);
      if (path === '/api/marketing/event' && request.method === 'POST') {
        if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1') return json({ ok: true });
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new AppError('BAD_REQUEST', '请求格式无效', 400);
        this.access.reserve(request, 'marketing', 30, 60_000);
        let input;
        try { input = JSON.parse(await body(request, 256)); }
        catch (error) { if (error instanceof AppError) throw error; throw new AppError('BAD_REQUEST', '事件格式无效', 400); }
        if (!await this.marketing.record(input)) throw new AppError('BAD_REQUEST', '事件格式无效', 400);
        return json({ ok: true });
      }
      if (path.startsWith('/api/auth/')) {
        if (!authRoutes.has(path)) throw new AppError('NOT_FOUND', '接口不存在', 404);
        const raw = request.method === 'POST' ? await body(request, 8192) : undefined;
        if (path.endsWith('/send-verification-otp') || path.endsWith('/sign-in/email-otp')) {
          const input = JSON.parse(raw || '{}');
          if (this.publicRegistration) {
            this.access.reserve(request, 'auth', 60, 60_000);
            if (path.endsWith('/send-verification-otp')) {
              this.access.reserve(request, 'mail', 15, 3600_000);
            } else {
              // 发送邮件保留限频；人机验证在消费邮箱验证码、创建会话之前执行。
              await this.access.verify(request, input.challengeToken);
            }
          }
          const allowed = (this.env.BETA_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
          if (!this.publicRegistration && !allowed.includes(input?.email?.trim().toLowerCase())) throw new AppError('BETA_ONLY', '当前仅向受邀邮箱开放内测', 403);
        }
        const next = new Request(request.url, { method: request.method, headers: request.headers, body: raw });
        // 数据库适配器不支持异步 SQL 事务，认证请求串行以防 OTP 并发重复消费。
        const job = this.authQueue.then(() => this.accounts.handleAuth(next, {
          beforeTrial: () => { if (this.publicRegistration) this.access.reserve(request, 'trial', 3, 86400_000); },
        }));
        this.authQueue = job.catch(() => {});
        return secure(await job);
      }
      const req = { headers: Object.fromEntries(request.headers) };
      if (path === '/api/account/attribution' && request.method === 'POST') {
        const user = await this.accounts.user(req);
        const input = JSON.parse(await body(request, 256) || '{}');
        if (!this.acquisition.record(user.id, input.source)) throw new AppError('BAD_REQUEST', '来源格式无效', 400);
        return json({ ok: true });
      }
      if (['/api/admin/funnel', '/api/admin/marketing'].includes(path) && request.method === 'GET') {
        const user = await this.accounts.user(req);
        const allowed = (this.env.METRICS_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        if (!allowed.includes(user.email.toLowerCase())) throw new AppError('FORBIDDEN', '无权访问', 403);
        return json(path === '/api/admin/marketing' ? await this.marketing.report() : this.acquisition.report());
      }
      if (path === '/api/account' && request.method === 'GET') {
        let user = null;
        try { const value = await this.accounts.user(req); user = { email: value.email, name: value.name }; }
        catch (error) { if (error.code !== 'LOGIN_REQUIRED') throw error; }
        return json({ user, developmentInbox: false, googleEnabled: false, cloudBeta: !this.live, production: this.live, turnstileSiteKey: this.publicRegistration ? this.env.TURNSTILE_SITE_KEY : undefined });
      }
      if (path === '/api/account/connection' && request.method === 'POST') return json({ ...await this.accounts.issueToken(req), relayUrl: origin.replace(/^http/, 'ws') + '/stream' });
      if (path === '/api/plans' && request.method === 'GET') return json({ plans, walletPaymentsAvailable: Boolean(this.env.STRIPE_MONTHPASS_PRICE) && this.env.PAYMENTS_ENABLED !== 'false', accountsEnabled: true, testPaymentsAvailable: !this.live, paymentsAvailable: this.env.PAYMENTS_ENABLED !== 'false', production: this.live, cloudBeta: !this.live });
      if (path === '/api/payments' || ['/api/payments/trial', '/api/payments/checkout', '/api/payments/cancel', '/api/payments/reconcile'].includes(path)) {
        const payments = await this.accounts.payments(req);
        if (path === '/api/payments' && request.method === 'GET') return json(await payments.status());
        if (request.method !== 'POST') throw new AppError('METHOD', '请求方法不支持', 405);
        const input = JSON.parse(await body(request, 4096) || '{}');
        if (path.endsWith('/checkout') && this.env.PAYMENTS_ENABLED === 'false') throw new AppError('UNAVAILABLE', '付款暂未开放，请稍后重试', 503);
        if (path.endsWith('/checkout')) return json(await payments.checkout(input.plan, input.paymentMethod, input.locale));
        if (path.endsWith('/trial')) {
          await payments.trial(() => { if (this.publicRegistration) this.access.reserve(request, 'trial', 3, 86400_000); });
        }
        else if (path.endsWith('/reconcile')) await payments.reconcile();
        else if (path.endsWith('/cancel')) await payments.cancel();
        else throw new AppError('NOT_FOUND', '接口不存在', 404);
        return json(await payments.status());
      }
      throw new AppError('NOT_FOUND', '接口不存在', 404);
    } catch (error) {
      if (!(error instanceof AppError)) console.error(JSON.stringify({ event: 'request_failed', path: new URL(request.url).pathname }));
      return json({ code: error instanceof AppError ? error.code : 'INTERNAL', message: error instanceof AppError ? error.message : '服务暂时不可用，请稍后重试' }, error instanceof AppError ? error.status : 500);
    }
  }
}
