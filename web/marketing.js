import { i18n } from './shared/ui-locale.js';

// 仅页面内去重，不设置访客标识；关闭页面即丢弃。
const sent = new Set();
function record(event) {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const locale = i18n.getLocale() === 'en' ? 'en' : 'zh-CN';
  const key = `${locale}:${event}`;
  if (sent.has(key)) return;
  sent.add(key);
  fetch('/api/marketing/event', {
    method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, locale }),
  }).catch(() => {});
}

const film = document.getElementById('film');
const video = document.getElementById('marketingVideo');
const play = document.getElementById('playMarketingVideo');
const error = document.getElementById('filmError');
function showPoster() {
  if (!video.poster) video.poster = video.dataset.poster;
}
film.addEventListener('toggle', () => {
  if (film.open) showPoster();
  else video.pause();
});
document.querySelectorAll('[data-film-open]').forEach(link => link.addEventListener('click', () => {
  film.open = true; showPoster();
}));
if (location.hash === '#film') { film.open = true; showPoster(); }
play.addEventListener('click', async () => {
  error.hidden = true;
  video.controls = true;
  showPoster();
  if (!video.getAttribute('src')) video.src = video.dataset.video;
  else if (video.error) video.load();
  try { await video.play(); }
  catch { error.hidden = false; play.hidden = false; }
});
video.addEventListener('playing', () => { play.hidden = true; error.hidden = true; record('video_play'); });
video.addEventListener('ended', () => record('video_complete'));
video.addEventListener('error', () => { error.hidden = false; play.hidden = false; });
document.addEventListener('click', event => {
  const link = event.target.closest?.('a');
  if (!link) return;
  if (link.hasAttribute('download')) record('download_click');
  else if (link.getAttribute('href') === '#install') record('install_guide_click');
});
