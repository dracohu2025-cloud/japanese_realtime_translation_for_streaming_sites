import { parse, parseFragment, serialize } from 'parse5';
import '../extension/shared/messages.js';
import { plans } from '../server/payment-catalog.js';

const origin = 'https://kotoba.uk';
const dictionary = globalThis.KotobaMessages;
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const setAttr = (node, name, value) => {
  node.attrs ||= [];
  const existing = node.attrs.find(a => a.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
};
const text = (node, value) => { node.childNodes = [{ nodeName: '#text', value, parentNode: node }]; };
const translate = value => {
  const key = value.trim();
  return Object.hasOwn(dictionary, key) ? value.replace(key, dictionary[key]) : value;
};

// 同一份 HTML 与产品词典构建中英文页面；不依赖浏览器执行脚本生成正文。
export function localizedPage(source, { locale, policy = false, pagePath, socialImage = { path: '/brand/social-card.png', width: 1200, height: 630, alt: 'Kotoba Live — Japanese audio. Live subtitles.' } }) {
  const document = parse(source);
  const chinesePath = pagePath || (policy ? '/policies.html' : '/');
  const englishPath = chinesePath === '/' ? '/en' : '/en' + chinesePath;
  const path = locale === 'en' ? englishPath : chinesePath;
  let head;
  function walk(node) {
    if (node.tagName === 'html') {
      setAttr(node, 'lang', locale);
      setAttr(node, 'data-page-locale', locale);
    }
    if (node.tagName === 'head') head = node;
    if (attr(node, 'id') === 'marketingVideo' && locale === 'en') {
      setAttr(node, 'data-video', '/marketing/kotoba-ja-en-v1.mp4');
      setAttr(node, 'data-poster', '/marketing/kotoba-en-v1.jpg');
    }
    if (node.nodeName === '#text' && !['script', 'style'].includes(node.parentNode?.tagName) && locale === 'en') node.value = translate(node.value);
    if (locale === 'en' && node.attrs) {
      for (const item of node.attrs) {
        if (['title', 'aria-label', 'placeholder'].includes(item.name) || (node.tagName === 'meta' && item.name === 'content')) item.value = translate(item.value);
        if (item.name === 'href' && item.value === '/') item.value = '/en';
        else if (item.name === 'href' && item.value.startsWith('/policies.html')) item.value = item.value.replace('/policies.html', '/en/policies.html');
        else if (item.name === 'href' && /^\/(how-it-works|faq|subtitle-guide|sample|demo)(#.*)?$/.test(item.value)) item.value = '/en' + item.value;
      }
    }
    if (node.tagName === 'link' && attr(node, 'rel') === 'canonical') setAttr(node, 'href', origin + path);
    if (node.tagName === 'meta' && attr(node, 'property') === 'og:url') setAttr(node, 'content', origin + path);
    if (node.tagName === 'meta' && attr(node, 'property') === 'og:locale') setAttr(node, 'content', locale === 'en' ? 'en_US' : 'zh_CN');
    if (node.tagName === 'meta' && attr(node, 'property') === 'og:locale:alternate') setAttr(node, 'content', locale === 'en' ? 'zh_CN' : 'en_US');
    if (node.tagName === 'option' && node.parentNode?.tagName === 'select' && attr(node.parentNode, 'data-ui-language') !== undefined) {
      node.attrs = node.attrs.filter(a => a.name !== 'selected');
      if (attr(node, 'value') === locale) setAttr(node, 'selected', '');
    }
    if (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json') {
      const graph = JSON.parse(node.childNodes[0].value);
      for (const entity of graph['@graph']) {
        if (entity['@type'] === 'SoftwareApplication') {
          entity.url = origin + path;
          entity.inLanguage = locale;
          entity.image = origin + '/brand/social-card.png';
          entity.offers = ['trial', 'monthly', 'topup'].map(kind => ({
            '@type': 'Offer', name: kind, price: (plans[kind].amount / 100).toFixed(2), priceCurrency: 'USD',
            description: kind === 'trial' ? 'One-time 20-minute trial per account.'
              : kind === 'monthly' ? plans[kind].seconds / 3600 + ' hours per billing period, no rollover.'
              : plans[kind].seconds / 3600 + ' hours, valid ' + plans[kind].days + ' days after purchase.',
          }));
        }
        if (entity['@type'] === 'Organization') entity.logo = origin + '/brand/apple-touch-icon.png';
      }
      text(node, JSON.stringify(graph));
    }
    const id = attr(node, 'id');
    for (const kind of ['trial', 'monthly', 'topup', 'monthpass']) {
      const plan = plans[kind];
      if (id === kind + 'Price') text(node, '$' + (plan.amount / 100).toFixed(2));
      if (id === kind + 'Time') {
        const time = kind === 'trial' ? (locale === 'en' ? '20 minutes' : '20 分钟') : plan.seconds / 3600 + (locale === 'en' ? ' hours' : ' 小时');
        text(node, locale === 'en' ? time + ' of translation' + (kind === 'monthly' ? ' per month' : '') : (kind === 'monthly' ? '每月 ' : '') + time + ' 翻译时长');
      }
    }
    // 英文页面无需重复中文页上的英文摘要。
    if (node.childNodes) node.childNodes = node.childNodes.filter(child => !(locale === 'en' && attr(child, 'class')?.split(' ').includes('crawl-en')));
    for (const child of node.childNodes || []) walk(child);
  }
  walk(document);
  head.childNodes = head.childNodes.filter(node => !(node.tagName === 'meta' && attr(node, 'name') === 'twitter:card'));
  const meta = `
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" href="/brand/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" sizes="180x180">
<link rel="alternate" hreflang="zh-CN" href="${origin + chinesePath}">
<link rel="alternate" hreflang="en" href="${origin + englishPath}">
<link rel="alternate" hreflang="x-default" href="${origin + chinesePath}">
<meta name="theme-color" content="#123e3b">
<meta property="og:image" content="${origin + socialImage.path}">
<meta property="og:image:width" content="${socialImage.width}">
<meta property="og:image:height" content="${socialImage.height}">
<meta property="og:image:alt" content="${socialImage.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${origin + socialImage.path}">
<meta name="twitter:image:alt" content="${socialImage.alt}">`;
  for (const child of parseFragment(meta).childNodes) { child.parentNode = head; head.childNodes.push(child); }
  return serialize(document);
}
