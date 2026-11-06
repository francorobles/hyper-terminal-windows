@echo off
setlocal
if not exist "%~dp0engine\ConEmu64.exe" (
    echo Run build.ps1, then open dist\HyperTerminal-Foot\HyperTerminal.cmd.
    exit /b 1
)
start "" "%~dp0engine\ConEmu64.exe" -LoadCfgFile "%~dp0config\ConEmu.xml" -Title "Hyper Terminal" -Dir "%USERPROFILE%" -Run wsl.exe --distribution Ubuntu --cd ~
