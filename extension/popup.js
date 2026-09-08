import { t, i18n, bindText, uiError } from './shared/ui-locale.js';
import { cloudRelay } from './shared/relay.js';
import { fetchBalance } from './shared/balance.js';
import { accountPreviewKey, validAccountPreview } from './shared/account-preview.js';
import { observePinGuide } from './shared/pin-guide.js';
const $ = id => document.getElementById(id);
const isActive = data => ['connecting', 'listening', 'paused'].includes(data.status);
let connectionState = 'unknown';
let statusToken;
let statusRelay;
let initialized = false;
let sessionActive = false;
let connectionError = '';
let currentSession = {}, currentTabId;
let savingToken = false;
const isConnectedView = () => ['verified', 'cached', 'custom'].includes(connectionState);
let pinState = { pinned: undefined, handled: true };
const pinGuide = observePinGuide(chrome, state => { pinState = state; renderPinGuide(); });
function renderPinGuide() {
  $('pinReminder').hidden = !initialized || !isConnectedView() || pinState.pinned !== false || pinState.handled;
}
$('skipPin').onclick = () => pinGuide.dismiss().catch(() => {});
const labels = { idle: '准备就绪', connecting: '正在连接…', listening: '正在翻译日语', paused: '已暂停', error: '需要处理一下' };
async function refresh() {
  const data = await chrome.runtime.sendMessage({ type: 'STATE' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = isActive(data);
  sessionActive = active;
  currentSession = data; currentTabId = tab?.id;
  renderConnection();
  const elsewhere = active && data.tabId !== tab?.id;
  bindText($('state'), () => elsewhere ? '另一个标签页已开启翻译' : labels[data.status] || '准备就绪');
  bindText($('detail'), () => elsewhere
    ? t('正在翻译：{title}。点击上方按钮切换到当前页面。', { title: data.tabTitle || t('其他标签页') })
    : data.message || (active ? '字幕默认显示在视频画面内下方，可拖到页面其他位置。只采集此标签页的声音，切换页面不会自动切换翻译。' : '在视频网页开启翻译，字幕将显示在视频画面内下方。'));
  const seconds = Math.max(0, Math.floor(data.audioSeconds || 0));
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  bindText($('translatedTime'), () => duration);
  bindText($('duration'), () => t('本次 {duration}', { duration }));
  bindText($('speakerHint'), () => data.speakerEpoch > 1 ? '翻译已重新连接，说话人编号可能发生变化。' : '帮助区分不同声音，编号可能在重新连接后变化。');
  $('meter').firstElementChild.style.width = `${Math.min(100, (data.level || 0) * 180)}%`;
}
$('main').onclick = async () => {
  $('main').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await chrome.runtime.sendMessage({ type: 'STATE' });
    const connected = isConnectedView();
    if (!connected && !isActive(data)) { $('pairingBox').open = true; $('token').focus(); return; }
    const result = await chrome.runtime.sendMessage(isActive(data) && (data.tabId === tab?.id || !connected) ? { type: 'STOP' } : { type: 'START', tabId: tab.id });
    if (!result.ok) throw new Error(result.error);
    await refresh();
  } catch (error) { bindText($('state'), () => '未能开始'); bindText($('detail'), () => uiError(error)); }
  finally { $('main').disabled = false; }
};
$('settings').onclick = e => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.session) refresh(); });

