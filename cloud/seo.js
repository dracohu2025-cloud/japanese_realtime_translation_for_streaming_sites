import { plans } from '../server/payment-catalog.js';

export function robotsTxt(origin, live) {
  if (!live) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    'Disallow: /api/',
    'Disallow: /stream',
    '',
    'User-agent: GPTBot',
    'User-agent: ClaudeBot',
    'Disallow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export const publicPagePaths = ['/', '/en', '/how-it-works', '/en/how-it-works', '/faq', '/en/faq', '/subtitle-guide', '/en/subtitle-guide', '/sample', '/en/sample', '/demo', '/en/demo', '/policies.html', '/en/policies.html'];

export function sitemapXml(origin) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + publicPagePaths.map(path => `  <url><loc>${origin}${path}</loc></url>\n`).join('')
    + '</urlset>\n';
}

export function llmsTxt(origin) {
  return `# Kotoba Live

> Chrome extension for real-time Japanese captions on pages that play audio in the browser.

Kotoba Live (ことば) is a desktop Chrome extension operated by DracoNova Inc. After the user starts it, the extension captures audio from the current browser tab and shows live subtitles that can be dragged and resized. Original audio stays playing. It does not download or parse a site's video files.

## Product

- Site: ${origin}/
- English site: ${origin}/en
- How it works: ${origin}/en/how-it-works
- Help and FAQ: ${origin}/en/faq
- Choosing a subtitle workflow: ${origin}/en/subtitle-guide
- Original audio sample and observed results: ${origin}/en/sample
- Real Chrome recording (Japanese to Chinese captions): ${origin}/en/demo
- Chrome Web Store: https://chromewebstore.google.com/detail/bgjpmnfpjjmldfhcggodmbpolgkplmih
- Manual download: ${origin}/downloads/kotoba-live.zip (unpacked Chrome extension; available when the store cannot be accessed)
- Source language: Japanese speech
- Target languages: English, Simplified Chinese
- Typical uses: courses, talks, interviews, livestreams, and other pages that play Japanese audio in Chrome
- Privacy: audio and captions are not stored after the session; processing uses a speech vendor while translation is active

## Pricing (USD)

- Trial: ${plans.trial.seconds / 60} minutes once per account, automatically credited after the first verified email sign-in, no credit card, does not convert to a paid plan
- Monthly: USD ${(plans.monthly.amount / 100).toFixed(2)} for ${plans.monthly.seconds / 3600} hours per billing period, no rollover, cancel anytime
- Top-up: USD ${(plans.topup.amount / 100).toFixed(2)} for ${plans.topup.seconds / 3600} hours, valid ${plans.topup.days} days after purchase
- One-time monthly pass (Alipay / WeChat Pay, offered in the Chinese interface): USD ${(plans.monthpass.amount / 100).toFixed(2)} for ${plans.monthpass.seconds / 3600} hours, valid ${plans.monthpass.days} days after crediting, no automatic renewal
- Existing purchases and subscriptions retain their agreed prices, time allowances, and expiry rules.
- Billing is based on audio actually processed by the service. Silence during playback still counts; stopping capture stops billing.

## Support

- Email: support@kotoba.uk
- Terms and privacy: ${origin}/en/policies.html
`;
}

export function canonicalLocation(requestUrl, publicOrigin) {
  if (!publicOrigin) return;
  const url = new URL(requestUrl);
  const canonical = new URL(publicOrigin);
  const host = url.hostname.toLowerCase();
  const apex = canonical.hostname.toLowerCase();
  if (host !== apex && host !== `www.${apex}`) return;
  const guide = url.pathname.match(/^\/(en\/)?(how-it-works|faq|subtitle-guide|sample|demo)(\/|\.html|\.en\.html)$/);
  if (guide) return canonical.origin + (guide[1] || guide[3] === '.en.html' ? '/en/' : '/') + guide[2] + url.search;
  if (url.pathname === '/en/' || url.pathname === '/en.html' || url.pathname === '/en/pricing') return canonical.origin + '/en' + url.search;
  if (url.pathname === '/policies.en.html') return canonical.origin + '/en/policies.html' + url.search;
  if (url.origin === canonical.origin) return;
  return canonical.origin + url.pathname + url.search;
}

export function discovery(url, env) {
  const origin = env.PUBLIC_ORIGIN;
  const live = env.PAYMENT_MODE === 'live';
  // IndexNow 所有权验证仅在正式站点的精确路径返回，不对外提供提交接口。
  if (live && /^[a-f0-9]{32}$/.test(env.INDEXNOW_KEY || '') && url.pathname === `/${env.INDEXNOW_KEY}.txt` && !url.search) {
    return { body: env.INDEXNOW_KEY, type: 'text/plain; charset=utf-8' };
  }
  if (url.pathname === '/robots.txt') return { body: robotsTxt(origin, live), type: 'text/plain; charset=utf-8' };
  if (url.pathname === '/sitemap.xml') {
    if (!live) return { body: '', type: 'application/xml; charset=utf-8', status: 404 };
    return { body: sitemapXml(origin), type: 'application/xml; charset=utf-8' };
  }
  if (url.pathname === '/llms.txt') return { body: llmsTxt(origin), type: 'text/plain; charset=utf-8' };
}
