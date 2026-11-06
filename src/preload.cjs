const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('terminalApp', {
  profiles: () => ipcRenderer.invoke('profiles'),
  create: (id, profile, cols, rows) => ipcRenderer.invoke('create', id, profile, cols, rows),
  write: (id, data) => ipcRenderer.invoke('write', id, data),
  resize: (id, cols, rows) => ipcRenderer.invoke('resize', id, cols, rows),
  close: id => ipcRenderer.invoke('close-session', id),
  ack: (id, length) => ipcRenderer.send('ack', id, length),
  copy: text => ipcRenderer.invoke('copy', text),
  paste: () => ipcRenderer.invoke('paste'),
  confirmClose: () => ipcRenderer.invoke('confirm-close'),
  window: action => ipcRenderer.invoke('window', action),
  onEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal-event', listener);
    return () => ipcRenderer.removeListener('terminal-event', listener);
  },
});
