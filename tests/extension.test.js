import { observePinGuide, registerPinGuide } from '../extension/shared/pin-guide.js';
import { accountPreviewKey, validAccountPreview } from '../extension/shared/account-preview.js';
import { createTranslator, resolveLocale, messages } from '../extension/shared/i18n.js';
const i18n = createTranslator('zh-CN');
const localization = { observePinGuide, registerPinGuide, accountPreviewKey, validAccountPreview, messages, uiError: error => error.message, i18n, t: i18n.t, resolveLocale, KotobaI18n: globalThis.KotobaI18n, bindText: (node, render) => { node.textContent = i18n.t(render()); } };
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cloudRelay, validateRelay } from '../extension/shared/relay.js';
const backgroundSource = async () => (await readFile(new URL('../extension/background.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');

test('在其他标签页打开弹窗时明确提示采集来源，并能切换当前页而非误停止', async () => {
  let session = { status: 'listening', tabId: 1, tabTitle: '本机控制台' };
  const actions = [];
  let storedSettings;
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', firstElementChild: { style: {} } });
    return elements.get(id);
  } };
  const chrome = {
    tabs: { async query() { return [{ id: 2 }]; } },
    storage: { local: { async get(defaults) { return { ...defaults, ...storedSettings }; }, async set(value) { storedSettings = value; } }, onChanged: { addListener() {} } },
    runtime: { async sendMessage(message) {
      if (message.type === 'STATE') return session;
      if (message.type === 'USAGE') return { ok: true };
      actions.push(message);
      session = message.type === 'START' ? { status: 'listening', tabId: message.tabId } : { status: 'idle' };
      return { ok: true };
    } },
  };
  vm.runInNewContext((await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, ''), { ...localization, document, chrome, cloudRelay, fetchBalance: async () => 1200, setInterval() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('main').textContent, '切换到当前标签页翻译');
  assert.match(elements.get('detail').textContent, /本机控制台/);
  await elements.get('main').onclick();
  assert.equal(actions[0].type, 'START');
  assert.equal(actions[0].tabId, 2);
  assert.equal(elements.get('main').textContent, '停止翻译');
  assert.match(elements.get('detail').textContent, /视频画面内下方/);
  await elements.get('main').onclick();
  assert.equal(actions[1].type, 'STOP');
  elements.get('token').value = 'test-account-connection-code-12345';
  await elements.get('saveToken').onclick();
  assert.equal(storedSettings.relayUrl, cloudRelay);
  assert.equal(storedSettings.token, 'test-account-connection-code-12345');
  assert.equal(elements.get('pairingSummary').textContent, '已连接');
  assert(!actions.some(action => action.type === 'USAGE'));

});

test('扩展自己的弹出页可控制会话，网页脚本和伪造状态消息被拒绝', async () => {
  const id = 'a'.repeat(32);
  const url = path => `chrome-extension://${id}/${path}`;
  let listener;
  const chrome = {
    runtime: { id, getURL: url, onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { setAccessLevel() {} }, session: { async get() { return { session: { status: 'idle' } }; } } },
    tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  };
  vm.runInNewContext(await backgroundSource(), { ...localization, chrome, cloudRelay, validateRelay });
  const send = (message, sender) => new Promise(resolve => listener(message, sender, resolve));
  const extensionTab = { id, url: url('popup.html'), tab: { id: 1 } };
  assert.equal((await send({ type: 'STATE' }, extensionTab)).status, 'idle');
  const website = { id, url: 'https://example.org/video', tab: { id: 2 } };
  assert.equal((await send({ type: 'STATE' }, website)).ok, false);
  assert.equal((await send({ type: 'OFFSCREEN_UPDATE', id: 'fake' }, extensionTab)).ok, false);
});

test('过期字幕不会被相同内容重新显示，新内容和临时字幕修订正常显示', async () => {
  const elements = [];
  class Element {
    constructor() { this.children = []; this.style = { setProperty() {} }; elements.push(this); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    attachShadow() { return new Element(); }
    set textContent(text) { this.children = [String(text)]; }
    get textContent() { return this.children.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
    remove() {}
    addEventListener() {}
    getBoundingClientRect() { return { width: 900, height: 80 }; }
  }
  let listener;
  let expire;
  const document = { createElement: () => new Element(), createTextNode: text => text, documentElement: new Element(), addEventListener() {}, querySelectorAll() { return []; } };
  const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  vm.runInNewContext(await readFile(new URL('../extension/content.js', import.meta.url), 'utf8'), {
    ...localization, document, chrome, setTimeout(fn) { expire = fn; }, clearTimeout() {}, setInterval() {}, clearInterval() {}, addEventListener() {}, innerWidth: 1200, innerHeight: 800,
  });
  listener({ type: 'KOTOBA_CONFIG', settings: { showOriginal: true, fontSize: 28 } });
  const update = (text, final = true) => listener({ type: 'KOTOBA_CAPTIONS', captions: { original: { final: '今日は', partial: '' }, translation: { final: final ? text : '', partial: final ? '' : text } } });
  const translation = elements.find(node => node.className === 'line translation');
  update('今天', false);
  assert.equal(translation.textContent, '今天');
  update('今天');
  assert.equal(translation.children[1].textContent, '');
  expire();
  update('今天');
  assert.equal(translation.textContent, '');
  update('今天的天气');
  assert.equal(translation.textContent, '今天的天气');
  listener({ type: 'KOTOBA_SETTINGS', settings: { uiLocale: 'en' } });
  assert(elements.some(node => node.textContent === 'Hide Japanese text'));
  assert.equal(translation.textContent, '今天的天气', '切换界面语言不翻译或清除已有字幕');
  listener({ type: 'KOTOBA_SETTINGS', settings: { uiLocale: 'zh-CN' } });
  assert(elements.some(node => node.textContent === '隐藏日文原文'));
});

test('停止后保留最终费用，迟到的采集状态不能重新激活已停止会话', async () => {
  let saved = { id: 'session', tabId: 7, status: 'listening', billing: { estimateUsd: .01 } };
  let listener;
  const id = 'b'.repeat(32);
  const url = path => `chrome-extension://${id}/${path}`;
  const finalBilling = { estimateUsd: .02, segments: [{ id: 'request', endedAt: 123 }] };
  const chrome = {
    runtime: { id, getURL: url, onMessage: { addListener(fn) { listener = fn; } }, async sendMessage() { return { ok: true, billing: finalBilling }; } },
    storage: { local: { setAccessLevel() {} }, session: { async get() { return { session: saved }; }, async set(value) { saved = value.session; } } },
    offscreen: { async hasDocument() { return true; } },
    action: { async setBadgeText() {} },
    tabs: { async sendMessage() {}, onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  };
  vm.runInNewContext(await backgroundSource(), { ...localization, chrome, cloudRelay, validateRelay });
  const send = (message, page) => new Promise(resolve => listener(message, { id, url: url(page) }, resolve));
  await send({ type: 'STOP' }, 'popup.html');
  assert.equal(saved.status, 'idle');
  assert.equal(saved.billing.estimateUsd, .02);
  await send({ type: 'OFFSCREEN_UPDATE', id: 'session', state: { status: 'listening', billing: {} } }, 'offscreen.html');
  assert.equal(saved.status, 'idle');
  assert.equal(saved.billing.estimateUsd, .02);
});

test('字幕上的原文开关只允许当前翻译页调用，并持久保存及同步显示', async () => {
  let listener;
  const settings = {};
  const messages = [];
  const id = 'c'.repeat(32);
  const chrome = {
    runtime: { id, getURL: path => `chrome-extension://${id}/${path}`, onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { setAccessLevel() {}, async set(value) { Object.assign(settings, value); } }, session: { async get() { return { session: { tabId: 7, status: 'listening' } }; } } },
    tabs: { async sendMessage(tabId, message) { messages.push({ tabId, message }); }, onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  };
  vm.runInNewContext(await backgroundSource(), { ...localization, chrome, cloudRelay, validateRelay });
  const send = (tabId, value) => new Promise(resolve => listener({ type: 'SET_ORIGINAL', showOriginal: value }, { id, url: 'https://example.org', tab: { id: tabId } }, resolve));
  assert.equal((await send(8, false)).ok, false);
  assert.equal((await send(7, 'false')).ok, false);
  assert.equal((await send(7, false)).ok, true);
  assert.equal(settings.showOriginal, false);
  assert.equal(messages[0].tabId, 7);
  assert.equal(messages[0].message.settings.showOriginal, false);
});

test('连接码失效时提供常驻重新连接入口，调整字幕设置不会覆盖失效状态', async () => {
  const elements = new Map(), listeners = [];
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', firstElementChild: { style: {} }, focus() { this.focused = true; } });
    return elements.get(id);
  } };
  const chrome = {
    tabs: { async query() { return [{ id: 1 }]; } },
    storage: {
      local: { async get(defaults) { return { ...defaults, token: 'expired-test-connection-code' }; } },
      onChanged: { addListener(fn) { listeners.push(fn); } },
    },
    runtime: { async sendMessage() { return { status: 'idle' }; } },
  };
  const source = (await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, {
    ...localization,
    document, chrome, cloudRelay, setInterval() {},
    fetchBalance: async () => { throw Object.assign(new Error('连接码已失效'), { code: 'LOGIN_REQUIRED' }); },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('connectionIntro').hidden, false);
  assert.equal(elements.get('translationControl').hidden, true);
  assert.equal(elements.get('pairingSummary').textContent, '连接码已失效');
  elements.get('pairingBox').open = false;
  for (const fn of listeners) fn({ showOriginal: {} }, 'local');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('pairingSummary').textContent, '连接码已失效');
  assert.equal(elements.get('pairingBox').open, false, '不打断用户手动折叠');
  elements.get('connectionNotice').onclick();
  assert.equal(elements.get('pairingBox').open, true);
  assert.equal(elements.get('token').focused, true);
});

test('未连接与验证中隐藏翻译入口，验证后进入主界面，失效后仍能停止已有翻译', async () => {
  const elements = new Map(), listeners = [];
  const settings = { token: '' };
  let session = { status: 'idle' }, verify;
  let lookup = async () => { throw new Error('请先连接账户'); };
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', firstElementChild: { style: {} }, focus() {} });
    return elements.get(id);
  } };
  const chrome = {
    tabs: { async query() { return [{ id: 1 }]; } },
    storage: {
      local: { async get(defaults) { return { ...defaults, ...settings }; }, async set(values) { Object.assign(settings, values); } },
      onChanged: { addListener(fn) { listeners.push(fn); } },
    },
    runtime: { async sendMessage(msg) {
      if (msg.type === 'STOP') { session = { status: 'idle' }; return { ok: true }; }
      return session;
    } },
  };
  const source = (await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, { ...localization, document, chrome, cloudRelay, setInterval() {}, fetchBalance: (...args) => lookup(...args) });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await tick();
  assert.equal(elements.get('translationControl').hidden, true);
  assert.equal(elements.get('balanceCard').hidden, true);
  assert.equal(elements.get('connectionIntro').hidden, false);
  lookup = () => new Promise(resolve => { verify = resolve; });
  elements.get('token').value = 'new-valid-test-connection-code';
  const saving = elements.get('saveToken').onclick();
  await tick();
  assert.equal(elements.get('translationControl').hidden, true, '保存字符串不等于验证通过');
  verify(0); await saving;
  assert.equal(elements.get('translationControl').hidden, false, '零余额也是有效账户');
  assert.equal(elements.get('connectionIntro').hidden, true);
  assert.equal(elements.get('pairingBox').open, false);
  lookup = async () => { throw Object.assign(new Error('连接失效'), { code: 'LOGIN_REQUIRED' }); };
  await elements.get('refreshBalance').onclick();
  assert.equal(elements.get('translationControl').hidden, true);
  assert.equal(elements.get('connectionIntro').hidden, false);
  session = { status: 'listening', tabId: 9 };
  for (const fn of listeners) fn({ session: {} }, 'session');
  await tick();
  assert.equal(elements.get('translationControl').hidden, false);
  assert.equal(elements.get('main').textContent, '停止翻译', '凭据失效时不能切换去启动新翻译');
  await elements.get('main').onclick();
  assert.equal(elements.get('translationControl').hidden, true);
});

test('重新打开弹窗恢复同一账户预览，后台失败不闪回登录，失效或换码则丢弃预览', async () => {
  const settings = { token: 'preview-verified-account-code', relayUrl: cloudRelay };
  const stored = {};
  const open = async lookup => {
    const elements = new Map();
    let started;
    const querying = new Promise(resolve => { started = resolve; });
    const document = { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '', firstElementChild: { style: {} }, focus() {} });
      return elements.get(id);
    } };
    const chrome = {
      tabs: { async query() { return [{ id: 1 }]; } },
      storage: {
        local: { async get(defaults) { return { ...defaults, ...settings }; } },
        session: { async get(key) { return { [key]: stored[key] }; }, async set(value) { Object.assign(stored, value); } },
        onChanged: { addListener() {} },
      },
      runtime: { async sendMessage() { return { status: 'idle' }; } },
    };
    const source = (await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
    vm.runInNewContext(source, { ...localization, document, chrome, cloudRelay, setInterval() {}, fetchBalance: (...args) => { started(); return lookup(...args); } });
    await querying;
    return elements;
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const first = await open(async () => 1200);
  for (let i = 0; i < 100 && !stored.accountPreview; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(first.get('translationControl').hidden, false);
  assert(stored.accountPreview);
  assert(!JSON.stringify(stored).includes(settings.token), '快照不重复保存连接码');
  let reject;
  const returning = await open(() => new Promise((_, no) => { reject = no; }));
  assert.equal(returning.get('connectionIntro').hidden, true, '网络结果尚未返回时不显示连接引导');
  assert.equal(returning.get('translationControl').hidden, false);
  assert.equal(returning.get('pairingBox').open, false);
  assert.equal(returning.get('balanceLabel').textContent, '上次查询余额');
  assert.equal(returning.get('remainingTime').textContent, i18n.duration(1200));
  reject(new Error('余额查询超时，请稍后刷新。')); await tick();
  assert.equal(returning.get('connectionIntro').hidden, true, '暂时断网不当成退出登录');
  assert.equal(returning.get('translationControl').hidden, false);
  const originalToken = settings.token;
  settings.token = 'different-unverified-account-code';
  const other = await open(() => new Promise(() => {}));
  assert.equal(other.get('translationControl').hidden, true, '新连接码必须先验证，不能借用旧账户快照');
  assert.equal(other.get('remainingTime').textContent, '—');
  settings.token = originalToken;
  const expired = await open(async () => { throw Object.assign(new Error('连接码已失效'), { code: 'LOGIN_REQUIRED' }); });
  await tick();
  assert.equal(expired.get('translationControl').hidden, true);
  assert.equal(expired.get('connectionIntro').hidden, false);
  assert.equal(stored.accountPreview, null);
  const next = await open(() => new Promise(() => {}));
  assert.equal(next.get('translationControl').hidden, true, '已失效快照不能在再次打开时恢复');
});

test('账户预览限制凭据、服务地址、时间范围和余额格式', async () => {
  const a = await accountPreviewKey({ token: 'a', relayUrl: cloudRelay });
  assert.notEqual(a, await accountPreviewKey({ token: 'b', relayUrl: cloudRelay }));
  assert.notEqual(a, await accountPreviewKey({ token: 'a', relayUrl: 'ws://localhost:8787/stream' }));
  const snapshot = { key: a, seconds: 0, updatedAt: 1000 };
  assert(validAccountPreview(snapshot, a, 1000));
  assert(!validAccountPreview(snapshot, a, 3601000));
  assert(!validAccountPreview(snapshot, a, 999));
  assert(!validAccountPreview({ ...snapshot, seconds: -1 }, a, 1000));
  assert(!validAccountPreview({ ...snapshot, seconds: NaN }, a, 1000));
  assert(!validAccountPreview(snapshot, 'wrong', 1000));
});
