import { createTranslator, resolveLocale } from './i18n.js';
const extension = Boolean(globalThis.chrome?.runtime?.id);
const browserLanguages = () => extension && chrome.i18n?.getUILanguage ? [chrome.i18n.getUILanguage()] : navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
let preference = 'auto';
try { if (!extension) preference = localStorage.getItem('kotoba.uiLanguage') || 'auto'; } catch { /* 存储不可用时仍允许本页切换。 */ }
export const i18n = createTranslator(resolveLocale(preference, browserLanguages()));
export const t = i18n.t;
export const uiError = error => Object.hasOwn(globalThis.KotobaMessages, error?.message) ? error.message : '操作未成功，请稍后重试。';
const bindings = new Map();
let cleanupScheduled = false;
export function bindText(node, render) {
  bindings.set(node, render);
  node.textContent = t(render());
  if (!cleanupScheduled) {
    cleanupScheduled = true;
    queueMicrotask(() => {
      cleanupScheduled = false;
      for (const element of bindings.keys()) if (element.isConnected === false) bindings.delete(element);
    });
  }
}
function repaint() {
  document.documentElement.lang = i18n.getLocale();
  for (const [node, render] of bindings) {
    if (node.isConnected === false) { bindings.delete(node); continue; }
    node.textContent = t(render());
  }
  for (const [node, attribute, key] of attributes) node.setAttribute(attribute, t(key));
  document.querySelectorAll('[data-ui-language]').forEach(select => { select.value = preference; });
}
// 仅绑定页面加载时的静态产品文字；不会翻译用户输入、邮箱、连接码或字幕内容。
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
let node;
while ((node = walker.nextNode())) {
  if (['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName)) continue;
  const source = node.textContent, key = source.trim();
  if (Object.hasOwn(globalThis.KotobaMessages, key)) bindings.set(node, () => source.replace(key, t(key)));
}
const title = document.querySelector('title');
if (title) { const source = title.textContent; bindings.set(title, () => t(source)); }
const attributes = [];
for (const element of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    const source = element.getAttribute(attr);
    if (source && Object.hasOwn(globalThis.KotobaMessages, source)) attributes.push([element, attr, source]);
  }
}
for (const element of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]')) {
  const source = element.getAttribute('content');
  if (source && Object.hasOwn(globalThis.KotobaMessages, source)) attributes.push([element, 'content', source]);
}
const normalizePreference = value => ['zh-CN', 'en'].includes(value) ? value : 'auto';
async function setPreference(value) {
  preference = normalizePreference(value);
  i18n.setLocale(resolveLocale(preference, browserLanguages()));
  repaint();
  if (extension) await chrome.storage.local.set({ uiLanguage: preference });
  else { try { localStorage.setItem('kotoba.uiLanguage', preference); } catch { /* 本页选择仍然生效。 */ } }
}
document.querySelectorAll('[data-ui-language]').forEach(select => {
  select.onchange = () => setPreference(select.value).catch(() => {});
});
if (extension) {
  chrome.storage.local.get({ uiLanguage: 'auto' }).then(settings => {
    preference = normalizePreference(settings.uiLanguage); i18n.setLocale(resolveLocale(preference, browserLanguages())); repaint();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uiLanguage) { preference = normalizePreference(changes.uiLanguage.newValue); i18n.setLocale(resolveLocale(preference, browserLanguages())); repaint(); }
  });
} else window.addEventListener('storage', event => {
  if (event.key === 'kotoba.uiLanguage') { preference = normalizePreference(event.newValue); i18n.setLocale(resolveLocale(preference, browserLanguages())); repaint(); }
});
window.addEventListener('languagechange', () => { if (preference === 'auto') { i18n.setLocale(resolveLocale('auto', browserLanguages())); repaint(); } });
repaint();
