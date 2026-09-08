import test from 'node:test';
import assert from 'node:assert/strict';
import { observePinGuide, registerPinGuide } from '../extension/shared/pin-guide.js';
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const storageListeners = [], actionListeners = [], installed = [], opened = [];
  const saved = {};
  let pinned = false;
  const chrome = {
    action: {
      async getUserSettings() { return { isOnToolbar: pinned }; },
      onUserSettingsChanged: { addListener(fn) { actionListeners.push(fn); } },
    },
    runtime: {
      getURL: path => 'chrome-extension://fixture/' + path,
      onInstalled: { addListener(fn) { installed.push(fn); } },
    },
    tabs: { async create(value) { opened.push(value); } },
    storage: {
      local: {
        async get(defaults) { return { ...defaults, ...saved }; },
        async set(values) {
          Object.assign(saved, values);
          storageListeners.forEach(fn => fn(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])), 'local'));
        },
      },
      onChanged: { addListener(fn) { storageListeners.push(fn); } },
    },
  };
  return { chrome, saved, opened, installed, async pin(value) {
    pinned = value;
    actionListeners.forEach(fn => fn({ isOnToolbar: value }));
    await settle();
  } };
}
test('首次安装打开欢迎页，更新不打开；已固定不打开', async () => {
  const f = fixture(); registerPinGuide(f.chrome);
  await f.installed[0]({ reason: 'update' });
  assert.equal(f.opened.length, 0);
  await f.installed[0]({ reason: 'install' });
  assert.equal(f.opened[0].url, 'chrome-extension://fixture/welcome.html');
  await f.pin(true);
  await f.installed[0]({ reason: 'install' });
  assert.equal(f.opened.length, 1);
});
test('固定后自动隐藏，主动取消固定和重新打开也不再提醒', async () => {
  const f = fixture(); registerPinGuide(f.chrome);
  let view;
  observePinGuide(f.chrome, state => { view = state; });
  await settle();
  assert.deepEqual(view, { pinned: false, handled: false });
  await f.pin(true);
  assert.deepEqual(view, { pinned: true, handled: true });
  await f.pin(false);
  assert.deepEqual(view, { pinned: false, handled: true });
  observePinGuide(f.chrome, state => { view = state; });
  await settle();
  assert.equal(view.handled, true);
});
test('跳过选择不被正在进行的旧检测覆盖，检测失败不误报', async () => {
  const f = fixture();
  let complete, view;
  f.chrome.action.getUserSettings = () => new Promise(resolve => { complete = resolve; });
  const guide = observePinGuide(f.chrome, state => { view = state; });
  await guide.dismiss();
  complete({ isOnToolbar: false });
  await settle();
  assert.equal(view.handled, true);
  f.chrome.action.getUserSettings = async () => { throw Error('unavailable'); };
  await guide.refresh();
  assert.equal(view.handled, true);
});
