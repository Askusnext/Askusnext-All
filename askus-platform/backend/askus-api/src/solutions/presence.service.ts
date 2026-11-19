import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { User } from '../identity/identity.entities';
import { PresenceConfig, NOTICE, NOTICE_VERSION, computeState, consentInForce, loadPresenceConfig, needsDecision } from './presence.logic';
import { PresenceConsent, PresenceCurrent, PresenceSession, PresenceState, PresenceTransition } from './presence.entities';
import { PresenceBus, StaffHierarchyService, Viewer, staffName } from './staff-hierarchy.service';
import { toTmsRole } from './tms-role';

export type DisplayState = PresenceState | 'not_enabled';

export interface PresenceRow {
  userId: string;
  name: string;
  role: string;
  reportingAdminId: string | null;
  reportingAdminName: string | null;
  state: DisplayState;
  stateSince: string | null;
  lastSeenAt: string | null;
  version: number;
}

const SORTS: Record<string, string> = { name: 'u.fullName', state: 'state', lastSeen: 'ps.lastSeenAt' };
const STATES: DisplayState[] = ['active', 'background', 'away', 'offline', 'not_enabled'];
const ID40 = /^[A-Za-z0-9_-]{20,40}$/;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Presence');
  readonly cfg: PresenceConfig = loadPresenceConfig();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastTickAt = new Date();
  private lastPurge = 0;
  private readonly published = new Map<string, number>();
  /** Replaceable in tests so Away/Offline thresholds can be driven with a fake clock. */
  now: () => Date = () => new Date();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PresenceConsent) private readonly consents: Repository<PresenceConsent>,
    @InjectRepository(PresenceSession) private readonly sessions: Repository<PresenceSession>,
    @InjectRepository(PresenceCurrent) private readonly states: Repository<PresenceCurrent>,
    @InjectRepository(PresenceTransition) private readonly transitions: Repository<PresenceTransition>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly hierarchy: StaffHierarchyService,
    private readonly bus: PresenceBus,
  ) {}

  onModuleInit() {
    if (process.env.PRESENCE_DISABLE_EXPIRY === 'true') return; // tests drive tick() by hand
    this.timer = setInterval(() => void this.tick(), 15_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ───────────────────────── self-service (bound to the authenticated person) ─────────────────────────

  /** Admin, Employee and Agent only. SuperAdmin observes and Customer is excluded entirely. */
  private async trackable(actor: Pick<AuthUser, 'id'>): Promise<Viewer> {
    const v = await this.hierarchy.viewer(actor);
    if (!v || !(v.role === 'Admin' || v.role === 'Employee' || v.role === 'Agent')) throw new ForbiddenException();
    return v;
  }

  async me(actor: Pick<AuthUser, 'id'>) {
    const v = await this.hierarchy.viewer(actor);
    if (!v || v.role === 'Customer') throw new ForbiddenException();
    const base = { notice: NOTICE, config: { heartbeatSeconds: this.cfg.heartbeatSeconds }, role: v.role };
    if (v.role === 'SuperAdmin') return { ...base, trackable: false, needsDecision: false, consent: null, state: 'not_enabled' as DisplayState, stateSince: null, lastSeenAt: null };
    const c = await this.consents.findOneBy({ userId: v.id });
    const now = this.now();
    const row = await this.rowFor(v.id);
    return {
      ...base,
      trackable: true,
      needsDecision: needsDecision(c, now, this.cfg.deferDays),
      consent: c ? { decision: c.decision, noticeVersion: c.noticeVersion, decidedAt: c.decidedAt.toISOString(), current: c.noticeVersion === NOTICE_VERSION } : null,
      state: row?.state ?? 'not_enabled',
      stateSince: row?.stateSince ?? null,
      lastSeenAt: row?.lastSeenAt ?? null,
    };
  }

  async decide(actor: Pick<AuthUser, 'id'>, decision: 'accepted' | 'deferred' | 'withdrawn', noticeVersion?: string) {
    const v = await this.trackable(actor);
    if (noticeVersion !== undefined && noticeVersion !== NOTICE_VERSION) throw new ConflictException('The notice has changed. Please review it again.');
    const existing = await this.consents.findOneBy({ userId: v.id });
    if (decision === 'deferred' && consentInForce(existing)) throw new ConflictException('Presence is already enabled. Withdraw it instead.');
    if (decision === 'withdrawn' && !existing) throw new ConflictException('Presence has not been enabled');
    await this.consents.save(this.consents.create({ userId: v.id, noticeVersion: NOTICE_VERSION, decision, decidedAt: this.now() }));
    if (decision !== 'accepted') await this.endAll(v.id, 'withdrawn');
    return this.me(actor);
  }

  /** Immediately ends every session of a person and re-aggregates (used on withdrawal). */
  async endAll(userId: string, reason: 'withdrawn' | 'logout') {
    await this.sessions.update({ userId, endedAt: IsNull() }, { endedAt: this.now(), endReason: reason });
    await this.evaluate(userId, true);
  }

  async startSession(actor: Pick<AuthUser, 'id'>, inView: boolean) {
    const v = await this.trackable(actor);
    if (!consentInForce(await this.consents.findOneBy({ userId: v.id }))) throw new ForbiddenException('Browser presence is not enabled');
    const now = this.now();
    const id = randomBytes(24).toString('base64url');
    await this.sessions.save(this.sessions.create({ id, userId: v.id, inView, seq: 0, startedAt: now, lastSeenAt: now, endedAt: null, endReason: null }));
    // Bound how many tabs/devices one person can hold open: retire the oldest.
    const open = await this.sessions.find({ where: { userId: v.id, endedAt: IsNull() }, order: { startedAt: 'DESC' } });
    const surplus = open.slice(this.cfg.maxSessionsPerUser);
    if (surplus.length) await this.sessions.update({ id: In(surplus.map((s) => s.id)) }, { endedAt: now, endReason: 'replaced' });
    await this.evaluate(v.id);
    return { sessionId: id, heartbeatSeconds: this.cfg.heartbeatSeconds };
  }

  async heartbeat(actor: Pick<AuthUser, 'id'>, dto: { sessionId: string; inView: boolean; seq: number }) {
    const v = await this.trackable(actor);
    if (!ID40.test(dto.sessionId)) throw new BadRequestException('Invalid session');
    if (!consentInForce(await this.consents.findOneBy({ userId: v.id }))) {
      await this.endAll(v.id, 'withdrawn');
      throw new ForbiddenException('Browser presence is not enabled');
    }
    // The session must belong to the caller; someone else's session id behaves like an unknown one.
    const s = await this.sessions.findOneBy({ id: dto.sessionId, userId: v.id });
    if (!s || s.endedAt) throw new GoneException('Session ended');
    if (dto.seq <= s.seq) return { ok: true, ignored: true }; // duplicate or out-of-order: never overwrites newer state
    const now = this.now();
    await this.sessions.update({ id: s.id }, { seq: dto.seq, inView: dto.inView, lastSeenAt: now });
    await this.evaluate(v.id);
    return { ok: true, ignored: false };
  }

  async endSession(actor: Pick<AuthUser, 'id'>, sessionId: string) {
    if (!ID40.test(sessionId)) throw new BadRequestException('Invalid session');
    await this.sessions.update({ id: sessionId, userId: actor.id, endedAt: IsNull() }, { endedAt: this.now(), endReason: 'logout' });
    await this.evaluate(actor.id, true);
    return { ok: true };
  }

  // ───────────────────────── aggregation and expiry ─────────────────────────

  /** Recompute one person's aggregate state from all their valid sessions and record a real change only. */
  async evaluate(userId: string, force = false): Promise<void> {
    const now = this.now();
    const out = await this.db.transaction(async (m) => {
      await m.query(
        `INSERT INTO solutions.presence_states (user_id, state, state_since, version) VALUES ($1, 'offline', $2, 0) ON CONFLICT (user_id) DO NOTHING`,
        [userId, now],
      );
      const cur = await m.getRepository(PresenceCurrent).findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!cur) return null;
      const sessions = await m.getRepository(PresenceSession).find({ where: { userId, endedAt: IsNull() } });
      const next = computeState(sessions, cur, now, this.cfg);
      const changed = next.state !== cur.state;
      if (changed) {
        await m.getRepository(PresenceTransition).save(m.getRepository(PresenceTransition).create({ userId, fromState: cur.state, toState: next.state, at: now }));
        cur.state = next.state;
        cur.stateSince = now;
        cur.version = cur.version + 1;
      }
      cur.backgroundSince = next.backgroundSince;
      cur.lastSeenAt = next.lastSeenAt;
      await m.getRepository(PresenceCurrent).save(cur);
      return { changed };
    });
    if (out && (out.changed || force)) await this.publish(userId);
  }

  /** Broadcast a change once per version. Delivery to viewers re-checks their scope in the gateway. */
  private async publish(userId: string) {
    const row = await this.rowFor(userId);
    if (!row) return;
    const last = this.published.get(userId);
    if (last !== undefined && row.version === last && row.state !== 'not_enabled') return;
    this.published.set(userId, row.version);
    this.bus.emit('presence', row);
  }

  /** Server-driven expiry: runs without any client event, so closed tabs and sleeping laptops become Offline. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const since = this.lastTickAt;
      this.lastTickAt = this.now();
      const live = await this.states.find({ where: [{ state: 'active' }, { state: 'background' }, { state: 'away' }] });
      for (const row of live) await this.evaluate(row.userId);
      // Changes written by another API process still reach viewers connected here.
      const recent = await this.db.query(`SELECT user_id FROM solutions.presence_states WHERE state_since >= $1`, [new Date(since.getTime() - 1000)]);
      for (const r of recent as { user_id: string }[]) await this.publish(r.user_id);
      if (this.now().getTime() - this.lastPurge > 3_600_000) {
        this.lastPurge = this.now().getTime();
        await this.purge();
      }
    } catch (e) {
      this.log.error(`expiry tick failed: ${(e as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  /** Deletes only presence rows: old transitions and long-dead sessions. Monitoring and attendance are never touched. */
  async purge() {
    const now = this.now();
    const cutoff = new Date(now.getTime() - this.cfg.historyRetentionDays * 86_400_000);
    await this.transitions.delete({ at: LessThan(cutoff) });
    await this.sessions.delete({ lastSeenAt: LessThan(new Date(now.getTime() - 2 * 86_400_000)) });
  }

  // ───────────────────────── manager reads (always scoped in the query) ─────────────────────────

  private display(state: PresenceState | null, c: { decision: string; noticeVersion: string } | null, lastSeenAt: Date | null): DisplayState {
    if (!consentInForce(c)) return 'not_enabled';
    if (!state) return 'offline';
    // Read-time guard: a stale "active" is never shown even if the expiry tick is late.
    if (state !== 'offline' && (!lastSeenAt || this.now().getTime() - lastSeenAt.getTime() >= this.cfg.offlineAfterMs)) return 'offline';
    return state;
  }

  /** One person's row, with no authorization: callers must have resolved the viewer's scope first. */
  async rowFor(userId: string): Promise<PresenceRow | null> {
    const u = await this.users.findOneBy({ id: userId });
    if (!u) return null;
    const [ps, pc, admin] = await Promise.all([
      this.states.findOneBy({ userId }),
      this.consents.findOneBy({ userId }),
      u.reportingAdminId ? this.users.findOneBy({ id: u.reportingAdminId }) : Promise.resolve(null),
    ]);
    const state = this.display(ps?.state ?? null, pc, ps?.lastSeenAt ?? null);
    return {
      userId: u.id,
      name: staffName(u),
      role: toTmsRole(u.roles),
      reportingAdminId: u.reportingAdminId,
      reportingAdminName: admin ? staffName(admin) : null,
      state,
      stateSince: state === 'not_enabled' ? null : ps?.stateSince?.toISOString() ?? null,
      lastSeenAt: ps?.lastSeenAt?.toISOString() ?? null,
      version: ps?.version ?? 0,
    };
  }

  async team(actor: Pick<AuthUser, 'id'>, q: { role?: string; state?: string; adminId?: string; sort?: string; dir?: string; page?: number; pageSize?: number }) {
    const v = await this.hierarchy.manager(actor);
    if (q.role && !['Admin', 'Employee', 'Agent'].includes(q.role)) throw new BadRequestException('Unknown role');
    if (q.state && !STATES.includes(q.state as DisplayState)) throw new BadRequestException('Unknown state');
    if (q.adminId && !/^[0-9a-f-]{36}$/i.test(q.adminId) && q.adminId !== 'none') throw new BadRequestException('Invalid admin');
    const pageSize = Math.min(Math.max(q.pageSize ?? 100, 1), 200);
    const page = Math.max(q.page ?? 1, 1);

    const qb = this.hierarchy
      .scopedUsers(v, 'u')
      .leftJoin(PresenceCurrent, 'ps', 'ps.userId = u.id')
      .leftJoin(PresenceConsent, 'pc', 'pc.userId = u.id');
    const stateExpr = `CASE WHEN pc.decision = 'accepted' AND pc.noticeVersion = :nv THEN COALESCE(ps.state, 'offline') ELSE 'not_enabled' END`;
    qb.setParameter('nv', NOTICE_VERSION);
    if (q.role) {
      const r = q.role === 'Admin' ? 'ADMIN' : q.role.toUpperCase();
      qb.andWhere(`u.roles ~ :rre`, { rre: `(^|,)${r}(,|$)` });
    }
    if (q.adminId === 'none') qb.andWhere('u.reportingAdminId IS NULL');
    else if (q.adminId) qb.andWhere('u.reportingAdminId = :aid', { aid: q.adminId });
    if (q.state) qb.andWhere(`${stateExpr} = :st`, { st: q.state });

    const total = await qb.clone().getCount();
    const sortExpr = q.sort && SORTS[q.sort] ? (q.sort === 'state' ? stateExpr : SORTS[q.sort]) : 'u.fullName';
    const ids = (
      await qb
        .clone()
        .select('u.id', 'id')
        .addSelect(sortExpr, 'sort_key')
        .orderBy('sort_key', q.dir === 'desc' ? 'DESC' : 'ASC', 'NULLS LAST')
        .addOrderBy('u.id', 'ASC')
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .getRawMany<{ id: string }>()
    ).map((r) => r.id);
    const rows = (await Promise.all(ids.map((id) => this.rowFor(id)))).filter((r): r is PresenceRow => !!r);
    return { serverNow: this.now().toISOString(), total, page, pageSize, rows, canAssign: v.role === 'SuperAdmin', thresholds: { offlineSeconds: this.cfg.offlineAfterMs / 1000, awayMinutes: this.cfg.awayAfterMs / 60_000 } };
  }

  /** Unpaginated (bounded) rows for a viewer: the WebSocket snapshot and the CSV export share this scope. */
  async visibleRows(v: Viewer, limit = 1000): Promise<PresenceRow[]> {
    const ids = (await this.hierarchy.scopedUsers(v).select('u.id').orderBy('u.fullName', 'ASC').limit(limit).getMany()).map((u) => u.id);
    return (await Promise.all(ids.map((id) => this.rowFor(id)))).filter((r): r is PresenceRow => !!r);
  }

  async history(actor: Pick<AuthUser, 'id'>, subjectId: string, limit = 50) {
    const v = await this.hierarchy.manager(actor);
    const subject = await this.hierarchy.resolveSubject(v, subjectId); // 404 when out of scope
    const since = new Date(this.now().getTime() - this.cfg.historyRetentionDays * 86_400_000);
    const rows = await this.transitions.find({
      where: { userId: subject.id },
      order: { at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return {
      userId: subject.id,
      name: staffName(subject),
      retentionDays: this.cfg.historyRetentionDays,
      transitions: rows.filter((r) => r.at >= since).map((r) => ({ from: r.fromState, to: r.toState, at: r.at.toISOString() })),
    };
  }

  async exportCsv(actor: Pick<AuthUser, 'id'>): Promise<string> {
    const v = await this.hierarchy.manager(actor);
    const rows = await this.visibleRows(v, 5000);
    const cell = (s: string | null) => {
      const t = (s ?? '').replace(/"/g, '""');
      return `"${/^[=+\-@\t\r]/.test(t) ? `'${t}` : t}"`;
    };
    const head = ['Name', 'Role', 'Reporting Admin', 'Presence state', 'In state since (UTC)', 'Last seen (UTC)'];
    return [head.join(','), ...rows.map((r) => [r.name, r.role, r.reportingAdminName, r.state, r.stateSince, r.lastSeenAt].map(cell).join(','))].join('\n');
  }
}
