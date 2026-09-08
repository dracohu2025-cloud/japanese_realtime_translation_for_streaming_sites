// 固定与跳过均记为已处理，之后主动取消固定也不再提醒。
export function registerPinGuide(chrome) {
  chrome.action?.onUserSettingsChanged?.addListener(settings => {
    if (settings.isOnToolbar) chrome.storage.local.set({ pinGuideHandled: true }).catch(() => {});
  });
  chrome.runtime.onInstalled?.addListener(async ({ reason }) => {
    if (reason !== 'install') return;
    try {
      const settings = await chrome.action.getUserSettings();
      if (settings.isOnToolbar) { await chrome.storage.local.set({ pinGuideHandled: true }); return; }
      await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    } catch { /* 引导不可用不影响翻译。 */ }
  });
}

export function observePinGuide(chrome, render) {
  let state = { pinned: undefined, handled: true };
  let revision = 0;
  const refresh = async () => {
    const request = ++revision;
    try {
      const [settings, saved] = await Promise.all([
        chrome.action.getUserSettings(), chrome.storage.local.get({ pinGuideHandled: false }),
      ]);
      if (request !== revision) return;
      state = { pinned: settings.isOnToolbar, handled: saved.pinGuideHandled || settings.isOnToolbar };
      render(state);
      if (settings.isOnToolbar && !saved.pinGuideHandled) await chrome.storage.local.set({ pinGuideHandled: true });
    } catch { /* 无法检测时保持隐藏，避免误报未固定。 */ }
  };
  chrome.action?.onUserSettingsChanged?.addListener(refresh);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pinGuideHandled) {
      revision++;
      state = { ...state, handled: changes.pinGuideHandled.newValue === true }; render(state);
    }
  });
  refresh();
  return {
    refresh,
    async dismiss() {
      revision++;
      state = { ...state, handled: true }; render(state);
      await chrome.storage.local.set({ pinGuideHandled: true });
    },
  };
}
