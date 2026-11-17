# Prints one JSON line every few seconds: how long since the last keyboard/mouse input, and the NAME of the
# app in the foreground. That is all. No keystrokes, no mouse positions, no window titles, no screen contents.
#
# Windows: GetLastInputInfo (user32) gives the OS-level time of the last input.
param([int]$IntervalSeconds = 5)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AskUsNative {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  public static uint IdleMilliseconds() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return 0;
    return unchecked((uint)Environment.TickCount - info.dwTime);
  }
}
"@

while ($true) {
  $idleSeconds = [int]([AskUsNative]::IdleMilliseconds() / 1000)
  $app = $null
  $window = [AskUsNative]::GetForegroundWindow()
  if ($window -ne [IntPtr]::Zero) {
    $owner = [uint32]0
    [void][AskUsNative]::GetWindowThreadProcessId($window, [ref]$owner)
    try { $app = (Get-Process -Id $owner -ErrorAction Stop).ProcessName } catch { $app = $null }
  }
  $line = [ordered]@{ idleSeconds = $idleSeconds; app = $app } | ConvertTo-Json -Compress
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
  Start-Sleep -Seconds $IntervalSeconds
}
