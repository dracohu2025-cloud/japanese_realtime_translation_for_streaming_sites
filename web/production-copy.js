import { bindText } from './shared/ui-locale.js';
export function productionCopy() {
  const set = (selector, value) => { const node = document.querySelector(selector); if (node) bindText(node, () => value); };
  set('.preview>span', '现已开放');
  set('#previewText', '注册即享 20 分钟试用 · 用完即停 · 不自动转付费');
  set('nav a[href="#account"]', '我的时长 ↗');
  set('#account h2', '我的翻译时长');
  set('#account .eyebrow', 'YOUR KOTOBA ACCOUNT');
  set('#accountDescription', '首次验证邮箱并登录后，20 分钟免费试用自动到账。获取插件连接码，即可开始翻译。');
  set('#connectionInfo>p', '在插件中填写连接码和服务地址，即可开始使用当前账户的翻译时长。');
  set('[data-plan="trial"]', '领取免费试用');
  set('[data-plan="monthly"]', '订阅月度会员 ↗');
  set('[data-plan="topup"]', '购买加时包 ↗');
  set('#cancel', '取消自动续订');
  set('#rules>div>p:last-child', '按音频时长计费，购买前请阅读服务与退款说明。');
  set('#formalService', '可以。付款由安全收银台处理，付款确认后时长自动到账。月度会员自动续订，可随时取消后续续订；加时包不自动续费。');
  set('footer a', '返回首页 ↗');
}
