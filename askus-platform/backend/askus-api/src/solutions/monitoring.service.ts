import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt } from 'crypto';
import { Between, DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { istDay } from './attendance.service';
import { AttendanceRecordsService, assertDay, datesBetween } from './attendance-records.service';
import {
  ActivityHeartbeat, ActivitySession, AgentPairingCode, DailySummary, DeviceToken, MonitoringConsent, MonitoringSetting, TrackingMethod,
} from './monitoring.entities';
import { TimesheetService } from './timesheet.service';
import { toTmsRole } from './users.service';

// ───────────────────────── tunables ─────────────────────────

/** The agent pings this often. */
export const HEARTBEAT_SECONDS = 90;
/** No keyboard/mouse input for this long = idle. Short gaps under it still count as working. */
export const IDLE_THRESHOLD_SECONDS = 300;
/** Two pings further apart than this mean the machine was off, asleep, locked or the agent was stopped: not counted. */
export const MAX_GAP_SECONDS = 240;
/** No ping for this long = shown as offline. */
const OFFLINE_AFTER_SECONDS = 240;
/** A queued ping older than this is not accepted. */
const MAX_BACKFILL_MS = 7 * 86_400_000;
const MAX_FUTURE_MS = 5 * 60_000;
const RETENTION_DAYS = 90;
const PAIRING_TTL_MS = 10 * 60_000;
/** A manual session left running longer than this is not trusted past this point. */
const MAX_MANUAL_SECONDS = 16 * 3600;
export const DEFAULT_TARGET_MINUTES = 8 * 60;
const IST_OFFSET_MS = 5.5 * 3600_000;

/**
 * The wording employees accept once. PLACEHOLDER: the requirement document says the final text must be
 * reviewed by a lawyer against the DPDP Act 2023 and the IT Act before rollout. Change POLICY_VERSION
 * whenever the wording changes; the acceptance records which version was signed.
 */
export const POLICY_VERSION = '1';
export const POLICY_TEXT =
  'Company-owned devices are monitored for active/idle work-hour status and app usage during work hours. ' +
  'Only whether you are active or idle and the name of the app in use is recorded. Keystrokes, mouse movements, ' +
  'screen contents and window titles are never recorded. This acknowledgment is asked once.';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const nameOf = (u: Pick<User, 'fullName' | 'email' | 'mobile' | 'id'>) => u.fullName ?? u.email ?? u.mobile ?? u.id;
const mondayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
};
const addDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const toMinutes = (seconds: number) => Math.round(seconds / 60);

export interface DeviceContext { userId: string; deviceId: string; tokenId: string }
export interface BeatInput { deviceId: string; timestamp: string; status: 'active' | 'idle'; activeAppName?: string }

