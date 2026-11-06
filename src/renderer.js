import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import './style.css';

const api = window.terminalApp;
const $ = selector => document.querySelector(selector);
const themes = {
  jade: { background: '#161b1b', foreground: '#c5c9c5', cursor: '#a7c080', selectionBackground: '#394b42', black: '#232a2b', red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f', blue: '#7fbbb3', magenta: '#d699b6', cyan: '#83c092', white: '#d3c6aa', brightBlack: '#7a8478', brightRed: '#f19797', brightGreen: '#b8d090', brightYellow: '#edce91', brightBlue: '#91cdc5', brightMagenta: '#e8abc8', brightCyan: '#95d2a4', brightWhite: '#e5d8bc' },
  tokyo: { background: '#1a1b26', foreground: '#c0caf5', cursor: '#7aa2f7', selectionBackground: '#33467c', black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6', brightBlack: '#565f89', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5' },
  gruvbox: { background: '#282828', foreground: '#ebdbb2', cursor: '#fabd2f', selectionBackground: '#504945', black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984', brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2' },
};
let theme = localStorage.getItem('theme') || 'jade';
if (!themes[theme]) theme = 'jade';
let fontSize = Number(localStorage.getItem('fontSize')) || 14;
fontSize = Math.max(10, Math.min(28, fontSize));
const tabs = [];
const panes = new Map();
let activeTab;
let activePane;
let serial = 0;
let noticeTimer;
function notice(error) {
  $('#notice').textContent = error.message || String(error);
  $('#notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 6500);
}
function status() {
  const pane = panes.get(activePane);
  $('#session-status').textContent = pane ? `${pane.label.toUpperCase()} · ${pane.live ? 'CONNECTED' : pane.starting ? 'STARTING' : 'EXITED'}` : 'NO SESSION';
  $('#size').textContent = pane ? `${pane.term.cols} × ${pane.term.rows}` : '—';
}
function fit(pane) {
  if (pane.tab !== activeTab || !pane.live) return;
  pane.fit.fit();
  if (pane.cols !== pane.term.cols || pane.rows !== pane.term.rows) {
    pane.cols = pane.term.cols; pane.rows = pane.term.rows;
    api.resize(pane.id, pane.cols, pane.rows).catch(error => { if (pane.live) notice(error); });
  }
  status();
}
function focusPane(pane) {
  if (pane.tab !== activeTab || !panes.has(pane.id)) return;
  activePane = pane.id;
  for (const item of panes.values()) item.element.classList.toggle('active', item === pane);
  pane.term.focus();
  status();
}
function selectTab(tab) {
  activeTab = tab;
  for (const item of tabs) {
    item.element.hidden = item !== tab;
    item.button.setAttribute('aria-selected', String(item === tab));
    item.button.tabIndex = item === tab ? 0 : -1;
  }
  if (tab.panes.length) focusPane(tab.panes[0]);
  requestAnimationFrame(() => {
    for (const pane of tab.panes) fit(pane);
  });
}
async function newPane(tab) {
  if (tab.panes.length >= 4) return notice('Up to four panes per tab. Open a new tab for more.');
  const id = crypto.randomUUID();
  const profile = $('#profile').value;
  const label = $('#profile').selectedOptions[0].textContent;
  const element = document.createElement('section');
  element.className = 'pane';
  const heading = document.createElement('div'); heading.className = 'pane-heading';
  const caption = document.createElement('span'); caption.textContent = `${String(tab.panes.length + 1).padStart(2, '0')} / ${label}`;
  const close = document.createElement('button'); close.textContent = '×'; close.title = 'Close pane (Ctrl+Shift+W)'; close.setAttribute('aria-label', `Close ${label} pane`);
  heading.append(caption, close);
  const host = document.createElement('div'); host.className = 'terminal';
  element.append(heading, host); tab.element.append(element);
  const term = new Terminal({ fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "SFMono-Regular", monospace', fontSize, lineHeight: 1.25, cursorBlink: true, cursorStyle: 'bar', theme: themes[theme], scrollback: 10000, allowProposedApi: false, screenReaderMode: true });
  const fitAddon = new FitAddon(); const search = new SearchAddon();
  term.loadAddon(fitAddon); term.loadAddon(search); term.open(host); fitAddon.fit();
  const pane = { id, tab, element, term, fit: fitAddon, search, label, live: false, starting: true };
  panes.set(id, pane); tab.panes.push(pane);
  const observer = new ResizeObserver(() => fit(pane)); observer.observe(host); pane.observer = observer;
  element.addEventListener('pointerdown', () => focusPane(pane));
  close.addEventListener('click', () => closePane(pane).catch(notice));
  term.onData(data => { if (pane.live) api.write(id, data).catch(notice); });
  term.attachCustomKeyEventHandler(event => !shortcut(event));
  term.textarea.addEventListener('focus', () => { activePane = id; for (const item of panes.values()) item.element.classList.toggle('active', item === pane); status(); });
  focusPane(pane);
  try {
    await api.create(id, profile, term.cols, term.rows);
    pane.live = !pane.exited;
  } catch (error) {
    term.writeln(`\r\nUnable to start ${label}.\r\n${error.message}\r\n\r\nChoose another shell and open a new tab.`);
    notice(error);
  }
  pane.starting = false;
  fit(pane);
}
async function newTab() {
  if (tabs.length >= 12) return notice('Up to 12 tabs are supported.');
  const element = document.createElement('div'); element.className = 'tab-panes'; element.setAttribute('role', 'tabpanel');
  const button = document.createElement('button'); button.className = 'tab'; button.setAttribute('role', 'tab');
  const number = ++serial; button.textContent = `${String(number).padStart(2, '0')}  ${$('#profile').selectedOptions[0].textContent}`;
  element.id = `tab-${number}`; button.id = `tab-button-${number}`;
  button.setAttribute('aria-controls', element.id); element.setAttribute('aria-labelledby', button.id);
  const tab = { element, button, panes: [] }; tabs.push(tab);
  button.addEventListener('click', () => selectTab(tab));
  $('#tabs').append(button); $('#workspace').append(element);
  selectTab(tab); await newPane(tab);
}
async function closePane(pane) {
  if (pane.starting) return;
  if (pane.live && !(await api.confirmClose())) return;
  await api.close(pane.id);
  pane.live = false; pane.observer.disconnect(); pane.term.dispose(); pane.element.remove(); panes.delete(pane.id);
  const tab = pane.tab; tab.panes.splice(tab.panes.indexOf(pane), 1);
  if (!tab.panes.length) {
    const index = tabs.indexOf(tab); tabs.splice(index, 1); tab.button.remove(); tab.element.remove();
    if (tabs.length) selectTab(tabs[Math.min(index, tabs.length - 1)]);
    else await newTab();
  } else { for (const remaining of tab.panes) fit(remaining); focusPane(tab.panes[0]); }
}
async function paste() {
  const pane = panes.get(activePane);
  const text = await api.paste();
  if (pane?.live && text) pane.term.paste(text);
}
function zoom(delta) {
  fontSize = delta === 0 ? 14 : Math.max(10, Math.min(28, fontSize + delta));
  localStorage.setItem('fontSize', fontSize);
  for (const pane of panes.values()) { pane.term.options.fontSize = fontSize; fit(pane); }
}
function showSearch() { $('#search-bar').hidden = false; $('#search').focus(); $('#search').select(); }
function hideSearch() { $('#search-bar').hidden = true; panes.get(activePane)?.search.clearDecorations(); panes.get(activePane)?.term.focus(); }
function shortcut(event) {
  if (event.type !== 'keydown' || event.isComposing || $('#shortcuts').open) return false;
  const key = event.key.toLowerCase(); const pane = panes.get(activePane);
  let action;
  if (event.ctrlKey && event.shiftKey) {
    if (key === 't') action = newTab;
    if (key === 'd') action = () => newPane(activeTab);
    if (key === 'w' && pane) action = () => closePane(pane);
    if (key === 'c' && pane) action = () => api.copy(pane.term.getSelection());
    if (key === 'v') action = paste;
    if (key === 'f') action = showSearch;
  }
  if (event.ctrlKey && key === 'tab') action = () => selectTab(tabs[(tabs.indexOf(activeTab) + (event.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
  if (event.ctrlKey && ['+', '=', '-', '0'].includes(key)) action = () => zoom(key === '0' ? 0 : key === '-' ? -1 : 1);
  if (event.altKey && ['arrowright', 'arrowleft'].includes(key) && pane) action = () => { const list = activeTab.panes; focusPane(list[(list.indexOf(pane) + (key === 'arrowright' ? 1 : list.length - 1)) % list.length]); };
  if (key === 'escape' && !$('#search-bar').hidden) action = hideSearch;
  if (!action) return false;
  event.preventDefault(); event.stopPropagation(); Promise.resolve().then(action).catch(notice); return true;
}
document.addEventListener('keydown', shortcut);
document.addEventListener('paste', event => { if (event.target.closest('.terminal')) { event.preventDefault(); event.stopImmediatePropagation(); paste().catch(notice); } }, true);
api.onEvent(event => {
  const pane = panes.get(event.id); if (!pane) return;
  if (event.type === 'data') pane.term.write(event.data, () => api.ack(event.id, event.data.length));
  if (event.type === 'exit') {
    pane.live = false; pane.exited = true;
    pane.term.writeln(`\r\n\x1b[90m[Process exited with code ${event.exitCode}. Ctrl+Shift+T opens a new terminal.]\x1b[0m`); status();
  }
});
$('#new-tab').onclick = () => newTab().catch(notice);
$('#split').onclick = () => newPane(activeTab).catch(notice);
$('#layout').onclick = () => { activeTab.element.classList.toggle('stacked'); for (const pane of activeTab.panes) fit(pane); };
$('#help').onclick = () => $('#shortcuts').showModal();
$('#shortcuts').addEventListener('close', () => panes.get(activePane)?.term.focus());
$('#search-close').onclick = hideSearch;
$('#search-next').onclick = () => panes.get(activePane)?.search.findNext($('#search').value);
$('#search-prev').onclick = () => panes.get(activePane)?.search.findPrevious($('#search').value);
$('#search').addEventListener('input', () => panes.get(activePane)?.search.findNext($('#search').value, { incremental: true }));
$('#search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); panes.get(activePane)?.search[event.shiftKey ? 'findPrevious' : 'findNext']($('#search').value); } });
for (const button of document.querySelectorAll('[data-window]')) button.onclick = () => api.window(button.dataset.window).catch(notice);
function setTheme() {
  document.documentElement.style.setProperty('--terminal-bg', themes[theme].background);
  document.documentElement.style.setProperty('--accent', themes[theme].cursor);
  for (const pane of panes.values()) pane.term.options.theme = themes[theme];
}
$('#theme').value = theme;
$('#theme').onchange = () => { theme = $('#theme').value; localStorage.setItem('theme', theme); setTheme(); panes.get(activePane)?.term.focus(); };
setTheme();
const tick = () => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); };
tick(); setInterval(tick, 10000);
api.profiles().then(async profiles => {
  for (const profile of profiles) { const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.label; $('#profile').append(option); }
  await newTab();
}).catch(notice);
