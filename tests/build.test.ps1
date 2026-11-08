param([string]$BuildDirectory = "$PSScriptRoot\..\dist\HyperTerminal-Foot")
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert($condition, $message) { if (!$condition) { throw $message } }
foreach ($file in @('config\kali-prompt.bash', 'HyperTerminal.cmd', 'engine\ConEmu64.exe', 'engine\ConEmu\ConEmuC64.exe', 'engine\ConEmu\ConEmuCD64.dll', 'engine\ConEmu\License.txt')) {
    Assert (Test-Path -LiteralPath "$BuildDirectory\$file") "Missing $file"
}
[xml]$xml = Get-Content -LiteralPath "$BuildDirectory\config\ConEmu.xml"
$settings = $xml.SelectSingleNode('/key/key/key')
Assert ($settings.SelectSingleNode("value[@name='ColorTable00']").data -eq '0029221f') 'Kali Dark RGB conversion failed'
Assert ($settings.SelectSingleNode("value[@name='ClipboardConfirmEnter']").data -eq '01') 'Paste confirmation disabled'
Assert ($settings.SelectSingleNode("value[@name='Multi.CloseConfirmFlags']").data -eq '07') 'Close confirmation disabled'
Assert (!(Test-Path "$BuildDirectory\Cmder.exe")) 'Cmder must not be bundled'
Assert (!(Test-Path "$BuildDirectory\vendor")) 'Shell tools must not be bundled'
foreach ($name in @('Tabs', 'StatusBar.Show', 'ShowScrollbar')) {
    Assert ($settings.SelectSingleNode("value[@name='$name']").data -eq '00') "Visible chrome: $name"
}
Assert ($settings.SelectSingleNode("value[@name='HideCaptionAlways']").data -eq '01') 'Caption visible'
Assert ($settings.SelectSingleNode("value[@name='CenterConsolePad']").data -eq '14') 'Incorrect padding'
Assert ($settings.SelectSingleNode("value[@name='CursorTypeActive']").data -eq '00023282') 'Incorrect cursor'
Assert ($settings.SelectSingleNode("key[@name='Colors']/value[@name='Count']").data -eq '4') 'Palette count missing'
Assert ($settings.SelectSingleNode("value[@name='StartTasksName']").data -eq '{WSL}') 'Incorrect default shell'
$wslTask = $settings.SelectSingleNode("key[@name='Tasks']/key[value[@name='Name' and @data='{WSL}']]/value[@name='Cmd1']")
Assert ($wslTask.data -eq 'wsl.exe --distribution Ubuntu --cd ~') 'WSL must target Ubuntu, not the machine default distribution'
$launcher = Get-Content -LiteralPath "$BuildDirectory\HyperTerminal.cmd" -Raw
Assert ($launcher.Contains('-Run wsl.exe --distribution Ubuntu --cd ~')) 'Launcher must open Ubuntu in the Linux home directory'
foreach ($name in @('FadeInactive', 'AlphaValueSeparate')) {
    Assert ($settings.SelectSingleNode("value[@name='$name']").data -eq '00') 'Inactive appearance must remain stable'
}
foreach ($name in @('AlphaValue', 'AlphaValueInactive')) {
    Assert ($settings.SelectSingleNode("value[@name='$name']").data -eq 'ff') 'Terminal must be opaque'
}
$hotkeys = $settings.SelectSingleNode("key[@name='HotKeys']")
Assert ($settings.SelectSingleNode("value[@name='MouseDragWindow']").data -eq '01') 'Window drag disabled'
Assert ($hotkeys.SelectSingleNode("value[@name='WndDragKey']").data -eq '00121101') 'Incorrect drag binding'
Assert ($hotkeys.SelectSingleNode("value[@name='Key.SysMenu']").data -eq '00001220') 'Window menu disabled'
foreach ($binding in @(
    @('KeyMacro25', '00121125', 'WindowMode("TLEFT")'),
    @('KeyMacro26', '00121127', 'WindowMode("TRIGHT")'),
    @('KeyMacro27', '00121126', 'WindowMode("MAX")'),
    @('KeyMacro28', '00121128', 'WindowMode("NOR")')
)) {
    Assert ($hotkeys.SelectSingleNode("value[@name='$($binding[0])']").data -eq $binding[1]) 'Incorrect window shortcut'
    Assert ($hotkeys.SelectSingleNode("value[@name='$($binding[0]).Text']").data -eq $binding[2]) 'Incorrect window action'
}
$palettes = $settings.SelectNodes("key[@name='Colors']/key")
Assert ($palettes.Count -eq 4) 'Expected four palettes'
foreach ($palette in $palettes) {
    Assert ($palette.SelectNodes("value[starts-with(@name,'ColorTable')]").Count -eq 32) 'Incomplete palette'
}
$tasks = $settings.SelectNodes("key[@name='Tasks']/key")
Assert ($tasks.Count -eq 4) 'Expected four shell tasks'
foreach ($task in $tasks) {
    Assert (!$task.SelectSingleNode("value[@name='Cmd1']").data.StartsWith('*')) 'Unexpected admin shell'
}
$before = (Get-FileHash -LiteralPath "$BuildDirectory\config\ConEmu.xml").Hash
$rejected = $false
try { & "$PSScriptRoot\..\build.ps1" -OutputDirectory $BuildDirectory } catch {
    if ($_.Exception.Message -notlike 'Output already exists*') { throw }
    $rejected = $true
}
Assert $rejected 'Build must reject an existing installation'
Assert ((Get-FileHash -LiteralPath "$BuildDirectory\config\ConEmu.xml").Hash -eq $before) 'Existing configuration changed'
Write-Host 'Portable build checks passed.'
