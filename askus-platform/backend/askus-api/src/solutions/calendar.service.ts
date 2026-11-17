import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { istDay } from './attendance.service';
import { AttendanceRecordsService, assertDay, datesBetween } from './attendance-records.service';
import {
  authorizeUrl, exchangeCode, fetchEvents, open, ProviderAuthError, providerConfig, refreshAccess, seal, type RemoteEvent,
} from './calendar-providers';
import {
  ActivityFeedItem, CalendarConnection, CalendarProvider, Meeting, MeetingAttendee, MeetingScope, TEAMS, Team, TeamMember,
} from './calendar.entities';
import { AttendanceRecord, LeaveRequest } from './leave.entities';
import { LeaveService } from './leave.service';
import { MonitoringService } from './monitoring.service';
import { toTmsRole } from './users.service';

const SYNC_EVERY_MS = 20 * 60 * 1000; // the document asks for 15-30 minutes
const PAST_DAYS = 7;
const FUTURE_DAYS = 60;
const MAX_VIEW_DAYS = 62;
const DAY_MS = 86_400_000;

const nameOf = (u: Pick<User, 'fullName' | 'email' | 'mobile' | 'id'>) => u.fullName ?? u.email ?? u.mobile ?? u.id;
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const isSuper = (a: AuthUser) => a.roles.includes(Role.SuperAdmin);
const isAdmin = (a: AuthUser) => isSuper(a) || a.roles.includes(Role.Admin);

export interface MeetingView {
  id: string; title: string; start: string; end: string; source: 'synced' | 'manual'; private: boolean;
  ownerId: string; attendees: { name: string | null; email: string | null }[]; editable: boolean;
}
export interface Cell {
  status: { status: string; late: number } | null;
  leave: { id: string; leaveType: string; state: 'pending' | 'approved'; from: string; to: string } | null;
  meetings: MeetingView[];
}
const emptyCell = (): Cell => ({ status: null, leave: null, meetings: [] });

