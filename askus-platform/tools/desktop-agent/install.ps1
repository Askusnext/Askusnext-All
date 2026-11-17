# Makes the agent start every time this user signs in to Windows. Run once, in PowerShell, from this folder:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
# Needs Node.js 18+ on the PC and a pairing already done:  node agent.mjs pair --code <code>
#
# Remove it again with:  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Remove
param([switch]$Remove)

$taskName = 'AskUsWorkHourAgent'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Removed. The agent will no longer start at sign-in.'
  return
}

$node = (Get-Command node -ErrorAction Stop).Source
$agent = Join-Path $PSScriptRoot 'agent.mjs'
if (-not (Test-Path (Join-Path $env:APPDATA 'AskUsAgent\config.json'))) {
  Write-Warning 'This PC is not paired yet. Run: node agent.mjs pair --code <code from the web app>'
}

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$agent`" run" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'AskUs work-hour agent (disclosed monitoring)' -Force | Out-Null
Write-Host "Installed. The agent starts at every sign-in and shows a tray icon. Start it now with: Start-ScheduledTask -TaskName $taskName"
