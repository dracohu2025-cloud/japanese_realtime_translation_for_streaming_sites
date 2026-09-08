export function robotsTxt(origin, live) {
  if (!live) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(origin) {
  const urls = ['/', '/policies.html'];
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(path => `  <url><loc>${origin}${path}</loc></url>\n`).join('')
    + '</urlset>\n';
}

export function llmsTxt(origin) {
  return `# Kotoba Live

> Chrome extension for real-time Japanese captions on pages that play audio in the browser.

Kotoba Live (ことば) is a desktop Chrome extension operated by DracoNova Inc. After the user starts it, the extension captures audio from the current browser tab and shows live subtitles that can be dragged and resized. Original audio stays playing. It does not download or parse a site's video files.

## Product

- Site: ${origin}/
- Download: ${origin}/downloads/kotoba-live.zip (unpacked Chrome extension; not yet on the Chrome Web Store)
- Source language: Japanese speech
- Target languages: English, Simplified Chinese
- Typical uses: courses, talks, interviews, livestreams, and other pages that play Japanese audio in Chrome
- Privacy: audio and captions are not stored after the session; processing uses a speech vendor while translation is active

## Pricing (USD)

- Trial: 20 minutes once per account, no credit card, does not convert to a paid plan
- Monthly: USD 9.99 for 10 hours per billing period, no rollover, cancel anytime
- Top-up: USD 4.99 for 5 hours, valid 90 days after purchase
- Billing is based on audio actually processed by the service. Silence during playback still counts; stopping capture stops billing.

## Support

- Email: support@kotoba.uk
- Terms and privacy: ${origin}/policies.html
`;
}

export function canonicalLocation(requestUrl, publicOrigin) {
  if (!publicOrigin) return;
  const url = new URL(requestUrl);
  const canonical = new URL(publicOrigin);
  const host = url.hostname.toLowerCase();
  const apex = canonical.hostname.toLowerCase();
  if (host !== apex && host !== `www.${apex}`) return;
  if (url.origin === canonical.origin) return;
  return canonical.origin + url.pathname + url.search;
}

export function discovery(url, env) {
  const origin = env.PUBLIC_ORIGIN;
  const live = env.PAYMENT_MODE === 'live';
  if (url.pathname === '/robots.txt') return { body: robotsTxt(origin, live), type: 'text/plain; charset=utf-8' };
  if (url.pathname === '/sitemap.xml') {
    if (!live) return { body: '', type: 'application/xml; charset=utf-8', status: 404 };
    return { body: sitemapXml(origin), type: 'application/xml; charset=utf-8' };
  }
  if (url.pathname === '/llms.txt') return { body: llmsTxt(origin), type: 'text/plain; charset=utf-8' };
}
