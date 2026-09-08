import { t, i18n, bindText, uiError } from './shared/ui-locale.js';
const $ = id => document.getElementById(id);
// 原生 details 默认折叠；指南入口和下载操作展开步骤，锚点仍使用浏览器导航。
const installGuide = $('install');
const openInstallGuide = () => { installGuide.open = true; };
document.querySelectorAll('a[href="#install"], a[download]').forEach(link => link.addEventListener('click', openInstallGuide));
const followInstallHash = () => { if (location.hash === '#install') openInstallGuide(); };
window.addEventListener('hashchange', followInstallHash);
followInstallHash();

const buttons = [...document.querySelectorAll('[data-plan]')];
let production = false;
let canPurchase = true;
let token; let enabled = false; let busy = false; let accountMode = false;
const time = i18n.duration;
const money = i18n.money;
function feedback(text, error = false) { bindText($('feedback'), () => text); $('feedback').classList.toggle('error', error); }
async function api(path = '', body) {
  const response = await fetch(`/api/payments${path}`, { method: body ? 'POST' : 'GET', headers: { ...(!accountMode ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(({ LOGIN_REQUIRED: '请先登录 Kotoba 账户', SUBSCRIPTION_EXISTS: '已有订阅，请先管理当前订阅', PAYMENT_PENDING: '上一笔付款正在归账，请等待额度到账', NO_SUBSCRIPTION: '尚无订阅' })[data.code] || (production ? '支付暂时不可用，请稍后重试。' : '支付测试暂时不可用'));
  return data;
}
function render(data) {
  bindText($('balance'), () => time(data.seconds));
  $('grants').replaceChildren();
  for (const grant of data.grants) {
    const item = document.createElement('li');
    const label = document.createElement('span'); bindText(label, () => `${t({ trial: '免费试用', monthly: 'Kotoba 月度会员', topup: 'Kotoba 加时包' }[grant.kind] || '翻译时长')} · ${time(grant.seconds)}`);
    const expiry = document.createElement('span'); bindText(expiry, () => grant.expiresAt ? t('到期：{date}', { date: i18n.date(grant.expiresAt) }) : production ? '一次性试用额度' : '一次性测试额度');
    item.append(label, expiry); $('grants').append(item);
  }
  const subscription = data.subscription;
  const active = subscription && !['canceled', 'incomplete_expired'].includes(subscription.status);
  for (const button of buttons) button.disabled = busy || !enabled || (button.dataset.plan !== 'trial' && !canPurchase) || (button.dataset.plan === 'trial' && data.trialClaimed) || (button.dataset.plan === 'monthly' && active);
  $('cancel').hidden = !active || subscription.cancelAtPeriodEnd;
  if (subscription?.cancelAtPeriodEnd) feedback(production ? '已取消自动续订；有效时长保留到原到期日。' : '已取消自动续订；已到账的有效测试额度保留到原到期日。');
}
async function refresh() { if (enabled) { const data = await api(); if (enabled) render(data); } }
async function action(fn) {
  if (busy || !enabled) return;
  busy = true;
  [...buttons, $('refresh'), $('cancel')].forEach(button => { button.disabled = true; });
  try { await fn(); }
  catch (error) { feedback(uiError(error), true); }
  finally { busy = false; $('refresh').disabled = !enabled; $('cancel').disabled = false; await refresh().catch(error => feedback(uiError(error), true)); }
}
buttons.forEach(button => button.onclick = () => action(async () => {
  if (button.dataset.plan === 'trial') { await api('/trial', {}); feedback(production ? '20 分钟试用时长已领取。' : accountMode ? '20 分钟测试额度已领取。使用当前账户连接码翻译时会扣除此额度。' : '20 分钟测试额度已领取。现有翻译插件暂不扣除此额度。'); }
  else {
    feedback(production ? '正在打开安全付款页面…' : '正在创建 Stripe 测试收银台…');
    const data = await api('/checkout', { plan: button.dataset.plan });
    if (new URL(data.url).origin !== 'https://checkout.stripe.com') throw new Error('收银台地址验证失败');
    location.assign(data.url);
  }
}));
$('refresh').onclick = () => action(async () => { if (production) await api('/reconcile', {}); await refresh(); feedback(production ? '已核对付款状态并刷新时长。' : '测试额度已刷新。付款后请等待回调确认，再查看余额。'); });
$('cancel').onclick = () => action(async () => {
  if (!confirm(t(production ? '取消自动续订？已支付周期的时长仍然有效。' : '取消测试订阅的自动续订？已支付周期的测试额度仍然有效。'))) return;
  await api('/cancel', {}); feedback('自动续订已取消。');
});
try {
  const catalog = await (await fetch('/api/plans')).json();
  for (const name of ['trial', 'monthly', 'topup']) {
    bindText($(name + 'Price'), () => money(catalog.plans[name].amount));
    bindText($(name + 'Time'), () => t(name === 'monthly' ? '每月 {time} 翻译时长' : '{time} 翻译时长', { time: time(catalog.plans[name].seconds) }));
  }
  production = catalog.production === true;
  canPurchase = catalog.paymentsAvailable ?? catalog.testPaymentsAvailable;
  enabled = production || canPurchase;
  if (production) {
    const { productionCopy } = await import('./production-copy.js');
    productionCopy();
  }
  accountMode = catalog.accountsEnabled;
  if (!enabled) throw new Error(production ? '付款暂未开放，请稍后重试' : '这是方案预览。启动 npm run billing:test 后，在 http://127.0.0.1:8790/pricing 测试支付。');
  if (accountMode) {
    const { initializeAccountUi } = await import('./account.js');
    if (!production) {
    bindText($('previewText'), () => 'Stripe 测试模式 · 不产生真实扣款 · 当前账户连接的翻译会扣减测试时长');
    bindText($('accountDescription'), () => '登录后领取或购买测试时长，再获取插件连接码。每个账户的订单和额度独立；旧版共用测试余额不自动转入。');
    bindText($('formalService'), () => '目前仅在本机测试账号、Stripe 支付和翻译扣时，不产生真实扣款。Google 登录、真实邮件投递、云端部署及退款处理尚未开放。');
    }
    enabled = await initializeAccountUi(async loggedIn => {
      enabled = loggedIn; $('refresh').disabled = !enabled;
      if (enabled) { await refresh(); feedback(production ? '已登录，可以领取试用或购买时长。' : '已登录，可以领取试用或测试购买。'); }
      else { buttons.forEach(button => { button.disabled = true; }); bindText($('balance'), () => '—'); $('grants').replaceChildren(); $('cancel').hidden = true; feedback('请先登录，查看自己的额度。'); }
    });
  } else {
    const response = await fetch('/api/setup');
    if (!response.ok) throw new Error('本机服务验证失败');
    token = (await response.json()).token;
  }
  $('refresh').disabled = !enabled;
  await refresh();
  const returned = new URLSearchParams(location.search).get('checkout');
  if (production && enabled && returned === 'returned') { await api('/reconcile', {}); await refresh(); }
  feedback(!enabled ? '请先登录，查看自己的额度。' : returned === 'returned' ? '已从收银台返回，付款状态与额度以 Stripe 回调确认为准。' : returned === 'canceled' ? '已返回，未完成的付款不会发放额度。' : production ? '可以领取试用或购买翻译时长。' : '已连接 Stripe 测试环境，可以领取测试额度或测试购买。');
  setInterval(() => { if (!busy && document.visibilityState === 'visible') refresh().catch(() => feedback('暂时无法刷新，请稍后重试。', true)); }, 5000);
} catch (error) { enabled = false; $('refresh').disabled = true; feedback(uiError(error), true); }
