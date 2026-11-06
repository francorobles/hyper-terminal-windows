const { app } = require('electron');
const assert = require('node:assert/strict');
const { createSessions, profiles } = require('../src/sessions.cjs');
app.whenReady().then(async () => {
  try {
    for (const profile of profiles().filter(p => p.id !== 'wsl')) {
      await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => { sessions.closeAll(); reject(new Error(`${profile.label}: shell timed out`)); }, 15000);
        const sessions = createSessions(require('node-pty'), event => {
          if (event.type === 'data') { output += event.data; sessions.ack(event.id, event.data.length); }
          if (event.type === 'exit') {
            clearTimeout(timeout);
            try { assert.equal(event.exitCode, 0); assert.match(output, /HYPER_42/); resolve(); } catch (error) { reject(error); }
          }
        });
        sessions.create('smoke', profile.id, 80, 24);
        sessions.resize('smoke', 100, 30);
        const command = process.platform === 'win32'
          ? profile.id === 'cmd' ? 'set /a 6*7\r\necho HYPER_42\r\nexit 0\r\n' : "Write-Output ('HYPER_' + (6 * 7)); exit 0\r"
          : "printf 'HYPER_%s\\n' $((6 * 7)); exit 0\r";
        sessions.write('smoke', command);
      });
      console.log(`PASS: ${profile.label} startup, output, resize and exit`);
    }
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
