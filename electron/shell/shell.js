const ui = {
  url: document.getElementById('url'),
  form: document.getElementById('url-form'),
  back: document.getElementById('back'),
  forward: document.getElementById('forward'),
  reload: document.getElementById('reload'),
  toggle: document.getElementById('toggle'),
  state: document.getElementById('state'),
  detail: document.getElementById('detail'),
  meter: document.querySelector('#meter span'),
};

let listening = false;
let starting = false;
let capture = null;

function setState(status, message = '') {
  const labels = {
    idle: '空闲',
    connecting: '连接中',
    listening: '翻译中',
    error: '出错',
  };
  ui.state.textContent = labels[status] || status;
  ui.state.classList.toggle('error', status === 'error');
  ui.detail.textContent = message;
  listening = status === 'listening' || status === 'connecting';
  ui.toggle.textContent = listening ? '停止翻译' : '开始翻译';
  ui.toggle.classList.toggle('active', listening);
  ui.toggle.disabled = starting;
}

async function disposeCapture() {
  if (!capture) return;
  capture.generation += 1;
  capture.processor?.port.close?.();
  capture.processor?.disconnect();
  capture.source?.disconnect();
  capture.stream?.getTracks().forEach(track => track.stop());
  if (capture.context && capture.context.state !== 'closed') await capture.context.close();
  capture = null;
  ui.meter.style.width = '0%';
}

async function startCapture() {
  await disposeCapture();
  const source = await window.kotoba.windowSource();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxWidth: 16,
        maxHeight: 16,
      },
    },
  });
  stream.getVideoTracks().forEach(track => track.stop());

  const context = new AudioContext({ sampleRate: 16000 });
  await context.audioWorklet.addModule('./pcm-worklet.js');
  const sourceNode = context.createMediaStreamSource(stream);
  const processor = new AudioWorkletNode(context, 'kotoba-pcm');
  const silent = context.createGain();
  silent.gain.value = 0;
  sourceNode.connect(processor).connect(silent).connect(context.destination);

  const session = { generation: 0, stream, context, source: sourceNode, processor, armed: false };
  capture = session;
  processor.port.onmessage = event => {
    if (capture !== session || !session.armed) return;
    window.kotoba.sendPcm(event.data.buffer);
    ui.meter.style.width = `${Math.min(100, Math.round((event.data.level || 0) * 100))}%`;
  };
  stream.getAudioTracks()[0].onended = () => {
    if (capture === session) {
      setState('error', '窗口音频采集已结束，请重新开始');
      stopAll();
    }
  };
  await context.resume();
}

async function stopAll() {
  starting = false;
  await window.kotoba.stopTranslate().catch(() => {});
  await disposeCapture();
  if (!ui.state.classList.contains('error')) setState('idle', '已停止');
  ui.toggle.disabled = false;
}

async function startAll() {
  if (starting || listening) return;
  starting = true;
  ui.toggle.disabled = true;
  setState('connecting', '正在连接语音识别…');
  try {
    const ready = await window.kotoba.readyState();
    if (!ready.ready) throw new Error('尚未配置 SONIOX_API_KEY，请在项目根目录创建 .env 后重启应用');
    await startCapture();
    await window.kotoba.startTranslate({ context: '', terms: '' });
    if (capture) capture.armed = true;
    starting = false;
    ui.toggle.disabled = false;
  } catch (error) {
    starting = false;
    await disposeCapture();
    await window.kotoba.stopTranslate().catch(() => {});
    setState('error', error.message || String(error));
    ui.toggle.disabled = false;
  }
}

ui.form.addEventListener('submit', async event => {
  event.preventDefault();
  const target = await window.kotoba.navigate(ui.url.value);
  ui.url.value = target;
});
ui.back.addEventListener('click', () => window.kotoba.back());
ui.forward.addEventListener('click', () => window.kotoba.forward());
ui.reload.addEventListener('click', () => window.kotoba.reload());
ui.toggle.addEventListener('click', () => (listening ? stopAll() : startAll()));

window.kotoba.onUrl(url => { ui.url.value = url; });
window.kotoba.onStatus(data => {
  setState(data.status, data.message || '');
  if (data.status === 'error' || data.status === 'idle') disposeCapture();
});
window.kotoba.onMeter(data => {
  if (typeof data.audioSeconds === 'number' && listening) {
    ui.detail.textContent = `已识别 ${Math.round(data.audioSeconds)} 秒 · 日语 → 中文`;
  }
});

(async () => {
  const ready = await window.kotoba.readyState();
  const url = await window.kotoba.currentUrl();
  ui.url.value = url || ready.home;
  setState(
    ready.ready ? 'idle' : 'error',
    ready.ready
      ? `模型 ${ready.model} · CDN代理 ${ready.proxy?.port || '?'} · 打开视频后点播放`
      : (ready.envHint || '缺少 SONIOX_API_KEY'),
  );
})();
