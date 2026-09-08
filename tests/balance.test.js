import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBalance } from '../extension/shared/balance.js';
import { cloudRelay } from '../extension/shared/relay.js';

function socketFixture(response) {
  const sockets = [];
  class Socket {
    constructor(url) {
      this.url = url; this.sent = []; sockets.push(this);
      queueMicrotask(() => this.onopen());
    }
    send(raw) {
      this.sent.push(JSON.parse(raw));
      queueMicrotask(() => this.onmessage({ data: JSON.stringify(response) }));
    }
    close() { this.closed = true; this.onclose?.(); }
  }
  return { Socket, sockets };
}

test('余额查询只发送账户查询指令，零余额正常返回并关闭连接', async () => {
  const { Socket, sockets } = socketFixture({ type: 'balance', remainingSeconds: 0 });
  assert.equal(await fetchBalance(cloudRelay, 'fixture-token', Socket), 0);
  assert.deepEqual(sockets[0].sent, [{ type: 'balance', token: 'fixture-token' }]);
  assert.equal(sockets[0].closed, true);
});

test('过期连接码与无效余额不伪装成零余额，不暴露上游错误文本', async () => {
  for (const response of [
    { type: 'error', code: 'LOGIN_REQUIRED', message: 'private upstream details' },
    { type: 'balance', remainingSeconds: -1 },
  ]) {
    const { Socket, sockets } = socketFixture(response);
    await assert.rejects(fetchBalance(cloudRelay, 'fixture-token', Socket), error => {
      assert(!error.message.includes('private'));
      return true;
    });
    assert.equal(sockets[0].closed, true);
  }
});

test('缺少连接码或自定义地址时不向其他主机发送账户凭据', async () => {
  class ForbiddenSocket { constructor() { assert.fail('不得建立连接'); } }
  await assert.rejects(fetchBalance(cloudRelay, '', ForbiddenSocket), /连接码/);
  await assert.rejects(fetchBalance('wss://example.com/stream', 'fixture-token', ForbiddenSocket), /自定义连接/);
});
