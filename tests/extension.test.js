import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('在其他标签页打开弹窗时明确提示采集来源，并能切换当前页而非误停止', async () => {
  let session = { status: 'listening', tabId: 1, tabTitle: '本机控制台' };
  const actions = [];
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', firstElementChild: { style: {} } });
    return elements.get(id);
  } };
  const chrome = {
    tabs: { async query() { return [{ id: 2 }]; } },
    storage: { local: { async get(defaults) { return defaults; } }, onChanged: { addListener() {} } },
    runtime: { async sendMessage(message) {
      if (message.type === 'STATE') return session;
      if (message.type === 'USAGE') return { ok: true };
      actions.push(message);
      session = message.type === 'START' ? { status: 'listening', tabId: message.tabId } : { status: 'idle' };
      return { ok: true };
    } },
  };
  vm.runInNewContext(await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8'), { document, chrome, setInterval() {} });
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
  vm.runInNewContext(await readFile(new URL('../extension/background.js', import.meta.url), 'utf8'), { chrome });
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
    document, chrome, setTimeout(fn) { expire = fn; }, clearTimeout() {}, setInterval() {}, clearInterval() {}, addEventListener() {}, innerWidth: 1200, innerHeight: 800,
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
  vm.runInNewContext(await readFile(new URL('../extension/background.js', import.meta.url), 'utf8'), { chrome });
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
  vm.runInNewContext(await readFile(new URL('../extension/background.js', import.meta.url), 'utf8'), { chrome });
  const send = (tabId, value) => new Promise(resolve => listener({ type: 'SET_ORIGINAL', showOriginal: value }, { id, url: 'https://example.org', tab: { id: tabId } }, resolve));
  assert.equal((await send(8, false)).ok, false);
  assert.equal((await send(7, 'false')).ok, false);
  assert.equal((await send(7, false)).ok, true);
  assert.equal(settings.showOriginal, false);
  assert.equal(messages[0].tabId, 7);
  assert.equal(messages[0].message.settings.showOriginal, false);
});
