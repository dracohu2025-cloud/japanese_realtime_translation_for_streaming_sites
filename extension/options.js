import { t, i18n, bindText, uiError } from './shared/ui-locale.js';
import { cloudRelay, validateRelay } from './shared/relay.js';
const defaults = { relayUrl: cloudRelay, token: '', context: '', terms: '', showOriginal: true, fontSize: 28, opacity: 90 };
const $ = id => document.getElementById(id);
const settings = await chrome.storage.local.get(defaults);
for (const [key, value] of Object.entries(settings)) {
  if (typeof value === 'boolean') $(key).checked = value;
  else $(key).value = value;
}
const size = () => { bindText($('sizeLabel'), () => `${$('fontSize').value} px`); };
$('fontSize').oninput = size; size();
const opacity = () => { bindText($('opacityLabel'), () => i18n.percent(Number($('opacity').value))); };
$('opacity').oninput = opacity; opacity();
$('form').onsubmit = async event => {
  event.preventDefault();
  try {
    const url = new URL($('relayUrl').value.trim());
    validateRelay(url.href);
    const terms = $('terms').value.split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
    if (terms.length > 30 || terms.some(t => t.length > 60)) throw new Error('术语最多 30 个，每个最多 60 字');
    await chrome.storage.local.set({ relayUrl: url.href, token: $('token').value.trim(), context: $('context').value.trim(), terms: terms.join('\n'), showOriginal: $('showOriginal').checked, fontSize: Number($('fontSize').value), opacity: Number($('opacity').value) });
    bindText($('feedback'), () => '已保存，回到视频页面即可开始。');
  } catch (error) { bindText($('feedback'), () => error instanceof TypeError ? t('请使用本机服务地址或 Kotoba 线上内测页面提供的服务地址') : uiError(error)); }
};

$('useCloud').onclick = () => { $('relayUrl').value = cloudRelay; bindText($('feedback'), () => '已选择默认连接，请保存设置。'); };
