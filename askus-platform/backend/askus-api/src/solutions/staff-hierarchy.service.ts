import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { EventEmitter } from 'events';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { StaffAssignmentAudit } from './presence.entities';
import { TmsRole, toTmsRole } from './tms-role';

/** In-process event bus for presence and assignment changes (single-instance by design, see docs). */
@Injectable()
export class PresenceBus extends EventEmitter {}

export interface Viewer {
  id: string;
  role: TmsRole;
}

const REPORT_ROLES = [Role.Employee, Role.Agent];
const nameOf = (u: User) => u.fullName ?? u.email ?? u.mobile ?? 'User';

/**
 * The single source of truth for "who may see whom".
 *  - SuperAdmin: every active Admin, Employee and Agent (assigned or not).
 *  - Admin: only Employees/Agents whose reporting_admin_id is that Admin right now.
 *  - Everyone else: nobody.
 * Roles are always read from the database, never from the token or the request.
 */
@Injectable()
export class StaffHierarchyService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly bus: PresenceBus,
  ) {}

  /** The authenticated person as the database knows them now; null if disabled, unapproved or missing. */
  async viewer(actor: Pick<AuthUser, 'id'>): Promise<Viewer | null> {
    const u = await this.users.findOne({ where: { id: actor.id } });
    if (!u || !u.isActive || u.approvalStatus !== 'APPROVED') return null;
    return { id: u.id, role: toTmsRole(u.roles) };
  }

  /** A viewer who may look at other people's presence (Admin or SuperAdmin). */
  async manager(actor: Pick<AuthUser, 'id'>): Promise<Viewer> {
    const v = await this.viewer(actor);
    if (!v || (v.role !== 'SuperAdmin' && v.role !== 'Admin')) throw new ForbiddenException();
    return v;
  }

  async superAdmin(actor: Pick<AuthUser, 'id'>): Promise<Viewer> {
    const v = await this.viewer(actor);
    if (!v || v.role !== 'SuperAdmin') throw new ForbiddenException();
    return v;
  }

  /** Base query of the people a manager may see; further filters are AND-ed on by the caller. */
  scopedUsers(v: Viewer, alias = 'u'): SelectQueryBuilder<User> {
    const qb = this.users.createQueryBuilder(alias).where(`${alias}.isActive = true`).andWhere(`${alias}.approvalStatus = 'APPROVED'`);
    if (v.role === 'SuperAdmin') {
      return qb.andWhere(`${alias}.roles ~ '(^|,)(ADMIN|EMPLOYEE|AGENT)(,|$)'`).andWhere(`${alias}.roles !~ '(^|,)SUPER_ADMIN(,|$)'`);
    }
    if (v.role === 'Admin') {
      return qb.andWhere(`${alias}.reportingAdminId = :me`, { me: v.id }).andWhere(`${alias}.roles ~ '(^|,)(EMPLOYEE|AGENT)(,|$)'`);
    }
    return qb.andWhere('1 = 0');
  }

  /** Ids a viewer may see, or null for "everyone" is deliberately not offered: callers always get an explicit list. */
  async scopedIds(v: Viewer): Promise<string[]> {
    return (await this.scopedUsers(v).select('u.id').getMany()).map((u) => u.id);
  }

  /** Resolve one subject inside the viewer's scope. Out-of-scope and nonexistent look identical (404). */
  async resolveSubject(v: Viewer, subjectId: string): Promise<User> {
    const found = await this.scopedUsers(v).andWhere('u.id = :sid', { sid: subjectId }).getOne();
    if (!found) throw new NotFoundException('Not found');
    return found;
  }

  async canView(viewerId: string, subjectId: string): Promise<boolean> {
    const v = await this.viewer({ id: viewerId });
    if (!v) return false;
    return !!(await this.scopedUsers(v).andWhere('u.id = :sid', { sid: subjectId }).getCount());
  }

  /**
   * Staff-data scope for the pre-existing monitoring / attendance / leave endpoints.
   * Returns the ids the actor may see: SuperAdmin all staff, Admin their reports (plus themselves),
   * anyone else only themselves.
   */
  async staffScope(actor: Pick<AuthUser, 'id'>): Promise<{ all: boolean; ids: string[] }> {
    const v = await this.viewer(actor);
    if (!v) return { all: false, ids: [] };
    if (v.role === 'SuperAdmin') return { all: true, ids: [] };
    if (v.role === 'Admin') return { all: false, ids: [v.id, ...(await this.scopedIds(v))] };
    return { all: false, ids: [v.id] };
  }

  // ───────────────────────── assignment (Super Admin only) ─────────────────────────

  async listAdmins() {
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere("u.approvalStatus = 'APPROVED'")
      .andWhere("u.roles ~ '(^|,)ADMIN(,|$)' AND u.roles !~ '(^|,)SUPER_ADMIN(,|$)'")
      .orderBy('u.fullName', 'ASC')
      .getMany();
    return rows.filter((u) => toTmsRole(u.roles) === 'Admin').map((u) => ({ id: u.id, name: nameOf(u) }));
  }

  /**
   * Assign, reassign (adminId = new Admin) or unassign (adminId = null) an Employee/Agent.
   * Runs in one transaction with the subject row locked, so two concurrent changes serialise and
   * the audit row always records the true previous Admin.
   */
  async assign(actorUser: Pick<AuthUser, 'id'>, subjectId: string, adminId: string | null, reason?: string) {
    const actor = await this.superAdmin(actorUser);
    if (adminId && adminId === subjectId) throw new BadRequestException('A person cannot report to themselves');

    const result = await this.db.transaction(async (m) => {
      const subject = await m.getRepository(User).findOne({ where: { id: subjectId }, lock: { mode: 'pessimistic_write' } });
      if (!subject) throw new NotFoundException('Staff member not found');
      const role = toTmsRole(subject.roles);
      if (!subject.isActive || subject.approvalStatus !== 'APPROVED' || !(role === 'Employee' || role === 'Agent')) {
        throw new BadRequestException('Only active Employees and Agents can be assigned to an Admin');
      }
      if (adminId) {
        const admin = await m.getRepository(User).findOne({ where: { id: adminId }, lock: { mode: 'pessimistic_read' } });
        if (!admin || !admin.isActive || admin.approvalStatus !== 'APPROVED' || toTmsRole(admin.roles) !== 'Admin') {
          throw new BadRequestException('The target must be an active Solutions Admin');
        }
      }
      const old = subject.reportingAdminId;
      if (old === adminId) throw new ConflictException(adminId ? 'Already assigned to that Admin' : 'Already unassigned');
      await m.getRepository(User).update({ id: subjectId }, { reportingAdminId: adminId });
      const audit = await m.getRepository(StaffAssignmentAudit).save(
        m.getRepository(StaffAssignmentAudit).create({ actorId: actor.id, subjectId, oldAdminId: old, newAdminId: adminId, reason: reason?.trim() || null }),
      );
      return { subject, old, audit };
    });

    // After commit, so listeners only ever see durable state.
    this.bus.emit('assignment', { userId: subjectId, oldAdminId: result.old, newAdminId: adminId });
    return { userId: subjectId, reportingAdminId: adminId, auditId: result.audit.id };
  }

  /** Called when an Admin is disabled or a person stops being an Employee/Agent: their links are cleared and audited. */
  async clearLinks(actorId: string, where: { adminId?: string; subjectId?: string }, reason: string) {
    const affected = await this.db.transaction(async (m) => {
      const qb = m.getRepository(User).createQueryBuilder('u').setLock('pessimistic_write').where('u.reportingAdminId IS NOT NULL');
      if (where.adminId) qb.andWhere('u.reportingAdminId = :a', { a: where.adminId });
      if (where.subjectId) qb.andWhere('u.id = :s', { s: where.subjectId });
      const rows = await qb.getMany();
      for (const u of rows) {
        await m.getRepository(User).update({ id: u.id }, { reportingAdminId: null });
        await m.getRepository(StaffAssignmentAudit).save(
          m.getRepository(StaffAssignmentAudit).create({ actorId, subjectId: u.id, oldAdminId: u.reportingAdminId, newAdminId: null, reason }),
        );
      }
      return rows;
    });
    for (const u of affected) this.bus.emit('assignment', { userId: u.id, oldAdminId: u.reportingAdminId, newAdminId: null });
  }

  async auditFor(actorUser: Pick<AuthUser, 'id'>, subjectId: string | undefined, limit: number) {
    await this.superAdmin(actorUser);
    const rows = await this.db.getRepository(StaffAssignmentAudit).find({
      where: subjectId ? { subjectId } : {},
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.subjectId, r.oldAdminId, r.newAdminId].filter((x): x is string => !!x)))];
    const names = new Map((ids.length ? await this.users.find({ where: { id: In(ids) } }) : []).map((u) => [u.id, nameOf(u)]));
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      actor: names.get(r.actorId) ?? 'Unknown',
      subject: names.get(r.subjectId) ?? 'Unknown',
      subjectId: r.subjectId,
      oldAdmin: r.oldAdminId ? names.get(r.oldAdminId) ?? 'Unknown' : null,
      newAdmin: r.newAdminId ? names.get(r.newAdminId) ?? 'Unknown' : null,
      reason: r.reason,
    }));
  }
}

export { REPORT_ROLES, nameOf as staffName };
