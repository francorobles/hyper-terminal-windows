const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'hyper-terminal-test-')));
require('../src/main.cjs');
const timeout = setTimeout(() => { console.error('UI smoke test timed out'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.setBackgroundThrottling(false);
  window.show();
  window.focus();
  app.focus({ steal: true });
  try {
    await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (test) => { for (let i = 0; i < 100; i++) { if (test()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('UI condition timed out'); };
      await waitFor(() => document.querySelector('#session-status').textContent.includes('CONNECTED'));
      document.querySelector('#split').click();
      await waitFor(() => document.querySelectorAll('.pane').length === 2);
      document.querySelector('#layout').click();
      document.querySelector('#new-tab').click();
      await waitFor(() => document.querySelectorAll('[role=tab]').length === 2);
      await waitFor(() => document.querySelector('#session-status').textContent.includes('CONNECTED'));
      const theme = document.querySelector('#theme'); theme.value = 'tokyo'; theme.dispatchEvent(new Event('change'));
      document.querySelector('#help').click();
      const helpOpen = document.querySelector('dialog').open; document.querySelector('dialog').close();
      document.querySelector('[role=tab]').click();
      await new Promise(r => setTimeout(r, 500));
      return { panes: document.querySelectorAll('.pane').length, tabs: document.querySelectorAll('[role=tab]').length, stacked: document.querySelector('.tab-panes').classList.contains('stacked'), helpOpen, theme: document.documentElement.style.getPropertyValue('--terminal-bg'), notice: document.querySelector('#notice').hidden, nodeExposed: typeof require !== 'undefined' };
    })()`);
    assert.deepEqual(result, { panes: 3, tabs: 2, stacked: true, helpOpen: true, theme: '#1a1b26', notice: true, nodeExposed: false });
    window.focus();
    window.webContents.focus();
    await window.webContents.executeJavaScript(`document.querySelector('.tab-panes:not([hidden]) .pane.active textarea').focus()`);
    const command = process.platform === 'win32' ? "Write-Output ('UI_' + (6 * 7))" : "printf 'UI_%s\\n' $((6 * 7))";
    for (const keyCode of command) window.webContents.sendInputEvent({ type: 'char', keyCode });
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    await window.webContents.executeJavaScript(`(async () => {
      for (let i = 0; i < 100; i++) {
        if (document.querySelector('.pane.active .xterm-accessibility-tree').textContent.includes('UI_42')) return;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('Typed command output did not reach the terminal');
    })()`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    fs.writeFileSync(process.env.HYPER_SCREENSHOT || path.join(os.tmpdir(), 'hyper-terminal-preview.png'), (await window.webContents.capturePage()).toPNG());
    console.log('PASS: desktop UI, typed shell command/output, tabs, split layout, themes, shortcuts dialog and renderer isolation');
    clearTimeout(timeout); window.destroy(); app.exit(0);
  } catch (error) {
    console.error(error);
    console.error(await window.webContents.executeJavaScript(`({ focus: document.activeElement.className, status: document.querySelector('#session-status').textContent, output: [...document.querySelectorAll('.xterm-accessibility-tree')].map(e => e.textContent), notice: document.querySelector('#notice').textContent })`));
    if (process.env.HYPER_SCREENSHOT) fs.writeFileSync(process.env.HYPER_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
    window.destroy(); app.exit(1);
  }
});
