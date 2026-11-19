import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { User } from '../identity/identity.entities';
import { IDayEntry, Timesheet } from './solutions.entities';
import { StaffHierarchyService } from './staff-hierarchy.service';
import { toTmsRole } from './users.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every entry must fall inside the 7-day week that starts on `weekStart`. */
function assertEntriesInWeek(weekStart: string, entries: IDayEntry[]) {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(start)) throw new BadRequestException('Invalid week start.');
  const seen = new Set<string>();
  for (const e of entries) {
    const t = Date.parse(`${e.date}T00:00:00Z`);
    if (Number.isNaN(t) || t < start || t >= start + 7 * DAY_MS) {
      throw new BadRequestException(`${e.date} is outside the week starting ${weekStart}.`);
    }
    if (seen.has(e.date)) throw new BadRequestException(`${e.date} appears twice.`);
    seen.add(e.date);
  }
}

const displayName = (u: User) => u.fullName ?? u.email ?? u.mobile ?? u.id;
const displayId = (u: User) => u.email ?? u.mobile ?? u.id;

@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Timesheet) private readonly sheets: Repository<Timesheet>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly activity: ActivityService,
    private readonly hierarchy: StaffHierarchyService,
  ) {}

  /** null = everyone (Super Admin); otherwise the ids this actor may see. Employees and Agents get only themselves. */
  private async scope(actor: AuthUser): Promise<string[] | null> {
    const s = await this.hierarchy.staffScope(actor);
    return s.all ? null : s.ids.length ? s.ids : [actor.id];
  }

  async findAll(weekStart: string | undefined, user: AuthUser) {
    const scope = await this.scope(user);
    return this.sheets.find({
      where: {
        ...(weekStart ? { weekStart } : {}),
        ...(scope ? { userId: In(scope) } : {}),
      },
      order: { weekStart: 'DESC' },
    });
  }

  /**
   * One row per staff member for a week, with that week's entries (empty if nothing was entered yet).
   * Admins and employees see the whole team; an agent sees only themselves.
   */
  async week(weekStart: string, user: AuthUser) {
    const scope = await this.scope(user);
    const qb = this.users
      .createQueryBuilder('u')
      .where(`u.roles ~ '(^|,)(SUPER_ADMIN|ADMIN|EMPLOYEE|AGENT)(,|$)'`)
      .andWhere('u.isActive = true');
    if (scope) qb.andWhere('u.id IN (:...scope)', { scope });
    const staff: User[] = await qb.orderBy('u.fullName', 'ASC', 'NULLS LAST').getMany();
    const sheets = staff.length ? await this.sheets.find({ where: { weekStart, userId: In(staff.map((s) => s.id)) } }) : [];
    const byUser = new Map(sheets.map((s) => [s.userId, s]));
    return staff.map((u) => ({
      userId: u.id,
      employeeName: displayName(u),
      employeeId: displayId(u),
      role: toTmsRole(u.roles),
      sheetId: byUser.get(u.id)?.id ?? null,
      entries: byUser.get(u.id)?.entries ?? [],
    }));
  }

  private async save(account: User, weekStart: string, entries: IDayEntry[]) {
    assertEntriesInWeek(weekStart, entries);
    const existing = await this.sheets.findOne({ where: { userId: account.id, weekStart } });
    if (existing) {
      existing.entries = entries;
      existing.employeeName = displayName(account);
      existing.role = toTmsRole(account.roles);
      return this.sheets.save(existing);
    }
    return this.sheets.save(
      this.sheets.create({
        userId: account.id,
        employeeName: displayName(account),
        employeeId: displayId(account),
        role: toTmsRole(account.roles),
        weekStart,
        entries,
      }),
    );
  }

  /** Sets one day of one person's timesheet, creating the week if needed (used by work-session tracking). */
  async recordDay(account: User, date: string, status: IDayEntry['status'], hours: number) {
    const d = new Date(`${date}T00:00:00Z`);
    const weekStart = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
    const existing = await this.sheets.findOne({ where: { userId: account.id, weekStart } });
    const entries = (existing?.entries ?? []).filter((e) => e.date !== date);
    entries.push({ date, status, hours });
    entries.sort((x, y) => x.date.localeCompare(y.date));
    return this.save(account, weekStart, entries);
  }

  async upsert(user: AuthUser, weekStart: string, entries: IDayEntry[]) {
    const account = await this.users.findOneBy({ id: user.id });
    if (!account) throw new NotFoundException('Account not found');
    const saved = await this.save(account, weekStart, entries);
    await this.activity.log(user, {
      module: 'timesheet', action: 'timesheet.saved', entityType: 'timesheet', entityId: `${account.id}/${weekStart}`, entityLabel: `Week of ${weekStart}`,
      summary: `Saved own timesheet for the week of ${weekStart} (${entries.reduce((h, e) => h + e.hours, 0)} h)`,
    });
    return saved;
  }

  /** An admin or employee records attendance for someone else. */
  async upsertFor(actor: AuthUser, userId: string, weekStart: string, entries: IDayEntry[]) {
    const scope = await this.scope(actor);
    if (scope && !scope.includes(userId)) throw new NotFoundException('Staff member not found');
    const account = await this.users.findOneBy({ id: userId });
    if (!account) throw new NotFoundException('Staff member not found');
    const saved = await this.save(account, weekStart, entries);
    await this.activity.log(actor, {
      module: 'timesheet', action: 'timesheet.recorded_for', entityType: 'timesheet', entityId: `${account.id}/${weekStart}`, entityLabel: `${displayName(account)}, week of ${weekStart}`,
      summary: `Recorded attendance for ${displayName(account)}, week of ${weekStart} (${entries.reduce((h, e) => h + e.hours, 0)} h)`,
    });
    return saved;
  }

  async update(id: string, entries: IDayEntry[], user: AuthUser) {
    const sheet = await this.sheets.findOne({ where: { id } });
    if (!sheet) throw new NotFoundException('Not found');
    const scope = await this.scope(user);
    if (scope && !scope.includes(sheet.userId)) throw new NotFoundException('Not found');
    assertEntriesInWeek(sheet.weekStart, entries);
    sheet.entries = entries;
    return this.sheets.save(sheet);
  }
}
