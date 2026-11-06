const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSessions, dimensions, profiles } = require('../src/sessions.cjs');
function setup() {
  const events = [];
  const terminal = { input: '', size: [], paused: false, killed: false,
    onData(fn) { this.data = fn; }, onExit(fn) { this.exit = fn; },
    write(data) { this.input += data; }, resize(...size) { this.size = size; },
    pause() { this.paused = true; }, resume() { this.paused = false; }, kill() { this.killed = true; },
  };
  const manager = createSessions({ spawn: () => terminal }, event => events.push(event), [{ id: 'default', label: 'Test', file: 'test', args: [] }]);
  return { manager, terminal, events };
}
test('validates profile, ID, input and dimensions before touching the shell', () => {
  const { manager } = setup();
  assert.throws(() => manager.create('id', 'arbitrary.exe', 80, 24), /Unknown shell/);
  assert.throws(() => manager.create('../id', 'default', 80, 24), /Invalid session/);
  for (const size of [[0, 24], [80, -1], [1.5, 24], [1001, 24], [80, NaN]]) assert.throws(() => dimensions(...size));
  manager.create('id', 'default', 80, 24);
  assert.throws(() => manager.create('id', 'default', 80, 24), /Invalid session/);
  assert.throws(() => manager.write('id', 'x'.repeat(1048577)), /Invalid input/);
  assert.throws(() => manager.write('id', {}), /Invalid input/);
});
test('forwards IO and resize, pauses fast output, and cleans up', () => {
  const { manager, terminal, events } = setup();
  manager.create('id', 'default', 80, 24);
  manager.write('id', 'echo hello\r'); assert.equal(terminal.input, 'echo hello\r');
  manager.resize('id', 120, 40); assert.deepEqual(terminal.size, [120, 40]);
  terminal.data('x'.repeat(100001)); assert.equal(terminal.paused, true);
  manager.ack('id', 999999); assert.equal(terminal.paused, true);
  manager.ack('id', 100001); assert.equal(terminal.paused, false);
  assert.equal(events[0].data.length, 100001);
  manager.closeAll(); assert.equal(terminal.killed, true);
  assert.throws(() => manager.write('id', 'input'), /closed/);
});
test('exit removes the session and reports its exit code', () => {
  const { manager, terminal, events } = setup(); manager.create('id', 'default', 80, 24);
  terminal.exit({ exitCode: 7 });
  assert.deepEqual(events, [{ id: 'id', type: 'exit', exitCode: 7 }]);
  assert.throws(() => manager.resize('id', 80, 24), /closed/);
  assert.doesNotThrow(() => manager.ack('id', 10));
});
test('Windows provides built-in PowerShell and CMD', () => {
  const result = profiles('win32', { SystemRoot: 'C:\\Windows' });
  assert.match(result.find(p => p.id === 'default').file, /WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  assert.match(result.find(p => p.id === 'cmd').file, /System32\\cmd\.exe$/);
});
