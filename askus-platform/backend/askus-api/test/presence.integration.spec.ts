/**
 * End-to-end tests of Staff Hierarchy & Live Presence against a real Postgres (database `askus_test`,
 * dropped and recreated on every run) and the real Nest app, including a real WebSocket server.
 * Presence time is driven by a fake clock; no test waits for real time to pass.
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import WebSocket from 'ws';
import { Role } from '../src/common/roles';
import { User } from '../src/identity/identity.entities';
import { MonitoringConsent } from '../src/solutions/monitoring.entities';
import { PresenceConsent, PresenceTransition, StaffAssignmentAudit } from '../src/solutions/presence.entities';
import { PresenceService } from '../src/solutions/presence.service';
import { PresenceBus } from '../src/solutions/staff-hierarchy.service';

require('dotenv').config({ path: join(__dirname, '..', '.env') });

const TEST_DB = 'askus_test';
const ORIGIN = 'http://localhost:3005';
const baseUrl = new URL(process.env.DATABASE_URL!);
const testUrl = (() => {
  const u = new URL(baseUrl.toString());
  u.pathname = `/${TEST_DB}`;
  return u.toString();
})();

let app: INestApplication;
let base: string;
let jwt: JwtService;
let db: DataSource;
let presence: PresenceService;
let bus: PresenceBus;
let clock = new Date('2026-11-18T10:00:00Z');
const advance = (sec: number) => (clock = new Date(clock.getTime() + sec * 1000));

type Seed = { id: string; token: string };
const people: Record<string, Seed> = {};

async function seed(users: any, key: string, name: string, roles: Role[], extra: Partial<User> = {}) {
  const row = await users.save(users.create({ fullName: name, email: `${key}@test.local`, roles, permissions: ['timesheet', 'users'], isActive: true, approvalStatus: 'APPROVED', ...extra }));
  people[key] = { id: row.id, token: jwt.sign({ sub: row.id, roles, permissions: ['timesheet', 'users'], name }) };
}

async function call(who: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${people[who].token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* csv or empty */ }
  return { status: res.status, body: json };
}

/** Allow + start one tab; returns the opaque session id. */
async function enable(who: string, inView = true) {
  expect((await call(who, 'POST', '/presence/consent/accept', {})).status).toBe(201);
  const r = await call(who, 'POST', '/presence/sessions', { inView });
  expect(r.status).toBe(201);
  return r.body.sessionId as string;
}
let seqCounter = 0;
const beat = (who: string, sessionId: string, inView: boolean, seq = ++seqCounter) => call(who, 'POST', '/presence/heartbeat', { sessionId, inView, seq });
const stateOf = async (viewer: string, who: string) => (await call(viewer, 'GET', '/presence/team?pageSize=200')).body.rows.find((r: any) => r.userId === people[who].id)?.state;
const assign = (target: string, admin: string | null, as = 'sa') => call(as, 'PUT', `/presence/assignments/${people[target].id}`, { adminId: admin === null ? null : people[admin].id });

