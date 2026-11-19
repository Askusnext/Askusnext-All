import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { LocationPing, TrackingConsent, WorkSession } from './attendance.entities';
import { StaffHierarchyService } from './staff-hierarchy.service';
import { TimesheetService } from './timesheet.service';
import { toTmsRole } from './users.service';

/** Bump this when the notice shown to employees changes; everyone then has to accept again. */
export const CONSENT_VERSION = '1';

/** No sample for this long = the signal is lost (browser closed, phone locked, no network). */
const STALE_MS = 5 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface Fix {
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
}

export const istDay = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(TrackingConsent) private readonly consents: Repository<TrackingConsent>,
    @InjectRepository(WorkSession) private readonly sessions: Repository<WorkSession>,
    @InjectRepository(LocationPing) private readonly pings: Repository<LocationPing>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly timesheets: TimesheetService,
    private readonly activity: ActivityService,
    private readonly hierarchy: StaffHierarchyService,
  ) {}

  // ───────────────────────── time maths ─────────────────────────

  private isFresh(s: WorkSession, now = Date.now()) {
    return !s.endedAt && now - (s.lastPingAt ?? s.startedAt).getTime() <= STALE_MS;
  }

  /** Where a session's time stops counting: its end, or now while it is live, or its last sample if the signal was lost. */
  private effectiveEnd(s: WorkSession, now = Date.now()): number {
    if (s.endedAt) return s.endedAt.getTime();
    if (this.isFresh(s, now)) return now;
    return (s.lastPingAt ?? s.startedAt).getTime();
  }

  private minutes(list: WorkSession[], now = Date.now()) {
    return Math.round(list.reduce((sum, s) => sum + Math.max(0, this.effectiveEnd(s, now) - s.startedAt.getTime()), 0) / 60000);
  }

  // ───────────────────────── employee side ─────────────────────────

  private sessionDto(s: WorkSession, now = Date.now()) {
    return {
      id: s.id,
      day: s.day,
      startedAt: iso(s.startedAt),
      endedAt: iso(s.endedAt),
      endReason: s.endReason,
      live: this.isFresh(s, now),
      minutes: Math.round(Math.max(0, this.effectiveEnd(s, now) - s.startedAt.getTime()) / 60000),
      start: s.startLat == null ? null : { lat: s.startLat, lng: s.startLng },
      end: s.endLat == null ? null : { lat: s.endLat, lng: s.endLng },
      last: s.lastLat == null ? null : { lat: s.lastLat, lng: s.lastLng, accuracy: s.lastAccuracy },
      lastPingAt: iso(s.lastPingAt),
      lastState: s.lastState,
    };
  }

  async me(user: AuthUser) {
    const consent = await this.consents.findOneBy({ userId: user.id });
    const today = istDay(new Date());
    const rows = await this.sessions.find({ where: { userId: user.id, day: today }, order: { startedAt: 'ASC' } });
    const active = (await this.sessions.findOne({ where: { userId: user.id, endedAt: IsNull() }, order: { startedAt: 'DESC' } })) ?? null;
    return {
      consentVersion: CONSENT_VERSION,
      consented: consent?.version === CONSENT_VERSION,
      today,
      active: active ? this.sessionDto(active) : null,
      sessions: rows.map((s) => this.sessionDto(s)),
      todayMinutes: this.minutes(rows),
    };
  }

  async acceptConsent(user: AuthUser, version: string) {
    if (version !== CONSENT_VERSION) throw new BadRequestException('This notice is out of date. Reload the page.');
    await this.consents.save(this.consents.create({ userId: user.id, version }));
    await this.activity.log(user, { module: 'tracking', action: 'tracking.consent_accepted', summary: `Accepted the work-tracking notice (version ${version})` });
    return { consented: true };
  }

  private async requireConsent(userId: string) {
    const c = await this.consents.findOneBy({ userId });
    if (c?.version !== CONSENT_VERSION) throw new ForbiddenException('Accept the location notice before starting work.');
  }

  /** Closes a session whose signal was lost, at the moment of its last sample. */
  private async closeStale(s: WorkSession) {
    s.endedAt = s.lastPingAt ?? s.startedAt;
    s.endReason = 'auto';
    await this.sessions.save(s);
    const account = await this.users.findOneBy({ id: s.userId });
    if (account) await this.syncTimesheet(account, s.day);
  }

  async start(user: AuthUser, fix: Fix) {
    await this.requireConsent(user.id);
    if (fix.lat == null || fix.lng == null) throw new BadRequestException('Location is needed to start work. Allow location access and try again.');
    const open = await this.sessions.find({ where: { userId: user.id, endedAt: IsNull() } });
    const now = Date.now();
    for (const s of open) {
      if (this.isFresh(s, now)) return this.sessionDto(s, now); // already working
      await this.closeStale(s);
    }
    const at = new Date();
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        day: istDay(at),
        startedAt: at,
        startLat: fix.lat, startLng: fix.lng, startAccuracy: fix.accuracy ?? null,
        lastPingAt: at, lastLat: fix.lat, lastLng: fix.lng, lastAccuracy: fix.accuracy ?? null,
        lastState: 'active',
      }),
    );
    await this.pings.save(this.pings.create({ sessionId: session.id, userId: user.id, at, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy ?? null, state: 'active' }));
    await this.activity.log(user, { module: 'tracking', action: 'tracking.work_started', entityType: 'work_session', entityId: session.id, entityLabel: session.day, summary: 'Started work' });
    return this.sessionDto(session);
  }

  async ping(user: AuthUser, fix: Fix, state: 'active' | 'idle') {
    const s = await this.sessions.findOne({ where: { userId: user.id, endedAt: IsNull() }, order: { startedAt: 'DESC' } });
    if (!s) throw new ConflictException('No work session is running.');
    const at = new Date();
    s.lastPingAt = at;
    s.lastState = state;
    if (fix.lat != null && fix.lng != null) {
      s.lastLat = fix.lat; s.lastLng = fix.lng; s.lastAccuracy = fix.accuracy ?? null;
    }
    await this.sessions.save(s);
    await this.pings.save(this.pings.create({ sessionId: s.id, userId: user.id, at, lat: fix.lat ?? null, lng: fix.lng ?? null, accuracy: fix.accuracy ?? null, state }));
    return this.sessionDto(s);
  }

  async stop(user: AuthUser, fix: Fix) {
    const s = await this.sessions.findOne({ where: { userId: user.id, endedAt: IsNull() }, order: { startedAt: 'DESC' } });
    if (!s) throw new ConflictException('No work session is running.');
    const at = new Date();
    s.endedAt = at;
    s.endReason = 'manual';
    s.lastPingAt = at;
    if (fix.lat != null && fix.lng != null) {
      s.endLat = fix.lat; s.endLng = fix.lng; s.lastLat = fix.lat; s.lastLng = fix.lng; s.lastAccuracy = fix.accuracy ?? null;
    }
    await this.sessions.save(s);
    await this.pings.save(this.pings.create({ sessionId: s.id, userId: user.id, at, lat: fix.lat ?? null, lng: fix.lng ?? null, accuracy: fix.accuracy ?? null, state: 'active' }));
    const account = await this.users.findOneBy({ id: user.id });
    if (account) await this.syncTimesheet(account, s.day);
    const minutes = Math.round((at.getTime() - s.startedAt.getTime()) / 60000);
    await this.activity.log(user, { module: 'tracking', action: 'tracking.work_stopped', entityType: 'work_session', entityId: s.id, entityLabel: s.day, summary: `Stopped work after ${minutes} min`, metadata: { minutes } });
    return this.me(user);
  }

  /** Writes the day's tracked hours into the weekly timesheet so the two always agree. */
  private async syncTimesheet(account: User, day: string) {
    const list = await this.sessions.find({ where: { userId: account.id, day } });
    const hours = Math.min(24, Math.round((this.minutes(list) / 60) * 4) / 4); // nearest quarter hour
    if (hours <= 0) return;
    await this.timesheets.recordDay(account, day, hours < 4 ? 'Half Day' : 'Present', hours);
  }

  // ───────────────────────── admin / employee side ─────────────────────────

  /** Super Admin: everyone. Admin: their reports and themselves. Employees and Agents: only themselves. Never trusts the token's role. */
  private async visibleIds(actor: AuthUser): Promise<string[] | null> {
    const s = await this.hierarchy.staffScope(actor);
    if (!s.ids.length && !s.all) throw new ForbiddenException();
    return s.all ? null : s.ids;
  }

  /** Everyone's status for a day: working, idle, signal lost, finished, or not started. */
  async live(actor: AuthUser, day: string | undefined) {
    const scope = await this.visibleIds(actor);
    const date = day ?? istDay(new Date());
    const qb = this.users
      .createQueryBuilder('u')
      .where(`u.roles ~ '(^|,)(SUPER_ADMIN|ADMIN|EMPLOYEE|AGENT)(,|$)'`)
      .andWhere('u.isActive = true');
    if (scope) qb.andWhere('u.id IN (:...scope)', { scope });
    const staff = await qb
      .orderBy('u.fullName', 'ASC', 'NULLS LAST')
      .getMany();
    const ids = staff.map((s) => s.id);
    const sessions = ids.length ? await this.sessions.find({ where: { userId: In(ids), day: date }, order: { startedAt: 'ASC' } }) : [];
    const consents = ids.length ? await this.consents.find({ where: { userId: In(ids) } }) : [];
    const consented = new Set(consents.filter((c) => c.version === CONSENT_VERSION).map((c) => c.userId));
    const now = Date.now();
    return staff.map((u) => {
      const mine = sessions.filter((s) => s.userId === u.id);
      const open = mine.find((s) => !s.endedAt);
      const last = mine.length ? mine[mine.length - 1] : null;
      let status: 'working' | 'idle' | 'signal_lost' | 'ended' | 'not_started' = 'not_started';
      if (open) status = !this.isFresh(open, now) ? 'signal_lost' : open.lastState === 'idle' ? 'idle' : 'working';
      else if (mine.length) status = 'ended';
      const shown = open ?? last;
      return {
        userId: u.id,
        employeeName: u.fullName ?? u.email ?? u.mobile ?? u.id,
        employeeId: u.email ?? u.mobile ?? u.id,
        role: toTmsRole(u.roles),
        consented: consented.has(u.id),
        status,
        firstStartedAt: mine.length ? iso(mine[0].startedAt) : null,
        minutes: this.minutes(mine, now),
        sessions: mine.length,
        lastSeen: shown ? iso(shown.lastPingAt ?? shown.startedAt) : null,
        lastLocation: shown?.lastLat == null ? null : { lat: shown.lastLat, lng: shown.lastLng, accuracy: shown.lastAccuracy },
      };
    });
  }

  /** The sessions and location trail of one person on one day. */
  async trail(actor: AuthUser, userId: string, day: string) {
    const scope = await this.visibleIds(actor);
    if (scope && !scope.includes(userId)) throw new NotFoundException('Staff member not found');
    const account = await this.users.findOneBy({ id: userId });
    if (!account) throw new NotFoundException('Staff member not found');
    const sessions = await this.sessions.find({ where: { userId, day }, order: { startedAt: 'ASC' } });
    const pings = sessions.length
      ? await this.pings.find({ where: { sessionId: In(sessions.map((s) => s.id)) }, order: { at: 'ASC' }, take: 1000 })
      : [];
    const now = Date.now();
    return {
      userId,
      employeeName: account.fullName ?? account.email ?? account.mobile ?? account.id,
      day,
      totalMinutes: this.minutes(sessions, now),
      sessions: sessions.map((s) => this.sessionDto(s, now)),
      pings: pings.map((p) => ({ at: iso(p.at), lat: p.lat, lng: p.lng, accuracy: p.accuracy, state: p.state, sessionId: p.sessionId })),
    };
  }
}
