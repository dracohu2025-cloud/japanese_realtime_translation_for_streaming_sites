const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kotobaOverlay', {
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
});
