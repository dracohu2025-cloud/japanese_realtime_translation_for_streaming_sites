/** MissAV 定向适配：CDN 代理注入 + 失焦恢复播放。 */
export function matchMissav(url = '') {
  return /https?:\/\/(?:[\w-]+\.)*missav\.[a-z.]+/i.test(url);
}

export function buildMissavKeepPlayScript() {
  return `(() => {
    if (window.__kotobaMissavKeepPlay) return;
    window.__kotobaMissavKeepPlay = true;
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
            if (result && result.catch) result.catch(() => {});
          }
          if (window.hls && window.hls.startLoad) window.hls.startLoad(-1);
        } catch {}
      }, 80);
    };
    window.addEventListener('blur', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
  })();`;
}
