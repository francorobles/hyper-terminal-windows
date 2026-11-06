const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function profiles(platform = process.platform, env = process.env) {
  if (platform !== 'win32') return [{ id: 'default', label: 'Local shell', file: env.SHELL || '/bin/bash', args: ['-l'] }];
  const system = path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32');
  const result = [
    { id: 'default', label: 'Windows PowerShell', file: path.win32.join(system, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), args: ['-NoLogo'] },
    { id: 'cmd', label: 'Command Prompt', file: path.win32.join(system, 'cmd.exe'), args: [] },
  ];
  const pwsh = path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe');
  if (fs.existsSync(pwsh)) result.unshift({ id: 'pwsh', label: 'PowerShell 7', file: pwsh, args: ['-NoLogo'] });
  if (fs.existsSync(path.win32.join(system, 'wsl.exe'))) result.push({ id: 'wsl', label: 'WSL', file: path.win32.join(system, 'wsl.exe'), args: ['--cd', '~'] });
  return result;
}

function dimensions(cols, rows) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 1 || cols > 1000 || rows > 1000) throw new Error('Invalid terminal dimensions');
}

function createSessions(pty, send, available = profiles()) {
  const sessions = new Map();
  const get = id => {
    if (!sessions.has(id)) throw new Error('Terminal session is closed');
    return sessions.get(id);
  };
  return {
    create(id, profileId, cols, rows) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id) || sessions.has(id)) throw new Error('Invalid session ID');
      if (sessions.size >= 24) throw new Error('Maximum of 24 terminal sessions reached');
      dimensions(cols, rows);
      const profile = available.find(p => p.id === profileId);
      if (!profile) throw new Error('Unknown shell profile');
      const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'HyperTerminal' };
      delete env.TERM_SESSION_ID;
      const terminal = pty.spawn(profile.file, profile.args, { name: 'xterm-256color', cols, rows, cwd: os.homedir(), env });
      const session = { terminal, pending: 0 };
      sessions.set(id, session);
      terminal.onData(data => {
        session.pending += data.length;
        if (session.pending > 100000) terminal.pause();
        send({ id, type: 'data', data });
      });
      terminal.onExit(({ exitCode }) => {
        sessions.delete(id);
        send({ id, type: 'exit', exitCode });
      });
      return profile.label;
    },
    write(id, data) {
      if (typeof data !== 'string' || data.length > 1048576) throw new Error('Invalid input (maximum 1 MiB)');
      get(id).terminal.write(data);
    },
    resize(id, cols, rows) { dimensions(cols, rows); get(id).terminal.resize(cols, rows); },
    ack(id, length) {
      const session = sessions.get(id);
      if (!session || !Number.isInteger(length) || length < 0 || length > session.pending) return;
      session.pending -= length;
      if (session.pending < 10000) session.terminal.resume();
    },
    close(id) {
      const session = sessions.get(id);
      if (session) { session.terminal.kill(); sessions.delete(id); }
    },
    closeAll() { for (const id of sessions.keys()) this.close(id); },
  };
}
module.exports = { profiles, dimensions, createSessions };
