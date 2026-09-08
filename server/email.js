import { randomUUID } from 'node:crypto';
import { createTranslator } from '../extension/shared/i18n.js';

export function createEmailSender(env = process.env, fetcher = fetch) {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.KOTOBA_EMAIL_FROM?.trim();
  const replyTo = env.SUPPORT_EMAIL?.trim();
  if (!key || !/^re_\S+$/.test(key)) throw new Error('EMAIL_CONFIG: 请配置 RESEND_API_KEY');
  if (!from || /[\r\n]/.test(from) || !/^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(from)) throw new Error('EMAIL_CONFIG: KOTOBA_EMAIL_FROM 必须是已验证域名的发信邮箱');
  if (replyTo && !/^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(replyTo)) throw new Error('EMAIL_CONFIG: 客服邮箱格式不正确');
  return async ({ email, otp, locale = 'zh-CN' }) => {
    if (typeof email !== 'string' || email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) || !/^\d{6}$/.test(otp)) throw new Error('EMAIL_INPUT');
    let response;
    const { t, getLocale } = createTranslator(locale);
    try {
      response = await fetcher('https://api.resend.com/emails', {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({
          from: `Kotoba Live <${from}>`, to: [email], subject: t('Kotoba Live 登录验证码'),
          ...(replyTo ? { reply_to: replyTo } : {}),
          text: `${t('你的登录验证码是：')} ${otp}\n\n${t('5 分钟内有效，只能使用一次。请勿向他人透露验证码。')}\n${t('如果你没有请求登录，请忽略这封邮件。')}`,
          html: `<div lang="${getLocale()}" style="font-family:Arial,sans-serif;max-width:480px;margin:32px auto;color:#203e35;padding:24px"><h1 style="font-size:22px">${t('登录 Kotoba Live')}</h1><p>${t('你的登录验证码是：')}</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${otp}</p><p>${t('5 分钟内有效，只能使用一次。请勿向他人透露验证码。')}</p><p style="color:#667469;font-size:13px">${t('如果你没有请求登录，请忽略这封邮件。')}</p></div>`,
        }),
      });
      if (!response.ok) throw new Error('EMAIL_REJECTED');
      const data = await response.json();
      if (typeof data.id !== 'string' || !data.id) throw new Error('EMAIL_RESPONSE');
      return { id: data.id }; // 供应商已接受请求，不代表邮件已进入收件箱。
    } catch {
      // 不把供应商响应、收件地址、验证码或密钥带进日志和客户端错误。
      throw new Error('EMAIL_SEND_FAILED');
    }
  };
}
