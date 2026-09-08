import { t, i18n, bindText, uiError } from './shared/ui-locale.js';
const $ = id => document.getElementById(id);
export async function initializeAccountUi(onChange) {
  let busy = false, resendAt = 0, challenge;
  const updateResend = () => {
    const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    $('sendCode').disabled = busy || seconds > 0;
    bindText($('sendCode'), () => seconds ? t('{seconds} 秒后重发', { seconds: i18n.number(seconds) }) : '获取验证码');
  };
  const request = async (path, body) => {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Accept-Language': i18n.getLocale(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429 && path.endsWith('/send-verification-otp')) {
        const retry = Number(response.headers.get('Retry-After') || data.retryAfter || 60);
        resendAt = Date.now() + Math.min(3600, Math.max(1, Number.isFinite(retry) ? retry : 60)) * 1000;
      }
      throw new Error(data.code === 'CHALLENGE' ? '请完成人机验证后重试。' : data.code === 'BETA_ONLY' ? '当前仅向受邀邮箱开放内测。' : data.code === 'EMAIL_SEND_FAILED' ? '验证码发送未获确认，请稍后重试。' : response.status === 429 ? '操作频繁，请稍后重试。' : response.status === 401 ? '验证码无效或已过期，请检查后重新登录。' : '操作未成功，请检查邮箱或验证码后重试。');
    }
    return data;
  };
  const status = text => { bindText($('loginFeedback'), typeof text === 'function' ? text : () => text); };
  const render = data => {
    $('loginForm').hidden = Boolean(data.user);
    $('signedIn').hidden = !data.user;
    if ($('accountEntry')) bindText($('accountEntry'), () => data.user ? '我的账户' : '注册 / 登录');
    bindText($('accountEmail'), () => data.user?.email || '');
    $('connectionInfo').hidden = true;
    $('connectionToken').value = '';
    bindText($('loginHint'), () => data.developmentInbox ? '本机测试：使用 demo@kotoba.test 等以 .test 结尾的邮箱。验证码在这里显示，不会发送真实邮件。' : '输入邮箱获取验证码，首次登录会创建账户。');
    $('loginEmail').placeholder = data.developmentInbox ? 'demo@kotoba.test' : 'you@example.com';
    if (!data.developmentInbox && !data.production) bindText($('formalService'), () => '邮箱验证码会真实发送，账号及额度保存在本机。Stripe 仍使用测试卡，不产生真实扣款；云端部署与正式收费尚未开放。');
    if (data.cloudBeta) {
      bindText($('loginHint'), () => '受邀邮箱内测：验证码会真实发送，首次登录创建独立的线上账户。');
      bindText($('formalService'), () => '这是 Cloudflare 线上封闭内测，账户和额度保存在云端。Stripe 仅使用测试卡，不产生真实扣款；正式收费尚未开放。');
      bindText(document.querySelector('footer a'), () => '返回线上内测首页 ↗');
      document.querySelector('#account .eyebrow')?.replaceChildren(document.createTextNode('CLOUD BETA ACCOUNT'));
    }
    $('googleLogin').hidden = !data.googleEnabled || Boolean(data.user);
    return Boolean(data.user);
  };
  const config = await request('/api/account');
  if (config.turnstileSiteKey) {
    const { createChallenge } = await import('./challenge.js');
    challenge = await createChallenge(config.turnstileSiteKey);
  }
  $('loginPanel').hidden = false;
  if (location.hash === '#loginPanel') $('loginPanel').scrollIntoView({ block: 'start' });
  const cooldown = setInterval(updateResend, 1000);
  window.addEventListener('pagehide', () => clearInterval(cooldown), { once: true });
  async function action(fn) {
    if (busy) return;
    busy = true;
    $('loginPanel').querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await fn(); } catch (error) { status(uiError(error)); }
    finally { busy = false; $('loginPanel').querySelectorAll('button').forEach(button => { button.disabled = false; }); updateResend(); }
  }
  $('sendCode').onclick = () => action(async () => {
    if (Date.now() < resendAt) return;
    if (!$('loginEmail').reportValidity()) return;
    const email = $('loginEmail').value.trim();
    if (config.developmentInbox && !email.endsWith('.test')) { status('本机测试请使用 demo@kotoba.test；真实邮箱登录尚未开放。'); return; }
    if (challenge && !challenge.token()) { status('请先完成人机验证。'); return; }
    status('正在发送验证码…');
    resendAt = Date.now() + 60_000;
    try {
      await request('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in', ...(challenge ? { challengeToken: challenge.token() } : {}) });
    } finally { challenge?.reset(); }
    if (config.developmentInbox) {
      const code = await request(`/api/account/test-code?email=${encodeURIComponent(email)}`);
      status(() => t('仅本机测试验证码：{code}（5 分钟有效）', { code: code.otp }));
    } else status('验证码已提交发送，5 分钟内有效。请查看收件箱或垃圾邮件；未收到可在倒计时后重发。');
    $('loginCode').focus();
  });
  $('loginForm').onsubmit = event => {
    event.preventDefault();
    action(async () => {
      await request('/api/auth/sign-in/email-otp', { email: $('loginEmail').value.trim(), otp: $('loginCode').value.trim() });
      $('loginCode').value = '';
      const loggedIn = render(await request('/api/account'));
      status('已登录，额度仅归属于当前账户。');
      await onChange(loggedIn);
    });
  };
  $('logout').onclick = () => action(async () => {
    await request('/api/auth/sign-out', {});
    render({ ...config, user: null }); status('已退出登录，此登录会话发出的插件连接码也已失效。');
    await onChange(false);
  });
  $('googleLogin').onclick = () => action(async () => {
    const data = await request('/api/auth/sign-in/social', { provider: 'google', callbackURL: '/pricing' });
    if (new URL(data.url).origin !== 'https://accounts.google.com') throw new Error('Google 登录地址验证失败');
    location.assign(data.url);
  });
  $('getConnection').onclick = () => action(async () => {
    const data = await request('/api/account/connection', {});
    $('connectionUrl').value = data.relayUrl; $('connectionToken').value = data.token;
    bindText($('connectionExpiry'), () => t('有效至 {time}。退出登录后失效，请勿分享连接码。', { time: i18n.date(data.expiresAt) }));
    $('connectionInfo').hidden = false;
  });
  $('copyConnection').onclick = () => action(async () => {
    await navigator.clipboard.writeText($('connectionToken').value);
    status('连接码已复制。请在插件设置中粘贴，并将服务地址改为下方地址。');
  });
  return render(config);
}