beforeAll(async () => {
  const admin = new Client({ connectionString: new URL('/postgres', baseUrl).toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  Object.assign(process.env, { DATABASE_URL: testUrl, NODE_ENV: 'test', CORS_ORIGINS: ORIGIN, PRESENCE_DISABLE_EXPIRY: 'true', DISABLE_RATE_LIMIT: 'true', DUMMY_OTP_CODE: '', SUPER_ADMIN_IDENTIFIER: '', ADMIN_IDENTIFIER: '' });
  const { ensureSchemas } = await import('../src/common/ensure-schemas');
  await ensureSchemas(testUrl, false);
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  await app.listen(0);
  base = `${await app.getUrl()}`.replace('[::1]', '127.0.0.1').replace('//[::]', '//127.0.0.1') + '/api';
  jwt = app.get(JwtService);
  db = app.get(DataSource);
  presence = app.get(PresenceService);
  bus = app.get(PresenceBus);
  presence.now = () => clock;

  const users = app.get(getRepositoryToken(User));
  await seed(users, 'sa', 'Sam Super', [Role.SuperAdmin]);
  await seed(users, 'adminA', 'Alice Admin', [Role.Admin]);
  await seed(users, 'adminB', 'Bob Admin', [Role.Admin]);
  await seed(users, 'emp1', 'Eve Employee', [Role.Employee]);
  await seed(users, 'emp2', 'Eli Employee', [Role.Employee]);
  await seed(users, 'agent1', 'Ann Agent', [Role.Agent]);
  await seed(users, 'cust', 'Cy Customer', [Role.Customer]);
  await seed(users, 'deadAdmin', 'Dan Disabled', [Role.Admin], { isActive: false });
  await seed(users, 'taxiAdmin', 'Tia Taxi', [Role.TaxiAdmin]);
}, 900_000);

afterAll(async () => {
  await app?.close();
});

describe('migration', () => {
  it('migration file creates every presence table, an index and FK, and is reversible', () => {
    const sql = readFileSync(join(__dirname, '../src/migrations/1795800000000-AddStaffHierarchyPresence.ts'), 'utf8');
    for (const t of ['staff_assignment_audit', 'presence_consents', 'presence_sessions', 'presence_states', 'presence_transitions']) {
      expect(sql).toContain(`CREATE TABLE "solutions"."${t}"`);
      expect(sql).toContain(`DROP TABLE "solutions"."${t}"`);
    }
    expect(sql).toContain('IDX_8a3e62323d1f00bb739533c52c');
    expect(sql).toContain('FOREIGN KEY ("reporting_admin_id")');
  });
});

describe('assignment (Super Admin only) and audit', () => {
  it('everyone starts unassigned: no guessed mapping', async () => {
    const rows = (await call('sa', 'GET', '/presence/team?pageSize=200')).body.rows;
    expect(rows.filter((r: any) => r.role !== 'Admin').every((r: any) => r.reportingAdminId === null)).toBe(true);
  });

  it('Super Admin sees all eligible Admins, Employees and Agents, assigned or not, and nobody else', async () => {
    const res = await call('sa', 'GET', '/presence/team?pageSize=200');
    expect(res.status).toBe(200);
    const ids = res.body.rows.map((r: any) => r.userId).sort();
    const expected = ['adminA', 'adminB', 'emp1', 'emp2', 'agent1'].map((k) => people[k].id).sort();
    expect(ids).toEqual(expected); // no customer, no disabled admin, no product admin, not the Super Admin
    expect(res.body.canAssign).toBe(true);
  });

  it('assign, reassign and unassign write correct audit rows', async () => {
    expect((await assign('emp1', 'adminA')).status).toBe(200);
    expect((await assign('emp1', 'adminB')).status).toBe(200);
    expect((await assign('emp1', null)).status).toBe(200);
    const rows = await db.getRepository(StaffAssignmentAudit).find({ where: { subjectId: people.emp1.id }, order: { createdAt: 'ASC' } });
    expect(rows.map((r) => [r.oldAdminId, r.newAdminId])).toEqual([
      [null, people.adminA.id],
      [people.adminA.id, people.adminB.id],
      [people.adminB.id, null],
    ]);
    expect(rows.every((r) => r.actorId === people.sa.id)).toBe(true);
    const log = await call('sa', 'GET', `/presence/assignments/audit?userId=${people.emp1.id}`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(3);
  });

  it('rejects ineligible targets and subjects', async () => {
    expect((await assign('emp1', 'sa')).status).toBe(400); // SuperAdmin
    expect((await assign('emp1', 'emp2')).status).toBe(400); // Employee
    expect((await assign('emp1', 'agent1')).status).toBe(400); // Agent
    expect((await assign('emp1', 'cust')).status).toBe(400); // Customer
    expect((await assign('emp1', 'deadAdmin')).status).toBe(400); // disabled
    expect((await assign('emp1', 'taxiAdmin')).status).toBe(400); // not a Solutions Admin
    expect((await call('sa', 'PUT', `/presence/assignments/${people.emp1.id}`, { adminId: '11111111-1111-4111-8111-111111111111' })).status).toBe(400); // nonexistent
    expect((await assign('adminA', 'adminB')).status).toBe(400); // subject is an Admin
    expect((await assign('cust', 'adminA')).status).toBe(400); // subject is a Customer
    expect((await call('sa', 'PUT', `/presence/assignments/${people.adminA.id}`, { adminId: people.adminA.id })).status).toBe(400); // self
    expect((await call('sa', 'PUT', `/presence/assignments/${people.emp1.id}`, { adminId: 'not-a-uuid' })).status).toBe(400);
  });

  it('assigning to the same Admin twice is a conflict and writes no extra audit row', async () => {
    expect((await assign('emp2', 'adminA')).status).toBe(200);
    const before = await db.getRepository(StaffAssignmentAudit).count({ where: { subjectId: people.emp2.id } });
    expect((await assign('emp2', 'adminA')).status).toBe(409);
    expect(await db.getRepository(StaffAssignmentAudit).count({ where: { subjectId: people.emp2.id } })).toBe(before);
    expect((await assign('emp2', null)).status).toBe(200);
  });

  it('concurrent changes serialise and the audit trail stays consistent', async () => {
    const results = await Promise.all([assign('agent1', 'adminA'), assign('agent1', 'adminB'), assign('agent1', 'adminA')]);
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    const rows = await db.getRepository(StaffAssignmentAudit).find({ where: { subjectId: people.agent1.id }, order: { createdAt: 'ASC' } });
    for (let i = 1; i < rows.length; i++) expect(rows[i].oldAdminId).toBe(rows[i - 1].newAdminId); // a chain, never a gap
    const u = await db.getRepository(User).findOneByOrFail({ id: people.agent1.id });
    expect(u.reportingAdminId).toBe(rows[rows.length - 1].newAdminId);
    await assign('agent1', null);
  });

  it.each(['adminA', 'emp1', 'agent1', 'cust'])('%s cannot assign, list admins or read the assignment audit', async (who) => {
    expect((await assign('emp2', 'adminA', who)).status).toBe(403);
    expect((await call(who, 'GET', '/presence/admins')).status).toBe(403);
    expect((await call(who, 'GET', '/presence/assignments/audit')).status).toBe(403);
  });

  it('Super Admin can list the assignable Admins (active Solutions Admins only)', async () => {
    const r = await call('sa', 'GET', '/presence/admins');
    expect(r.body.map((a: any) => a.id).sort()).toEqual([people.adminA.id, people.adminB.id].sort());
  });
});

describe('server-side scope for Admins (never the UI)', () => {
  beforeAll(async () => {
    expect((await assign('emp1', 'adminA')).status).toBe(200);
    expect((await assign('agent1', 'adminA')).status).toBe(200);
    expect((await assign('emp2', 'adminB')).status).toBe(200);
  });

  it('Admin A sees only their assigned Employees/Agents: no peers, no other team, no unassigned', async () => {
    const rows = (await call('adminA', 'GET', '/presence/team?pageSize=200')).body.rows;
    expect(rows.map((r: any) => r.userId).sort()).toEqual([people.emp1.id, people.agent1.id].sort());
    expect((await call('adminA', 'GET', '/presence/team')).body.canAssign).toBe(false);
  });

  it('Admin B sees only theirs', async () => {
    const rows = (await call('adminB', 'GET', '/presence/team?pageSize=200')).body.rows;
    expect(rows.map((r: any) => r.userId)).toEqual([people.emp2.id]);
  });

  it('manipulated filters cannot widen the scope', async () => {
    const own = (await call('adminB', 'GET', `/presence/team?adminId=${people.adminA.id}&pageSize=200`)).body.rows;
    expect(own).toEqual([]); // asking for A's team from B gives nothing
    expect((await call('adminB', 'GET', '/presence/team?adminId=none&pageSize=200')).body.rows).toEqual([]);
    expect((await call('adminB', 'GET', '/presence/team?role=Admin&pageSize=200')).body.rows).toEqual([]);
    expect((await call('adminB', 'GET', '/presence/team?role=Employee;DROP')).status).toBe(400);
    expect((await call('adminB', 'GET', '/presence/team?sort=password')).status).toBe(400);
    expect((await call('adminB', 'GET', '/presence/team?pageSize=100000')).status).toBe(400);
  });

  it('guessed IDs: history of someone else’s report looks identical to a nonexistent person (404)', async () => {
    const other = await call('adminB', 'GET', `/presence/team/${people.emp1.id}/history`);
    const ghost = await call('adminB', 'GET', '/presence/team/11111111-1111-4111-8111-111111111111/history');
    expect(other.status).toBe(404);
    expect(ghost.status).toBe(404);
    expect(other.body).toEqual({ ...ghost.body });
    expect((await call('adminB', 'GET', `/presence/team/${people.adminA.id}/history`)).status).toBe(404); // a peer Admin
    expect((await call('adminB', 'GET', `/presence/team/${people.sa.id}/history`)).status).toBe(404); // the Super Admin
    expect((await call('adminA', 'GET', `/presence/team/${people.emp1.id}/history`)).status).toBe(200);
    expect((await call('sa', 'GET', `/presence/team/${people.emp1.id}/history`)).status).toBe(200);
  });

  it('CSV export uses the identical scope and carries no ids', async () => {
    const a = await call('adminA', 'GET', '/presence/team/export');
    expect(a.status).toBe(200);
    expect(a.body).toContain('Eve Employee');
    expect(a.body).not.toContain('Eli Employee');
    expect(a.body).not.toContain('Bob Admin');
    expect(a.body).not.toContain(people.emp1.id);
    const sa = (await call('sa', 'GET', '/presence/team/export')).body as string;
    for (const n of ['Eve Employee', 'Eli Employee', 'Alice Admin', 'Bob Admin', 'Ann Agent']) expect(sa).toContain(n);
  });

  it('reassignment immediately revokes the former Admin and enables the new one', async () => {
    expect((await call('adminA', 'GET', `/presence/team/${people.agent1.id}/history`)).status).toBe(200);
    expect((await assign('agent1', 'adminB')).status).toBe(200);
    expect((await call('adminA', 'GET', `/presence/team/${people.agent1.id}/history`)).status).toBe(404);
    expect((await call('adminB', 'GET', `/presence/team/${people.agent1.id}/history`)).status).toBe(200);
    expect((await call('adminA', 'GET', '/presence/team?pageSize=200')).body.rows.map((r: any) => r.userId)).toEqual([people.emp1.id]);
    expect((await call('adminA', 'GET', '/presence/team/export')).body).not.toContain('Ann Agent');
    expect((await assign('agent1', 'adminA')).status).toBe(200); // restore for later tests
  });

  it.each(['emp1', 'agent1', 'cust', 'taxiAdmin'])('%s cannot use any manager endpoint', async (who) => {
    expect((await call(who, 'GET', '/presence/team')).status).toBe(403);
    expect((await call(who, 'GET', '/presence/team/export')).status).toBe(403);
    expect((await call(who, 'GET', `/presence/team/${people.emp2.id}/history`)).status).toBe(403);
  });

  it('unauthenticated and tampered tokens are rejected', async () => {
    expect((await call(null, 'GET', '/presence/team')).status).toBe(401);
    const res = await fetch(`${base}/presence/team`, { headers: { Authorization: `Bearer ${people.sa.token}x` } });
    expect(res.status).toBe(401);
  });

  it('a client-supplied role or actor id is ignored: a forged token role cannot beat the database', async () => {
    // Token claims SUPER_ADMIN for an Employee. The route guard lets it through, but the service reads the real role.
    const forged = jwt.sign({ sub: people.emp1.id, roles: [Role.SuperAdmin], permissions: [], name: 'x' });
    const res = await fetch(`${base}/presence/team`, { headers: { Authorization: `Bearer ${forged}` } });
    expect(res.status).toBe(403);
    const assignRes = await fetch(`${base}/presence/assignments/${people.emp2.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${forged}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: people.adminA.id }) });
    expect(assignRes.status).toBe(403);
    const u = await db.getRepository(User).findOneByOrFail({ id: people.emp2.id });
    expect(u.reportingAdminId).toBe(people.adminB.id);
  });
});

describe('consent', () => {
  it.each(['adminA', 'emp1', 'agent1'])('%s is prompted when no current consent exists', async (who) => {
    const me = (await call(who, 'GET', '/presence/me')).body;
    expect(me).toMatchObject({ trackable: true, needsDecision: true, consent: null, state: 'not_enabled' });
    expect(me.notice.summary).toMatch(/Other tabs and apps are not monitored/);
  });

  it('Super Admin is an observer: no prompt, cannot accept or start; Customer is excluded entirely', async () => {
    expect((await call('sa', 'GET', '/presence/me')).body).toMatchObject({ trackable: false, needsDecision: false });
    expect((await call('sa', 'POST', '/presence/consent/accept', {})).status).toBe(403);
    expect((await call('sa', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
    expect((await call('cust', 'GET', '/presence/me')).status).toBe(403);
    expect((await call('cust', 'POST', '/presence/consent/accept', {})).status).toBe(403);
    expect((await call('cust', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
    expect((await call('cust', 'POST', '/presence/heartbeat', { sessionId: 'x'.repeat(24), inView: true, seq: 1 })).status).toBe(403);
    expect(await db.getRepository(PresenceConsent).count({ where: { userId: people.cust.id } })).toBe(0);
    expect(await db.getRepository(PresenceConsent).count({ where: { userId: people.sa.id } })).toBe(0);
  });

  it('a session cannot start without consent', async () => {
    expect((await call('emp2', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
  });

  it('desktop-agent consent is NOT reused', async () => {
    await db.getRepository(MonitoringConsent).save({ userId: people.emp2.id, policyVersion: '1', consentAcceptedAt: new Date() });
    expect((await call('emp2', 'GET', '/presence/me')).body.needsDecision).toBe(true);
    expect((await call('emp2', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
  });

  it('Not now persists, starts no ingestion, and does not nag on later requests (route changes)', async () => {
    const r = await call('emp2', 'POST', '/presence/consent/defer', {});
    expect(r.body.consent).toMatchObject({ decision: 'deferred', current: true });
    for (let i = 0; i < 3; i++) expect((await call('emp2', 'GET', '/presence/me')).body.needsDecision).toBe(false);
    expect((await call('emp2', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
    expect(await db.query(`SELECT 1 FROM solutions.presence_sessions WHERE user_id = $1`, [people.emp2.id])).toHaveLength(0);
    advance(2 * 86_400_000); // the deferral lapses and the choice is offered again
    expect((await call('emp2', 'GET', '/presence/me')).body.needsDecision).toBe(true);
    advance(-2 * 86_400_000);
  });

  it('Allow stores the notice version and starts a session only after the server confirms', async () => {
    const acc = await call('emp2', 'POST', '/presence/consent/accept', { noticeVersion: '1' });
    expect(acc.body.consent).toMatchObject({ decision: 'accepted', noticeVersion: '1', current: true });
    const sid = (await call('emp2', 'POST', '/presence/sessions', { inView: true })).body.sessionId;
    expect(sid).toMatch(/^[A-Za-z0-9_-]{20,40}$/);
    expect(sid).not.toContain('.'); // not a JWT
    await call('emp2', 'POST', '/presence/sessions/end', { sessionId: sid });
  });

  it('a stale notice version is refused with a conflict (never silently migrated)', async () => {
    expect((await call('emp1', 'POST', '/presence/consent/accept', { noticeVersion: '0' })).status).toBe(409);
  });

  it('a newer notice requires a new decision, and an old-version acceptance starts nothing', async () => {
    await db.getRepository(PresenceConsent).save({ userId: people.emp2.id, noticeVersion: '0', decision: 'accepted', decidedAt: clock });
    expect((await call('emp2', 'GET', '/presence/me')).body).toMatchObject({ needsDecision: true, state: 'not_enabled' });
    expect((await call('emp2', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
    await call('emp2', 'POST', '/presence/consent/accept', {}); // decide again for the current version
  });

  it('withdrawal stops ingestion immediately and invalidates every session', async () => {
    const s1 = (await call('emp2', 'POST', '/presence/sessions', { inView: true })).body.sessionId;
    const s2 = (await call('emp2', 'POST', '/presence/sessions', { inView: false })).body.sessionId;
    expect((await beat('emp2', s1, true)).status).toBe(201);
    expect((await call('emp2', 'POST', '/presence/consent/withdraw')).body.consent.decision).toBe('withdrawn');
    expect((await beat('emp2', s1, true)).status).toBe(403);
    expect((await beat('emp2', s2, true)).status).toBe(403);
    expect((await call('emp2', 'POST', '/presence/sessions', { inView: true })).status).toBe(403);
    expect(await db.query(`SELECT 1 FROM solutions.presence_sessions WHERE user_id = $1 AND ended_at IS NULL`, [people.emp2.id])).toHaveLength(0);
    expect(await stateOf('sa', 'emp2')).toBe('not_enabled'); // distinct from offline
    // revisit: a withdrawn decision stays respected, and the person can turn it on again
    expect((await call('emp2', 'GET', '/presence/me')).body.needsDecision).toBe(false);
    expect((await call('emp2', 'POST', '/presence/consent/accept', {})).body.consent.decision).toBe('accepted');
  });

  it('a heartbeat for someone else’s session id behaves like an unknown session', async () => {
    const mine = await enable('adminB');
    const theirs = await beat('emp1', mine, true);
    expect([403, 410]).toContain(theirs.status);
    await call('adminB', 'POST', '/presence/sessions/end', { sessionId: mine });
  });
});

describe('presence lifecycle (fake clock, server time only)', () => {
  let sid: string;

  it('Active -> Background -> Away -> Active', async () => {
    sid = await enable('emp1', true);
    expect(await stateOf('adminA', 'emp1')).toBe('active');
    advance(30);
    await beat('emp1', sid, false);
    expect(await stateOf('adminA', 'emp1')).toBe('background');
    for (let i = 0; i < 20; i++) { advance(30); await beat('emp1', sid, false); } // 10 minutes reachable in background
    await presence.tick();
    expect(await stateOf('adminA', 'emp1')).toBe('away');
    advance(30);
    await beat('emp1', sid, true);
    expect(await stateOf('adminA', 'emp1')).toBe('active');
  });

  it('server-driven expiry: no client event is needed to reach Offline, and Offline -> reconnected works', async () => {
    advance(121);
    await presence.tick();
    expect(await stateOf('adminA', 'emp1')).toBe('offline');
    advance(5);
    await beat('emp1', sid, true); // the same session reconnects
    expect(await stateOf('adminA', 'emp1')).toBe('active');
  });

  it('duplicate and out-of-order heartbeats are ignored and create no history rows', async () => {
    const before = await db.getRepository(PresenceTransition).count({ where: { userId: people.emp1.id } });
    const seq = ++seqCounter;
    expect((await beat('emp1', sid, true, seq)).body.ignored).toBe(false);
    for (let i = 0; i < 5; i++) expect((await beat('emp1', sid, true, seq)).body.ignored).toBe(true); // duplicates
    expect((await beat('emp1', sid, false, seq - 1)).body.ignored).toBe(true); // older: must not flip the state
    expect(await stateOf('adminA', 'emp1')).toBe('active');
    expect(await db.getRepository(PresenceTransition).count({ where: { userId: people.emp1.id } })).toBe(before);
  });

  it('multiple tabs: a visible tab wins; closing it falls back to the other; an expired tab never overrides a fresh one', async () => {
    const tabB = (await call('emp1', 'POST', '/presence/sessions', { inView: false })).body.sessionId;
    expect(await stateOf('adminA', 'emp1')).toBe('active'); // tab 1 still in view
    advance(30);
    await beat('emp1', tabB, false);
    await call('emp1', 'POST', '/presence/sessions/end', { sessionId: sid }); // close the visible tab
    expect(await stateOf('adminA', 'emp1')).toBe('background'); // the other tab is reachable
    advance(200); // tab B stops heartbeating
    await presence.tick();
    expect(await stateOf('adminA', 'emp1')).toBe('offline');
    await call('emp1', 'POST', '/presence/sessions/end', { sessionId: tabB });
  });

  it('multiple devices: a reconnecting stale device cannot overwrite a newer state from another', async () => {
    const laptop = await enable('agent1', true);
    const phone = (await call('agent1', 'POST', '/presence/sessions', { inView: false })).body.sessionId;
    advance(10);
    await beat('agent1', phone, false); // phone reports background
    expect(await stateOf('adminA', 'agent1')).toBe('active'); // laptop still visible: wins
    advance(10);
    await beat('agent1', laptop, true);
    await beat('agent1', phone, false, 1); // stale/replayed phone event
    expect(await stateOf('adminA', 'agent1')).toBe('active');
  });

  it('withdrawal with several live sessions clears them all and manager shows Not enabled', async () => {
    await call('agent1', 'POST', '/presence/consent/withdraw');
    expect(await db.query(`SELECT 1 FROM solutions.presence_sessions WHERE user_id = $1 AND ended_at IS NULL`, [people.agent1.id])).toHaveLength(0);
    expect(await stateOf('adminA', 'agent1')).toBe('not_enabled');
  });

  it('logout ends the session and re-evaluates', async () => {
    const s = await enable('emp2', true);
    expect(await stateOf('adminB', 'emp2')).toBe('active');
    await call('emp2', 'POST', '/presence/sessions/end', { sessionId: s });
    expect(await stateOf('adminB', 'emp2')).toBe('offline');
    expect((await beat('emp2', s, true)).status).toBe(410);
  });

  it('a disabled account can no longer send heartbeats', async () => {
    const s = await enable('emp2', true);
    await db.getRepository(User).update({ id: people.emp2.id }, { isActive: false });
    expect((await beat('emp2', s, true)).status).toBe(403);
    await db.getRepository(User).update({ id: people.emp2.id }, { isActive: true });
  });

  it('history is bounded and contains transitions only', async () => {
    const h = (await call('adminA', 'GET', `/presence/team/${people.emp1.id}/history?limit=500`));
    expect(h.status).toBe(400); // limit capped at 200
    const ok = (await call('adminA', 'GET', `/presence/team/${people.emp1.id}/history?limit=200`)).body;
    expect(ok.transitions.length).toBeGreaterThan(0);
    expect(Object.keys(ok.transitions[0]).sort()).toEqual(['at', 'from', 'reason', 'to']);
  });

  it('retention purge deletes only old presence rows', async () => {
    await db.getRepository(PresenceTransition).save({ userId: people.emp1.id, fromState: 'active', toState: 'offline', at: new Date(clock.getTime() - 400 * 86_400_000) });
    const attendanceBefore = await db.query(`SELECT count(*)::int AS n FROM solutions.attendance_records`);
    await presence.purge();
    expect(await db.getRepository(PresenceTransition).count({ where: { at: new Date(clock.getTime() - 400 * 86_400_000) } })).toBe(0);
    expect(await db.getRepository(PresenceTransition).count({ where: { userId: people.emp1.id } })).toBeGreaterThan(0);
    expect(await db.query(`SELECT count(*)::int AS n FROM solutions.attendance_records`)).toEqual(attendanceBefore);
  });
});

describe('rate limiting', () => {
  it('consent and heartbeat endpoints are rate-limited per client (429) when limiting is on', async () => {
    process.env.DISABLE_RATE_LIMIT = 'false';
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 14; i++) statuses.push((await call('adminB', 'POST', '/presence/consent/withdraw')).status);
      expect(statuses).toContain(429);
      const beats: number[] = [];
      for (let i = 0; i < 45; i++) beats.push((await call('adminB', 'POST', '/presence/heartbeat', { sessionId: 'x'.repeat(24), inView: true, seq: i + 1 })).status);
      expect(beats).toContain(429);
    } finally {
      process.env.DISABLE_RATE_LIMIT = 'true';
    }
  });
});

describe('privacy', () => {
  it('heartbeats with extra fields (urls, titles, apps, keystrokes) are rejected, not stored', async () => {
    const s = await enable('adminB', true);
    for (const extra of [{ url: 'https://other.site' }, { title: 'Bank' }, { activeApp: 'Slack' }, { keys: 'abc' }, { screenshot: 'data:' }]) {
      const r = await call('adminB', 'POST', '/presence/heartbeat', { sessionId: s, inView: true, seq: ++seqCounter, ...extra });
      expect(r.status).toBe(400);
    }
    await call('adminB', 'POST', '/presence/sessions/end', { sessionId: s });
  });

  it('presence tables have no column that could hold URLs, titles, apps, keystrokes, media or tokens', async () => {
    const cols = (await db.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='solutions' AND table_name LIKE 'presence_%'`)) as { table_name: string; column_name: string }[];
    expect(cols.length).toBeGreaterThan(10);
    const banned = /url|title|app|key|screen|record|mic|camera|token|secret|password|location|lat|lng|ip_?addr|agent/i;
    expect(cols.filter((c) => banned.test(c.column_name))).toEqual([]);
  });

  it('manager payloads contain no desktop-agent fields', async () => {
    const body = JSON.stringify((await call('sa', 'GET', '/presence/team?pageSize=200')).body);
    expect(body).not.toMatch(/activeApp|active_app|idle|devices|lat|lng|screenshot|url/i);
    expect(Object.keys((await call('sa', 'GET', '/presence/team')).body.rows[0]).sort()).toEqual(
      ['lastSeenAt', 'name', 'offlineReason', 'reportingAdminId', 'reportingAdminName', 'role', 'state', 'stateSince', 'userId', 'version'],
    );
  });

  it('browser presence is not wired into attendance, payroll or desktop monitoring code', () => {
    for (const f of ['presence.service.ts', 'presence.gateway.ts', 'presence.controller.ts', 'presence.logic.ts', 'presence.entities.ts']) {
      const src = readFileSync(join(__dirname, '../src/solutions', f), 'utf8');
      expect(src).not.toMatch(/from '\.\/(attendance|leave|timesheet|monitoring)[^']*'/);
    }
    for (const f of ['attendance.service.ts', 'attendance-records.service.ts', 'leave.service.ts', 'timesheet.service.ts', 'monitoring.service.ts']) {
      expect(readFileSync(join(__dirname, '../src/solutions', f), 'utf8')).not.toMatch(/presence\.(service|entities)/);
    }
  });
});

describe('WebSocket: authenticated, origin-checked, scoped per viewer', () => {
  const wsUrl = () => base.replace('http', 'ws').replace(/\/api$/, '') + '/ws/presence';

  function open(origin: string | null = ORIGIN) {
    const ws = new WebSocket(wsUrl(), { headers: origin ? { origin } : {} });
    const inbox: any[] = [];
    let closed: { code: number } | null = null;
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
    ws.on('close', (code) => (closed = { code }));
    const opened = new Promise<void>((res, rej) => { ws.on('open', () => res()); ws.on('error', rej); ws.on('unexpected-response', (_q, r) => rej(new Error(`HTTP ${r.statusCode}`))); });
    const waitFor = async (pred: (m: any) => boolean, ms = 3000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const hit = inbox.find(pred); if (hit) return hit; await new Promise((r) => setTimeout(r, 25)); }
      return null;
    };
    const waitClose = async (ms = 3000) => { const end = Date.now() + ms; while (!closed && Date.now() < end) await new Promise((r) => setTimeout(r, 25)); return closed; };
    return { ws, inbox, opened, waitFor, waitClose, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  }
  // `ready` = true waits for the server to finish authenticating, like the real client does before it subscribes.
  const connect = async (who: string, ready = true) => {
    const c = open();
    await c.opened;
    c.send({ type: 'auth', token: people[who].token });
    if (ready) expect(await c.waitFor((m) => m.type === 'ready')).toBeTruthy();
    return c;
  };

  it('rejects a bad or missing Origin, and never accepts a token in the URL', async () => {
    await expect(open('https://evil.example').opened).rejects.toThrow(/403/);
    await expect(open(null).opened).rejects.toThrow(/403/); // no Origin header at all
    const c = open();
    await c.opened;
    expect(wsUrl()).not.toContain('token');
    c.ws.close();
  });

  it('closes unauthenticated sockets and refuses non-manager roles with the same code', async () => {
    const silent = open();
    await silent.opened;
    silent.send({ type: 'subscribe' });
    expect((await silent.waitClose())?.code).toBe(4401);
    for (const who of ['emp1', 'agent1', 'cust', 'taxiAdmin']) {
      const c = await connect(who, false); // these never become ready
      expect((await c.waitClose())?.code).toBe(4403);
      expect(c.inbox).toEqual([]);
    }
    const bad = open();
    await bad.opened;
    bad.send({ type: 'auth', token: people.sa.token + 'tampered' });
    expect((await bad.waitClose())?.code).toBe(4403);
  });

  it('snapshots are scoped: each Admin only receives their own team', async () => {
    const a = await connect('adminA');
    expect(await a.waitFor((m) => m.type === 'ready')).toBeTruthy();
    a.send({ type: 'subscribe' });
    const snapA = await a.waitFor((m) => m.type === 'snapshot');
    expect(snapA.rows.map((r: any) => r.userId).sort()).toEqual([people.emp1.id, people.agent1.id].sort());
    const b = await connect('adminB');
    b.send({ type: 'subscribe' });
    const snapB = await b.waitFor((m) => m.type === 'snapshot');
    expect(snapB.rows.map((r: any) => r.userId)).toEqual([people.emp2.id]);
    a.ws.close(); b.ws.close();
  });

  it('clients cannot pick a team: extra fields and unknown message types are refused', async () => {
    const a = await connect('adminA');
    await a.waitFor((m) => m.type === 'ready');
    a.send({ type: 'subscribe', adminId: people.adminB.id, userIds: [people.emp2.id] });
    const snap = await a.waitFor((m) => m.type === 'snapshot');
    expect(snap.rows.map((r: any) => r.userId)).not.toContain(people.emp2.id);
    a.send({ type: 'subscribeTeam', team: people.adminB.id });
    expect((await a.waitClose())?.code).toBe(4400);
  });

  it('live events reach only the authorized Admin, then reassignment revokes the former Admin and informs the new one', async () => {
    const a = await connect('adminA');
    const b = await connect('adminB');
    const sa = await connect('sa');
    for (const c of [a, b, sa]) { c.send({ type: 'subscribe' }); await c.waitFor((m) => m.type === 'snapshot'); }

    // Eve (Admin A's report) goes live.
    await call('emp1', 'POST', '/presence/consent/accept', {});
    const sid = (await call('emp1', 'POST', '/presence/sessions', { inView: true })).body.sessionId;
    expect(await a.waitFor((m) => m.type === 'upsert' && m.row.userId === people.emp1.id)).toBeTruthy();
    expect(await sa.waitFor((m) => m.type === 'upsert' && m.row.userId === people.emp1.id)).toBeTruthy();
    advance(5);
    await beat('emp1', sid, false);
    await new Promise((r) => setTimeout(r, 300));
    expect(b.inbox.filter((m) => m.type === 'upsert' && m.row.userId === people.emp1.id)).toEqual([]); // Admin B never hears of Eve

    // Reassign Eve A -> B while both dashboards are open.
    a.inbox.length = 0; b.inbox.length = 0;
    expect((await assign('emp1', 'adminB')).status).toBe(200);
    expect(await a.waitFor((m) => m.type === 'removed' && m.userId === people.emp1.id)).toBeTruthy();
    expect(await b.waitFor((m) => m.type === 'upsert' && m.row.userId === people.emp1.id && m.row.reportingAdminId === people.adminB.id)).toBeTruthy();

    // Afterwards the former Admin receives nothing more about Eve.
    a.inbox.length = 0; b.inbox.length = 0;
    advance(5);
    await beat('emp1', sid, true);
    expect(await b.waitFor((m) => m.type === 'upsert' && m.row.userId === people.emp1.id)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(a.inbox.filter((m) => 'row' in m && m.row.userId === people.emp1.id)).toEqual([]);

    // A reconnect gets a fresh, correctly scoped snapshot.
    a.ws.close();
    const a2 = await connect('adminA');
    a2.send({ type: 'subscribe' });
    const snap = await a2.waitFor((m) => m.type === 'snapshot');
    expect(snap.rows.map((r: any) => r.userId)).not.toContain(people.emp1.id);
    [b, sa, a2].forEach((c) => c.ws.close());
    expect((await assign('emp1', 'adminA')).status).toBe(200);
  });

  it('a viewer who loses Admin status is cut off at the next delivery (revalidated, not trusted from connect time)', async () => {
    const a = await connect('adminA');
    a.send({ type: 'subscribe' });
    await a.waitFor((m) => m.type === 'snapshot');
    await db.getRepository(User).update({ id: people.adminA.id }, { roles: [Role.Employee] });
    await new Promise((r) => setTimeout(r, 5200)); // beyond the revalidation window
    bus.emit('presence', { userId: people.emp1.id, name: 'x', role: 'Employee', reportingAdminId: people.adminA.id, reportingAdminName: null, state: 'active', stateSince: null, lastSeenAt: null, version: 99 });
    expect((await a.waitClose())?.code).toBe(4403);
    expect(a.inbox.filter((m) => m.type === 'upsert')).toEqual([]);
    await db.getRepository(User).update({ id: people.adminA.id }, { roles: [Role.Admin] });
  });

  it('floods are rate-limited', async () => {
    const a = await connect('adminB');
    for (let i = 0; i < 40; i++) a.send({ type: 'ping' });
    expect((await a.waitClose())?.code).toBe(4429);
  });
});

describe('existing monitoring and attendance paths follow the same hierarchy', () => {
  const day = '2026-11-18';

  it('/users: an Admin sees only their reports (plus their own creations), never another Admin’s team', async () => {
    const ids = (await call('adminB', 'GET', '/users')).body.map((u: any) => u.id);
    expect(ids).toContain(people.emp2.id);
    expect(ids).not.toContain(people.agent1.id);
    expect(ids).not.toContain(people.adminA.id);
    const all = (await call('sa', 'GET', '/users')).body.map((u: any) => u.id);
    expect(all).toEqual(expect.arrayContaining([people.emp2.id, people.agent1.id]));
  });

  it('/users/:id actions on another Admin’s staff look like a missing person; Employees see only themselves', async () => {
    expect((await call('adminB', 'PUT', `/users/${people.agent1.id}/permissions`, { permissions: [] })).status).toBe(404);
    expect((await call('adminA', 'PUT', `/users/${people.agent1.id}/permissions`, { permissions: ['tickets'] })).status).toBe(200);
    const mine = (await call('emp1', 'GET', '/users')).body;
    expect(mine.map((u: any) => u.id)).toEqual([people.emp1.id]);
  });

  it('/attendance/live and /trail: Admin gets own team, Employee only self, Super Admin everyone', async () => {
    const ids = async (who: string) => (await call(who, 'GET', `/attendance/live?date=${day}`)).body.map((r: any) => r.userId);
    expect(await ids('sa')).toEqual(expect.arrayContaining([people.emp1.id, people.emp2.id, people.agent1.id]));
    const a = await ids('adminA');
    expect(a).toEqual(expect.arrayContaining([people.agent1.id]));
    expect(a).not.toContain(people.emp2.id);
    expect(await ids('emp1')).toEqual([people.emp1.id]);
    expect((await call('adminB', 'GET', `/attendance/trail?userId=${people.agent1.id}&date=${day}`)).status).toBe(404);
    expect((await call('emp1', 'GET', `/attendance/trail?userId=${people.emp2.id}&date=${day}`)).status).toBe(404);
    expect((await call('adminA', 'GET', `/attendance/trail?userId=${people.agent1.id}&date=${day}`)).status).toBe(200);
  });

  it('/time/active-status and /time/daily-summary are scoped; a guessed userId is a 404', async () => {
    const ids = async (who: string) => (await call(who, 'GET', '/time/active-status')).body.map((r: any) => r.userId);
    expect(await ids('adminB')).toEqual(expect.arrayContaining([people.emp2.id]));
    expect(await ids('adminB')).not.toContain(people.agent1.id);
    expect(await ids('emp1')).toEqual([people.emp1.id]);
    expect((await call('adminB', 'GET', `/time/daily-summary?from=${day}&to=${day}&userId=${people.agent1.id}`)).status).toBe(404);
    expect((await call('adminA', 'GET', `/time/daily-summary?from=${day}&to=${day}&userId=${people.agent1.id}`)).status).toBe(200);
  });

  it('attendance register, late report, missed checkouts and export are scoped', async () => {
    const reg = async (who: string) => (await call(who, 'GET', '/attendance/register?month=2026-11')).body.rows.map((r: any) => r.userId);
    expect(await reg('adminB')).not.toContain(people.agent1.id);
    expect(await reg('adminB')).not.toContain(people.adminA.id);
    expect(await reg('sa')).toEqual(expect.arrayContaining([people.agent1.id, people.emp2.id]));
    expect((await call('adminB', 'GET', '/attendance/late-report?month=2026-11')).status).toBe(200);
    expect((await call('adminB', 'GET', '/attendance/missed-checkouts')).status).toBe(200);
    expect((await call('emp1', 'GET', '/attendance/register?month=2026-11')).status).toBe(403); // admin-only, unchanged
    expect((await call('adminB', 'PUT', '/attendance/manual', { userId: people.agent1.id, date: day, status: 'Present' })).status).toBe(404);
  });

  it('leave and timesheet follow the scope while self-service keeps working', async () => {
    const week = async (who: string) => (await call(who, 'GET', '/timesheet/week?weekStart=2026-11-16')).body.map((r: any) => r.userId);
    expect(await week('emp1')).toEqual([people.emp1.id]);
    expect(await week('adminB')).not.toContain(people.agent1.id);
    expect(await week('sa')).toEqual(expect.arrayContaining([people.agent1.id, people.emp2.id]));
    expect((await call('adminB', 'GET', `/leave/balance?userId=${people.agent1.id}`)).status).toBe(404);
    expect((await call('emp1', 'GET', `/leave/balance?userId=${people.emp2.id}`)).status).toBe(403);
    expect((await call('emp1', 'GET', '/leave/balance')).status).toBe(200); // own balance still works
    expect((await call('adminB', 'GET', '/leave/requests')).status).toBe(200);
    expect((await call('adminB', 'GET', '/leave/balance-summary')).status).toBe(200);
  });

  it('self-service attendance still works (check-in / today)', async () => {
    const today = await call('emp1', 'GET', '/attendance/today');
    expect(today.status).toBe(200);
  });
});

describe('Teams-style presence: why someone is offline, and the employee live link', () => {
  const linkUrl = () => base.replace('http', 'ws').replace(/\/api$/, '') + '/ws/presence/self';
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const row = async (who: string) => (await call('sa', 'GET', '/presence/team?pageSize=200')).body.rows.find((r: any) => r.userId === people[who].id);
  const startTab = async (who: string, inView = true) => {
    advance(1); // real time always moves on between a tab closing and the next one opening
    await call(who, 'POST', '/presence/consent/accept', {});
    const r = await call(who, 'POST', '/presence/sessions', { inView });
    expect(r.status).toBe(201);
    return r.body.sessionId as string;
  };

  function openLink(origin: string | null = ORIGIN) {
    const ws = new WebSocket(linkUrl(), { headers: origin ? { origin } : {} });
    const inbox: any[] = [];
    let closed: { code: number } | null = null;
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
    ws.on('close', (code) => (closed = { code }));
    const opened = new Promise<void>((res, rej) => { ws.on('open', () => res()); ws.on('error', rej); ws.on('unexpected-response', (_q, r) => rej(new Error(`HTTP ${r.statusCode}`))); });
    const waitFor = async (type: string, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { const hit = inbox.find((m) => m.type === type); if (hit) return hit; await sleep(25); } return null; };
    const waitClose = async (ms = 3000) => { const end = Date.now() + ms; while (!closed && Date.now() < end) await sleep(25); return closed; };
    return { ws, inbox, opened, waitFor, waitClose, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  }
  const link = async (who: string, sessionId?: string) => {
    const c = openLink();
    await c.opened;
    c.send({ type: 'auth', token: people[who].token });
    expect(await c.waitFor('ready')).toBeTruthy();
    if (sessionId) {
      c.send({ type: 'bind', sessionId });
      expect(await c.waitFor('bound')).toBeTruthy();
    }
    return c;
  };

  beforeAll(async () => {
    process.env.PRESENCE_LINK_GRACE_MS = '150';
    // earlier tests left tabs open for these people; start from nobody being connected
    for (const who of ['emp1', 'emp2', 'adminA', 'agent1']) {
      await db.query(`UPDATE solutions.presence_sessions SET ended_at = $2, end_reason = 'logout' WHERE user_id = $1 AND ended_at IS NULL`, [people[who].id, clock]);
      await presence.evaluate(people[who].id, true);
    }
  });
  afterAll(() => { delete process.env.PRESENCE_LINK_GRACE_MS; });

  it('closing the tab shows "closed"; a session that just stops reporting shows "lost"', async () => {
    const closedTab = await startTab('emp1');
    expect((await row('emp1')).state).toBe('active');
    expect((await row('emp1')).offlineReason).toBeNull();
    await call('emp1', 'POST', '/presence/sessions/end', { sessionId: closedTab });
    expect(await row('emp1')).toMatchObject({ state: 'offline', offlineReason: 'closed' });

    await startTab('emp1');
    advance(500);
    await presence.tick(); // no heartbeat arrived: laptop closed, asleep or network gone
    expect(await row('emp1')).toMatchObject({ state: 'offline', offlineReason: 'lost' });

    const history = (await call('adminA', 'GET', `/presence/team/${people.emp1.id}/history?limit=20`)).body.transitions;
    expect(history.some((t: any) => t.to === 'offline' && t.reason === 'closed')).toBe(true);
    expect(history.some((t: any) => t.to === 'offline' && t.reason === 'lost')).toBe(true);
  });

  it('withdrawing permission is neither closed nor lost', async () => {
    await startTab('agent1');
    await call('agent1', 'POST', '/presence/consent/withdraw', {});
    expect((await call('agent1', 'GET', '/presence/me')).body.state).toBe('not_enabled');
    await call('agent1', 'POST', '/presence/consent/accept', {});
  });

  it('an employee can open the live link but never the manager socket, and a customer can open neither', async () => {
    const sid = await startTab('emp1');
    const c = await link('emp1', sid);
    expect(c.inbox.some((m) => m.type === 'snapshot' || m.type === 'upsert')).toBe(false); // it carries no team data at all
    c.ws.close();

    const cust = openLink();
    await cust.opened;
    cust.send({ type: 'auth', token: people.cust.token });
    expect((await cust.waitClose())?.code).toBe(4403);

    const mgr = new WebSocket(base.replace('http', 'ws').replace(/\/api$/, '') + '/ws/presence', { headers: { origin: ORIGIN } });
    await new Promise<void>((res) => mgr.on('open', () => res()));
    mgr.send(JSON.stringify({ type: 'auth', token: people.emp1.token }));
    await sleep(300);
    expect(mgr.readyState).not.toBe(WebSocket.OPEN); // the manager path still refuses employees
  });

  it('rejects a bad Origin and unauthenticated or tampered links', async () => {
    await expect(openLink('https://evil.example').opened).rejects.toThrow(/403/);
    const silent = openLink();
    await silent.opened;
    silent.send({ type: 'bind', sessionId: 'x'.repeat(24) });
    expect((await silent.waitClose())?.code).toBe(4401);
    const bad = openLink();
    await bad.opened;
    bad.send({ type: 'auth', token: people.emp1.token + 'tampered' });
    expect((await bad.waitClose())?.code).toBe(4403);
  });

  it("a link can only bind to its owner's own open session", async () => {
    const others = await startTab('emp2');
    const c = openLink();
    await c.opened;
    c.send({ type: 'auth', token: people.emp1.token });
    expect(await c.waitFor('ready')).toBeTruthy();
    c.send({ type: 'bind', sessionId: others });
    expect((await c.waitClose())?.code).toBe(4404);
    expect((await row('emp2')).state).toBe('active'); // nothing happened to the other person
  });

  it('saying goodbye on the link ends the session as closed, at once', async () => {
    const sid = await startTab('emp1');
    const c = await link('emp1', sid);
    c.send({ type: 'bye' });
    await c.waitClose();
    expect(await row('emp1')).toMatchObject({ state: 'offline', offlineReason: 'closed' });
  });

  it('a dropped link (laptop closed, network gone) makes the person "lost" after a short grace', async () => {
    const sid = await startTab('emp1');
    const c = await link('emp1', sid);
    expect((await row('emp1')).state).toBe('active');
    c.ws.terminate(); // no goodbye: the connection simply dies
    await sleep(700);
    expect(await row('emp1')).toMatchObject({ state: 'offline', offlineReason: 'lost' });
    expect((await call('emp1', 'POST', '/presence/heartbeat', { sessionId: sid, inView: true, seq: ++seqCounter })).status).toBe(410); // the session is over
  });

  it('a link that reconnects within the grace period is not treated as lost', async () => {
    const sid = await startTab('emp1');
    const first = await link('emp1', sid);
    first.ws.terminate();
    const second = await link('emp1', sid); // a network blip: the browser reconnects at once
    await sleep(700);
    expect((await row('emp1')).state).toBe('active');
    second.ws.close();
    await sleep(700);
    expect((await row('emp1')).offlineReason).toBe('lost');
  });

  it('the link keeps a throttled background tab from looking gone', async () => {
    const sid = await startTab('emp1', false); // another tab is in front
    expect((await row('emp1')).state).toBe('background');
    advance(100); // close to the offline limit with no REST heartbeat
    await presence.touch(people.emp1.id, sid); // the live link answered a ping
    advance(100);
    await presence.tick();
    expect((await row('emp1')).state).not.toBe('offline'); // without the touch this would be 200 s of silence
  });

  it('an Admin on the live link is tracked too, and Super Admin sees them', async () => {
    const sid = await startTab('adminA');
    const c = await link('adminA', sid);
    expect((await row('adminA')).state).toBe('active');
    c.ws.terminate();
    await sleep(700);
    expect(await row('adminA')).toMatchObject({ state: 'offline', offlineReason: 'lost' });
  });

  it('the Super Admin is an observer and cannot open the live link', async () => {
    const c = openLink();
    await c.opened;
    c.send({ type: 'auth', token: people.sa.token });
    expect((await c.waitClose())?.code).toBe(4403);
  });
});
