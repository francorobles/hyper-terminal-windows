# Hyper Terminal for Windows

A minimal native Windows terminal styled after Omarchy's Foot: dark Tokyo Night colors, 14-pixel padding, a steady block cursor, and a terminal-only window. No visible tabs, toolbar, status bar, scrollbar, or title bar.

This is a configured ConEmu engine, not a port of Foot or a new terminal renderer. Foot runs on Wayland; Windows rendering and window borders will differ. The output contains no Cmder launcher, Clink, Git, or bundled shell customization tools. No Electron, Node.js, Visual Studio, or compilation is required.

## Run

The new build is separate from the earlier Cmder-based output:

```sh
# Git Bash, after building:
./dist/HyperTerminal-Foot/HyperTerminal.cmd
```

Or double-click **dist/HyperTerminal-Foot/HyperTerminal.cmd** in Explorer. The old `dist/HyperTerminal/` folder still contains the previous UI; do not use that launcher.

## Linux setup (once per Windows user)

Install Ubuntu from PowerShell if it is not installed:

```powershell
wsl --install -d Ubuntu
```

Restart Windows if the installer requests it. On first launch, Ubuntu asks you to choose a Linux username and password. Password input is invisible; type it and press Enter. These credentials are separate from your Windows login.

The terminal explicitly selects Ubuntu, so it will not open Docker Desktop's internal distribution. It does not change your machine-wide WSL default. Ubuntu is installed per Windows user, separately from the portable terminal folder; copying the terminal to another PC does not copy Linux or its files.

Inside Linux, check with `uname -a`, `cat /etc/os-release`, and `pwd`. Windows drives are available under `/mnt/c`; this repository is at `/mnt/c/Users/roble/Projects/hyper-terminal-windows`. Prefer `~/projects` for Linux-based development. Use `sudo apt update` and `sudo apt install <package>` to manage Linux packages.

## Build

From the repository on Windows 10/11 x64:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\build.test.ps1
```

The script downloads Cmder Mini 1.3.25 as a source of prebuilt ConEmu binaries, verifies the pinned upstream SHA-256, and extracts only the engine/runtime and its license. The archive is cached under `.cache/`. The full Cmder package is not shipped.

Existing output folders are never overwritten. To rebuild without losing portable settings:

```powershell
.\build.ps1 -OutputDirectory .\dist\HyperTerminal-new
.\tests\build.test.ps1 -BuildDirectory .\dist\HyperTerminal-new
```

## Appearance and controls

Ubuntu on WSL opens in your Linux home directory using its default shell (Bash on a fresh Ubuntu install). Your Linux shell profile applies. The font is JetBrainsMono Nerd Font if installed, then JetBrains Mono, Cascadia Mono, or Consolas. No fonts are installed automatically. Tokyo Night is the default; Jade and Gruvbox are also available in the configuration.

- Close with **Alt+F4**, or type `exit`.
- Move: hold **Ctrl+Alt** and drag anywhere inside the terminal with the left mouse button.
- Half-screen: **Ctrl+Alt+Left** or **Ctrl+Alt+Right**.
- Maximize: **Ctrl+Alt+Up**. Restore: **Ctrl+Alt+Down**.
- Window menu: **Alt+Space**. Resize by dragging the thin window edge.
- Copy selected text with **Ctrl+Shift+C**; paste with **Shift+Insert**.
- Scroll with the mouse wheel. Run the launcher again for another window.

The terminal engine still supports advanced settings and tasks, but they have no persistent on-screen controls. Preferences are stored in `config/ConEmu.xml`; edit only while the app is closed. Tasks include CMD, PowerShell, PowerShell 7 (requires `pwsh` on PATH), and WSL (Ubuntu, the default task). Close and multi-line paste confirmations remain enabled.

The narrow native resize edge is retained. Omarchy's compositor borders, window tiling, Linux shell prompt, and exact font rendering are not reproduced by this Windows configuration.

## Architecture and distribution

```text
HyperTerminal.cmd -> engine/ConEmu64.exe -> wsl.exe -> Ubuntu Linux / Bash
                   config/ConEmu.xml
```

GitHub Actions builds and checks the portable folder and uploads it as an artifact. Extract the complete artifact into a writable folder and run its launcher. Runtime licensing is retained under `engine/ConEmu/License.txt`. No installer or automatic updater is included.

The former Electron source, npm manifests, xterm.js and node-pty integration are removed. Old ignored `node_modules/` and earlier build outputs are unused. Back up portable settings before replacing an installation. Distribute a fresh build rather than personal shell history.

Tests verify packaging, chrome settings, cursor/padding, palettes/tasks, and refusal to overwrite existing settings. Desktop behavior, accessibility, IME, DPI, clipboard interaction, full-screen console programs, and child-process cleanup still require manual checks.

References: [Omarchy Foot configuration](https://github.com/omacom/omarchy/blob/quattro/config/foot/foot.ini), [ConEmu](https://conemu.github.io/), [binary source and checksum](https://github.com/cmderdev/cmder/releases/tag/v1.3.25).

Independent project, not affiliated with Omarchy, Foot, ConEmu, Cmder, or the Hyper terminal project.
