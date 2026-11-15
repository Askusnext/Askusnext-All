import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { ActivityLog, ActivityModuleName } from './activity.entities';

export interface ActivityEntry {
  module: ActivityModuleName;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFilter {
  userId?: string;
  module?: string;
  action?: string;
  entityId?: string;
  q?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

/** Display role of an account, as the screens know it. */
export function roleLabel(roles: Role[]): string {
  if (roles.includes(Role.SuperAdmin)) return 'Admin';
  if (roles.includes(Role.Employee)) return 'Employee';
  if (roles.includes(Role.Agent)) return 'Agent';
  if (roles.some((r) => r !== Role.Customer)) return 'Staff';
  return 'Customer';
}

export const isAdmin = (u: AuthUser) => u.roles.includes(Role.SuperAdmin);
const isTeam = (u: AuthUser) => isAdmin(u) || u.roles.includes(Role.Employee);

/** A staff view of the same item twice within this time is recorded once. */
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(ActivityLog) private readonly logs: Repository<ActivityLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ───────────────────────── writing ─────────────────────────

  /**
   * Records one action. Never throws: a problem with the activity log must not stop the real work.
   * `actor` null means the system itself.
   */
  async log(actor: Pick<AuthUser, 'id' | 'name' | 'roles'> | null, e: ActivityEntry): Promise<void> {
    try {
      await this.logs.save(
        this.logs.create({
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? 'System',
          actorRole: actor ? roleLabel(actor.roles) : 'System',
          module: e.module,
          action: e.action,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          entityLabel: e.entityLabel ?? null,
          summary: e.summary.slice(0, 1000),
          metadata: e.metadata ?? null,
        }),
      );
    } catch (err) {
      this.logger.warn(`Could not record activity ${e.action}: ${(err as Error).message}`);
    }
  }

  /** Records that a staff member opened a customer's record (once per 10 minutes per item). */
  async recordView(actor: AuthUser, e: { module: ActivityModuleName; entityType: string; entityId: string; entityLabel?: string }) {
    const since = new Date(Date.now() - VIEW_DEDUPE_MS);
    const recent = await this.logs
      .createQueryBuilder('a')
      .where('a.actorId = :id', { id: actor.id })
      .andWhere('a.action = :action', { action: `${e.module}.viewed` })
      .andWhere('a.entityId = :entityId', { entityId: e.entityId })
      .andWhere('a.createdAt > :since', { since })
      .getCount();
    if (recent > 0) return { recorded: false };
    await this.log(actor, {
      module: e.module, action: `${e.module}.viewed`, entityType: e.entityType, entityId: e.entityId, entityLabel: e.entityLabel,
      summary: `Opened ${e.entityLabel ?? e.entityType}`,
    });
    return { recorded: true };
  }

  // ───────────────────────── reading ─────────────────────────

  /** Admins see everyone's activity; everybody else sees only their own (except the trail of one item). */
  async list(viewer: AuthUser, f: ActivityFilter) {
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const qb = this.logs.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(limit + 1);
    // The whole team can see the full trail of a single item they are working on; the general feed is own-only for non-admins.
    const itemTrail = Boolean(f.entityId) && isTeam(viewer);
    if (!isAdmin(viewer) && !itemTrail) qb.andWhere('a.actorId = :me', { me: viewer.id });
    else if (isAdmin(viewer) && f.userId) qb.andWhere('a.actorId = :uid', { uid: f.userId });
    if (f.module) qb.andWhere('a.module = :module', { module: f.module });
    if (f.action) qb.andWhere('a.action LIKE :action', { action: `${f.action}%` });
    if (f.entityId) qb.andWhere('a.entityId = :eid', { eid: f.entityId });
    if (f.from) qb.andWhere('a.createdAt >= :from', { from: f.from });
    if (f.to) qb.andWhere('a.createdAt < :to', { to: f.to });
    if (f.before) qb.andWhere('a.createdAt < :before', { before: f.before });
    if (f.q) {
      const like = `%${f.q.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(a.summary) LIKE :like', { like })
            .orWhere('LOWER(a.entityLabel) LIKE :like', { like })
            .orWhere('LOWER(a.actorName) LIKE :like', { like });
        }),
      );
    }
    const rows = await qb.getMany();
    const more = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id, at: r.createdAt.toISOString(), actorId: r.actorId, actorName: r.actorName, actorRole: r.actorRole,
      module: r.module, action: r.action, entityType: r.entityType, entityId: r.entityId, entityLabel: r.entityLabel,
      summary: r.summary, metadata: r.metadata,
    }));
    return { items, nextBefore: more ? items[items.length - 1].at : null };
  }

  /** Per staff member: how much they did in a period, by area, and when they were first and last active. */
  async summary(viewer: AuthUser, from: string, to: string) {
    if (!isTeam(viewer) && !viewer.roles.includes(Role.Agent)) throw new ForbiddenException();
    const mine = !isAdmin(viewer);
    const rows: { actor_id: string; name: string; role: string; module: string; c: string; first: Date; last: Date }[] = await this.db.query(
      `select actor_id, max(actor_name) as name, max(actor_role) as role, module, count(*)::text as c,
              min(created_at) as first, max(created_at) as last
         from admin.activity_logs
        where created_at >= $1 and created_at < $2
          and actor_id is not null and actor_role <> 'Customer' and action not like '%viewed'
          ${mine ? 'and actor_id = $3' : ''}
        group by actor_id, module`,
      mine ? [from, to, viewer.id] : [from, to],
    );
    const views: { actor_id: string; c: string }[] = await this.db.query(
      `select actor_id, count(*)::text as c from admin.activity_logs
        where created_at >= $1 and created_at < $2 and action like '%viewed' and actor_id is not null
          ${mine ? 'and actor_id = $3' : ''} group by actor_id`,
      mine ? [from, to, viewer.id] : [from, to],
    );
    const viewMap = new Map(views.map((v) => [v.actor_id, Number(v.c)]));
    const byActor = new Map<string, { userId: string; name: string; role: string; total: number; views: number; byModule: Record<string, number>; first: string; last: string }>();
    for (const r of rows) {
      const cur = byActor.get(r.actor_id) ?? { userId: r.actor_id, name: r.name, role: r.role, total: 0, views: viewMap.get(r.actor_id) ?? 0, byModule: {}, first: r.first.toISOString(), last: r.last.toISOString() };
      cur.total += Number(r.c);
      cur.byModule[r.module] = (cur.byModule[r.module] ?? 0) + Number(r.c);
      if (r.first.toISOString() < cur.first) cur.first = r.first.toISOString();
      if (r.last.toISOString() > cur.last) cur.last = r.last.toISOString();
      byActor.set(r.actor_id, cur);
    }
    return [...byActor.values()].sort((a, b) => b.total - a.total);
  }

  // ───────────────────────── staff and workload ─────────────────────────

  async staff(viewer: AuthUser) {
    if (!isTeam(viewer)) throw new ForbiddenException();
    const list = await this.users
      .createQueryBuilder('u')
      .where(`(u.roles LIKE '%SUPER_ADMIN%' OR u.roles LIKE '%EMPLOYEE%' OR u.roles LIKE '%AGENT%')`)
      .andWhere('u.isActive = true')
      .orderBy('u.fullName', 'ASC', 'NULLS LAST')
      .getMany();
    return list.map((u) => ({ id: u.id, name: u.fullName ?? u.email ?? u.mobile ?? u.id, role: roleLabel(u.roles) }));
  }

  /** Open work per staff member across loans, insurance and tickets, plus what is still unassigned. */
  async workload(viewer: AuthUser) {
    if (!isTeam(viewer)) throw new ForbiddenException();
    const q = async (sql: string): Promise<{ id: string | null; c: string }[]> => this.db.query(sql);
    const [loanJ, loanF, ins, tix] = await Promise.all([
      q(`select assigned_to_id::text as id, count(*)::text as c from loans.quote_applications where status in ('submitted','under_review','documents_required') group by 1`),
      q(`select assigned_to_id::text as id, count(*)::text as c from loans.form_applications where status in ('submitted','under_review','documents_required','verification_pending') group by 1`),
      q(`select assigned_to_id::text as id, count(*)::text as c from insurance.requests where status in ('new','contacted','quoted') group by 1`),
      q(`select assigned_to_id::text as id, count(*)::text as c from solutions.tickets where status in ('Open','InProgress') group by 1`),
    ]);
    const out = new Map<string, { loans: number; insurance: number; tickets: number }>();
    const add = (rows: { id: string | null; c: string }[], key: 'loans' | 'insurance' | 'tickets') => {
      for (const r of rows) {
        const id = r.id ?? 'unassigned';
        const cur = out.get(id) ?? { loans: 0, insurance: 0, tickets: 0 };
        cur[key] += Number(r.c);
        out.set(id, cur);
      }
    };
    add(loanJ, 'loans'); add(loanF, 'loans'); add(ins, 'insurance'); add(tix, 'tickets');
    return [...out.entries()].map(([userId, v]) => ({ userId: userId === 'unassigned' ? null : userId, ...v, total: v.loans + v.insurance + v.tickets }));
  }

  /** Who may be given a piece of work: an active staff account. */
  async assignee(actor: AuthUser, assigneeId: string | null, current: string | null) {
    if (assigneeId === null) {
      // releasing: an admin can release anything, others only what they hold themselves
      if (!isAdmin(actor) && current !== actor.id) throw new ForbiddenException('Only the person holding this item, or an admin, can release it.');
      return null;
    }
    if (!isAdmin(actor) && assigneeId !== actor.id) throw new ForbiddenException('You can assign work to yourself. Ask an admin to assign it to someone else.');
    const u = await this.users.findOneBy({ id: assigneeId });
    const ok = u?.isActive && u.roles.some((r) => r === Role.SuperAdmin || r === Role.Employee || r === Role.Agent);
    if (!u || !ok) throw new ForbiddenException('That person cannot be given work.');
    return { id: u.id, name: u.fullName ?? u.email ?? u.mobile ?? u.id };
  }
}