function tokenStatus(token, relayUrl = cloudRelay) {
  const ok = typeof token === 'string' && token.length >= 24;
  if (statusToken !== token || statusRelay !== relayUrl) {
    statusToken = token;
    statusRelay = relayUrl;
    connectionState = ok ? 'checking' : 'missing';
    connectionError = '';
    $('pairingBox').open = true;
  }
  renderConnection();
  return ok;
}
function renderConnection() {
  if (!initialized) return;
  $('popupLoading').hidden = true;
  $('pairingBox').hidden = false;
  const connected = isConnectedView();
  const showTranslation = connected || sessionActive;
  renderPinGuide();
  for (const id of ['languageControl', 'translationControl', 'translationContext', 'captionSettings', 'balanceCard', 'popupFooter']) $(id).hidden = !showTranslation;
  $('connectionIntro').hidden = showTranslation;
  const labels = { checking: '正在验证', verified: '已连接', cached: '连接已保存', custom: '自定义连接', expired: '连接码已失效', missing: '尚未连接', unknown: '待验证', unavailable: '暂未验证成功' };
  bindText($('pairingSummary'), () => labels[connectionState]);
  bindText($('connectionTitle'), () => connectionState === 'expired' ? '重新连接，继续听懂。' : connectionState === 'checking' ? '正在连接你的账户…' : '先连接你的账户。');
  bindText($('connectionHint'), () => connectionState === 'expired' ? '连接码已失效。请到账户页获取新的连接码，并在下方更新。' : connectionState === 'unavailable' ? connectionError : connectionState === 'checking' ? '正在验证连接码，请稍候。' : '登录 Kotoba 获取连接码，粘贴到下方即可。无需先付费，新账户可领取 20 分钟试用。');
  $('retryConnection').hidden = connectionState !== 'unavailable';
  $('connectionNotice').hidden = !sessionActive || connected;
  bindText($('connectionNotice'), () => '账户连接需要更新 · 重新连接 →');
  bindText($('main'), () => sessionActive ? connected && currentSession.tabId !== currentTabId ? '切换到当前标签页翻译' : '停止翻译' : '开始翻译当前标签页');
}
$('connectionNotice').onclick = () => {
  $('pairingBox').open = true;
  $('token').focus();
};

async function loadSettings() {
  const settings = await chrome.storage.local.get({ relayUrl: cloudRelay, targetLanguage: 'zh', showOriginal: true, showSpeakers: true, token: '', opacity: 90 });
  $('targetLanguage').value = settings.targetLanguage;
  $('showOriginal').checked = settings.showOriginal;
  $('showSpeakers').checked = settings.showSpeakers;
  $('token').value = settings.token;
  $('opacity').value = settings.opacity;
  bindText($('opacityLabel'), () => i18n.percent(settings.opacity));
  tokenStatus(settings.token, settings.relayUrl);
  return settings;
}
async function changeSettings() {
  const result = await chrome.runtime.sendMessage({ type: 'SETTINGS', settings: { targetLanguage: $('targetLanguage').value, showOriginal: $('showOriginal').checked, showSpeakers: $('showSpeakers').checked, opacity: Number($('opacity').value) } });
  if (!result.ok) bindText($('detail'), () => result.error);
}
$('targetLanguage').onchange = changeSettings;
$('showOriginal').onchange = changeSettings;
$('showSpeakers').onchange = changeSettings;
$('opacity').oninput = () => { bindText($('opacityLabel'), () => i18n.percent(Number($('opacity').value))); };
$('opacity').onchange = changeSettings;

$('saveToken').onclick = async () => {
  const token = $('token').value.trim();
  if (token.length < 24) {
    bindText($('tokenFeedback'), () => '连接码不完整，请从账户页重新复制。');
    return;
  }
  savingToken = true; $('saveToken').disabled = true;
  try {
    await chrome.storage.local.set({ token, relayUrl: cloudRelay });
    tokenStatus(token);
    bindText($('tokenFeedback'), () => '正在验证账户连接…');
    await refreshBalance();
    bindText($('tokenFeedback'), () => connectionState === 'verified' ? '账户已连接。' : '连接尚未验证成功，请检查连接码或重试。');
  } catch { bindText($('tokenFeedback'), () => '未能保存连接码，请重试。'); }
  finally { savingToken = false; $('saveToken').disabled = false; }
};

chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.targetLanguage || changes.showOriginal || changes.showSpeakers || changes.token || changes.opacity)) loadSettings(); if (area === 'local' && !savingToken && (changes.token || changes.relayUrl)) refreshBalance(); });

