import { resolveLocale, messages } from './shared/i18n.js';
import { registerPinGuide } from './shared/pin-guide.js';
registerPinGuide(chrome);
import { cloudRelay, validateRelay } from './shared/relay.js';
const publicError = error => Object.hasOwn(messages, error?.message) ? error.message : '操作未成功，请稍后重试。';
let creating;
let starting = false;
const state = async () => (await chrome.storage.session.get('session')).session || { status: 'idle' };
const save = session => chrome.storage.session.set({ session });
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

async function offscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ||= chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: '用户主动开启后采集当前标签页音频并生成实时字幕' }).finally(() => { creating = null; });
  await creating;
}

async function stop() {
  const current = await state();
  await save({ ...current, status: 'stopping' });
  const result = await chrome.offscreen.hasDocument() ? await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' }) : null;
  await save({ ...current, status: 'idle', level: 0, message: '', billing: result?.billing || current.billing });
  if (current.tabId) await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_REMOVE' }).catch(() => {});
  await chrome.action.setBadgeText({ text: '' });
  if (current.tabId) await chrome.action.setBadgeText({ tabId: current.tabId, text: '' }).catch(() => {});
}

async function start(tabId) {
  if (starting) throw new Error('正在连接，请稍候');
  starting = true;
  let id;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:\/\//.test(tab.url || '')) throw new Error('请在普通网页的视频标签页开启字幕');
    const settings = await chrome.storage.local.get({ relayUrl: cloudRelay, token: '', context: '', terms: '', showOriginal: true, fontSize: 28, opacity: 90, targetLanguage: 'zh', showSpeakers: true, uiLanguage: 'auto' });
    validateRelay(settings.relayUrl);
    if (!settings.token) throw new Error('请先连接 Kotoba 账户：在弹窗中获取并保存连接码');
    await stop();
    id = crypto.randomUUID();
    await save({ id, tabId, tabTitle: tab.title || '已选择的页面', status: 'connecting', audioSeconds: 0, targetLanguage: settings.targetLanguage });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['shared/messages.js', 'shared/i18n-core.js', 'content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'KOTOBA_CONFIG', settings: { targetLanguage: settings.targetLanguage, uiLocale: resolveLocale(settings.uiLanguage, [chrome.i18n?.getUILanguage() || 'en']), showOriginal: settings.showOriginal, showSpeakers: settings.showSpeakers, fontSize: settings.fontSize, opacity: settings.opacity } });
    await offscreen();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start', id, tabId, streamId, settings });
    if (!result?.ok) throw new Error(result?.error || '无法开始采集');
    return { ok: true };
  } catch (error) {
    if (!id || (await state()).id === id) {
      await stop();
      await save({ status: 'error', message: publicError(error) });
    }
    throw error;
  } finally { starting = false; }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target === 'offscreen') return;
  const trusted = sender.id === chrome.runtime.id && ['popup.html', 'offscreen.html'].some(path => sender.url === chrome.runtime.getURL(path));
  const run = async () => {
    if (message.type === 'MEDIA_EVENT' && sender.tab) {
      const current = await state();
      if (current.tabId !== sender.tab.id || !current.id || !['pause', 'resume', 'seek'].includes(message.event)) return;
      return chrome.runtime.sendMessage({ target: 'offscreen', type: message.event, id: current.id });
    }
    if (message.type === 'SET_OPACITY' && sender.id === chrome.runtime.id && sender.tab) {
      const current = await state();
      const opacity = Number(message.opacity);
      if (current.tabId !== sender.tab.id || !['connecting', 'listening', 'paused'].includes(current.status) || !Number.isInteger(opacity) || opacity < 0 || opacity > 100) throw new Error('只能调整当前翻译页面的字幕');
      await chrome.storage.local.set({ opacity });
      await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_SETTINGS', settings: { opacity } });
      return { ok: true };
    }
    if (message.type === 'SET_ORIGINAL' && sender.id === chrome.runtime.id && sender.tab) {
      const current = await state();
      if (current.tabId !== sender.tab.id || !['connecting', 'listening', 'paused'].includes(current.status) || typeof message.showOriginal !== 'boolean') throw new Error('只能调整当前翻译页面的字幕');
      await chrome.storage.local.set({ showOriginal: message.showOriginal });
      await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_SETTINGS', settings: { showOriginal: message.showOriginal } });
      return { ok: true };
    }
    if (!trusted) throw new Error('无权调用扩展控制接口');
    if (message.type === 'START') return start(message.tabId);
    if (message.type === 'STOP') { await stop(); return { ok: true }; }
    if (message.type === 'STATE') return state();
    if (message.type === 'USAGE') return usage();
    if (message.type === 'SETTINGS') {
      const settings = message.settings;
      if (!settings || !['zh', 'en', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'vi', 'th', 'id'].includes(settings.targetLanguage) || typeof settings.showOriginal !== 'boolean') throw new Error('设置无效');
      if (settings.showSpeakers !== undefined && typeof settings.showSpeakers !== 'boolean') throw new Error('说话人显示设置无效');
      if (settings.opacity !== undefined && (!Number.isInteger(Number(settings.opacity)) || Number(settings.opacity) < 0 || Number(settings.opacity) > 100)) throw new Error('不透明度无效');
      const values = {
        targetLanguage: settings.targetLanguage,
        showOriginal: settings.showOriginal,
        ...(typeof settings.showSpeakers === 'boolean' ? { showSpeakers: settings.showSpeakers } : {}),
        ...(settings.opacity !== undefined ? { opacity: Number(settings.opacity) } : {}),
      };
      await chrome.storage.local.set(values);
      const current = await state();
      if (['connecting', 'listening', 'paused'].includes(current.status)) {
        await save({ ...current, targetLanguage: values.targetLanguage });
        await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_SETTINGS', settings: values }).catch(() => {});
        const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'settings', id: current.id, settings: values });
        if (!result?.ok) throw new Error(result?.error || '未能应用设置，请停止后重新开始');
      }
      return { ok: true };
    }
    if (message.type === 'OFFSCREEN_UPDATE') {
      if (sender.url !== chrome.runtime.getURL('offscreen.html')) throw new Error('无权更新采集状态');
      const current = await state();
      if (current.id !== message.id || ['idle', 'stopping'].includes(current.status)) return;
      if (message.captions) {
        await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_CAPTIONS', captions: message.captions }).catch(() => {});
      } else {
        const next = { ...current, ...message.state };
        await save(next);
        await chrome.action.setBadgeBackgroundColor({ tabId: current.tabId, color: next.status === 'error' ? '#a83a3a' : '#245e52' });
        await chrome.action.setBadgeText({ tabId: current.tabId, text: next.status === 'listening' ? 'ON' : next.status === 'paused' ? 'Ⅱ' : next.status === 'error' ? '!' : '…' });
        await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_STATUS', status: next.status, message: next.message, speakerEpoch: next.speakerEpoch }).catch(() => {});
      }
    }
  };
  run().then(result => reply(result || { ok: true }), error => reply({ ok: false, error: publicError(error) }));
  return true;
});
chrome.tabs.onRemoved.addListener(async tabId => { if ((await state()).tabId === tabId) await stop(); });
chrome.tabs.onUpdated.addListener(async (tabId, change) => { if (change.status === 'loading' && (await state()).tabId === tabId) await stop(); });

