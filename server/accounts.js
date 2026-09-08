import { randomBytes, createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders } from 'better-auth/node';
import { AppError } from './config.js';
import { createEmailThrottle } from './email-throttle.js';
import { resolveLocale } from '../extension/shared/i18n.js';

const digest = token => createHash('sha256').update(token).digest('hex');
export async function createAccounts({ database, authDatabase = database, baseUrl, secret, billing, sendOTP, google, developmentInbox = false, initialize = false }) {
  const origin = new URL(baseUrl);
  if (developmentInbox && (origin.hostname !== '127.0.0.1' || google || sendOTP)) throw new Error('测试收件箱仅允许独立本机测试，不能混用真实登录');
  if (!developmentInbox && !sendOTP) throw new Error('真实邮箱登录需要配置邮件投递服务');
  const inbox = new Map();
  const delivery = new AsyncLocalStorage();
  const auth = betterAuth({
    appName: 'Kotoba Live', baseURL: baseUrl, secret, database: authDatabase,
    trustedOrigins: [baseUrl],
    logger: { disabled: true },
    emailAndPassword: { enabled: false },
    socialProviders: google ? { google } : {},
    session: { expiresIn: 7 * 86400, updateAge: 86400, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    advanced: { cookiePrefix: developmentInbox ? 'kotoba-test' : 'kotoba', useSecureCookies: origin.protocol === 'https:', defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' } },
    plugins: [emailOTP({
      otpLength: 6, expiresIn: 300, allowedAttempts: 3, storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') throw new Error('仅开放验证码登录');
        if (developmentInbox) {
          if (!/^[^@\s]+@[^@\s]+\.test$/i.test(email)) throw new Error('本机测试请使用 .test 邮箱');
          if (inbox.size > 100) inbox.clear();
          inbox.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 300_000 });
        } else {
          try { await sendOTP({ email, otp, locale: delivery.getStore()?.locale || 'en' }); if (delivery.getStore()) delivery.getStore().accepted = true; }
          catch { if (delivery.getStore()) delivery.getStore().failed = true; throw new Error('EMAIL_SEND_FAILED'); }
        }
      },
    })],
  });
  if (initialize) {
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
  }
  const throttle = createEmailThrottle(database);
  // 凭据只存哈希，必须随账户持久化；Durable Object 回收或部署不能让有效连接码丢失。
  database.exec('CREATE TABLE IF NOT EXISTS kotoba_connection_tokens (hash TEXT PRIMARY KEY, userId TEXT NOT NULL, sessionId TEXT NOT NULL, expiresAt INTEGER NOT NULL)');
  const readSession = async req => {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result?.user.emailVerified) throw new AppError('LOGIN_REQUIRED', '请先登录 Kotoba 账户', 401);
    return result;
  };
  return {
    auth, billing, developmentInbox, googleEnabled: Boolean(google),
    async handleAuth(request) {
      const sending = request.method === 'POST' && new URL(request.url).pathname === '/api/auth/email-otp/send-verification-otp';
      if (!sending) return auth.handler(request);
      let input;
      try { input = await request.clone().json(); } catch { return Response.json({ code: 'BAD_REQUEST', message: '请求格式错误' }, { status: 400 }); }
      if (input?.type !== 'sign-in' || typeof input.email !== 'string' || input.email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(input.email)) return Response.json({ code: 'BAD_REQUEST', message: '请填写有效邮箱' }, { status: 400 });
      const retryAfter = throttle(input.email);
      if (retryAfter) return Response.json({ code: 'EMAIL_RATE_LIMIT', message: '发送过于频繁，请稍后再试', retryAfter }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
      const languages = (request.headers.get('Accept-Language') || 'en').split(',').map(value => value.split(';')[0].trim());
      return delivery.run({ locale: resolveLocale('auto', languages) }, async () => {
        const response = await auth.handler(request);
        // Better Auth 的后台任务会吸收发送异常，单独核对结果，避免把失败显示为已发送。
        if (!developmentInbox && response.ok && !delivery.getStore().accepted) return Response.json({ code: 'EMAIL_SEND_FAILED', message: '验证码发送未获确认，请稍后重试' }, { status: 503 });
        return response;
      });
    },
    async user(req) { return (await readSession(req)).user; },
    async payments(req) { return billing.forUser((await readSession(req)).user.id).payments; },
    async issueToken(req) {
      const { user, session } = await readSession(req);
      const now = Date.now();
      database.prepare('DELETE FROM kotoba_connection_tokens WHERE expiresAt <= ? OR NOT EXISTS (SELECT 1 FROM session WHERE session.id = kotoba_connection_tokens.sessionId AND session.userId = kotoba_connection_tokens.userId AND session.expiresAt > ?)').run(now, now);
      if (database.prepare('SELECT COUNT(*) AS count FROM kotoba_connection_tokens').get().count >= 1000) throw new AppError('RATE_LIMIT', '连接凭据过多，请稍后重试', 429);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = Math.min(now + 3600_000, new Date(session.expiresAt).getTime());
      database.prepare('INSERT INTO kotoba_connection_tokens (hash, userId, sessionId, expiresAt) VALUES (?, ?, ?, ?)').run(digest(token), user.id, session.id, expiresAt);
      return { token, expiresAt };
    },
    authenticateStream(token) {
      // 不缓存撤销状态；网页退出登录后，该会话发出的插件凭据也会失效。
      const now = Date.now();
      const entry = typeof token === 'string' && token.length <= 256
        ? database.prepare('SELECT t.userId FROM kotoba_connection_tokens t JOIN session s ON s.id = t.sessionId AND s.userId = t.userId WHERE t.hash = ? AND t.expiresAt > ? AND s.expiresAt > ?').get(digest(token), now, now) : null;
      if (!entry) throw new AppError('LOGIN_REQUIRED', '账户连接已过期，请登录后重新获取连接码', 401);
      return billing.forUser(entry.userId);
    },
    readTestCode(email) {
      if (!developmentInbox) throw new AppError('NOT_FOUND', '接口不存在', 404);
      const item = inbox.get(email.toLowerCase());
      if (!item || item.expiresAt <= Date.now()) throw new AppError('NOT_FOUND', '测试验证码尚未生成或已过期', 404);
      return { otp: item.otp, testOnly: true };
    },
  };
}
