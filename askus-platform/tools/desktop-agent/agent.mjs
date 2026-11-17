#!/usr/bin/env node
// AskUs work-hour agent (Windows, Phase 1). Plain Node 18+, no dependencies.
//
//   node agent.mjs pair --code ABCD2345 [--api http://localhost:4000/api]   pair this PC (code from the web app)
//   node agent.mjs run                                                       send heartbeats (what the logon task runs)
//   node agent.mjs status                                                    show pairing and queue state
//   node agent.mjs unpair                                                    forget this pairing
//
// Every 90 s it sends { employeeId, deviceId, timestamp, status: 'active'|'idle', activeAppName }.
// Idle = no keyboard/mouse input for 5 minutes (checked by sampler.ps1 through the OS). A locked screen
// sends nothing, so it counts as offline. If the network is down, heartbeats wait in queue.jsonl and are
// sent in order when it returns. Nothing else is ever collected.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.AGENT_HOME || join(process.env.APPDATA || join(homedir(), '.config'), 'AskUsAgent');
const CONFIG = join(HOME, 'config.json');
const QUEUE = join(HOME, 'queue.jsonl');
const STATUS = join(HOME, 'status.json');
const QUIT = join(HOME, 'quit.flag');
const FAKE = join(HOME, 'fake-sample.json'); // test hook: stands in for the Windows sampler when AGENT_SAMPLER=fake
const LOCKED_APPS = new Set(['LockApp', 'LogonUI']);

mkdirSync(HOME, { recursive: true });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// ───────────────────────── queue (flat file, one JSON object per line) ─────────────────────────

function readQueue() {
  if (!existsSync(QUEUE)) return [];
  return readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}
function writeQueue(items) {
  const tmp = `${QUEUE}.tmp`;
  writeFileSync(tmp, items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''));
  renameSync(tmp, QUEUE); // atomic, so a crash never leaves half a file
}

function writeStatus(state, extra = {}) {
  writeFileSync(STATUS, JSON.stringify({ state, queued: readQueue().length, at: new Date().toISOString(), ...extra }));
}

// ───────────────────────── server calls ─────────────────────────

async function call(cfg, path, method = 'GET', body) {
  const res = await fetch(`${cfg.api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(json?.message ? [].concat(json.message).join(', ') : `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ───────────────────────── commands ─────────────────────────

async function pair() {
  const code = arg('code');
  if (!code) throw new Error('Usage: node agent.mjs pair --code <code from the web app> [--api <url>]');
  const existing = readJson(CONFIG);
  const cfg = {
    api: (arg('api') || existing?.api || process.env.ASKUS_API || 'http://localhost:4000/api').replace(/\/$/, ''),
    deviceId: existing?.deviceId || randomUUID(),
  };
  const out = await call(cfg, '/agent/register', 'POST', { code, deviceId: cfg.deviceId, deviceName: arg('name') || hostname(), platform: 'windows' });
  writeFileSync(CONFIG, JSON.stringify({ ...cfg, token: out.deviceToken, employeeId: out.employeeId, employeeName: out.employeeName, heartbeatSeconds: out.heartbeatSeconds, idleThresholdSeconds: out.idleThresholdSeconds }, null, 2));
  log(`Paired with ${out.employeeName}. Start the agent with: node agent.mjs run`);
}

function status() {
  const cfg = readJson(CONFIG);
  console.log(cfg ? { paired: true, api: cfg.api, employee: cfg.employeeName, deviceId: cfg.deviceId, queued: readQueue().length, last: readJson(STATUS) } : { paired: false });
}

function unpair() {
  rmSync(CONFIG, { force: true });
  rmSync(QUEUE, { force: true });
  log('Unpaired. Ask your admin or remove the device in the web app to revoke it on the server too.');
}

// ───────────────────────── sampling ─────────────────────────

/** Latest { idleSeconds, app } sample. Real samples come from sampler.ps1; AGENT_SAMPLER=fake reads fake-sample.json for tests. */
function startSampler() {
  const state = { sample: null, stop: () => {} };
  if (process.env.AGENT_SAMPLER === 'fake') {
    state.read = () => readJson(FAKE);
    return state;
  }
  if (process.platform !== 'win32') throw new Error('This agent runs on Windows only in this phase.');
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', join(HERE, 'sampler.ps1')], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  let buf = '';
  ps.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) > -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      try { state.sample = JSON.parse(line); } catch { /* ignore a partial line */ }
    }
  });
  ps.on('exit', () => { state.sample = null; });
  state.read = () => state.sample;
  state.stop = () => ps.kill();
  return state;
}