export type LiveState = 'working' | 'idle' | 'offline';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(ActivityHeartbeat) private readonly beats: Repository<ActivityHeartbeat>,
    @InjectRepository(ActivitySession) private readonly sessions: Repository<ActivitySession>,
    @InjectRepository(DailySummary) private readonly summaries: Repository<DailySummary>,
    @InjectRepository(DeviceToken) private readonly devices: Repository<DeviceToken>,
    @InjectRepository(AgentPairingCode) private readonly codes: Repository<AgentPairingCode>,
    @InjectRepository(MonitoringConsent) private readonly consents: Repository<MonitoringConsent>,
    @InjectRepository(MonitoringSetting) private readonly settings: Repository<MonitoringSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly attendance: AttendanceRecordsService,
    private readonly timesheets: TimesheetService,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit() {
    const run = () => this.housekeeping().catch((e) => this.logger.warn(`Housekeeping failed: ${(e as Error).message}`));
    setTimeout(run, 60_000).unref();
    setInterval(run, 6 * 3600_000).unref();
  }

  /** Raw heartbeats older than 90 days are deleted. Daily summaries and sessions stay. */
  async housekeeping() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const purged = await this.beats.delete({ timestamp: LessThan(cutoff) });
    await this.codes.delete({ expiresAt: LessThan(new Date(Date.now() - 86_400_000)) });
    if (purged.affected) this.logger.log(`Purged ${purged.affected} heartbeat(s) older than ${RETENTION_DAYS} days`);
    return { purged: purged.affected ?? 0 };
  }

  // ───────────────────────── consent ─────────────────────────

  policy() {
    return { version: POLICY_VERSION, text: POLICY_TEXT };
  }

  async consentState(userId: string) {
    const c = await this.consents.findOneBy({ userId });
    return { accepted: !!c, acceptedAt: c?.consentAcceptedAt.toISOString() ?? null, policyVersion: c?.policyVersion ?? null, currentVersion: POLICY_VERSION };
  }

  async acceptConsent(user: AuthUser, version: string) {
    if (version !== POLICY_VERSION) throw new BadRequestException('This notice is out of date. Reload the page.');
    const row = (await this.consents.findOneBy({ userId: user.id })) ?? this.consents.create({ userId: user.id });
    row.policyVersion = version;
    row.consentAcceptedAt = new Date();
    await this.consents.save(row);
    await this.activity.log(user, { module: 'tracking', action: 'monitoring.consent_accepted', summary: `Accepted the work-hour monitoring policy (version ${version})` });
    return this.consentState(user.id);
  }

  // ───────────────────────── settings: method and target ─────────────────────────

  private async effective(person: Pick<User, 'id' | 'roles'>, rules?: MonitoringSetting[]) {
    const all = rules ?? (await this.settings.find());
    const role = toTmsRole(person.roles);
    const byUser = all.find((r) => r.scope === 'user' && r.target === person.id);
    const byRole = all.find((r) => r.scope === 'role' && r.target === role);
    const method: TrackingMethod = byUser?.trackingMethod ?? byRole?.trackingMethod ?? (role === 'Agent' ? 'manual' : 'agent');
    const targetMinutesPerDay = byUser?.targetMinutesPerDay ?? byRole?.targetMinutesPerDay ?? DEFAULT_TARGET_MINUTES;
    return { method, targetMinutesPerDay };
  }

  async settingsView() {
    const rules = await this.settings.find({ order: { scope: 'ASC', target: 'ASC' } });
    const staff = await this.attendance.staffList();
    const names = new Map(staff.map((s) => [s.id, nameOf(s)] as const));
    return {
      defaultTargetMinutesPerDay: DEFAULT_TARGET_MINUTES,
      rules: rules.map((r) => ({ id: r.id, scope: r.scope, target: r.target, label: r.scope === 'user' ? names.get(r.target) ?? r.target : r.target, targetMinutesPerDay: r.targetMinutesPerDay, trackingMethod: r.trackingMethod })),
    };
  }

  async saveSetting(actor: AuthUser, dto: { scope: 'user' | 'role'; target: string; targetMinutesPerDay?: number | null; trackingMethod?: TrackingMethod | null }) {
    if (dto.scope === 'role' && !['Admin', 'Employee', 'Agent'].includes(dto.target)) throw new BadRequestException('role must be Admin, Employee or Agent');
    if (dto.scope === 'user' && !(await this.users.findOneBy({ id: dto.target }))) throw new NotFoundException('Staff member not found');
    const row = (await this.settings.findOneBy({ scope: dto.scope, target: dto.target })) ?? this.settings.create({ scope: dto.scope, target: dto.target, targetMinutesPerDay: null, trackingMethod: null });
    if (dto.targetMinutesPerDay !== undefined) row.targetMinutesPerDay = dto.targetMinutesPerDay;
    if (dto.trackingMethod !== undefined) row.trackingMethod = dto.trackingMethod;
    await this.settings.save(row);
    await this.activity.log(actor, { module: 'tracking', action: 'monitoring.setting_changed', summary: `Set work-hour ${dto.scope} rule for ${dto.target}`, metadata: { ...dto } });
    return this.settingsView();
  }

  async removeSetting(actor: AuthUser, id: string) {
    const row = await this.settings.findOneBy({ id });
    if (!row) throw new NotFoundException('Rule not found');
    await this.settings.remove(row);
    await this.activity.log(actor, { module: 'tracking', action: 'monitoring.setting_removed', summary: `Removed work-hour ${row.scope} rule for ${row.target}` });
    return this.settingsView();
  }

  // ───────────────────────── agent pairing ─────────────────────────

  private async requirePerson(userId: string) {
    const p = await this.users.findOneBy({ id: userId });
    if (!p || !p.isActive) throw new NotFoundException('Account not found');
    return p;
  }

  /** An employee asks for a one-time code to pair a desktop agent. Needs the consent first. */
  async createPairingCode(user: AuthUser) {
    const person = await this.requirePerson(user.id);
    if (!(await this.consents.findOneBy({ userId: user.id }))) throw new ForbiddenException('Accept the work-hour monitoring policy before pairing an agent.');
    if ((await this.effective(person)).method === 'manual') throw new ConflictException('Your account records hours with manual start/stop, not the desktop agent.');
    await this.codes.delete({ userId: user.id, usedAt: IsNull() }); // only the newest code works
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await this.codes.save(this.codes.create({ userId: user.id, codeHash: sha256(code), expiresAt, usedAt: null }));
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /** The agent swaps the code for a device token. The token is shown once; only its hash is stored. */
  async registerDevice(dto: { code: string; deviceId: string; deviceName?: string; platform: 'windows' | 'mac' }) {
    if (dto.platform !== 'windows') throw new BadRequestException('Only the Windows agent is available in this phase.');
    const row = await this.codes.findOneBy({ codeHash: sha256(dto.code.trim().toUpperCase()) });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('That pairing code is not valid or has expired.');
    const person = await this.requirePerson(row.userId);
    if (!(await this.consents.findOneBy({ userId: row.userId }))) throw new ForbiddenException('Accept the work-hour monitoring policy first.');

    row.usedAt = new Date();
    await this.codes.save(row);
    const token = randomBytes(32).toString('base64url');
    const device = (await this.devices.findOneBy({ userId: row.userId, deviceId: dto.deviceId })) ?? this.devices.create({ userId: row.userId, deviceId: dto.deviceId });
    device.tokenHash = sha256(token);
    device.deviceName = dto.deviceName?.slice(0, 120) ?? null;
    device.platform = dto.platform;
    device.revokedAt = null;
    device.lastSeenAt = null;
    await this.devices.save(device);
    await this.activity.log({ id: person.id, name: nameOf(person), roles: person.roles }, { module: 'tracking', action: 'monitoring.device_paired', summary: `Paired a desktop agent (${dto.deviceName ?? dto.deviceId})` });
    return { deviceToken: token, employeeId: person.id, employeeName: nameOf(person), heartbeatSeconds: HEARTBEAT_SECONDS, idleThresholdSeconds: IDLE_THRESHOLD_SECONDS };
  }

  /** Resolves a device token (sent as a Bearer token by the agent) to the device and its employee. */
  async authenticateDevice(token: string | undefined): Promise<DeviceContext> {
    if (!token) throw new UnauthorizedException();
    const d = await this.devices.findOneBy({ tokenHash: sha256(token) });
    if (!d || d.revokedAt) throw new UnauthorizedException('This device is not paired or was removed.');
    return { userId: d.userId, deviceId: d.deviceId, tokenId: d.id };
  }

  async agentStatus(device: DeviceContext) {
    const person = await this.requirePerson(device.userId);
    return {
      consented: !!(await this.consents.findOneBy({ userId: device.userId })),
      employeeName: nameOf(person),
      heartbeatSeconds: HEARTBEAT_SECONDS,
      idleThresholdSeconds: IDLE_THRESHOLD_SECONDS,
      serverTime: new Date().toISOString(),
    };
  }

  async myDevices(userId: string) {
    const rows = await this.devices.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return rows.map((d) => ({ id: d.id, deviceName: d.deviceName ?? d.deviceId, platform: d.platform, pairedAt: d.createdAt.toISOString(), lastSeenAt: d.lastSeenAt?.toISOString() ?? null, revoked: !!d.revokedAt }));
  }

  async revokeDevice(user: AuthUser, id: string) {
    const d = await this.devices.findOneBy({ id, userId: user.id });
    if (!d) throw new NotFoundException('Device not found');
    d.revokedAt = new Date();
    await this.devices.save(d);
    await this.activity.log(user, { module: 'tracking', action: 'monitoring.device_removed', summary: `Removed a desktop agent (${d.deviceName ?? d.deviceId})` });
    return this.myDevices(user.id);
  }

  // ───────────────────────── heartbeat ingest ─────────────────────────

  /**
   * Stores pings and keeps sessions and the daily summary current. Accepts a queue flushed after an
   * offline spell: pings are applied in time order, duplicates are ignored, and a ping that lands before
   * the end of an existing session makes that day rebuild from the raw pings.
   */
  async ingest(device: DeviceContext, input: BeatInput[]) {
    for (const b of input) if (b.deviceId !== device.deviceId) throw new ForbiddenException('This ping belongs to a different device.');
    if (!(await this.consents.findOneBy({ userId: device.userId }))) throw new ForbiddenException('consent_required');

    const now = Date.now();
    const parsed = input
      .map((b) => ({ at: new Date(b.timestamp), idle: b.status === 'idle', app: b.activeAppName?.slice(0, 120) ?? null }))
      .filter((b) => !Number.isNaN(b.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    const usable = parsed.filter((b) => b.at.getTime() <= now + MAX_FUTURE_MS && b.at.getTime() >= now - MAX_BACKFILL_MS);

    const dirty = new Set<string>();
    const touched = new Set<string>();
    let accepted = 0;
    for (const b of usable) {
      const day = istDay(b.at);
      const res = await this.beats.createQueryBuilder().insert()
        .values({ userId: device.userId, deviceId: device.deviceId, timestamp: b.at, idleFlag: b.idle, source: 'agent', activeApp: b.app })
        .orIgnore().returning('id').execute();
      if (!res.raw?.length) continue; // an exact repeat of a ping already stored
      accepted += 1;
      touched.add(day);
      if (!dirty.has(day) && !(await this.appendToSession(device.userId, day, b.at, b.idle))) dirty.add(day);
    }
    for (const day of dirty) await this.rebuildDay(device.userId, day);
    for (const day of touched) await this.rollup(device.userId, day);
    await this.devices.update({ id: device.tokenId }, { lastSeenAt: new Date() });
    return { accepted, duplicates: usable.length - accepted, rejected: input.length - usable.length };
  }

  /** The common case: this ping is newer than everything stored, so extend the latest session. Returns false if it is not. */
  private async appendToSession(userId: string, day: string, at: Date, idle: boolean): Promise<boolean> {
    const last = await this.sessions.findOne({ where: { userId, day, source: 'agent' }, order: { endTime: 'DESC' } });
    if (!last) {
      await this.sessions.save(this.sessions.create({ userId, day, startTime: at, endTime: at, activeSeconds: 0, idleSeconds: 0, source: 'agent', open: false }));
      return true;
    }
    if (at.getTime() < last.endTime.getTime()) return false;
    const gap = (at.getTime() - last.endTime.getTime()) / 1000;
    if (gap > MAX_GAP_SECONDS) {
      await this.sessions.save(this.sessions.create({ userId, day, startTime: at, endTime: at, activeSeconds: 0, idleSeconds: 0, source: 'agent', open: false }));
      return true;
    }
    // The time since the previous ping counts as the state this ping reports.
    if (idle) last.idleSeconds += Math.round(gap); else last.activeSeconds += Math.round(gap);
    last.endTime = at;
    await this.sessions.save(last);
    return true;
  }

  /** Recomputes a day's agent sessions from its raw pings (used when pings arrive out of order). */
  async rebuildDay(userId: string, day: string) {
    const rows = await this.beats.find({
      where: { userId, source: 'agent', timestamp: Between(dayStart(day), new Date(dayStart(day).getTime() + 86_400_000 - 1)) },
      order: { timestamp: 'ASC' },
    });
    const out: ActivitySession[] = [];
    let cur: ActivitySession | null = null;
    for (const r of rows) {
      const gap = cur ? (r.timestamp.getTime() - cur.endTime.getTime()) / 1000 : Infinity;
      if (!cur || gap > MAX_GAP_SECONDS || gap < 0) {
        cur = this.sessions.create({ userId, day, startTime: r.timestamp, endTime: r.timestamp, activeSeconds: 0, idleSeconds: 0, source: 'agent', open: false });
        out.push(cur);
        continue;
      }
      if (r.idleFlag) cur.idleSeconds += Math.round(gap); else cur.activeSeconds += Math.round(gap);
      cur.endTime = r.timestamp;
    }
    await this.db.transaction(async (m) => {
      await m.getRepository(ActivitySession).delete({ userId, day, source: 'agent' });
      if (out.length) await m.getRepository(ActivitySession).save(out);
    });
  }

  /** Totals a day's sessions into daily_summary and mirrors the hours into the weekly timesheet. */
  async rollup(userId: string, day: string) {
    const list = await this.sessions.find({ where: { userId, day } });
    const active = list.reduce((s, x) => s + x.activeSeconds, 0);
    const idle = list.reduce((s, x) => s + x.idleSeconds, 0);
    const first = list.length ? new Date(Math.min(...list.map((x) => x.startTime.getTime()))) : null;
    const last = list.length ? new Date(Math.max(...list.map((x) => x.endTime.getTime()))) : null;
    const row = (await this.summaries.findOneBy({ userId, date: day })) ?? this.summaries.create({ userId, date: day });
    row.totalActiveMinutes = toMinutes(active);
    row.totalIdleMinutes = toMinutes(idle);
    row.firstActivity = first;
    row.lastActivity = last;
    await this.summaries.save(row);
    await this.syncTimesheet(userId, day, row.totalActiveMinutes);
    return row;
  }

  /** daily_summary feeds the weekly timesheet so the existing Timesheet screen keeps working. */
  private async syncTimesheet(userId: string, day: string, minutes: number) {
    const hours = Math.min(24, Math.round((minutes / 60) * 4) / 4);
    if (hours <= 0) return;
    try {
      const account = await this.users.findOneBy({ id: userId });
      if (account) await this.timesheets.recordDay(account, day, hours < 4 ? 'Half Day' : 'Present', hours);
    } catch (e) {
      this.logger.warn(`Could not mirror ${day} into the timesheet: ${(e as Error).message}`);
    }
  }

  // ───────────────────────── manual start / stop ─────────────────────────

  async manualState(user: AuthUser) {
    const person = await this.requirePerson(user.id);
    const open = await this.sessions.findOne({ where: { userId: user.id, source: 'manual', open: true }, order: { startTime: 'DESC' } });
    const today = istDay(new Date());
    const summary = await this.summaries.findOneBy({ userId: user.id, date: today });
    const eff = await this.effective(person);
    return {
      method: eff.method,
      targetMinutesPerDay: eff.targetMinutesPerDay,
      running: !!open && Date.now() - open.startTime.getTime() < MAX_MANUAL_SECONDS * 1000,
      startedAt: open?.startTime.toISOString() ?? null,
      todayMinutes: (summary?.totalActiveMinutes ?? 0) + (open ? Math.min(toMinutes((Date.now() - open.startTime.getTime()) / 1000), toMinutes(MAX_MANUAL_SECONDS)) : 0),
      consent: await this.consentState(user.id),
    };
  }

  /** For people who work in the field: start and stop by hand, no desktop agent. */
  async manualEntry(user: AuthUser, action: 'start' | 'stop') {
    const person = await this.requirePerson(user.id);
    if ((await this.effective(person)).method !== 'manual') throw new ConflictException('Your hours are recorded by the desktop agent, not by hand.');
    const now = new Date();
    const open = await this.sessions.findOne({ where: { userId: user.id, source: 'manual', open: true }, order: { startTime: 'DESC' } });
    const beat = (idle = false) => this.beats.createQueryBuilder().insert()
      .values({ userId: user.id, deviceId: 'manual', timestamp: now, idleFlag: idle, source: 'manual', activeApp: null }).orIgnore().execute();

    if (action === 'start') {
      if (open) throw new ConflictException('You have already started. Stop first.');
      await this.sessions.save(this.sessions.create({ userId: user.id, day: istDay(now), startTime: now, endTime: now, activeSeconds: 0, idleSeconds: 0, source: 'manual', open: true }));
      await beat();
      await this.activity.log(user, { module: 'tracking', action: 'monitoring.manual_started', summary: 'Started work (manual entry)' });
    } else {
      if (!open) throw new ConflictException('You have not started.');
      const seconds = Math.min(MAX_MANUAL_SECONDS, Math.round((now.getTime() - open.startTime.getTime()) / 1000));
      open.endTime = new Date(open.startTime.getTime() + seconds * 1000);
      open.activeSeconds = seconds;
      open.open = false;
      await this.sessions.save(open);
      await beat();
      await this.rollup(user.id, open.day);
      await this.activity.log(user, { module: 'tracking', action: 'monitoring.manual_stopped', summary: `Stopped work (manual entry) after ${toMinutes(seconds)} min`, metadata: { minutes: toMinutes(seconds) } });
    }
    return this.manualState(user);
  }

  // ───────────────────────── reads ─────────────────────────

  /** Working / idle / offline for each person. Admins see everyone; everyone else sees only themselves. */
  async activeStatus(actor: AuthUser) {
    const isAdmin = actor.roles.includes(Role.SuperAdmin) || actor.roles.includes(Role.Admin);
    const staff = await this.attendance.staffList(isAdmin ? undefined : [actor.id]);
    const ids = staff.map((s) => s.id);
    if (!ids.length) return [];
    const today = istDay(new Date());
    const [last, open, todayRows, consents, devices, rules] = await Promise.all([
      this.db.query(
        `SELECT DISTINCT ON (user_id) user_id, "timestamp", idle_flag, source, active_app FROM solutions.activity_heartbeats
         WHERE user_id = ANY($1) AND "timestamp" > now() - interval '2 days' ORDER BY user_id, "timestamp" DESC`, [ids]),
      this.sessions.find({ where: { userId: In(ids), source: 'manual', open: true } }),
      this.summaries.find({ where: { userId: In(ids), date: today } }),
      this.consents.find({ where: { userId: In(ids) } }),
      this.devices.find({ where: { userId: In(ids), revokedAt: IsNull() } }),
      this.settings.find(),
    ]);
    const now = Date.now();
    return Promise.all(staff.map(async (u) => {
      const beat = (last as { user_id: string; timestamp: Date; idle_flag: boolean; active_app: string | null }[]).find((x) => x.user_id === u.id);
      const manual = open.find((s) => s.userId === u.id && now - s.startTime.getTime() < MAX_MANUAL_SECONDS * 1000);
      const age = beat ? (now - new Date(beat.timestamp).getTime()) / 1000 : Infinity;
      let status: LiveState = 'offline';
      if (manual) status = 'working';
      else if (age <= OFFLINE_AFTER_SECONDS) status = beat!.idle_flag ? 'idle' : 'working';
      const eff = await this.effective(u, rules);
      const sum = todayRows.find((r) => r.userId === u.id);
      const lastSeen = manual ? new Date() : beat ? new Date(beat.timestamp) : null;
      return {
        userId: u.id,
        employeeName: nameOf(u),
        role: toTmsRole(u.roles),
        method: eff.method,
        status,
        activeApp: isAdmin && status !== 'offline' && !manual ? beat?.active_app ?? null : null,
        lastSeen: lastSeen?.toISOString() ?? null,
        todayActiveMinutes: (sum?.totalActiveMinutes ?? 0) + (manual ? toMinutes((now - manual.startTime.getTime()) / 1000) : 0),
        targetMinutesPerDay: eff.targetMinutesPerDay,
        consented: consents.some((c) => c.userId === u.id),
        devices: devices.filter((d) => d.userId === u.id).length,
      };
    }));
  }

  /** Per-day totals plus a weekly average against the target. Employees see their own; admins can see anyone. */
  async dailySummary(actor: AuthUser, q: { from: string; to: string; userId?: string }) {
    assertDay(q.from, 'from');
    assertDay(q.to, 'to');
    if (q.from > q.to) throw new BadRequestException('from must not be after to');
    if (datesBetween(q.from, q.to).length > 93) throw new BadRequestException('Ask for at most 93 days at a time');
    const isAdmin = actor.roles.includes(Role.SuperAdmin) || actor.roles.includes(Role.Admin);
    if (q.userId && q.userId !== actor.id && !isAdmin) throw new ForbiddenException();
    const staff = await this.attendance.staffList(q.userId ? [q.userId] : isAdmin ? undefined : [actor.id]);
    const ids = staff.map((s) => s.id);

    // Weeks run Monday to Sunday, so pull whole weeks even when the range starts mid-week.
    const wFrom = mondayOf(q.from);
    const wTo = addDays(mondayOf(q.to), 6);
    const [rows, rules] = await Promise.all([
      ids.length ? this.summaries.find({ where: { userId: In(ids), date: Between(wFrom, wTo) }, order: { date: 'ASC' } }) : Promise.resolve([] as DailySummary[]),
      this.settings.find(),
    ]);
    const today = istDay(new Date());
    return Promise.all(staff.map(async (u) => {
      const mine = rows.filter((r) => r.userId === u.id);
      const eff = await this.effective(u, rules);
      const weeks: { weekStart: string; activeMinutes: number; targetMinutes: number; targetToDateMinutes: number; workingDays: number; metTarget: boolean }[] = [];
      for (let w = wFrom; w <= q.to; w = addDays(w, 7)) {
        const days = await this.attendance.workingDays(u, w, addDays(w, 6));
        const active = mine.filter((r) => r.date >= w && r.date <= addDays(w, 6)).reduce((s, r) => s + r.totalActiveMinutes, 0);
        const target = days.length * eff.targetMinutesPerDay;
        const toDate = days.filter((d) => d <= today).length * eff.targetMinutesPerDay;
        weeks.push({ weekStart: w, activeMinutes: active, targetMinutes: target, targetToDateMinutes: toDate, workingDays: days.length, metTarget: target > 0 && active >= target });
      }
      const inRange = mine.filter((r) => r.date >= q.from && r.date <= q.to);
      return {
        userId: u.id,
        employeeName: nameOf(u),
        role: toTmsRole(u.roles),
        method: eff.method,
        targetMinutesPerDay: eff.targetMinutesPerDay,
        totalActiveMinutes: inRange.reduce((s, r) => s + r.totalActiveMinutes, 0),
        days: inRange.map((r) => ({ date: r.date, totalActiveMinutes: r.totalActiveMinutes, totalIdleMinutes: r.totalIdleMinutes, firstActivity: r.firstActivity?.toISOString() ?? null, lastActivity: r.lastActivity?.toISOString() ?? null })),
        weeks,
      };
    }));
  }
}