let balanceRequest = 0;
let balanceCredential = '';
let latestBalance;
async function refreshBalance() {
  const request = ++balanceRequest;
  const settings = await chrome.storage.local.get({ relayUrl: cloudRelay, token: '' });
  if (request !== balanceRequest) return;
  tokenStatus(settings.token, settings.relayUrl);
  const credential = settings.relayUrl + settings.token;
  if (balanceCredential !== credential) {
    balanceCredential = credential; latestBalance = undefined;
    bindText($('remainingTime'), () => '—');
  }
  $('refreshBalance').disabled = true;
  if (connectionState === 'cached') bindText($('balanceLabel'), () => '上次查询余额');
  bindText($('balanceHint'), () => '正在查询账户余额…');
  try {
    const seconds = await fetchBalance(settings.relayUrl, settings.token);
    if (request !== balanceRequest) return;
    latestBalance = seconds;
    if (connectionState !== 'verified') $('pairingBox').open = false;
    connectionState = 'verified';
    renderConnection();
    const updatedAt = Date.now();
    bindText($('remainingTime'), () => i18n.duration(seconds));
    bindText($('balanceLabel'), () => '剩余翻译时长');
    bindText($('balanceHint'), () => t('更新于 {time} · 每 15 秒刷新。时长用完会停止，不会自动加购。', { time: i18n.time(updatedAt) }));
    // 余额返回后才更新展示快照。存储失败不应把已验证账户降级成未连接。
    if (chrome.storage.session) {
      const key = await accountPreviewKey(settings);
      if (request === balanceRequest) await chrome.storage.session.set({ accountPreview: { key, seconds, updatedAt } }).catch(() => {});
    }
  } catch (error) {
    if (request !== balanceRequest) return;
    bindText($('balanceLabel'), () => latestBalance === undefined ? '剩余翻译时长' : '上次查询余额');
    bindText($('balanceHint'), () => uiError(error));
    if (settings.relayUrl !== cloudRelay && settings.token.length >= 24) {
      connectionState = 'custom';
    } else if (error.code === 'LOGIN_REQUIRED') {
      if (connectionState !== 'expired') $('pairingBox').open = true;
      connectionState = 'expired';
      chrome.storage.session?.set({ accountPreview: null }).catch(() => {});
    } else if (settings.token && !isConnectedView()) {
      connectionState = 'unavailable'; connectionError = uiError(error);
      $('pairingBox').open = true;
    }
    renderConnection();
  } finally { if (request === balanceRequest) $('refreshBalance').disabled = false; }
}
$('refreshBalance').onclick = refreshBalance;
$('retryConnection').onclick = refreshBalance;
async function initialize() {
  try {
    const settings = await loadSettings();
    if (settings.token.length >= 24 && settings.relayUrl === cloudRelay && chrome.storage.session) {
      const key = await accountPreviewKey(settings);
      const { accountPreview } = await chrome.storage.session.get('accountPreview');
      // 读取期间若用户更换凭据，不能将旧账户的预览套到新账户上。
      if (statusToken === settings.token && statusRelay === settings.relayUrl && connectionState === 'checking' && validAccountPreview(accountPreview, key)) {
        connectionState = 'cached'; latestBalance = accountPreview.seconds;
        balanceCredential = settings.relayUrl + settings.token;
        $('pairingBox').open = false;
        bindText($('remainingTime'), () => i18n.duration(accountPreview.seconds));
        bindText($('balanceLabel'), () => '上次查询余额');
      }
    }
  } catch { connectionError = '操作未成功，请稍后重试。'; }
  finally {
    initialized = true; renderConnection();
    refresh().catch(() => {});
    refreshBalance();
  }
}
initialize();
setInterval(() => { if (document.visibilityState !== 'hidden') refreshBalance(); }, 15_000);