function startTray() {
  if (process.platform !== 'win32' || process.argv.includes('--no-tray')) return () => {};
  const tray = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', join(HERE, 'tray.ps1'), '-HomeDir', HOME], { stdio: 'ignore', windowsHide: true });
  return () => tray.kill();
}

// ───────────────────────── main loop ─────────────────────────

async function flush(cfg) {
  let queue = readQueue();
  while (queue.length) {
    const chunk = queue.slice(0, 200);
    if (chunk.length === 1) await call(cfg, '/agent/heartbeat', 'POST', chunk[0]);
    else await call(cfg, '/agent/heartbeat/batch', 'POST', { heartbeats: chunk });
    queue = queue.slice(chunk.length);
    writeQueue(queue); // only what was acknowledged is removed
  }
}

async function run() {
  const cfg = readJson(CONFIG);
  if (!cfg?.token) throw new Error('This PC is not paired. Run: node agent.mjs pair --code <code>');
  rmSync(QUIT, { force: true });

  // Refuses to start unless the employee has accepted the monitoring policy.
  let info;
  try {
    info = await call(cfg, '/agent/status');
  } catch (e) {
    if (e.status === 401) throw new Error('This device was removed. Pair it again with a new code.');
    log(`Cannot reach the server yet (${e.message}); starting anyway and queueing heartbeats.`);
  }
  if (info && !info.consented) {
    writeStatus('waiting for consent');
    throw new Error('The work-hour monitoring policy has not been accepted. Accept it in the web app, then start the agent again.');
  }

  const heartbeatMs = Number(process.env.AGENT_HEARTBEAT_MS) || (info?.heartbeatSeconds ?? cfg.heartbeatSeconds ?? 90) * 1000;
  const idleAfter = Number(process.env.AGENT_IDLE_SECONDS) || info?.idleThresholdSeconds || cfg.idleThresholdSeconds || 300;
  const sampler = startSampler();
  const stopTray = startTray();
  log(`Agent running for ${cfg.employeeName}: a heartbeat every ${heartbeatMs / 1000}s, idle after ${idleAfter}s.`);

  let stopping = false;
  const shutdown = () => { stopping = true; };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (!stopping && !existsSync(QUIT)) {
    await sleep(heartbeatMs);
    if (stopping || existsSync(QUIT)) break;

    const sample = sampler.read();
    let state = 'offline (no sample)';
    if (sample && !LOCKED_APPS.has(sample.app)) {
      const idle = sample.idleSeconds >= idleAfter;
      state = idle ? 'idle' : 'active';
      appendFileSync(QUEUE, JSON.stringify({
        employeeId: cfg.employeeId,
        deviceId: cfg.deviceId,
        timestamp: new Date().toISOString(),
        status: idle ? 'idle' : 'active',
        ...(sample.app ? { activeAppName: sample.app } : {}),
      }) + '\n');
    } else if (sample) {
      state = 'screen locked'; // nothing is sent: the time is simply not counted
    }

    try {
      await flush(cfg);
      writeStatus(state, { lastSent: new Date().toISOString() });
    } catch (e) {
      if (e.status === 401) { writeStatus('device removed'); log('This device was removed on the server. Stopping.'); break; }
      if (e.status === 403) { writeStatus('waiting for consent'); log(`Server refused: ${e.message}. Stopping.`); break; }
      writeStatus(`${state}, offline`);
      log(`Could not send (${e.message}); ${readQueue().length} heartbeat(s) are queued.`);
    }
  }
  sampler.stop();
  stopTray();
  log('Agent stopped.');
}

const commands = { pair, run, status, unpair };
const command = process.argv[2];
if (!commands[command]) {
  console.log('Usage: node agent.mjs <pair|run|status|unpair>');
  process.exit(1);
}
Promise.resolve(commands[command]()).catch((e) => { console.error(e.message); process.exit(2); });
