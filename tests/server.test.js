import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { createApp } from '../server/app.js';
import { loadConfig, validateStart } from '../server/config.js';
import { connectSoniox } from '../server/soniox.js';

async function fixture(t, overrides = {}, factory) {
  const config = { ...loadConfig({ RELAY_TOKEN: 'test-pairing-token-1234567890' }), port: 0, ...overrides };
  const app = createApp(config, factory);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  config.port = app.server.address().port;
  t.after(() => app.close());
  const base = `http://127.0.0.1:${config.port}`;
  return { config, app, base, async socket(origin = base) {
    const ws = new WebSocket(`ws://127.0.0.1:${config.port}/stream`, { origin });
    await once(ws, 'open');
    t.after(() => ws.terminate());
    return ws;
  } };
}
const receive = async ws => JSON.parse((await once(ws, 'message'))[0].toString());
const start = token => ({ type: 'start', token, targetLanguage: 'zh', terms: [], context: '', speakerDiarization: true });

test('缺少供应商密钥可以预览，但 readiness 明确返回 503', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.base}/health`)).status, 200);
  assert.equal((await fetch(`${f.base}/ready`)).status, 503);
  const setup = await (await fetch(`${f.base}/api/setup`)).json();
  assert.equal(setup.ready, false);
  assert(!('apiKey' in setup));
  const ws = await f.socket();
  ws.send(JSON.stringify(start(f.config.token)));
  assert.equal((await receive(ws)).code, 'NOT_CONFIGURED');
});
test('跨站、错误 Host 和错误配对码不能调用服务', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.base}/api/setup`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(`${f.base}/api/setup`, { headers: { Origin: 'https://example.org' } })).status, 403);
  const fromExtension = await fetch(`${f.base}/api/setup`, { headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' } });
  assert.equal(fromExtension.status, 200);
  assert.equal((await fromExtension.json()).token, f.config.token);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    http.get(`${f.base}/api/setup`, { headers: { Host: 'example.org' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(wrongHostStatus, 403);
  const ws = await f.socket();
  ws.send(JSON.stringify(start('wrong')));
  assert.equal((await receive(ws)).code, 'AUTH');
  const denied = new WebSocket(`ws://127.0.0.1:${f.config.port}/stream`, { origin: 'https://example.org' });
  const [error] = await once(denied, 'error');
  assert.match(error.message, /403/);
});
test('协议只接受经验证的配置，拒绝非法帧', async t => {
  assert.throws(() => validateStart({ ...start('x'), terms: ['a'.repeat(61)] }));
  assert.throws(() => validateStart({ ...start('x'), speakerDiarization: 'true' }));
  assert.throws(() => loadConfig({ PORT: '0' }));
  const f = await fixture(t);
  const ws = await f.socket(); ws.send(Buffer.alloc(4));
  assert.equal((await receive(ws)).code, 'AUTH');
});
test('经本机中继连接真实 WebSocket 假上游，验证配置、音频、字幕和资源清理', async t => {
  const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1',
    verifyClient: info => info.req.headers.authorization === 'Bearer fake-provider-key',
  });
  await once(upstream, 'listening');
  t.after(() => { for (const ws of upstream.clients) ws.terminate(); upstream.close(); });
  let upstreamConfig;
  let seenBytes = 0;
  upstream.on('connection', ws => {
    ws.on('message', (raw, binary) => {
      if (!binary && raw.length) upstreamConfig = JSON.parse(raw.toString());
      else if (!raw.length) { ws.send(JSON.stringify({ tokens: [], finished: true })); ws.close(); }
      else {
        seenBytes += raw.length;
        ws.send(JSON.stringify({ tokens: [{ text: '今日は', is_final: true, speaker: '1', translation_status: 'original' }, { text: '今天', is_final: true, speaker: '1', translation_status: 'translation' }], total_audio_proc_ms: 100 }));
      }
    });
  });
  const factory = (config, options, emit) => connectSoniox(config, options, emit, `ws://127.0.0.1:${upstream.address().port}`);
  const f = await fixture(t, { apiKey: 'fake-provider-key' }, factory);
  const ws = await f.socket();
  ws.send(JSON.stringify(start(f.config.token)));
  assert.equal((await receive(ws)).type, 'ready');
  ws.send(Buffer.alloc(3200));
  const message = await receive(ws);
  assert.equal(message.tokens[1].text, '今天');
  assert.equal(message.tokens[0].speaker, '1');
  assert.equal(message.tokens[1].speaker, '1');
  assert.equal(upstreamConfig.enable_speaker_diarization, true);
  assert.equal(seenBytes, 3200);
  assert.match(upstreamConfig.client_reference_id, /^kotoba:[a-f0-9-]{36}$/);
  assert.equal(Object.hasOwn(upstreamConfig, 'api_key'), false, '供应商密钥只通过握手请求头发送');
  assert.deepEqual(upstreamConfig.language_hints, ['ja']);
  assert.equal(upstreamConfig.translation.target_language, 'zh');
  assert.equal(upstreamConfig.audio_format, 'pcm_s16le');
  assert(!JSON.stringify(message).includes('fake-provider-key'));
  ws.send(JSON.stringify({ type: 'stop' }));
  await once(ws, 'close');
  assert.equal(upstream.clients.size, 0);
});
test('客户端提前离开时，上游会话被关闭', async t => {
  let closed = false;
  const f = await fixture(t, { apiKey: 'fake' }, () => ({ ready: Promise.resolve(), write() {}, close() { closed = true; }, finish() { closed = true; } }));
  const ws = await f.socket();
  ws.send(JSON.stringify(start(f.config.token)));
  await receive(ws);
  ws.close(); await once(ws, 'close');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(closed);
});
