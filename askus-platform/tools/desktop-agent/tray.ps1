# Visible tray icon for the AskUs work-hour agent, so monitoring is never hidden from the employee.
# Shows the agent's state from status.json and offers "Quit agent". Started by agent.mjs.
param([Parameter(Mandatory = $true)][string]$HomeDir)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$statusFile = Join-Path $HomeDir 'status.json'
$quitFile = Join-Path $HomeDir 'quit.flag'

$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Information
$icon.Visible = $true
$icon.Text = 'AskUs work-hour agent'

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add('AskUs work-hour agent: starting')
$statusItem.Enabled = $false
[void]$menu.Items.Add('-')
$quitItem = $menu.Items.Add('Quit agent')
$quitItem.add_Click({ Set-Content -Path $quitFile -Value 'quit'; $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({
  if (-not (Test-Path $statusFile)) { return }
  try {
    $s = Get-Content $statusFile -Raw | ConvertFrom-Json
    $text = "AskUs agent: $($s.state)"
    if ($s.queued -gt 0) { $text += " ($($s.queued) waiting to send)" }
    $statusItem.Text = $text
    $icon.Text = $text.Substring(0, [Math]::Min(63, $text.Length)) # tray tooltips are limited to 63 characters
  } catch { }
  if (Test-Path $quitFile) { $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
