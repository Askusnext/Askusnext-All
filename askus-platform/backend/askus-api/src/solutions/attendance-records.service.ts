import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { StaffHierarchyService } from './staff-hierarchy.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { istDay } from './attendance.service';
import {
  ATTENDANCE_STATUSES, AttendanceConfig, AttendanceRecord, AttendanceSource, AttendanceStatus, Holiday, LeaveRequest, WeekOffRule,
} from './leave.entities';
import { toTmsRole } from './users.service';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAFF_ROLES = `(^|,)(SUPER_ADMIN|ADMIN|EMPLOYEE|AGENT)(,|$)`;

export const minutesOfDayIst = (d: Date) => {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const hmToMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const parseDays = (csv: string | null | undefined) =>
  (csv ?? '').split(',').filter((x) => x.trim() !== '').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00Z`).getTime();
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month must look like 2026-11');
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function assertDay(day: string, label = 'date') {
  if (!DAY_RE.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime())) throw new BadRequestException(`${label} must be YYYY-MM-DD`);
}

/** The slice of a user the day rules need. */
type Person = Pick<User, 'id' | 'roles' | 'createdAt'>;

export interface DayCell { s: AttendanceStatus | null; late: number; miss: boolean }

const NO_ONE = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AttendanceRecordsService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceRecordsService.name);

  constructor(
    @InjectRepository(AttendanceRecord) private readonly records: Repository<AttendanceRecord>,
    @InjectRepository(AttendanceConfig) private readonly configs: Repository<AttendanceConfig>,
    @InjectRepository(WeekOffRule) private readonly weekOffs: Repository<WeekOffRule>,
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
    @InjectRepository(LeaveRequest) private readonly leaves: Repository<LeaveRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly hierarchy: StaffHierarchyService,
  ) {}

  /** Staff ids the actor may see: undefined means everyone (Super Admin). Admins get their reports plus themselves. */
  async scopeIds(actor: AuthUser): Promise<string[] | undefined> {
    const s = await this.hierarchy.staffScope(actor);
    return s.all ? undefined : s.ids;
  }

  async onModuleInit() {
    await this.config();
    // Holidays and week-offs are written to the table by this hourly pass (idempotent, so several instances are harmless).
    const run = () => this.dailyPass().catch((e) => this.logger.warn(`Daily attendance pass failed: ${(e as Error).message}`));
    setTimeout(run, 30_000).unref();
    setInterval(run, 60 * 60 * 1000).unref();
  }

  // ───────────────────────── rules ─────────────────────────

  async config() {
    let c = await this.configs.findOneBy({ id: 'default' });
    if (!c) c = await this.configs.save(this.configs.create({ id: 'default', shiftStart: '09:30', graceMinutes: 10, halfDayMinutes: 240, weekOffDays: '0' }));
    return c;
  }

  async configView() {
    const [config, rules] = await Promise.all([this.config(), this.weekOffs.find({ order: { scope: 'ASC', target: 'ASC' } })]);
    return {
      shiftStart: config.shiftStart,
      graceMinutes: config.graceMinutes,
      halfDayMinutes: config.halfDayMinutes,
      weekOffDays: parseDays(config.weekOffDays),
      rules: rules.map((r) => ({ id: r.id, scope: r.scope, target: r.target, days: parseDays(r.days) })),
    };
  }

  async updateConfig(actor: AuthUser, dto: { shiftStart?: string; graceMinutes?: number; halfDayMinutes?: number; weekOffDays?: number[] }) {
    const c = await this.config();
    const before = { shiftStart: c.shiftStart, graceMinutes: c.graceMinutes, halfDayMinutes: c.halfDayMinutes, weekOffDays: c.weekOffDays };
    if (dto.shiftStart !== undefined) {
      if (!HM_RE.test(dto.shiftStart)) throw new BadRequestException('shiftStart must be HH:mm');
      c.shiftStart = dto.shiftStart;
    }
    if (dto.graceMinutes !== undefined) c.graceMinutes = dto.graceMinutes;
    if (dto.halfDayMinutes !== undefined) c.halfDayMinutes = dto.halfDayMinutes;
    if (dto.weekOffDays !== undefined) c.weekOffDays = [...new Set(dto.weekOffDays)].sort().join(',');
    await this.configs.save(c);
    if (dto.weekOffDays !== undefined) await this.resetAutoWeekOffs();
    await this.activity.log(actor, { module: 'attendance', action: 'attendance.config_updated', summary: 'Changed the attendance rules', metadata: { before, after: dto } });
    return this.configView();
  }

  /** Sets (or with empty days, removes the need for) a week-off override for one user or one role. */
  async setWeekOffRule(actor: AuthUser, dto: { scope: 'user' | 'role'; target: string; days: number[] }) {
    if (dto.scope === 'role' && !['Admin', 'Employee', 'Agent'].includes(dto.target)) throw new BadRequestException('role must be Admin, Employee or Agent');
    if (dto.scope === 'user' && !(await this.users.findOneBy({ id: dto.target }))) throw new NotFoundException('Staff member not found');
    const days = [...new Set(dto.days)].sort().join(',');
    const rule = (await this.weekOffs.findOneBy({ scope: dto.scope, target: dto.target })) ?? this.weekOffs.create({ scope: dto.scope, target: dto.target });
    rule.days = days;
    await this.weekOffs.save(rule);
    await this.resetAutoWeekOffs();
    await this.activity.log(actor, { module: 'attendance', action: 'attendance.week_off_changed', summary: `Set week-off for ${dto.scope} ${dto.target}`, metadata: { days: dto.days } });
    return this.configView();
  }

  async removeWeekOffRule(actor: AuthUser, id: string) {
    const rule = await this.weekOffs.findOneBy({ id });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.weekOffs.remove(rule);
    await this.resetAutoWeekOffs();
    await this.activity.log(actor, { module: 'attendance', action: 'attendance.week_off_changed', summary: `Removed week-off rule for ${rule.scope} ${rule.target}` });
    return this.configView();
  }

  /** Week-offs from today onward are recomputed; history is left as it was. */
  private resetAutoWeekOffs() {
    return this.records
      .createQueryBuilder()
      .delete()
      .where(`status = 'WeekOff' AND source = 'system' AND date >= :today`, { today: istDay(new Date()) })
      .execute();
  }

  private weekOffDaysFor(p: Person, cfg: AttendanceConfig, rules: WeekOffRule[]): number[] {
    const user = rules.find((r) => r.scope === 'user' && r.target === p.id);
    if (user) return parseDays(user.days);
    const role = rules.find((r) => r.scope === 'role' && r.target === toTmsRole(p.roles));
    if (role) return parseDays(role.days);
    return parseDays(cfg.weekOffDays);
  }

  private async holidayMap(from: string, to: string) {
    const rows = await this.holidays.find({ where: { date: Between(from, to) } });
    return new Map(rows.filter((h) => h.applicableTo === 'all').map((h) => [h.date, h.name] as const));
  }

  /** Approved leave covering each day, as userId -> set of dates. */
  private async leaveDays(userIds: string[], from: string, to: string) {
    const out = new Map<string, Set<string>>();
    if (!userIds.length) return out;
    const rows = await this.leaves
      .createQueryBuilder('l')
      .where(`l.status = 'approved' AND l.userId IN (:...ids) AND l.fromDate <= :to AND l.toDate >= :from`, { ids: userIds, from, to })
      .getMany();
    for (const l of rows) {
      const set = out.get(l.userId) ?? new Set<string>();
      for (const d of datesBetween(l.fromDate < from ? from : l.fromDate, l.toDate > to ? to : l.toDate)) set.add(d);
      out.set(l.userId, set);
    }
    return out;
  }

  /** Working days for one person in a range: not a holiday and not one of their week-offs. */
  async workingDays(person: Person, from: string, to: string): Promise<string[]> {
    const [cfg, rules, holidays] = await Promise.all([this.config(), this.weekOffs.find(), this.holidayMap(from, to)]);
    const off = this.weekOffDaysFor(person, cfg, rules);
    return datesBetween(from, to).filter((d) => !holidays.has(d) && !off.includes(weekdayOf(d)));
  }

  // ───────────────────────── auto-marking ─────────────────────────

  private async staff(ids?: string[]) {
    const qb = this.users.createQueryBuilder('u').where(`u.roles ~ :re`, { re: STAFF_ROLES }).andWhere('u.isActive = true').orderBy('u.fullName', 'ASC', 'NULLS LAST');
    if (ids) qb.andWhere('u.id IN (:...ids)', { ids: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] });
    return qb.getMany();
  }

  /**
   * Writes the days nobody has to mark by hand: holidays, week-offs, approved leave, and (for days already
   * over) Absent. Never touches a day that already has a record, and never looks past today.
   */
  async ensureRange(people: Person[], from: string, to: string) {
    const today = istDay(new Date());
    const end = to > today ? today : to;
    if (!people.length || from > end) return;
    const [cfg, rules, holidays, leave, existing] = await Promise.all([
      this.config(),
      this.weekOffs.find(),
      this.holidayMap(from, end),
      this.leaveDays(people.map((p) => p.id), from, end),
      this.records.find({ where: { userId: In(people.map((p) => p.id)), date: Between(from, end) }, select: ['userId', 'date'] }),
    ]);
    const have = new Set(existing.map((r) => `${r.userId}|${r.date}`));
    const rows: Partial<AttendanceRecord>[] = [];
    for (const p of people) {
      const off = this.weekOffDaysFor(p, cfg, rules);
      const joined = istDay(p.createdAt);
      for (const d of datesBetween(from, end)) {
        if (d < joined || have.has(`${p.id}|${d}`)) continue;
        let status: AttendanceStatus | null = null;
        if (holidays.has(d)) status = 'Holiday';
        else if (off.includes(weekdayOf(d))) status = 'WeekOff';
        else if (leave.get(p.id)?.has(d)) status = 'OnLeave';
        else if (d < today) status = 'Absent';
        if (status) rows.push({ userId: p.id, date: d, status, source: status === 'OnLeave' ? 'leave' : 'system', lateByMinutes: 0 });
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      await this.records.createQueryBuilder().insert().values(rows.slice(i, i + 500)).orIgnore().execute();
    }
  }

  /** Runs hourly: fills the last few days for everyone and flags forgotten check-outs. */
  async dailyPass() {
    const today = istDay(new Date());
    const from = istDay(new Date(Date.now() - 3 * 86_400_000));
    await this.ensureRange(await this.staff(), from, today);
    await this.flagMissedCheckouts();
  }

  /** A check-in with no check-out on a day that is over is flagged for an admin to review. */
  async flagMissedCheckouts() {
    await this.records
      .createQueryBuilder()
      .update()
      .set({ missedCheckout: true })
      .where(`date < :today AND check_in_time IS NOT NULL AND check_out_time IS NULL AND missed_checkout = false`, { today: istDay(new Date()) })
      .execute();
  }

  // ───────────────────────── employee side ─────────────────────────

  dto(r: AttendanceRecord) {
    return {
      id: r.id,
      date: r.date,
      status: r.status,
      checkInTime: iso(r.checkInTime),
      checkOutTime: iso(r.checkOutTime),
      lateByMinutes: r.lateByMinutes,
      missedCheckout: r.missedCheckout,
      source: r.source,
      note: r.note,
    };
  }

  private lateBy(checkIn: Date, cfg: AttendanceConfig) {
    const behind = minutesOfDayIst(checkIn) - hmToMinutes(cfg.shiftStart);
    return behind > cfg.graceMinutes ? behind : 0;
  }

  async checkIn(user: AuthUser) {
    const now = new Date();
    const today = istDay(now);
    const person = await this.users.findOneBy({ id: user.id });
    if (!person) throw new NotFoundException('Account not found');
    await this.ensureRange([person], today, today);
    const rec = await this.records.findOneBy({ userId: user.id, date: today });
    if (rec?.checkInTime) throw new ConflictException('You have already checked in today.');
    if (rec?.status === 'OnLeave') throw new ConflictException('You are on approved leave today.');
    const cfg = await this.config();
    const row = rec ?? this.records.create({ userId: user.id, date: today });
    Object.assign(row, { status: 'Present', checkInTime: now, checkOutTime: null, lateByMinutes: this.lateBy(now, cfg), missedCheckout: false, source: 'self' as AttendanceSource });
    return this.dto(await this.records.save(row));
  }

  async checkOut(user: AuthUser) {
    const now = new Date();
    const rec = await this.records.findOneBy({ userId: user.id, date: istDay(now) });
    if (!rec?.checkInTime) throw new ConflictException('Check in first.');
    if (rec.checkOutTime) throw new ConflictException('You have already checked out today.');
    const cfg = await this.config();
    const minutes = Math.round((now.getTime() - rec.checkInTime.getTime()) / 60000);
    rec.checkOutTime = now;
    rec.status = minutes < cfg.halfDayMinutes ? 'HalfDay' : 'Present';
    rec.missedCheckout = false;
    return this.dto(await this.records.save(rec));
  }

  /** Today for the signed-in employee. Polled by the screen so the status stays live. */
  async today(user: AuthUser) {
    const now = new Date();
    const today = istDay(now);
    const person = await this.users.findOneBy({ id: user.id });
    if (person) await this.ensureRange([person], today, today);
    const [rec, cfg] = await Promise.all([this.records.findOneBy({ userId: user.id, date: today }), this.config()]);
    const worked = rec?.checkInTime ? Math.round(((rec.checkOutTime ?? now).getTime() - rec.checkInTime.getTime()) / 60000) : 0;
    return {
      date: today,
      status: rec?.status ?? null,
      checkInTime: iso(rec?.checkInTime),
      checkOutTime: iso(rec?.checkOutTime),
      lateByMinutes: rec?.lateByMinutes ?? 0,
      workedMinutes: worked,
      canCheckIn: !rec?.checkInTime && rec?.status !== 'OnLeave',
      canCheckOut: !!rec?.checkInTime && !rec.checkOutTime,
      shiftStart: cfg.shiftStart,
      graceMinutes: cfg.graceMinutes,
    };
  }

  async myRecord(user: AuthUser, from: string, to: string) {
    assertDay(from, 'from');
    assertDay(to, 'to');
    if (from > to) throw new BadRequestException('from must not be after to');
    if (datesBetween(from, to).length > 366) throw new BadRequestException('Ask for at most a year at a time');
    const person = await this.users.findOneBy({ id: user.id });
    if (person) await this.ensureRange([person], from, to);
    const rows = await this.records.find({ where: { userId: user.id, date: Between(from, to) }, order: { date: 'ASC' } });
    return { from, to, records: rows.map((r) => this.dto(r)), summary: this.summarise(rows) };
  }

  private summarise(rows: AttendanceRecord[]) {
    const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
    return {
      present: count('Present'), halfDay: count('HalfDay'), absent: count('Absent'), onLeave: count('OnLeave'),
      holiday: count('Holiday'), weekOff: count('WeekOff'),
      lateCount: rows.filter((r) => r.lateByMinutes > 0).length,
      lateMinutes: rows.reduce((s, r) => s + r.lateByMinutes, 0),
      missedCheckouts: rows.filter((r) => r.missedCheckout).length,
    };
  }

  // ───────────────────────── admin side ─────────────────────────

  /** Employee x date x status grid for a month. */
  async register(month: string, actor: AuthUser) {
    const { from, to } = monthRange(month);
    const scope = await this.scopeIds(actor);
    const staff = await this.staff(scope);
    await this.ensureRange(staff, from, to);
    const [rows, holidays, cfg, rules, leave] = await Promise.all([
      this.records.find({ where: scope ? { date: Between(from, to), userId: In(scope.length ? scope : [NO_ONE]) } : { date: Between(from, to) } }),
      this.holidayMap(from, to),
      this.config(),
      this.weekOffs.find(),
      this.leaveDays(staff.map((s) => s.id), from, to),
    ]);
    const days = datesBetween(from, to);
    const byKey = new Map(rows.map((r) => [`${r.userId}|${r.date}`, r] as const));
    const today = istDay(new Date());
    return {
      month, from, to, days,
      holidays: Object.fromEntries(holidays),
      rows: staff.map((u) => {
        const off = this.weekOffDaysFor(u, cfg, rules);
        const mine: AttendanceRecord[] = [];
        const cells: DayCell[] = days.map((d) => {
          const r = byKey.get(`${u.id}|${d}`);
          if (r) { mine.push(r); return { s: r.status, late: r.lateByMinutes, miss: r.missedCheckout }; }
          // Days that are still to come, or before the person joined, are shown but not stored.
          if (d < istDay(u.createdAt)) return { s: null, late: 0, miss: false };
          const s = holidays.has(d) ? 'Holiday' : off.includes(weekdayOf(d)) ? 'WeekOff' : leave.get(u.id)?.has(d) ? 'OnLeave' : null;
          return { s: s as AttendanceStatus | null, late: 0, miss: false };
        });
        return {
          userId: u.id,
          employeeName: u.fullName ?? u.email ?? u.mobile ?? u.id,
          role: toTmsRole(u.roles),
          cells,
          summary: this.summarise(mine),
        };
      }),
      today,
    };
  }

  async lateReport(month: string, actor: AuthUser) {
    const { from, to } = monthRange(month);
    const scope = await this.scopeIds(actor);
    const rows = await this.records.find({ where: scope ? { date: Between(from, to), userId: In(scope.length ? scope : [NO_ONE]) } : { date: Between(from, to) }, order: { date: 'ASC' } });
    const late = rows.filter((r) => r.lateByMinutes > 0);
    const people = await this.users.find({ where: { id: In([...new Set(late.map((r) => r.userId))]) } });
    const name = new Map(people.map((u) => [u.id, u.fullName ?? u.email ?? u.mobile ?? u.id] as const));
    const grouped = new Map<string, { userId: string; employeeName: string; count: number; totalMinutes: number; days: { date: string; minutes: number }[] }>();
    for (const r of late) {
      const g = grouped.get(r.userId) ?? { userId: r.userId, employeeName: name.get(r.userId) ?? r.userId, count: 0, totalMinutes: 0, days: [] };
      g.count += 1; g.totalMinutes += r.lateByMinutes; g.days.push({ date: r.date, minutes: r.lateByMinutes });
      grouped.set(r.userId, g);
    }
    return { month, graceMinutes: (await this.config()).graceMinutes, people: [...grouped.values()].sort((a, b) => b.count - a.count) };
  }

  async missedCheckouts(actor: AuthUser) {
    const scope = await this.scopeIds(actor);
    const rows = await this.records.find({ where: scope ? { missedCheckout: true, userId: In(scope.length ? scope : [NO_ONE]) } : { missedCheckout: true }, order: { date: 'DESC' }, take: 200 });
    const people = await this.users.find({ where: { id: In([...new Set(rows.map((r) => r.userId))]) } });
    const name = new Map(people.map((u) => [u.id, u.fullName ?? u.email ?? u.mobile ?? u.id] as const));
    return rows.map((r) => ({ ...this.dto(r), userId: r.userId, employeeName: name.get(r.userId) ?? r.userId }));
  }

  /** An admin sets or corrects one person's day. Always written to the activity and audit logs. */
  async manualMark(actor: AuthUser, dto: { userId: string; date: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }) {
    assertDay(dto.date);
    if (!ATTENDANCE_STATUSES.includes(dto.status)) throw new BadRequestException('Unknown status');
    for (const hm of [dto.checkIn, dto.checkOut]) if (hm && !HM_RE.test(hm)) throw new BadRequestException('Times must be HH:mm');
    const today = istDay(new Date());
    if (dto.date > today) throw new BadRequestException('You cannot mark a day that has not happened yet');
    const scope = await this.scopeIds(actor);
    if (scope && !scope.includes(dto.userId)) throw new NotFoundException('Staff member not found');
    const person = await this.users.findOneBy({ id: dto.userId });
    if (!person || !person.roles.some((r) => [Role.SuperAdmin, Role.Admin, Role.Employee, Role.Agent].includes(r))) throw new NotFoundException('Staff member not found');

    const cfg = await this.config();
    const rec = (await this.records.findOneBy({ userId: dto.userId, date: dto.date })) ?? this.records.create({ userId: dto.userId, date: dto.date });
    const before = rec.id ? { status: rec.status, checkIn: iso(rec.checkInTime), checkOut: iso(rec.checkOutTime), lateByMinutes: rec.lateByMinutes } : null;

    const working = dto.status === 'Present' || dto.status === 'HalfDay';
    const at = (hm?: string) => (hm ? new Date(`${dto.date}T${hm}:00+05:30`) : null);
    rec.status = dto.status;
    rec.checkInTime = working ? at(dto.checkIn) ?? rec.checkInTime : null;
    rec.checkOutTime = working ? at(dto.checkOut) ?? rec.checkOutTime : null;
    if (working && rec.checkInTime && rec.checkOutTime && rec.checkOutTime <= rec.checkInTime) throw new BadRequestException('Check-out must be after check-in');
    rec.lateByMinutes = working && rec.checkInTime ? this.lateBy(rec.checkInTime, cfg) : 0;
    rec.missedCheckout = working && !!rec.checkInTime && !rec.checkOutTime && dto.date < today;
    rec.source = 'admin';
    rec.markedBy = actor.id;
    rec.note = dto.note?.slice(0, 500) ?? null;
    const saved = await this.records.save(rec);

    const after = { status: saved.status, checkIn: iso(saved.checkInTime), checkOut: iso(saved.checkOutTime), lateByMinutes: saved.lateByMinutes };
    const label = person.fullName ?? person.email ?? person.mobile ?? person.id;
    await this.activity.log(actor, {
      module: 'attendance', action: 'attendance.manual_correction', entityType: 'attendance_record', entityId: saved.id, entityLabel: `${label} · ${dto.date}`,
      summary: `Set ${label}'s attendance on ${dto.date} to ${saved.status}${before ? ` (was ${before.status})` : ''}`,
      metadata: { userId: dto.userId, date: dto.date, before, after, note: dto.note },
    });
    await this.audit.log({ actorId: actor.id, action: 'attendance.manual_correction', resource: `attendance:${dto.userId}:${dto.date}`, metadata: { before, after, note: dto.note } });
    return this.dto(saved);
  }

  // ───────────────────────── holidays ─────────────────────────

  listHolidays(year?: number) {
    const y = year ?? Number(istDay(new Date()).slice(0, 4));
    return this.holidays.find({ where: { date: Between(`${y}-01-01`, `${y}-12-31`) }, order: { date: 'ASC' } });
  }

  async addHoliday(actor: AuthUser, dto: { date: string; name: string; applicableTo?: string }) {
    assertDay(dto.date);
    if (await this.holidays.findOneBy({ date: dto.date })) throw new ConflictException('That date is already a holiday');
    const saved = await this.holidays.save(this.holidays.create({ date: dto.date, name: dto.name.trim(), applicableTo: dto.applicableTo?.trim() || 'all' }));
    // Days already auto-marked Absent / Week-off by the system become a Holiday.
    await this.records
      .createQueryBuilder()
      .update()
      .set({ status: 'Holiday' })
      .where(`date = :d AND source = 'system' AND check_in_time IS NULL AND status IN ('Absent', 'WeekOff')`, { d: dto.date })
      .execute();
    await this.activity.log(actor, { module: 'attendance', action: 'attendance.holiday_added', entityType: 'holiday', entityId: saved.id, entityLabel: dto.date, summary: `Added holiday ${dto.name} on ${dto.date}` });
    return saved;
  }

  async removeHoliday(actor: AuthUser, id: string) {
    const h = await this.holidays.findOneBy({ id });
    if (!h) throw new NotFoundException('Holiday not found');
    await this.holidays.remove(h);
    // System-marked Holiday rows for that date are dropped so the day is worked out again.
    await this.records.createQueryBuilder().delete().where(`date = :d AND status = 'Holiday' AND source = 'system'`, { d: h.date }).execute();
    await this.activity.log(actor, { module: 'attendance', action: 'attendance.holiday_removed', entityType: 'holiday', entityId: id, entityLabel: h.date, summary: `Removed holiday ${h.name} on ${h.date}` });
    return { message: 'Holiday removed' };
  }

  // ───────────────────────── used by leave approval ─────────────────────────

  /** Marks these days On Leave. A day the person already checked in on keeps its times. */
  async markLeave(userId: string, days: string[]) {
    if (!days.length) return;
    const existing = await this.records.find({ where: { userId, date: In(days) } });
    const have = new Map(existing.map((r) => [r.date, r] as const));
    const rows = days.map((d) => {
      const r = have.get(d) ?? this.records.create({ userId, date: d });
      r.status = 'OnLeave'; r.source = 'leave'; r.lateByMinutes = 0; r.missedCheckout = false;
      return r;
    });
    await this.records.save(rows);
  }

  /** A person's own record for each day, for the calendar overlay. */
  recordsFor(userIds: string[], from: string, to: string) {
    return userIds.length ? this.records.find({ where: { userId: In(userIds), date: Between(from, to) }, order: { date: 'ASC' } }) : Promise.resolve([]);
  }

  staffList(ids?: string[]) {
    return this.staff(ids);
  }
}
