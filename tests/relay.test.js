import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelay, cloudRelay } from '../extension/shared/relay.js';
test('服务地址仅接受本机或指定线上 WSS，不把连接码送往任意服务器', () => {
  assert.equal(validateRelay(cloudRelay), cloudRelay);
  assert.equal(validateRelay('ws://127.0.0.1:8787/stream'), 'ws://127.0.0.1:8787/stream');
  for (const url of ['ws://evil.test/stream', 'wss://evil.test/stream', cloudRelay + '?token=x', cloudRelay + '#x', 'wss://kotoba-beta.dracohu2025.workers.dev.evil.test/stream', 'ws://user:pass@localhost/stream']) assert.throws(() => validateRelay(url));
});