@Injectable()
export class CalendarService implements OnModuleInit {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarConnection) private readonly connections: Repository<CalendarConnection>,
    @InjectRepository(Meeting) private readonly meetings: Repository<Meeting>,
    @InjectRepository(MeetingAttendee) private readonly attendees: Repository<MeetingAttendee>,
    @InjectRepository(ActivityFeedItem) private readonly feed: Repository<ActivityFeedItem>,
    @InjectRepository(TeamMember) private readonly members: Repository<TeamMember>,
    @InjectRepository(LeaveRequest) private readonly leaves: Repository<LeaveRequest>,
    @InjectRepository(AttendanceRecord) private readonly records: Repository<AttendanceRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly attendance: AttendanceRecordsService,
    private readonly leave: LeaveService,
    private readonly monitoring: MonitoringService,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit() {
    // The background pull. Safe to run on several instances: each pass is idempotent.
    const run = () => this.syncAll().catch((e) => this.logger.warn(`Calendar sync pass failed: ${(e as Error).message}`));
    setTimeout(run, 90_000).unref();
    setInterval(run, SYNC_EVERY_MS).unref();
  }

  // ───────────────────────── connecting an account ─────────────────────────

  async connectionsView(userId: string) {
    const rows = await this.connections.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return {
      providers: { google: { configured: !!providerConfig('google') }, microsoft: { configured: !!providerConfig('microsoft') } },
      connections: rows.map((c) => ({
        id: c.id, provider: c.provider, accountEmail: c.accountEmail, status: c.status,
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null, lastError: c.lastError, connectedAt: c.createdAt.toISOString(),
      })),
    };
  }

  /** Step 1: the employee is sent to the provider's own consent screen to allow read access to their calendar. */
  async startConnect(user: AuthUser, provider: CalendarProvider) {
    const cfg = providerConfig(provider);
    if (!cfg) {
      const name = provider === 'google' ? 'Google' : 'Microsoft';
      throw new ConflictException(`${name} calendar is not set up on this server yet. An admin needs to add the ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET settings.`);
    }
    const state = await this.jwt.signAsync({ sub: user.id, provider, purpose: 'calendar-oauth' }, { expiresIn: '10m' });
    return { authUrl: authorizeUrl(provider, cfg, state) };
  }

  /** Step 2: the provider sends the browser back here with a one-time code. Returns the page to send the person on to. */
  async finishConnect(q: { code?: string; state?: string; error?: string }): Promise<string> {
    const web = (process.env.SOLUTIONS_WEB_URL ?? 'http://localhost:3005').replace(/\/$/, '');
    const back = (params: Record<string, string>) => `${web}/calendar?${new URLSearchParams(params)}`;
    if (q.error) return back({ calendar_error: q.error === 'access_denied' ? 'You chose not to share your calendar.' : 'The provider did not allow the connection.' });
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; provider: CalendarProvider; purpose: string }>(q.state ?? '');
      if (claims.purpose !== 'calendar-oauth') throw new Error('wrong state');
      const cfg = providerConfig(claims.provider);
      if (!cfg || !q.code) throw new Error('missing code');
      const tokens = await exchangeCode(cfg, q.code);
      const existing = await this.connections.findOneBy({ userId: claims.sub, provider: claims.provider });
      const refresh = tokens.refreshToken ?? (existing?.refreshToken ? open(existing.refreshToken) : null);
      if (!refresh) throw new Error('no refresh token');
      const conn = existing ?? this.connections.create({ userId: claims.sub, provider: claims.provider });
      Object.assign(conn, {
        accountEmail: tokens.accountEmail, oauthToken: seal(tokens.accessToken), refreshToken: seal(refresh),
        tokenExpiresAt: tokens.expiresAt, status: 'active', lastError: null,
      });
      const saved = await this.connections.save(conn);
      const person = await this.users.findOneBy({ id: claims.sub });
      if (person) await this.activity.log({ id: person.id, name: nameOf(person), roles: person.roles }, { module: 'calendar', action: 'calendar.connected', summary: `Connected a ${claims.provider} calendar${tokens.accountEmail ? ` (${tokens.accountEmail})` : ''}` });
      void this.syncConnection(saved).catch(() => undefined); // first pull right away; failures are recorded on the connection
      return back({ connected: claims.provider });
    } catch (e) {
      this.logger.warn(`Calendar connect failed: ${(e as Error).message}`);
      return back({ calendar_error: 'The connection could not be completed. Please try again.' });
    }
  }

  async disconnect(user: AuthUser, id: string) {
    const conn = await this.connections.findOneBy({ id, userId: user.id });
    if (!conn) throw new NotFoundException('Connection not found');
    await this.db.transaction(async (m) => {
      const ids = (await m.getRepository(Meeting).find({ where: { userId: user.id, provider: conn.provider, source: 'synced' }, select: ['id'] })).map((x) => x.id);
      if (ids.length) await m.getRepository(MeetingAttendee).delete({ meetingId: In(ids) });
      await m.getRepository(Meeting).delete({ userId: user.id, provider: conn.provider, source: 'synced' });
      await m.getRepository(CalendarConnection).delete({ id });
    });
    await this.activity.log(user, { module: 'calendar', action: 'calendar.disconnected', summary: `Disconnected the ${conn.provider} calendar` });
    return this.connectionsView(user.id);
  }

  // ───────────────────────── syncing ─────────────────────────

  /** Pull for one connection: refresh the access token if needed, fetch events, reconcile. Only title, time and attendees are read. */
  async syncConnection(conn: CalendarConnection) {
    const cfg = providerConfig(conn.provider);
    if (!cfg) throw new ConflictException('This calendar provider is not set up on the server.');
    try {
      let access = open(conn.oauthToken);
      if (!conn.tokenExpiresAt || conn.tokenExpiresAt.getTime() < Date.now() + 60_000) {
        if (!conn.refreshToken) throw new ProviderAuthError('No saved sign-in to renew', true);
        const r = await refreshAccess(cfg, open(conn.refreshToken));
        access = r.accessToken;
        conn.oauthToken = seal(r.accessToken);
        conn.tokenExpiresAt = r.expiresAt;
        if (r.refreshToken) conn.refreshToken = seal(r.refreshToken);
      }
      const from = new Date(Date.now() - PAST_DAYS * DAY_MS);
      const to = new Date(Date.now() + FUTURE_DAYS * DAY_MS);
      const events = await fetchEvents(conn.provider, cfg, access, from, to);
      const result = await this.reconcile(conn, events, from, to);
      conn.status = 'active';
      conn.lastError = null;
      conn.lastSyncAt = new Date();
      await this.connections.save(conn);
      return result;
    } catch (e) {
      const revoked = e instanceof ProviderAuthError && e.revoked;
      conn.status = revoked ? 'revoked' : 'error';
      conn.lastError = revoked ? 'Access was revoked. Connect the calendar again.' : (e as Error).message.slice(0, 300);
      await this.connections.save(conn);
      throw e;
    }
  }

  /** Makes this person's synced meetings in the window match the provider: add, update, and remove what was deleted or cancelled. */
  private async reconcile(conn: CalendarConnection, events: RemoteEvent[], from: Date, to: Date) {
    const emails = [...new Set(events.flatMap((e) => e.attendees.map((a) => a.email).filter((x): x is string => !!x)))];
    const staff = emails.length ? await this.users.createQueryBuilder('u').where('LOWER(u.email) IN (:...emails)', { emails }).getMany() : [];
    const byEmail = new Map(staff.map((u) => [u.email!.toLowerCase(), u.id] as const));

    return this.db.transaction(async (m) => {
      const mr = m.getRepository(Meeting);
      const ar = m.getRepository(MeetingAttendee);
      const existing = await mr.createQueryBuilder('x')
        .where('x.userId = :u AND x.provider = :p AND x.source = :s AND x.startTime >= :from AND x.startTime <= :to', { u: conn.userId, p: conn.provider, s: 'synced', from, to })
        .getMany();
      const have = new Map(existing.map((x) => [x.externalId, x] as const));
      const seen = new Set<string>();
      let imported = 0;
      for (const e of events) {
        seen.add(e.externalId);
        const row = have.get(e.externalId) ?? (await mr.findOneBy({ userId: conn.userId, provider: conn.provider, externalId: e.externalId })) ?? mr.create({ userId: conn.userId, provider: conn.provider, externalId: e.externalId });
        Object.assign(row, { title: e.title, startTime: e.start, endTime: e.end, source: 'synced', visibilityScope: (e.isPrivate ? 'private' : 'team') as MeetingScope });
        const saved = await mr.save(row);
        await ar.delete({ meetingId: saved.id });
        if (e.attendees.length) await ar.save(e.attendees.map((a) => ar.create({ meetingId: saved.id, email: a.email, name: a.name, employeeId: a.email ? byEmail.get(a.email) ?? null : null })));
        imported += 1;
      }
      const gone = existing.filter((x) => x.externalId && !seen.has(x.externalId));
      if (gone.length) {
        await ar.delete({ meetingId: In(gone.map((x) => x.id)) });
        await mr.delete({ id: In(gone.map((x) => x.id)) });
      }
      return { imported, removed: gone.length };
    });
  }

  /** The signed-in person's own connections ("Sync now"). */
  async syncMine(user: AuthUser) {
    const rows = await this.connections.find({ where: { userId: user.id } });
    if (!rows.length) throw new ConflictException('Connect a calendar first.');
    const results: Record<string, unknown>[] = [];
    for (const c of rows) {
      try { results.push({ provider: c.provider, ...(await this.syncConnection(c)) }); } catch (e) { results.push({ provider: c.provider, error: (e as Error).message }); }
    }
    return { results, ...(await this.connectionsView(user.id)) };
  }

  /** Every connection that has not been revoked. Run by the built-in timer and by POST /calendar/sync-all (for an external cron). */
  async syncAll() {
    const rows = await this.connections.find({ where: { status: In(['active', 'error']) } });
    let ok = 0, failed = 0;
    for (const c of rows) {
      try { await this.syncConnection(c); ok += 1; } catch { failed += 1; }
    }
    return { connections: rows.length, ok, failed };
  }

  assertCronKey(header: string | undefined) {
    const expected = process.env.CALENDAR_SYNC_KEY;
    if (!expected || !header) throw new UnauthorizedException();
    const a = Buffer.from(header), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
  }

  // ───────────────────────── manual meetings ─────────────────────────

  async createManual(actor: AuthUser, dto: { title: string; startTime: string; endTime: string; employeeId?: string; attendeeIds?: string[]; visibilityScope?: MeetingScope }) {
    const owner = dto.employeeId ?? actor.id;
    await this.assertCanEdit(actor, owner);
    const start = new Date(dto.startTime), end = new Date(dto.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Give valid start and end times');
    if (end.getTime() < start.getTime()) throw new BadRequestException('The meeting ends before it starts');
    if (end.getTime() - start.getTime() > 3 * DAY_MS) throw new BadRequestException('A meeting cannot be longer than 3 days');
    const invited = dto.attendeeIds?.length ? await this.attendance.staffList([...new Set(dto.attendeeIds)]) : [];
    const saved = await this.db.transaction(async (m) => {
      const meeting = await m.getRepository(Meeting).save(m.getRepository(Meeting).create({
        userId: owner, title: dto.title.trim(), startTime: start, endTime: end, source: 'manual', visibilityScope: dto.visibilityScope ?? 'team', provider: null, externalId: null, createdBy: actor.id,
      }));
      if (invited.length) await m.getRepository(MeetingAttendee).save(invited.map((u) => m.getRepository(MeetingAttendee).create({ meetingId: meeting.id, employeeId: u.id, email: u.email?.toLowerCase() ?? null, name: nameOf(u) })));
      return meeting;
    });
    await this.activity.log(actor, { module: 'calendar', action: 'meeting.created', entityType: 'meeting', entityId: saved.id, entityLabel: saved.title, summary: `Added meeting "${saved.title}"${owner !== actor.id ? ' for a team member' : ''}`, metadata: { owner } });
    return { id: saved.id };
  }

  private async manualOrThrow(id: string) {
    const m = await this.meetings.findOneBy({ id });
    if (!m) throw new NotFoundException('Meeting not found');
    if (m.source !== 'manual') throw new ForbiddenException('Meetings synced from a calendar are changed in that calendar.');
    return m;
  }

  async updateManual(actor: AuthUser, id: string, dto: { title?: string; startTime?: string; endTime?: string; visibilityScope?: MeetingScope }) {
    const m = await this.manualOrThrow(id);
    await this.assertCanEdit(actor, m.userId);
    const before = { title: m.title, start: m.startTime.toISOString(), end: m.endTime.toISOString() };
    if (dto.title !== undefined) m.title = dto.title.trim();
    if (dto.startTime) m.startTime = new Date(dto.startTime);
    if (dto.endTime) m.endTime = new Date(dto.endTime);
    if (dto.visibilityScope) m.visibilityScope = dto.visibilityScope;
    if (Number.isNaN(m.startTime.getTime()) || Number.isNaN(m.endTime.getTime()) || m.endTime < m.startTime) throw new BadRequestException('Give valid start and end times');
    await this.meetings.save(m);
    await this.activity.log(actor, { module: 'calendar', action: 'meeting.updated', entityType: 'meeting', entityId: m.id, entityLabel: m.title, summary: `Changed meeting "${m.title}"`, metadata: { owner: m.userId, before } });
    return { id: m.id };
  }

  async deleteManual(actor: AuthUser, id: string) {
    const m = await this.manualOrThrow(id);
    await this.assertCanEdit(actor, m.userId);
    await this.db.transaction(async (x) => {
      await x.getRepository(MeetingAttendee).delete({ meetingId: id });
      await x.getRepository(Meeting).delete({ id });
    });
    await this.activity.log(actor, { module: 'calendar', action: 'meeting.deleted', entityType: 'meeting', entityId: id, entityLabel: m.title, summary: `Deleted meeting "${m.title}"`, metadata: { owner: m.userId } });
    return { message: 'Meeting deleted' };
  }

  // ───────────────────────── who can see and edit whom ─────────────────────────

  /** The people an actor may see in a view. Employees and agents: themselves. Admins: their teams. Super Admin: everyone. */
  private async scope(actor: AuthUser, mode: 'self' | 'team' | 'org', team?: string): Promise<User[]> {
    if (team && !TEAMS.includes(team as Team)) throw new BadRequestException('Unknown team');
    if (mode === 'self') return this.attendance.staffList([actor.id]);
    if (mode === 'org' && !isSuper(actor)) throw new ForbiddenException();
    if (mode === 'team' && !isAdmin(actor)) throw new ForbiddenException();

    if (isSuper(actor)) {
      if (!team) return this.attendance.staffList();
      return this.attendance.staffList((await this.members.find({ where: { team: team as Team } })).map((m) => m.userId));
    }
    const mine = (await this.members.find({ where: { userId: actor.id } })).map((m) => m.team);
    if (team && !mine.includes(team as Team)) throw new ForbiddenException('That is not one of your teams.');
    const use = team ? [team as Team] : mine;
    const ids = new Set((use.length ? await this.members.find({ where: { team: In(use) } }) : []).map((m) => m.userId));
    ids.add(actor.id);
    return this.attendance.staffList([...ids]);
  }

  /** Whether the actor may add or change entries for this person. */
  private async assertCanEdit(actor: AuthUser, ownerId: string) {
    if (ownerId === actor.id || isSuper(actor)) return;
    if (!isAdmin(actor)) throw new ForbiddenException('You can only change your own entries.');
    const visible = await this.scope(actor, 'team');
    if (!visible.some((u) => u.id === ownerId)) throw new ForbiddenException('That person is not on your team.');
  }

  // ───────────────────────── teams ─────────────────────────

  async listTeams(actor: AuthUser) {
    if (!isAdmin(actor)) throw new ForbiddenException();
    const mine = isSuper(actor) ? [...TEAMS] : (await this.members.find({ where: { userId: actor.id } })).map((m) => m.team);
    const rows = mine.length ? await this.members.find({ where: { team: In(mine) } }) : [];
    const people = await this.attendance.staffList();
    const by = new Map(people.map((u) => [u.id, u] as const));
    return {
      allTeams: [...TEAMS],
      teams: mine.map((t) => ({
        team: t,
        members: rows.filter((r) => r.team === t).flatMap((r) => (by.get(r.userId) ? [{ userId: r.userId, name: nameOf(by.get(r.userId)!), role: toTmsRole(by.get(r.userId)!.roles) }] : [])),
      })),
      staff: people.map((u) => ({ userId: u.id, name: nameOf(u), role: toTmsRole(u.roles) })),
    };
  }

  async setMember(actor: AuthUser, dto: { team: Team; userId: string; member: boolean }) {
    if (!isAdmin(actor)) throw new ForbiddenException();
    if (!TEAMS.includes(dto.team)) throw new BadRequestException('Unknown team');
    if (!isSuper(actor) && !(await this.members.findOneBy({ team: dto.team, userId: actor.id }))) throw new ForbiddenException('You can only manage your own teams.');
    if (!(await this.attendance.staffList([dto.userId])).length) throw new NotFoundException('Staff member not found');
    const row = await this.members.findOneBy({ team: dto.team, userId: dto.userId });
    if (dto.member && !row) await this.members.save(this.members.create({ team: dto.team, userId: dto.userId }));
    if (!dto.member && row) await this.members.remove(row);
    await this.activity.log(actor, { module: 'calendar', action: dto.member ? 'team.member_added' : 'team.member_removed', entityType: 'team', entityId: dto.userId, entityLabel: dto.team, summary: `${dto.member ? 'Added' : 'Removed'} a person ${dto.member ? 'to' : 'from'} ${dto.team}` });
    return this.listTeams(actor);
  }

  // ───────────────────────── the unified feed ─────────────────────────

  /** Rewrites activity_feed for these people and days from leave_requests, meetings and attendance_records. */
  private async buildFeed(userIds: string[], from: string, to: string) {
    if (!userIds.length) return;
    const lo = dayStart(from), hi = new Date(dayStart(to).getTime() + DAY_MS);
    const [leaves, meetings, recs] = await Promise.all([
      this.leave.forPeople(userIds, from, to),
      this.meetingsFor(userIds, lo, hi),
      this.attendance.recordsFor(userIds, from, to),
    ]);
    const rows = new Map<string, Partial<ActivityFeedItem>>();
    const add = (userId: string, type: ActivityFeedItem['type'], refId: string, date: string) => {
      if (date >= from && date <= to) rows.set(`${userId}|${type}|${refId}|${date}`, { userId, type, refId, date });
    };
    for (const l of leaves) for (const d of datesBetween(l.fromDate, l.toDate)) add(l.userId, 'leave', l.id, d);
    for (const { meeting, people } of meetings) {
      const last = meeting.endTime > meeting.startTime ? new Date(meeting.endTime.getTime() - 1) : meeting.startTime;
      for (const d of datesBetween(istDay(meeting.startTime), istDay(last))) for (const u of people) if (userIds.includes(u)) add(u, 'meeting', meeting.id, d);
    }
    for (const r of recs) add(r.userId, 'status', r.id, r.date);

    await this.db.transaction(async (m) => {
      await m.getRepository(ActivityFeedItem).createQueryBuilder().delete().where('user_id IN (:...ids) AND date >= :from AND date <= :to', { ids: userIds, from, to }).execute();
      const all = [...rows.values()];
      for (let i = 0; i < all.length; i += 500) await m.getRepository(ActivityFeedItem).createQueryBuilder().insert().values(all.slice(i, i + 500)).orIgnore().execute();
    });
  }

  /** Meetings in a window that any of these people own or are invited to, with who each one is for. */
  private async meetingsFor(userIds: string[], lo: Date, hi: Date) {
    const list = await this.meetings.createQueryBuilder('m')
      .where('m.startTime < :hi AND m.endTime >= :lo', { hi, lo })
      .andWhere(new Brackets((q) => q.where('m.userId IN (:...ids)', { ids: userIds })
        .orWhere('m.id IN (SELECT meeting_id FROM solutions.meeting_attendees WHERE employee_id IN (:...ids))', { ids: userIds })))
      .getMany();
    const att = list.length ? await this.attendees.find({ where: { meetingId: In(list.map((m) => m.id)) } }) : [];
    return list.map((meeting) => ({
      meeting,
      attendees: att.filter((a) => a.meetingId === meeting.id),
      people: [...new Set([meeting.userId, ...att.filter((a) => a.meetingId === meeting.id && a.employeeId).map((a) => a.employeeId as string)])],
    }));
  }

  /** Reads the feed back for these people and turns it into one cell per person per day. */
  private async cells(viewer: AuthUser, userIds: string[], from: string, to: string) {
    await this.buildFeed(userIds, from, to);
    const rows = userIds.length ? await this.feed.createQueryBuilder('f').where('f.userId IN (:...ids) AND f.date >= :from AND f.date <= :to', { ids: userIds, from, to }).getMany() : [];
    const ids = (t: string) => [...new Set(rows.filter((r) => r.type === t).map((r) => r.refId))];
    const [leaves, meetings, recs] = await Promise.all([
      ids('leave').length ? this.leaves.find({ where: { id: In(ids('leave')) } }) : Promise.resolve([] as LeaveRequest[]),
      ids('meeting').length ? this.meetings.find({ where: { id: In(ids('meeting')) } }) : Promise.resolve([] as Meeting[]),
      ids('status').length ? this.records.find({ where: { id: In(ids('status')) } }) : Promise.resolve([] as AttendanceRecord[]),
    ]);
    const att = meetings.length ? await this.attendees.find({ where: { meetingId: In(meetings.map((m) => m.id)) } }) : [];
    const leaveBy = new Map(leaves.map((l) => [l.id, l] as const));
    const meetBy = new Map(meetings.map((m) => [m.id, m] as const));
    const recBy = new Map(recs.map((r) => [r.id, r] as const));

    const out = new Map<string, Map<string, Cell>>();
    const cell = (u: string, d: string) => {
      const days = out.get(u) ?? new Map<string, Cell>();
      out.set(u, days);
      const c = days.get(d) ?? emptyCell();
      days.set(d, c);
      return c;
    };
    const seen = new Set<string>();
    // The person's own copy of a meeting comes first, so an invitation to the same meeting does not show twice.
    for (const r of [...rows].sort((a, b) => Number(meetBy.get(b.refId)?.userId === b.userId) - Number(meetBy.get(a.refId)?.userId === a.userId))) {
      const c = cell(r.userId, r.date);
      if (r.type === 'leave') {
        const l = leaveBy.get(r.refId);
        if (l && (l.status === 'approved' || l.status === 'pending') && (!c.leave || l.status === 'approved')) c.leave = { id: l.id, leaveType: l.leaveTypeName, state: l.status, from: l.fromDate, to: l.toDate };
      } else if (r.type === 'status') {
        const s = recBy.get(r.refId);
        if (s) c.status = { status: s.status, late: s.lateByMinutes };
      } else {
        const m = meetBy.get(r.refId);
        if (!m) continue;
        const key = `${r.userId}|${r.date}|${m.title}|${m.startTime.getTime()}|${m.endTime.getTime()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // A private meeting shows as "Busy" to everyone except its owner and the people invited to it (Admins and the Super Admin included).
        const hide = m.visibilityScope === 'private' && m.userId !== viewer.id && !att.some((a) => a.meetingId === m.id && a.employeeId === viewer.id);
        c.meetings.push({
          id: m.id, title: hide ? 'Busy' : m.title, start: m.startTime.toISOString(), end: m.endTime.toISOString(), source: m.source,
          private: m.visibilityScope === 'private', ownerId: m.userId,
          attendees: hide ? [] : att.filter((a) => a.meetingId === m.id).slice(0, 30).map((a) => ({ name: a.name, email: a.email })),
          editable: m.source === 'manual' && (m.userId === viewer.id || isSuper(viewer) || isAdmin(viewer)),
        });
      }
    }
    for (const days of out.values()) for (const c of days.values()) c.meetings.sort((a, b) => a.start.localeCompare(b.start));
    return out;
  }

  private checkRange(from: string, to: string) {
    assertDay(from, 'from');
    assertDay(to, 'to');
    if (from > to) throw new BadRequestException('from must not be after to');
    if (datesBetween(from, to).length > MAX_VIEW_DAYS) throw new BadRequestException(`Ask for at most ${MAX_VIEW_DAYS} days at a time`);
  }

  // ───────────────────────── the three views ─────────────────────────

  /** The caller's own meetings, leave and status, merged. Server-side: it can only ever return the caller's own data. */
  async myEvents(user: AuthUser, from: string, to: string) {
    this.checkRange(from, to);
    const cells = await this.cells(user, [user.id], from, to);
    return { from, to, days: datesBetween(from, to), cells: Object.fromEntries(cells.get(user.id) ?? []), ...(await this.connectionsView(user.id)) };
  }

  /** A grid for an Admin's teams (or, for the Super Admin, any scope). */
  async grid(actor: AuthUser, mode: 'team' | 'org', from: string, to: string, team?: string) {
    this.checkRange(from, to);
    const people = await this.scope(actor, mode, team);
    const ids = people.map((p) => p.id);
    const [cells, live, nowMeetings, membership] = await Promise.all([
      this.cells(actor, ids, from, to),
      this.monitoring.activeStatus(actor),
      ids.length ? this.meetingsFor(ids, new Date(), new Date(Date.now() + 1)) : Promise.resolve([]),
      ids.length ? this.members.find({ where: { userId: In(ids) } }) : Promise.resolve([] as TeamMember[]),
    ]);
    const today = istDay(new Date());
    const liveBy = new Map(live.map((l) => [l.userId, l.status] as const));
    return {
      from, to, days: datesBetween(from, to), team: team ?? null, teams: [...TEAMS],
      rows: people.map((p) => {
        const mine = cells.get(p.id) ?? new Map<string, Cell>();
        const todayCell = mine.get(today);
        const inMeeting = nowMeetings.some((x) => x.people.includes(p.id));
        const onLeave = todayCell?.leave?.state === 'approved' || todayCell?.status?.status === 'OnLeave';
        const state = inMeeting ? 'in_meeting' : onLeave ? 'on_leave' : liveBy.get(p.id) ?? 'offline';
        return {
          userId: p.id, employeeName: nameOf(p), role: toTmsRole(p.roles),
          teams: membership.filter((m) => m.userId === p.id).map((m) => m.team),
          now: state, cells: Object.fromEntries(mine),
        };
      }),
    };
  }
}
