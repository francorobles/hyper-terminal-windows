# Hyper Terminal

A Windows terminal with an Omarchy/Hyprland-inspired look: dark colors, accent borders, tiled panes, and keyboard-first controls. Runs real shells through node-pty and ConPTY, with xterm.js terminal emulation. An independent app, not affiliated with Omarchy, Hyprland, or the Hyper terminal project.

## Target

Windows 10 version 1809+ and Windows 11, x64. Windows compatibility is a target until validated on those systems; development checks can run on macOS/Linux using the local shell. Hyprland itself is a Linux compositor and is not embedded here.

## Features

- Windows PowerShell and Command Prompt; PowerShell 7 when installed in its standard location; WSL when the Windows executable is available (requires a configured distribution).
- Tabs and up to four equal-size panes per tab, with horizontal/vertical layouts.
- ANSI colors, interactive terminal programs, shell history/completion, scrolling, search, copy/paste, and font zoom.
- Jade, Tokyo Night, and Gruvbox palettes; theme and font size persist locally.
- Close confirmation and multi-line paste confirmation.

## Run

Install Node.js 24 LTS. On Windows, native dependency builds may require Python and Visual Studio 2022 Build Tools with Desktop development with C++ and the Windows SDK. On macOS, install Xcode Command Line Tools.

```sh
npm install
npm start
```

PowerShell 7 is selected first when detected; otherwise Windows PowerShell is the default. Select a shell from the toolbar before opening a tab or pane. New terminals start in your home directory. WSL starts in the default distribution's home directory. Shell profiles and prompt customization work normally; the app does not modify them.

## Keyboard

| Action | Shortcut |
| --- | --- |
| New tab | Ctrl Shift T |
| Split pane | Ctrl Shift D |
| Close pane | Ctrl Shift W |
| Next / previous tab | Ctrl Tab / Ctrl Shift Tab |
| Next / previous pane | Alt Right / Alt Left |
| Copy selection / paste | Ctrl Shift C / Ctrl Shift V |
| Search output | Ctrl Shift F |
| Next / previous match | Enter / Shift Enter in search |
| Close search | Escape |
| Font larger / smaller / reset | Ctrl + / Ctrl - / Ctrl 0 |

Ctrl C remains the shell interrupt. Closing the last pane opens a fresh terminal. Closing a pane/window stops its shell; save work in terminal programs first.

## Verify and package

```sh
npm test
npm run build
npm run test:pty
npm run test:ui
npm run dist:win
```

Build the Windows installer on Windows so node-pty is compiled for the correct OS and Electron ABI. The GitHub Actions workflow builds an x64 NSIS installer under `release/`, and exercises PowerShell/CMD plus the desktop UI. It does not publish a release. The installer is unsigned and may trigger SmartScreen until code signing is configured.

Manual Windows 10/11 checks still required: installer launch/uninstall; PowerShell/CMD/WSL interaction; Ctrl C stopping a running command; Unicode input and IME; full-screen programs; high-output scrolling; DPI resizing; clipboard confirmation; and process cleanup after closing tabs/windows.

## Boundaries

This is a first working terminal, not complete Windows Terminal feature parity. No desktop window management, arbitrary custom shell profiles, draggable pane dividers, session restore, auto-updater, or Windows default-terminal registration. Tabs and commands are not restored after exit. WSL availability checks for `wsl.exe`, not an installed distribution. The Windows native path and installer must be verified on actual Windows 10/11 machines.

The renderer is sandboxed, context isolated, and has no Node access. Only the local main frame can access the limited IPC bridge. Shell output is rendered as terminal text, never HTML. Remote navigation, popups, and browser permissions are blocked. Output is acknowledged with backpressure to avoid unbounded renderer buffering. Shell commands run with the user's privileges; this is not a shell sandbox.

References: [Omarchy themes](https://omarchy.org/manual/themes/), [node-pty](https://github.com/microsoft/node-pty), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [xterm.js flow control](https://xtermjs.org/docs/guides/flowcontrol/).

## Local verification

The build, four backend tests, native shell smoke test, and desktop UI integration test passed on macOS. The UI test types and runs a command and checks its rendered output, alongside tabs, splits, themes, and renderer isolation. All interface corners are square.

`npm audit` reports six moderate advisories in the development-only electron-builder dependency chain (minimatch pattern denial of service). No production dependency advisories were reported. Recheck the packaging toolchain before distributing a release; no forced major dependency overrides are applied.
