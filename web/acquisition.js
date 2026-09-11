// 仅在当前页面内存中读取粗粒度来源，不写 Cookie、浏览器存储或访客标识。
export function acquisitionSource() {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return 'unknown';
  const known = new Set(['google', 'bing', 'chatgpt', 'claude', 'perplexity', 'producthunt', 'alternativeto', 'community']);
  try {
    const source = new URLSearchParams(location.search).get('utm_source')?.toLowerCase();
    let value = known.has(source) ? source : 'direct';
    if (!known.has(source) && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host === location.hostname) value = 'unknown';
      else {
        value = 'referral';
        for (const [domain, label] of [['google.com','google'],['bing.com','bing'],['chatgpt.com','chatgpt'],['claude.ai','claude'],['perplexity.ai','perplexity'],['producthunt.com','producthunt'],['alternativeto.net','alternativeto']]) {
          if (host === domain || host.endsWith('.' + domain)) { value = label; break; }
        }
      }
    }
    return value;
  } catch { return 'unknown'; }
}

// 只有现有登录流程确认用户已登录后才调用，统计失败不影响产品功能。
export async function recordAcquisition() {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  try {
    await fetch('/api/account/attribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: acquisitionSource() }) });
  } catch { /* 统计不是登录或翻译的前置条件。 */ }
}
