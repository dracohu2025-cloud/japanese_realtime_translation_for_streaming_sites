import { validateRelay } from './shared/relay.js';
import { CaptionBuffer } from './shared/captions.js';
import { estimateBilling, countTokenCharacters } from './shared/billing.js';

const billing = s => ({ segments: s.segments, estimateUsd: estimateBilling(s.segments) });

let session;
const post = (s, payload) => chrome.runtime.sendMessage({ type: 'OFFSCREEN_UPDATE', id: s.id, ...payload }).catch(() => {});
const status = (s, value, message = '', errorCode = '') => {
  s.status = value;
  return post(s, { state: { status: value, message, errorCode, speakerEpoch: s.segments.length, audioSeconds: Math.round(s.audioSeconds || 0), billing: billing(s), remainingSeconds: s.remainingSeconds } });
};

function disconnect(s) {
  const segment = s.segments.at(-1);
  if (segment && !segment.endedAt) segment.endedAt = Date.now();
  s.generation++;
  s.ready = false;
  s.socket?.close();
  s.socket = null;
  clearTimeout(s.connectTimer);
  s.captions.reset();
  post(s, { captions: s.captions.snapshot() });
}

async function dispose(s) {
  if (!s) return;
  disconnect(s);
  s.stream?.getTracks().forEach(track => track.stop());
  s.processor?.disconnect();
  if (s.context && s.context.state !== 'closed') await s.context.close();
  if (s.playback && s.playback.state !== 'closed') await s.playback.close();
  if (session === s) session = null;
}

async function fail(s, message, errorCode = '') {
  if (session !== s) return;
  await dispose(s);
  await status(s, 'error', message, errorCode);
}

function connect(s) {
  if (session !== s) return;
  disconnect(s);
  if (s.segments.length >= 200) { fail(s, '本次连接次数已达上限，请重新开始翻译'); return; }
  status(s, 'connecting');
  const generation = s.generation;
  const socket = new WebSocket(s.settings.relayUrl);
  s.socket = socket;
  const current = () => session === s && s.generation === generation;
  s.connectTimer = setTimeout(() => { if (current()) fail(s, '连接超时，请检查网络后重试'); }, 12_000);
  socket.onopen = () => {
    if (!current()) { socket.close(); return; }
    socket.send(JSON.stringify({ type: 'start', token: s.settings.token, speakerDiarization: true, targetLanguage: s.settings.targetLanguage || 'zh', context: s.settings.context, terms: s.settings.terms.split(/[,，\n]/).map(x => x.trim()).filter(Boolean) }));
  };
  socket.onmessage = event => {
    if (!current()) return;
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'ready') {
        clearTimeout(s.connectTimer);
        const context = { terms: s.settings.terms.split(/[,，\n]/).map(x => x.trim()).filter(Boolean), ...(s.settings.context ? { text: s.settings.context } : {}) };
        s.segments.push({ id: data.requestId, startedAt: data.startedAt || Date.now(), model: data.model, audioSeconds: 0, inputChars: [...JSON.stringify(context)].length, finalChars: 0, partialChars: 0 });
        s.ready = true;
        status(s, 'listening');
      } else if (data.type === 'tokens') {
        if (s.segments.length) countTokenCharacters(s.segments.at(-1), data.tokens);
        post(s, { captions: { ...s.captions.push(data.tokens), speakerEpoch: s.segments.length } });
      }
      else if (data.type === 'quota' && Number.isFinite(data.remainingSeconds) && data.remainingSeconds >= 0) {
        const first = s.remainingSeconds === undefined;
        s.remainingSeconds = data.remainingSeconds;
        if (first || data.remainingSeconds === 0 || Date.now() - (s.lastQuotaUpdate || 0) >= 1000) {
          s.lastQuotaUpdate = Date.now();
          post(s, { state: { remainingSeconds: s.remainingSeconds } });
        }
      }
      else if (data.type === 'error') {
        const messages = {
          LOGIN_REQUIRED: '连接码已失效，请在账户页重新获取并保存。',
          AUTH: '请在账户页重新获取连接码并保存。',
          QUOTA_EXHAUSTED: '可用时长已用完，请前往账户页领取试用或购买时长；不会自动加购。',
          SESSION_ACTIVE: '此账户正在另一处翻译，请先停止另一处翻译。',
          TIME_LIMIT: '本次翻译已达一小时，请重新开始。',
          AUDIO_TIMEOUT: '暂未收到声音，请确认视频正在播放，然后重新开始。',
          UPSTREAM_CONNECT: '翻译服务暂时无法连接，请稍后重新开始。',
          UPSTREAM_CLOSED: '翻译服务连接已断开，请重新开始翻译。',
          PROVIDER_NETWORK: '翻译服务连接已断开，请重新开始翻译。',
          PROVIDER_ERROR: '翻译服务暂时无法处理音频，请稍后重试。',
          RATE_LIMIT: '音频传输速度异常，请重新开始翻译。',
          TOO_LARGE: '音频传输出现积压，请检查网络后重新开始。',
        };
        const errorCode = typeof data.code === 'string' && /^[A-Z_]{1,40}$/.test(data.code) ? data.code : 'UNKNOWN';
        fail(s, messages[errorCode] || '翻译暂时中断，请稍后重新开始。', errorCode);
      }
    } catch { fail(s, '收到无法识别的字幕数据'); }
  };
  socket.onerror = () => { if (current()) fail(s, '暂时无法连接翻译服务，请检查网络后重试'); };
  socket.onclose = () => { if (current()) fail(s, '翻译连接已断开，点击重新开始即可恢复'); };
}

