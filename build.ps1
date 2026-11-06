param([string]$OutputDirectory = "$PSScriptRoot\dist\HyperTerminal-Foot")
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# Never overwrite portable settings or shell history.
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Output already exists. Choose a new -OutputDirectory to preserve your settings.' }
$cache = Join-Path $PSScriptRoot '.cache'
$archive = Join-Path $cache 'cmder_mini.zip'
New-Item -ItemType Directory -Force $cache | Out-Null
if (!(Test-Path -LiteralPath $archive)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest 'https://github.com/cmderdev/cmder/releases/download/v1.3.25/cmder_mini.zip' -OutFile $archive -UseBasicParsing
}
$expected = 'C0611777A5BEE9952CFB0439BD903EFE49248DE99823A3127563C55E7FA1A5D8'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
    throw 'Cmder checksum mismatch. Remove .cache/cmder_mini.zip and retry.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    $output = [IO.Path]::GetFullPath($OutputDirectory)
    New-Item -ItemType Directory -Path "$output\engine\ConEmu", "$output\config" | Out-Null
    foreach ($entry in $zip.Entries) {
        # Only the console engine and its license; no Cmder, Clink, plugins or shell tools.
        if ($entry.FullName -match '^vendor/conemu-maximus5/(ConEmu(?:64)?\.exe|ConEmu/(?:[^/]+\.(?:dll|exe|l10n)|License\.txt|About-ConEmu\.txt))$') {
            $destination = Join-Path "$output\engine" $Matches[1]
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination)
        }
    }
    $reader = New-Object IO.StreamReader($zip.GetEntry('vendor/ConEmu.xml.default').Open())
    try { [xml]$config = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $zip.Dispose() }
