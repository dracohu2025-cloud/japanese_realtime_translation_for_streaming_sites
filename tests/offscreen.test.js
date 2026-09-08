import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validateRelay } from '../extension/shared/relay.js';
import { CaptionBuffer } from '../extension/shared/captions.js';
import { estimateBilling, countTokenCharacters } from '../extension/shared/billing.js';

test('原文开关不重连，语言切换与暂停恢复新建分段，停止返回完整费用元数据', async () => {
  const sockets = [];
  const updates = [];
  let listener;
  class Socket {
    static OPEN = 1;
    constructor() { this.readyState = 1; sockets.push(this); this.sent = []; }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Context {
    state = 'running';
    audioWorklet = { async addModule() {} };
    createMediaStreamSource() { return { connect() { return this; } }; }
    createGain() { return { gain: {}, connect() {} }; }
    async resume() {}
    async close() { this.state = 'closed'; }
  }
  const track = { stop() {} };
  const chrome = { runtime: { id: 'test', async sendMessage(value) { updates.push(value); }, onMessage: { addListener(fn) { listener = fn; } } } };
  const source = (await readFile(new URL('../extension/offscreen.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, {
    chrome, validateRelay, CaptionBuffer, estimateBilling, countTokenCharacters, URL, WebSocket: Socket, AudioContext: Context,
    AudioWorkletNode: class { port = {}; disconnect() {} },
    navigator: { mediaDevices: { async getUserMedia() { return { getTracks: () => [track], getAudioTracks: () => [track] }; } } },
    setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 },
  });
  const send = value => new Promise(resolve => listener({ target: 'offscreen', id: 'session', ...value }, { id: 'test' }, resolve));
  const ready = (socket, id) => { socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'ready', requestId: id, startedAt: Date.now(), model: 'stt-rt-v5' }) }); };
  assert.equal((await send({ type: 'start', settings: { relayUrl: 'ws://localhost:8787/stream', token: 'fake', terms: '', context: '', targetLanguage: 'zh' } })).ok, true);
  ready(sockets[0], 'first');
  assert.equal(sockets[0].sent[0].speakerDiarization, true);
  await send({ type: 'settings', settings: { targetLanguage: 'zh', showSpeakers: false } });
  assert.equal(sockets.length, 1);
  await send({ type: 'settings', settings: { targetLanguage: 'zh', showOriginal: false } });
  assert.equal(sockets.length, 1);
  await send({ type: 'settings', settings: { targetLanguage: 'en', showOriginal: false } });
  ready(sockets[1], 'second');
  assert.equal(updates.filter(update => update.state?.status === 'listening').at(-1).state.speakerEpoch, 2);
  sockets[1].onmessage({ data: JSON.stringify({ type: 'tokens', tokens: [{ text: '译文', speaker: '1', is_final: true, translation_status: 'translation' }] }) });
  assert.equal(updates.at(-1).captions.speakerEpoch, 2);
  assert.equal(updates.at(-1).captions.translation.runs[0].speaker, '1');
  assert.equal(sockets[1].sent[0].targetLanguage, 'en');
  await send({ type: 'pause' });
  await send({ type: 'settings', settings: { targetLanguage: 'ko', showOriginal: true } });
  assert.equal(sockets.length, 2);
  await send({ type: 'resume' });
  ready(sockets[2], 'third');
  assert.equal(sockets[2].sent[0].targetLanguage, 'ko');
  sockets[2].onmessage({ data: JSON.stringify({ type: 'quota', remainingSeconds: 1199.5 }) });
  assert.equal(updates.at(-1).state.remainingSeconds, 1199.5);
  sockets[2].onmessage({ data: JSON.stringify({ type: 'quota', remainingSeconds: -1 }) });
  assert.equal(updates.at(-1).state.remainingSeconds, 1199.5);
  sockets[2].onmessage({ data: JSON.stringify({ type: 'quota', remainingSeconds: 0 }) });
  assert.equal(updates.at(-1).state.remainingSeconds, 0);
  const stopped = await send({ type: 'stop' });
  assert.equal(stopped.billing.segments.length, 3);
  assert(stopped.billing.segments.every(s => s.endedAt));
  assert(!JSON.stringify(stopped.billing).includes('fake'));
  await send({ type: 'start', settings: { relayUrl: 'ws://localhost:8787/stream', token: 'fake', terms: '', context: '', targetLanguage: 'zh' } });
  ready(sockets[3], 'failure');
  sockets[3].onmessage({ data: JSON.stringify({ type: 'error', code: 'UPSTREAM_CLOSED', message: 'private provider detail' }) });
  await new Promise(resolve => setImmediate(resolve));
  const failure = updates.filter(update => update.state?.status === 'error').at(-1).state;
  assert.equal(failure.errorCode, 'UPSTREAM_CLOSED');
  assert.equal(failure.message, '翻译服务连接已断开，请重新开始翻译。');
  assert.equal(sockets[3].readyState, 3);
  assert(!JSON.stringify(updates).includes('private provider detail'));
});
