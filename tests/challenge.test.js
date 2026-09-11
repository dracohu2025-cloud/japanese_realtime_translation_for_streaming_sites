import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../web/challenge.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/, '').replace('export function', 'function');
function setup(loaded = true) {
  const elements = new Map(['loginChallenge', 'challengeWidget', 'challengeStatus', 'retryChallenge'].map(id => [id, {
    hidden: true, classList: { toggle() {} }, scrollIntoView() { this.scrolled = true; }, focus() { this.focused = true; },
  }]));
  let callbacks, script, resets = 0;
  const provider = { render(_node, options) { callbacks = options; return 0; }, remove() {}, reset() { resets++; } };
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id), head: { append(value) { script = value; } }, createElement: () => ({ remove() {} }) },
    bindText: (node, render) => { node.textContent = render(); }, setTimeout, clearTimeout,
    ...(loaded ? { turnstile: provider } : {}),
  });
  vm.runInContext(source, context);
  const challenge = context.createChallenge('test-only');
  return { challenge, elements, get callbacks() { return callbacks; }, get script() { return script; }, provider, context, get resets() { return resets; } };
}
test('验证成功、过期、重试、重置与失败都更新状态，不允许保留失效 token', () => {
  const env = setup();
  assert.equal(env.challenge.token(), '');
  assert.equal(env.elements.get('loginChallenge').hidden, false);
  env.callbacks.callback('test-token');
  assert.equal(env.challenge.token(), 'test-token');
  env.callbacks['expired-callback']();
  assert.equal(env.challenge.token(), '');
  assert.equal(env.elements.get('retryChallenge').hidden, false);
  env.elements.get('retryChallenge').onclick();
  env.callbacks.callback('new-test-token');
  env.challenge.reset();
  assert.equal(env.resets, 1);
  assert.equal(env.challenge.token(), '');
  env.callbacks['error-callback']();
  assert.match(env.elements.get('challengeStatus').textContent, /加载失败/);
  env.challenge.focus();
  assert.equal(env.elements.get('loginChallenge').scrolled, true);
  assert.equal(env.elements.get('loginChallenge').focused, true);
});
test('验证脚本加载不阻塞调用方，加载失败可重试', async () => {
  const env = setup(false);
  assert.equal(typeof env.challenge.focus, 'function');
  assert.match(env.elements.get('challengeStatus').textContent, /正在加载/);
  env.script.onerror();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.elements.get('retryChallenge').hidden, false);
  assert.equal(env.challenge.token(), '');
  env.context.turnstile = env.provider;
  env.elements.get('retryChallenge').onclick();
  env.callbacks.callback('retry-test-token');
  assert.equal(env.challenge.token(), 'retry-test-token');
});
