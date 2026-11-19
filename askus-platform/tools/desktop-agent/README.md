# AskUs work-hour agent (Windows, Phase 1)

Measures how long an employee is **active** at their PC, so nobody has to clock in and out. It sends a
heartbeat to the AskUs API every 90 seconds and nothing else.

## What it sends, and what it never sends

```json
{ "employeeId": "…", "deviceId": "…", "timestamp": "2026-11-17T09:30:00.000Z", "status": "active", "activeAppName": "Code" }
```

- `status` is `idle` after 5 minutes with no keyboard or mouse input (read from Windows through
  `GetLastInputInfo`; the agent never sees *what* was typed or *where* the mouse is).
- `activeAppName` is the process name of the foreground app. No window titles, no screen contents.
- The server rejects any other field, so extra data cannot be sent even by mistake.
- A locked screen sends nothing, and a closed lid or stopped agent leaves a gap, so those hours are not counted.
- If the network is down, heartbeats wait in `queue.jsonl` and are sent in order when it returns.

Monitoring is **disclosed**: the employee accepts the policy once in the web app (Work hours → My hours). The
server refuses to pair a device or accept heartbeats without it, and the agent refuses to start. A tray icon
shows that it is running, with a *Quit agent* menu item.

> The policy wording in the API (`POLICY_TEXT`) is a placeholder. It must be reviewed by a lawyer against the
> DPDP Act 2023 and the IT Act before rollout.

## Install on a Windows PC

Needs Node.js 18 or newer.

1. In the web app open **Work hours → My hours**, accept the notice, and click **Generate a pairing code**.
2. In this folder run:
   ```powershell
   node agent.mjs pair --code ABCD2345 --api https://<your-api>/api
   ```
3. Make it start at every sign-in (one time):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   Start-ScheduledTask -TaskName AskUsWorkHourAgent
   ```
   Remove it with `install.ps1 -Remove`.

Other commands: `node agent.mjs run` (what the logon task runs), `status`, `unpair`.

Config and queue live in `%APPDATA%\AskUsAgent`.

## Not done yet

- **Mac** is Phase 2. The server refuses `platform: mac`.
- **Screenshots** are Phase 2 (needs the consent flow signed off).
- It is a Node script, not a signed installer (`.exe`/MSI). Packaging is a separate task.
- `install.ps1` and the tray icon (`tray.ps1`) were written but not run on a real sign-in session; the sampler,
  pairing, queue, consent gate and server side were tested end to end.

## Testing without Windows

`AGENT_SAMPLER=fake` reads `fake-sample.json` (`{"idleSeconds": 5, "app": "Code"}`) from the config folder instead of
calling PowerShell, and `AGENT_HEARTBEAT_MS=2000` shortens the interval. `AGENT_HOME` moves the config folder.
