const original = document.getElementById('original');
const translation = document.getElementById('translation');
const status = document.getElementById('status');

let lastContent = '';
let expiry;

function paint(element, lane) {
  const final = document.createTextNode(lane?.final || '');
  const partial = document.createElement('span');
  partial.className = 'partial';
  partial.textContent = lane?.partial || '';
  element.replaceChildren(final, partial);
  element.scrollTop = element.scrollHeight;
}

function clearLinesSoon(next) {
  if (next === lastContent) return;
  clearTimeout(expiry);
  lastContent = next;
  if (!next) return;
  expiry = setTimeout(() => {
    original.textContent = '';
    translation.textContent = '';
    lastContent = '';
  }, 9000);
}

window.kotobaOverlay.onCaptions(captions => {
  paint(original, captions.original);
  paint(translation, captions.translation);
  clearLinesSoon((original.textContent || '') + (translation.textContent || ''));
  if (status.textContent && status.dataset.mode === 'connecting') status.textContent = '';
});

window.kotobaOverlay.onStatus(data => {
  if (data.status === 'connecting') {
    status.dataset.mode = 'connecting';
    status.textContent = '正在连接日语字幕…';
  } else if (data.status === 'error') {
    status.dataset.mode = 'error';
    status.textContent = data.message || '出错';
  } else if (data.status === 'idle') {
    status.dataset.mode = '';
    status.textContent = '';
    original.textContent = '';
    translation.textContent = '';
    lastContent = '';
    clearTimeout(expiry);
  } else if (data.status === 'listening') {
    status.dataset.mode = '';
    status.textContent = '';
  }
});
