const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kotoba', {
  readyState: () => ipcRenderer.invoke('app:ready-state'),
  navigate: url => ipcRenderer.invoke('browser:navigate', url),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  currentUrl: () => ipcRenderer.invoke('browser:current-url'),
  windowSource: () => ipcRenderer.invoke('capture:window-source'),
  startTranslate: options => ipcRenderer.invoke('translate:start', options),
  stopTranslate: () => ipcRenderer.invoke('translate:stop'),
  sendPcm: buffer => ipcRenderer.send('translate:pcm', buffer),
  onUrl: handler => {
    const listener = (_e, url) => handler(url);
    ipcRenderer.on('browser:url', listener);
    return () => ipcRenderer.removeListener('browser:url', listener);
  },
  onStatus: handler => {
    const listener = (_e, data) => handler(data);
    ipcRenderer.on('translate:status', listener);
    return () => ipcRenderer.removeListener('translate:status', listener);
  },
  onCaptions: handler => {
    const listener = (_e, data) => handler(data);
    ipcRenderer.on('translate:captions', listener);
    return () => ipcRenderer.removeListener('translate:captions', listener);
  },
  onMeter: handler => {
    const listener = (_e, data) => handler(data);
    ipcRenderer.on('translate:meter', listener);
    return () => ipcRenderer.removeListener('translate:meter', listener);
  },
});
