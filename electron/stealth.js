import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function chromeMajor(version) {
  return String(version || '130').split('.')[0];
}

export function buildChromeUa(chromeVersion) {
  const version = chromeVersion || '130.0.0.0';
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

function buildStealthScript(chromeVersion, mode) {
  const major = chromeMajor(chromeVersion);
  const full = chromeVersion || `${major}.0.0.0`;
  // early：只做 Turnstile 可接受的最小补丁；full：普通页面补齐 Chrome 外观。
  return `(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined, configurable: true });
    } catch {}
    try {
      const brands = [
        { brand: 'Not(A:Brand', version: '8' },
        { brand: 'Chromium', version: '${major}' },
        { brand: 'Google Chrome', version: '${major}' },
      ];
      const uald = {
        brands,
        mobile: false,
        platform: 'macOS',
        getHighEntropyValues: async hints => {
          const out = { brands, mobile: false, platform: 'macOS' };
          if (hints.includes('platformVersion')) out.platformVersion = '15.0.0';
          if (hints.includes('architecture')) out.architecture = 'arm';
          if (hints.includes('bitness')) out.bitness = '64';
          if (hints.includes('model')) out.model = '';
          if (hints.includes('uaFullVersion')) out.uaFullVersion = '${full}';
          if (hints.includes('fullVersionList')) out.fullVersionList = brands.map(b => ({ brand: b.brand, version: b.brand === 'Not(A:Brand' ? '10.0.0.0' : '${full}' }));
          return out;
        },
        toJSON() { return { brands, mobile: false, platform: 'macOS' }; },
      };
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => uald, configurable: true });
    } catch {}
    ${mode === 'full' ? `
    try {
      if (!window.chrome) window.chrome = {};
      window.chrome.runtime = window.chrome.runtime || {};
      window.chrome.csi = window.chrome.csi || function () { return {}; };
      window.chrome.loadTimes = window.chrome.loadTimes || function () { return {}; };
      window.chrome.app = window.chrome.app || { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };
    } catch {}
    try {
      Object.defineProperty(Navigator.prototype, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'], configurable: true });
      Object.defineProperty(Navigator.prototype, 'language', { get: () => 'zh-CN', configurable: true });
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel', configurable: true });
      Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Google Inc.', configurable: true });
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 0, configurable: true });
      Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8, configurable: true });
      Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8, configurable: true });
    } catch {}
    // MissAV 等站在 blur/切后台时会强制 pause；Electron 弹广告窗或叠层时会触发，导致播放器一直转圈。
    try {
      if (!window.__kotobaKeepPlay) {
        window.__kotobaKeepPlay = true;
        let wantPlay = false;
        setInterval(() => {
          try { if (window.player && window.player.playing) wantPlay = true; } catch {}
        }, 250);
        const resume = () => {
          setTimeout(() => {
            try {
              if (!wantPlay || !window.player) return;
              if (!window.player.playing) {
                const result = window.player.play();
                if (result && typeof result.catch === 'function') result.catch(() => {});
              }
              if (window.hls && typeof window.hls.startLoad === 'function') window.hls.startLoad(-1);
            } catch {}
          }, 80);
        };
        window.addEventListener('blur', resume);
        window.addEventListener('focus', resume);
        document.addEventListener('visibilitychange', resume);
      }
    } catch {}
    ` : ''}
  })();`;
}

function buildSessionPreloadSource(earlyScript, fullScript) {
  return `'use strict';
try {
  var url = (typeof location !== 'undefined' && location.href) || '';
  if (url.startsWith('file://')) return;
  var isTurnstile = /challenges\\.cloudflare\\.com/i.test(url);
  var isChallengePage = /cdn-cgi\\/challenge-platform|__cf_chl/i.test(url);
  var { webFrame } = require('electron');
  var mode = (isTurnstile || isChallengePage) ? 'early' : 'full';
  var code = mode === 'early' ? ${JSON.stringify(earlyScript)} : ${JSON.stringify(fullScript)};
  webFrame.executeJavaScriptInIsolatedWorld(0, [{ code: code, url: 'kotoba://stealth' }]);
} catch (e) {}
`;
}

/** 让浏览分区更接近真实 Chrome，降低 Cloudflare 二次拦截导致的白屏/一直转圈。 */
export function applyBrowserStealth(session, { userDataDir, chromeVersion, extraFullScripts = [] } = {}) {
  const version = chromeVersion || process.versions.chrome || '130.0.0.0';
  const major = chromeMajor(version);
  const ua = buildChromeUa(version);
  const early = buildStealthScript(version, 'early');
  const full = [buildStealthScript(version, 'full'), ...extraFullScripts].filter(Boolean).join('\n');

  session.setUserAgent(ua);

  const dir = userDataDir || process.cwd();
  mkdirSync(dir, { recursive: true });
  const preloadPath = join(dir, 'kotoba-stealth-preload.cjs');
  writeFileSync(preloadPath, buildSessionPreloadSource(early, full), 'utf8');
  const existing = typeof session.getPreloads === 'function' ? session.getPreloads() : [];
  session.setPreloads([...new Set([...existing.filter(p => !String(p).includes('kotoba-stealth-preload')), preloadPath])]);

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    let grease = '"Not(A:Brand";v="8"';
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'sec-ch-ua' && headers[key]) {
        const match = String(headers[key]).match(/"(Not[^"]*Brand)";v="([^"]+)"/i);
        if (match) grease = `"${match[1]}";v="${match[2]}"`;
      }
    }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase().startsWith('sec-ch-ua')) delete headers[key];
    }
    headers['User-Agent'] = ua;
    headers['sec-ch-ua'] = `${grease}, "Chromium";v="${major}", "Google Chrome";v="${major}"`;
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"macOS"';
    if (!headers['Accept-Language'] && !headers['accept-language']) {
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7';
    }
    // MissAV 正片 CDN（surrit）与封面 CDN 常校验 Referer
    if (/surrit\.com|fourhoi\.com/i.test(details.url || '')) {
      if (!headers.Referer && !headers.referer) headers.Referer = 'https://missav.ai/';
      if (!headers.Origin && !headers.origin) headers.Origin = 'https://missav.ai';
    }
    callback({ requestHeaders: headers });
  });

  return { ua, chromeVersion: version, preloadPath };
}
