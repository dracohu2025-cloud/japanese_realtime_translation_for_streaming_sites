const $ = id => document.getElementById(id);
const isActive = data => ['connecting', 'listening', 'paused'].includes(data.status);
const labels = { idle: '准备就绪', connecting: '正在连接…', listening: '正在翻译日语', paused: '已暂停', error: '需要处理一下' };
async function refresh() {
  const data = await chrome.runtime.sendMessage({ type: 'STATE' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = isActive(data);
  const elsewhere = active && data.tabId !== tab?.id;
  $('state').textContent = elsewhere ? '另一个标签页已开启翻译' : labels[data.status] || '准备就绪';
  $('detail').textContent = elsewhere
    ? `采集页面：${data.tabTitle || '其他标签页'}。点击下方切换到当前页面。`
    : data.message || (active ? '字幕默认显示在视频画面内下方，可拖到页面其他位置。只采集此标签页的声音，切换页面不会自动切换翻译。' : '在视频网页开启翻译，字幕将显示在视频画面内下方。');
  $('main').textContent = elsewhere ? '切换到当前标签页翻译' : active ? '停止翻译' : '开始翻译当前标签页';
  const segments = data.billing?.segments || [];
  const estimate = data.billing?.estimateUsd;
  $('estimate').textContent = typeof estimate === 'number' ? `$${estimate.toFixed(6)}` : '—';
  $('actualLabel').textContent = data.usageError && data.usage?.actualUsd != null ? '上次已归账（查询失败）' : 'Soniox 已归账';
  $('actual').textContent = data.usage?.actualUsd != null ? `$${Number(data.usage.actualUsd).toFixed(6)}` : '等待记录';
  $('actual').title = data.usage?.actualUsd != null ? `USD ${data.usage.actualUsd}` : '尚无匹配记录，不能按零费用计算';
  const reported = data.usage?.reported || 0;
  const complete = segments.length && segments.every(s => s.endedAt) && reported === segments.length;
  $('billingStatus').textContent = data.usageError || (segments.length
    ? `${reported}/${segments.length} 段已归账 · ${complete ? '本次记录已齐' : '其余等待请求结束及供应商记录'}${data.usage?.checkedAt ? ` · ${new Date(data.usage.checkedAt).toLocaleTimeString()} 查询` : ''}。USD，预估与归账不能相加。`
    : '开始翻译后显示费用，单位 USD。');
  $('refreshUsage').disabled = !segments.length;
  $('speakerHint').textContent = data.speakerEpoch > 1 ? `第 ${data.speakerEpoch} 段连接：编号已重置，与前一段无身份对应关系。` : '编号仅区分声音，不代表身份；重连后重新编号。';
  const seconds = data.audioSeconds || 0;
  $('duration').textContent = `本次 ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('meter').firstElementChild.style.width = `${Math.min(100, (data.level || 0) * 180)}%`;
}
$('main').onclick = async () => {
  $('main').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await chrome.runtime.sendMessage({ type: 'STATE' });
    const result = await chrome.runtime.sendMessage(isActive(data) && data.tabId === tab?.id ? { type: 'STOP' } : { type: 'START', tabId: tab.id });
    if (!result.ok) throw new Error(result.error);
    await refresh();
  } catch (error) { $('state').textContent = '未能开始'; $('detail').textContent = error.message; }
  finally { $('main').disabled = false; }
};
$('settings').onclick = e => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.session) refresh(); });
refresh();

function tokenStatus(token) {
  const ok = typeof token === 'string' && token.length >= 24;
  $('pairingSummary').textContent = ok ? '已保存' : '未填写配对码';
  $('pairingBox').open = !ok;
  return ok;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get({ targetLanguage: 'zh', showOriginal: true, showSpeakers: true, token: '', opacity: 90 });
  $('targetLanguage').value = settings.targetLanguage;
  $('showOriginal').checked = settings.showOriginal;
  $('showSpeakers').checked = settings.showSpeakers;
  $('token').value = settings.token;
  $('opacity').value = settings.opacity;
  $('opacityLabel').textContent = `${settings.opacity}%`;
  tokenStatus(settings.token);
}
async function changeSettings() {
  const result = await chrome.runtime.sendMessage({ type: 'SETTINGS', settings: { targetLanguage: $('targetLanguage').value, showOriginal: $('showOriginal').checked, showSpeakers: $('showSpeakers').checked, opacity: Number($('opacity').value) } });
  if (!result.ok) $('detail').textContent = result.error;
}
$('targetLanguage').onchange = changeSettings;
$('showOriginal').onchange = changeSettings;
$('showSpeakers').onchange = changeSettings;
$('opacity').oninput = () => { $('opacityLabel').textContent = `${$('opacity').value}%`; };
$('opacity').onchange = changeSettings;

$('saveToken').onclick = async () => {
  const token = $('token').value.trim();
  if (token.length < 24) {
    $('tokenFeedback').textContent = '配对码至少 24 位，请从本机服务读取或粘贴。';
    return;
  }
  await chrome.storage.local.set({ token });
  tokenStatus(token);
  $('tokenFeedback').textContent = '已保存，可以直接开始翻译。';
};

$('fetchToken').onclick = async () => {
  $('fetchToken').disabled = true;
  $('tokenFeedback').textContent = '正在读取本机服务…';
  try {
    const response = await fetch('http://127.0.0.1:8787/api/setup');
    if (!response.ok) throw new Error('本机服务拒绝了读取请求');
    const data = await response.json();
    if (typeof data.token !== 'string' || data.token.length < 24) throw new Error('本机服务未返回有效配对码');
    $('token').value = data.token;
    await chrome.storage.local.set({ token: data.token, ...(data.relayUrl ? { relayUrl: data.relayUrl } : {}) });
    tokenStatus(data.token);
    $('tokenFeedback').textContent = data.ready ? '已从本机服务读取并保存。' : '已保存配对码，但本机尚未配置 SONIOX_API_KEY。';
  } catch {
    $('tokenFeedback').textContent = '读不到本机服务。请确认已启动 npm start，或手动粘贴配对码。';
  } finally { $('fetchToken').disabled = false; }
};

async function refreshUsage() {
  $('refreshUsage').disabled = true;
  try { await chrome.runtime.sendMessage({ type: 'USAGE' }); await refresh(); }
  catch { $('billingStatus').textContent = '费用查询不可用，请重新打开弹窗'; }
}
$('refreshUsage').onclick = refreshUsage;
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.targetLanguage || changes.showOriginal || changes.showSpeakers || changes.token || changes.opacity)) loadSettings(); });
loadSettings();
refreshUsage();
setInterval(refreshUsage, 15_000);
