const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { profiles, createSessions } = require('./sessions.cjs');
const pty = require('node-pty');
let window;
let sessions;
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page) throw new Error('Untrusted terminal request');
}
const handle = (channel, fn) => ipcMain.handle(channel, (event, ...args) => { trusted(event); return fn(...args); });
handle('profiles', () => profiles().map(({ id, label }) => ({ id, label })));
handle('create', (...args) => sessions.create(...args));
handle('write', (...args) => sessions.write(...args));
handle('resize', (...args) => sessions.resize(...args));
handle('close-session', id => sessions.close(id));
ipcMain.on('ack', (event, ...args) => { try { trusted(event); sessions.ack(...args); } catch { /* Ignore messages from a closing renderer. */ } });
handle('copy', text => { if (typeof text !== 'string' || text.length > 1048576) throw new Error('Selection is too large'); clipboard.writeText(text); });
handle('paste', async () => {
  const text = clipboard.readText();
  if (text.length > 1048576) throw new Error('Paste exceeds 1 MiB');
  if (/[\r\n]/.test(text)) {
    const { response } = await dialog.showMessageBox(window, { type: 'question', buttons: ['Cancel', 'Paste'], defaultId: 0, cancelId: 0, message: 'Paste multiple lines?', detail: 'Multi-line text can execute commands in your shell.' });
    if (response !== 1) return '';
  }
  return text;
});
handle('confirm-close', async () => (await dialog.showMessageBox(window, { type: 'question', buttons: ['Keep open', 'Close'], defaultId: 0, cancelId: 0, message: 'Close this terminal?', detail: 'Running commands in this terminal will be stopped.' })).response === 1);
handle('window', action => {
  if (action === 'minimize') window.minimize();
  else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  else if (action === 'close') window.close();
});
app.whenReady().then(() => {
  window = new BrowserWindow({ width: 1240, height: 820, minWidth: 680, minHeight: 420, backgroundColor: '#161b1b', frame: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.setMenu(null);
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  sessions = createSessions(pty, payload => { if (!window.isDestroyed()) window.webContents.send('terminal-event', payload); });
  window.on('closed', () => sessions.closeAll());
  window.webContents.on('render-process-gone', () => { sessions.closeAll(); window.destroy(); });
  let closing = false;
  window.on('close', event => {
    if (closing) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(window, { type: 'question', buttons: ['Keep open', 'Close window'], defaultId: 0, cancelId: 0, message: 'Close all terminals?', detail: 'All running commands in this window will be stopped.' });
    if (choice === 1) { closing = true; sessions.closeAll(); window.close(); }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
