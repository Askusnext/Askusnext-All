import { StaffHierarchyService } from './staff-hierarchy.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { NotificationService } from '../notification/notification.service';
import { istDay } from './attendance.service';
import { AttendanceRecordsService, assertDay } from './attendance-records.service';
import { LeaveBalance, LeaveRequest, LeaveStatus, LeaveType } from './leave.entities';
import { toTmsRole } from './users.service';

const DEFAULT_TYPES = [
  { name: 'Casual', defaultDaysPerYear: 12, isPaid: true },
  { name: 'Sick', defaultDaysPerYear: 12, isPaid: true },
  { name: 'Earned', defaultDaysPerYear: 15, isPaid: true },
  { name: 'Unpaid', defaultDaysPerYear: 0, isPaid: false },
];

const nameOf = (u: Pick<User, 'fullName' | 'email' | 'mobile' | 'id'>) => u.fullName ?? u.email ?? u.mobile ?? u.id;

@Injectable()
export class LeaveService implements OnModuleInit {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(LeaveBalance) private readonly balances: Repository<LeaveBalance>,
    @InjectRepository(LeaveRequest) private readonly requests: Repository<LeaveRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly attendance: AttendanceRecordsService,
    private readonly activity: ActivityService,
    private readonly notify: NotificationService,
    private readonly hierarchy: StaffHierarchyService,
  ) {}

  /** The four standard leave types exist from the first start. Admins can change or add more. */
  async onModuleInit() {
    if ((await this.types.count()) === 0) await this.types.save(DEFAULT_TYPES.map((t) => this.types.create(t)));
  }

  // ───────────────────────── leave types ─────────────────────────

  listTypes(all = false) {
    return this.types.find({ where: all ? {} : { isActive: true }, order: { name: 'ASC' } });
  }

  async saveType(actor: AuthUser, id: string | null, dto: { name?: string; defaultDaysPerYear?: number; isPaid?: boolean; isActive?: boolean }) {
    const type = id ? await this.types.findOneBy({ id }) : this.types.create({ name: '', defaultDaysPerYear: 0, isPaid: true, isActive: true });
    if (!type) throw new NotFoundException('Leave type not found');
    if (dto.name !== undefined) type.name = dto.name.trim();
    if (!type.name) throw new BadRequestException('A leave type needs a name');
    if (dto.defaultDaysPerYear !== undefined) type.defaultDaysPerYear = dto.defaultDaysPerYear;
    if (dto.isPaid !== undefined) type.isPaid = dto.isPaid;
    if (dto.isActive !== undefined) type.isActive = dto.isActive;
    const clash = await this.types.findOneBy({ name: type.name });
    if (clash && clash.id !== type.id) throw new ConflictException('A leave type with that name already exists');
    const saved = await this.types.save(type);
    await this.activity.log(actor, { module: 'attendance', action: id ? 'leave.type_updated' : 'leave.type_created', entityType: 'leave_type', entityId: saved.id, entityLabel: saved.name, summary: `${id ? 'Updated' : 'Created'} leave type ${saved.name}` });
    return saved;
  }

  // ───────────────────────── balances ─────────────────────────

  /** One row per active leave type for this person and year, created from the type defaults the first time it is asked for. */
  private async ensureBalances(userId: string, year: number) {
    const types = await this.listTypes();
    const have = await this.balances.find({ where: { userId, year } });
    const missing = types.filter((t) => !have.some((b) => b.leaveTypeId === t.id));
    if (missing.length) {
      await this.balances.createQueryBuilder().insert()
        .values(missing.map((t) => ({ userId, leaveTypeId: t.id, year, totalAllotted: t.isPaid ? t.defaultDaysPerYear : 0, used: 0 })))
        .orIgnore().execute();
    }
    const rows = await this.balances.find({ where: { userId, year } });
    return { types, rows };
  }

  async balance(userId: string, year = Number(istDay(new Date()).slice(0, 4))) {
    const { types, rows } = await this.ensureBalances(userId, year);
    const pending = await this.requests.find({ where: { userId, status: 'pending' } });
    return types.map((t) => {
      const b = rows.find((r) => r.leaveTypeId === t.id)!;
      const pendingDays = pending.filter((p) => p.leaveTypeId === t.id && p.fromDate.startsWith(`${year}`)).reduce((s, p) => s + p.days, 0);
      return {
        leaveTypeId: t.id, leaveType: t.name, isPaid: t.isPaid, year,
        totalAllotted: t.isPaid ? b.totalAllotted : null,
        used: b.used,
        pending: pendingDays,
        remaining: t.isPaid ? b.totalAllotted - b.used : null,
      };
    });
  }

  /** Everyone's balances for the year, for the admin summary and the export. */
  async balanceSummary(year = Number(istDay(new Date()).slice(0, 4)), actor?: AuthUser) {
    const staff = await this.attendance.staffList(actor ? await this.attendance.scopeIds(actor) : undefined);
    const types = await this.listTypes();
    const rows = await Promise.all(staff.map(async (u) => ({ userId: u.id, employeeName: nameOf(u), role: toTmsRole(u.roles), balances: await this.balance(u.id, year) })));
    return { year, types: types.map((t) => t.name), rows };
  }

  /** Throws 404 unless the actor may see this person's leave data (themselves, their reports, or anyone for a Super Admin). */
  async assertCanSee(actor: AuthUser, userId: string) {
    if (userId === actor.id) return;
    const scope = await this.attendance.scopeIds(actor);
    if (scope && !scope.includes(userId)) throw new NotFoundException('Staff member not found');
  }

  // ───────────────────────── requests ─────────────────────────

  private view(r: LeaveRequest) {
    return {
      id: r.id, userId: r.userId, employeeName: r.userName, leaveTypeId: r.leaveTypeId, leaveType: r.leaveTypeName,
      fromDate: r.fromDate, toDate: r.toDate, days: r.days, reason: r.reason, status: r.status,
      approvedBy: r.approvedByName, decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote, createdAt: r.createdAt.toISOString(),
    };
  }

  async request(user: AuthUser, dto: { leaveTypeId: string; fromDate: string; toDate: string; reason: string }) {
    assertDay(dto.fromDate, 'fromDate');
    assertDay(dto.toDate, 'toDate');
    if (dto.fromDate > dto.toDate) throw new BadRequestException('The end date is before the start date');
    if (dto.fromDate.slice(0, 4) !== dto.toDate.slice(0, 4)) throw new BadRequestException('A request cannot span two calendar years. Please send one request per year.');
    const [type, person] = await Promise.all([this.types.findOneBy({ id: dto.leaveTypeId, isActive: true }), this.users.findOneBy({ id: user.id })]);
    if (!type) throw new NotFoundException('Leave type not found');
    if (!person) throw new NotFoundException('Account not found');

    const working = await this.attendance.workingDays(person, dto.fromDate, dto.toDate);
    if (!working.length) throw new BadRequestException('Every day in that range is already a holiday or week-off.');

    const overlap = await this.requests.createQueryBuilder('l')
      .where(`l.userId = :id AND l.status IN ('pending','approved') AND l.fromDate <= :to AND l.toDate >= :from`, { id: user.id, from: dto.fromDate, to: dto.toDate })
      .getCount();
    if (overlap) throw new ConflictException('You already have a leave request covering some of these dates.');

    if (type.isPaid) {
      const year = Number(dto.fromDate.slice(0, 4));
      const line = (await this.balance(user.id, year)).find((b) => b.leaveTypeId === type.id)!;
      const available = (line.remaining ?? 0) - line.pending;
      if (working.length > available) throw new BadRequestException(`Not enough ${type.name} leave: ${Math.max(0, available)} day(s) available, ${working.length} requested.`);
    }

    const saved = await this.requests.save(this.requests.create({
      userId: user.id, userName: nameOf(person), leaveTypeId: type.id, leaveTypeName: type.name,
      fromDate: dto.fromDate, toDate: dto.toDate, days: working.length, reason: dto.reason.trim(), status: 'pending',
    }));
    await this.activity.log(user, { module: 'attendance', action: 'leave.requested', entityType: 'leave_request', entityId: saved.id, entityLabel: `${saved.userName} · ${saved.fromDate}`, summary: `Requested ${saved.days} day(s) of ${type.name} leave (${saved.fromDate} to ${saved.toDate})` });
    void this.tellApprovers(saved);
    return this.view(saved);
  }

  private async tellApprovers(r: LeaveRequest) {
    try {
      const admins = await this.users.createQueryBuilder('u').where(`u.roles ~ '(^|,)(SUPER_ADMIN|ADMIN)(,|$)'`).andWhere('u.isActive = true').getMany();
      const message = `${r.userName} has asked for ${r.days} day(s) of ${r.leaveTypeName} leave (${r.fromDate} to ${r.toDate}). Reason: ${r.reason}`;
      await Promise.all(admins.filter((a) => a.email && a.id !== r.userId).map((a) => this.notify.send({ channel: 'email', to: a.email as string, message })));
    } catch (e) {
      this.logger.warn(`Could not notify approvers: ${(e as Error).message}`);
    }
  }

  async cancel(user: AuthUser, id: string) {
    const r = await this.requests.findOneBy({ id });
    if (!r || r.userId !== user.id) throw new NotFoundException('Leave request not found');
    if (r.status !== 'pending') throw new ConflictException('Only a pending request can be cancelled.');
    r.status = 'cancelled';
    await this.requests.save(r);
    await this.activity.log(user, { module: 'attendance', action: 'leave.cancelled', entityType: 'leave_request', entityId: r.id, entityLabel: `${r.userName} · ${r.fromDate}`, summary: `Cancelled leave request (${r.fromDate} to ${r.toDate})` });
    return this.view(r);
  }

  mine(userId: string) {
    return this.requests.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }).then((rows) => rows.map((r) => this.view(r)));
  }

  async list(status: LeaveStatus | undefined, actor: AuthUser) {
    const scope = await this.attendance.scopeIds(actor);
    const where = { ...(status ? { status } : {}), ...(scope ? { userId: In(scope.length ? scope : ['00000000-0000-0000-0000-000000000000']) } : {}) };
    const rows = await this.requests.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    return rows.map((r) => this.view(r));
  }

  /**
   * Approve or reject. Approval, the balance and the attendance days change together or not at all.
   * Nobody decides their own request, except the Super Admin, who has no one above them.
   */
  async decide(actor: AuthUser, dto: { id: string; decision: 'approved' | 'rejected'; note?: string }) {
    const isSuper = actor.roles.includes(Role.SuperAdmin);
    const scope = await this.attendance.scopeIds(actor);
    const result = await this.db.transaction(async (m) => {
      const r = await m.getRepository(LeaveRequest).createQueryBuilder('l').setLock('pessimistic_write').where('l.id = :id', { id: dto.id }).getOne();
      if (!r) throw new NotFoundException('Leave request not found');
      if (scope && !scope.includes(r.userId)) throw new NotFoundException('Leave request not found');
      if (r.status !== 'pending') throw new ConflictException(`This request is already ${r.status}.`);
      if (r.userId === actor.id && !isSuper) throw new ForbiddenException('You cannot approve your own leave. Ask another Admin.');

      if (dto.decision === 'approved') {
        const type = await m.getRepository(LeaveType).findOneBy({ id: r.leaveTypeId });
        if (type?.isPaid) {
          const year = Number(r.fromDate.slice(0, 4));
          let b = await m.getRepository(LeaveBalance).findOneBy({ userId: r.userId, leaveTypeId: r.leaveTypeId, year });
          if (!b) b = m.getRepository(LeaveBalance).create({ userId: r.userId, leaveTypeId: r.leaveTypeId, year, totalAllotted: type.defaultDaysPerYear, used: 0 });
          if (b.used + r.days > b.totalAllotted) throw new BadRequestException(`${r.userName} does not have enough ${r.leaveTypeName} leave left to approve this.`);
          b.used += r.days;
          await m.getRepository(LeaveBalance).save(b);
        } else {
          const year = Number(r.fromDate.slice(0, 4));
          const b = (await m.getRepository(LeaveBalance).findOneBy({ userId: r.userId, leaveTypeId: r.leaveTypeId, year }))
            ?? m.getRepository(LeaveBalance).create({ userId: r.userId, leaveTypeId: r.leaveTypeId, year, totalAllotted: 0, used: 0 });
          b.used += r.days; // unpaid leave: kept as a running count, never limited
          await m.getRepository(LeaveBalance).save(b);
        }
      }
      r.status = dto.decision;
      r.approvedBy = actor.id;
      r.approvedByName = actor.name;
      r.decidedAt = new Date();
      r.decisionNote = dto.note?.slice(0, 500) ?? null;
      await m.getRepository(LeaveRequest).save(r);
      return r;
    });

    if (result.status === 'approved') {
      const person = await this.users.findOneBy({ id: result.userId });
      if (person) await this.attendance.markLeave(result.userId, await this.attendance.workingDays(person, result.fromDate, result.toDate));
    }
    await this.activity.log(actor, {
      module: 'attendance', action: `leave.${result.status}`, entityType: 'leave_request', entityId: result.id, entityLabel: `${result.userName} · ${result.fromDate}`,
      summary: `${result.status === 'approved' ? 'Approved' : 'Rejected'} ${result.userName}'s ${result.leaveTypeName} leave (${result.fromDate} to ${result.toDate})`, metadata: { note: dto.note },
    });
    void this.tellEmployee(result);
    return this.view(result);
  }

  private async tellEmployee(r: LeaveRequest) {
    try {
      const person = await this.users.findOneBy({ id: r.userId });
      if (!person?.email) return;
      await this.notify.send({ channel: 'email', to: person.email, message: `Your ${r.leaveTypeName} leave (${r.fromDate} to ${r.toDate}) was ${r.status}${r.decisionNote ? `: ${r.decisionNote}` : '.'}` });
    } catch (e) {
      this.logger.warn(`Could not notify employee: ${(e as Error).message}`);
    }
  }

  /** For the calendar overlay: leave in a range, for a set of people. */
  forPeople(userIds: string[], from: string, to: string, statuses: LeaveStatus[] = ['pending', 'approved']) {
    if (!userIds.length) return Promise.resolve([] as LeaveRequest[]);
    return this.requests.createQueryBuilder('l')
      .where('l.userId IN (:...ids) AND l.status IN (:...st) AND l.fromDate <= :to AND l.toDate >= :from', { ids: userIds, st: statuses, from, to })
      .getMany();
  }
}