async function start(message) {
  await dispose(session);
  const url = new URL(message.settings.relayUrl);
  validateRelay(url.href);
  const s = { id: message.id, settings: message.settings, generation: 0, captions: new CaptionBuffer(4000, { retainHistory: true }), audioSeconds: 0, lastMeter: 0, segments: [] };
  session = s;
  try {
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } }, video: false });
    if (session !== s) { s.stream.getTracks().forEach(t => t.stop()); return; }
    s.context = new AudioContext({ sampleRate: 16000 });
    await s.context.audioWorklet.addModule('pcm-worklet.js');
    if (session !== s) return;
    const source = s.context.createMediaStreamSource(s.stream);
    // 播放使用设备原生采样率，避免为了识别而降低用户听到的音质。
    s.playback = new AudioContext();
    s.playback.createMediaStreamSource(s.stream).connect(s.playback.destination);
    s.processor = new AudioWorkletNode(s.context, 'kotoba-pcm');
    const silent = s.context.createGain();
    silent.gain.value = 0;
    source.connect(s.processor).connect(silent).connect(s.context.destination);
    s.processor.port.onmessage = event => {
      if (session !== s || !s.ready || s.socket?.readyState !== WebSocket.OPEN) return;
      if (s.socket.bufferedAmount > 128_000) { fail(s, '网络跟不上音频播放，会话已停止'); return; }
      s.socket.send(event.data.buffer);
      s.audioSeconds += event.data.buffer.byteLength / 32_000;
      s.segments.at(-1).audioSeconds += event.data.buffer.byteLength / 32_000;
      if (performance.now() - s.lastMeter > 1000) {
        s.lastMeter = performance.now();
        post(s, { state: { status: 'listening', audioSeconds: Math.round(s.audioSeconds), level: event.data.level, billing: billing(s), remainingSeconds: s.remainingSeconds } });
      }
    };
    s.stream.getAudioTracks()[0].onended = () => { if (session === s) fail(s, '标签页音频采集已结束'); };
    await s.context.resume();
    await s.playback.resume();
    connect(s);
  } catch (error) {
    await dispose(s);
    throw new Error('音频采集失败，请检查浏览器权限并重试。');
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target !== 'offscreen' || sender.id !== chrome.runtime.id || sender.tab) return;
  (async () => {
    if (message.type === 'start') await start(message);
    else if (message.type === 'stop') {
      const current = session;
      await dispose(current);
      return { ok: true, ...(current ? { billing: billing(current) } : {}) };
    }
    else if (session?.id === message.id) {
      if (message.type === 'settings') {
        const changed = session.settings.targetLanguage !== message.settings.targetLanguage;
        Object.assign(session.settings, message.settings);
        if (changed && session.status !== 'paused') connect(session);
      } else if (message.type === 'pause' || message.type === 'seek') { disconnect(session); await status(session, 'paused'); }
      else if (message.type === 'resume' && session.status === 'paused') connect(session);
    }
    return { ok: true };
  })().then(reply, error => reply({ ok: false, error: error.message }));
  return true;
});