// 只查询本次连接编号对应的费用；密钥留在本机服务端。
let usagePending;
async function usage() {
  if (usagePending) return usagePending;
  usagePending = (async () => {
    const current = await state();
    const segments = current.billing?.segments || [];
    if (!segments.length) return { ok: true };
    if (Date.now() - (current.usageAttemptAt || 0) < 15_000) return { ok: true };
    await save({ ...current, usageAttemptAt: Date.now() });
    try {
      const settings = await chrome.storage.local.get({ relayUrl: cloudRelay, token: '' });
      const result = await new Promise((resolve, reject) => {
        const socket = new WebSocket(validateRelay(settings.relayUrl));
        let timer;
        const finish = (error, value) => { clearTimeout(timer); socket.onclose = null; socket.close(); error ? reject(error) : resolve(value); };
        timer = setTimeout(() => finish(new Error('费用查询超时，请稍后重试')), 20_000);
        socket.onopen = () => socket.send(JSON.stringify({ type: 'usage', token: settings.token, references: segments.map(({ id, startedAt }) => ({ id, startedAt })) }));
        socket.onmessage = event => {
          try { const data = JSON.parse(event.data); if (data.type === 'usage') finish(null, data); else if (data.type === 'error') finish(new Error(data.message)); }
          catch { finish(new Error('费用响应格式异常')); }
        };
        socket.onerror = () => finish(new Error('无法连接本机服务查询费用'));
        socket.onclose = () => finish(new Error('费用查询连接提前关闭'));
      });
      const latest = await state();
      if (latest.id === current.id) await save({ ...latest, usage: result, usageError: '' });
    } catch (error) {
      const latest = await state();
      if (latest.id === current.id) await save({ ...latest, usageError: error.message });
    }
    return { ok: true };
  })().finally(() => { usagePending = null; });
  return usagePending;
}

// 只更新界面文字；不重连音频、不改变字幕目标语言。
chrome.storage.onChanged?.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.uiLanguage) return;
  const current = await state();
  if (current.tabId && ['connecting', 'listening', 'paused'].includes(current.status)) {
    await chrome.tabs.sendMessage(current.tabId, { type: 'KOTOBA_SETTINGS', settings: { uiLocale: resolveLocale(changes.uiLanguage.newValue, [chrome.i18n?.getUILanguage() || 'en']) } }).catch(() => {});
  }
});