$settings = $config.SelectSingleNode('/key/key/key')
function Set-Setting($node, $name, $data) {
    $node.SelectSingleNode("value[@name='$name']").SetAttribute('data', $data)
}
$themes = [ordered]@{
    Jade = '161b1b 7fbbb3 a7c080 83c092 e67e80 d699b6 dbbc7f c5c9c5 7a8478 91cdc5 b8d090 95d2a4 f19797 e8abc8 edce91 e5d8bc'
    'Tokyo Night' = '1a1b26 7aa2f7 9ece6a 7dcfff f7768e bb9af7 e0af68 c0caf5 565f89 7aa2f7 9ece6a 7dcfff f7768e bb9af7 e0af68 c0caf5'
    Gruvbox = '282828 458588 98971a 689d6a cc241d b16286 d79921 ebdbb2 928374 83a598 b8bb26 8ec07c fb4934 d3869b fabd2f ebdbb2'
}
$colors = $settings.SelectSingleNode("key[@name='Colors']")
$template = $colors.SelectSingleNode('key').CloneNode($true)
$paletteCount = $colors.SelectSingleNode("value[@name='Count']").CloneNode($true)
$paletteCount.SetAttribute('data', '3')
$colors.RemoveAll()
$colors.SetAttribute('name', 'Colors')
$null = $colors.AppendChild($paletteCount)
$index = 0
foreach ($theme in $themes.GetEnumerator()) {
    $palette = $template.CloneNode($true)
    $palette.SetAttribute('name', "Palette$(++$index)")
    Set-Setting $palette 'Name' $theme.Key
    $rgb = $theme.Value.Split(' ')
    for ($i = 0; $i -lt 32; $i++) {
        $hex = $rgb[$i % 16]
        $bgr = '00' + $hex.Substring(4,2) + $hex.Substring(2,2) + $hex.Substring(0,2)
        Set-Setting $palette ('ColorTable{0:00}' -f $i) $bgr
        if ($theme.Key -eq 'Tokyo Night') { Set-Setting $settings ('ColorTable{0:00}' -f $i) $bgr }
    }
    Set-Setting $palette 'TextColorIdx' '07'
    Set-Setting $palette 'BackColorIdx' '00'
    $null = $colors.AppendChild($palette)
}
Set-Setting $settings 'TextColorIdx' '07'
Set-Setting $settings 'BackColorIdx' '00'
Set-Setting $settings 'Multi.CloseConfirm' '01'
Set-Setting $settings 'Multi.CloseConfirmFlags' '07'
Set-Setting $settings 'ClipboardConfirmEnter' '01'
# Foot-style presentation with a narrow native resize edge.
$appearance = @{
    FadeInactive = '00'; AlphaValue = 'ff'; AlphaValueInactive = 'ff'; AlphaValueSeparate = '00'
    Tabs = '00'; 'StatusBar.Show' = '00'; HideCaption = '01'; HideCaptionAlways = '01'
    HideCaptionAlwaysFrame = '01'; ShowScrollbar = '00'; CenterConsolePad = '14'
    TryToCenter = '01'; FontSize = '12'; FontUseDpi = '01'; CursorTypeActive = '00023282'
    CursorTypeInactive = '00823283'; 'Update.CheckOnStartup' = '00'
    StartTasksName = '{WSL}'; 'Multi.NewConfirm' = '00'
}
foreach ($name in $appearance.Keys) { Set-Setting $settings $name $appearance[$name] }
# Explicit window controls work even with the caption hidden.
Set-Setting $settings 'MouseDragWindow' '01'
$hotkeys = $settings.SelectSingleNode("key[@name='HotKeys']")
Set-Setting $hotkeys 'WndDragKey' '00121101'
Set-Setting $hotkeys 'Key.SysMenu' '00001220'
$windowKeys = @{
    KeyMacro25 = '00121125'; 'KeyMacro25.Text' = 'WindowMode("TLEFT")'
    KeyMacro26 = '00121127'; 'KeyMacro26.Text' = 'WindowMode("TRIGHT")'
    KeyMacro27 = '00121126'; 'KeyMacro27.Text' = 'WindowMode("MAX")'
    KeyMacro28 = '00121128'; 'KeyMacro28.Text' = 'WindowMode("NOR")'
}
foreach ($name in $windowKeys.Keys) { Set-Setting $hotkeys $name $windowKeys[$name] }
Add-Type -AssemblyName System.Drawing
$fonts = New-Object Drawing.Text.InstalledFontCollection
try {
    $fontName = 'Consolas'
    foreach ($candidate in @('JetBrainsMono Nerd Font', 'JetBrains Mono', 'Cascadia Mono')) {
        if ($fonts.Families.Name -contains $candidate) { $fontName = $candidate; break }
    }
    Set-Setting $settings 'FontName' $fontName
} finally { $fonts.Dispose() }
$tasks = $settings.SelectSingleNode("key[@name='Tasks']")
$taskTemplate = $tasks.SelectSingleNode('key').CloneNode($true)
$tasks.RemoveAll()
$tasks.SetAttribute('name', 'Tasks')
$count = $config.CreateElement('value')
$count.SetAttribute('name', 'Count')
$count.SetAttribute('type', 'long')
$count.SetAttribute('data', '4')
$null = $tasks.AppendChild($count)
$commands = [ordered]@{
    '{CMD}' = 'cmd.exe /d'
    '{PowerShell}' = 'powershell.exe -NoLogo'
    '{PowerShell 7}' = 'pwsh.exe -NoLogo'
    '{WSL}' = 'wsl.exe --distribution Ubuntu --cd ~'
}
$index = 0
foreach ($command in $commands.GetEnumerator()) {
    $task = $taskTemplate.CloneNode($true)
    $task.SetAttribute('name', "Task$(++$index)")
    Set-Setting $task 'Name' $command.Key
    Set-Setting $task 'Cmd1' $command.Value
    Set-Setting $task 'GuiArgs' ''
    $null = $tasks.AppendChild($task)
}
$config.Save((Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) 'config\ConEmu.xml'))
Copy-Item -LiteralPath "$PSScriptRoot\HyperTerminal.cmd", "$PSScriptRoot\README.md" -Destination $OutputDirectory
Write-Host "Built $OutputDirectory. Launch HyperTerminal.cmd."
