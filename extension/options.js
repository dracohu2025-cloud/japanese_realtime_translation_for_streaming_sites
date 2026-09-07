const defaults = { relayUrl: 'ws://127.0.0.1:8787/stream', token: '', context: '', terms: '', showOriginal: true, fontSize: 28, opacity: 90 };
const $ = id => document.getElementById(id);
const settings = await chrome.storage.local.get(defaults);
for (const [key, value] of Object.entries(settings)) {
  if (typeof value === 'boolean') $(key).checked = value;
  else $(key).value = value;
}
const size = () => { $('sizeLabel').textContent = `${$('fontSize').value} px`; };
$('fontSize').oninput = size; size();
const opacity = () => { $('opacityLabel').textContent = `${$('opacity').value}%`; };
$('opacity').oninput = opacity; opacity();
$('form').onsubmit = async event => {
  event.preventDefault();
  try {
    const url = new URL($('relayUrl').value.trim());
    if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/stream' || url.search || url.hash || url.username || url.password) throw new Error('请填写本机地址，例如 ws://127.0.0.1:8787/stream');
    const terms = $('terms').value.split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
    if (terms.length > 30 || terms.some(t => t.length > 60)) throw new Error('术语最多 30 个，每个最多 60 字');
    await chrome.storage.local.set({ relayUrl: url.href, token: $('token').value.trim(), context: $('context').value.trim(), terms: terms.join('\n'), showOriginal: $('showOriginal').checked, fontSize: Number($('fontSize').value), opacity: Number($('opacity').value) });
    $('feedback').textContent = '已保存，回到视频页面即可开始。';
  } catch (error) { $('feedback').textContent = error.message; }
};
