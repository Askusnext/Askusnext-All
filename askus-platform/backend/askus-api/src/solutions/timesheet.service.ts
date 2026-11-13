import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { IDayEntry, Timesheet } from './solutions.entities';
import { toTmsRole } from './users.service';

const canSeeAll = (u: AuthUser) => u.roles.includes(Role.SuperAdmin) || u.roles.includes(Role.Employee);

@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Timesheet) private readonly sheets: Repository<Timesheet>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findAll(weekStart: string | undefined, user: AuthUser) {
    return this.sheets.find({
      where: {
        ...(weekStart ? { weekStart } : {}),
        ...(canSeeAll(user) ? {} : { userId: user.id }),
      },
      order: { weekStart: 'DESC' },
    });
  }

  async upsert(user: AuthUser, weekStart: string, entries: IDayEntry[]) {
    const existing = await this.sheets.findOne({ where: { userId: user.id, weekStart } });
    if (existing) {
      existing.entries = entries;
      return this.sheets.save(existing);
    }
    const account = await this.users.findOne({ where: { id: user.id } });
    return this.sheets.save(
      this.sheets.create({
        userId: user.id,
        employeeName: account?.fullName ?? user.name,
        employeeId: account?.email ?? account?.mobile ?? user.id,
        role: toTmsRole(user.roles),
        weekStart,
        entries,
      }),
    );
  }

  async update(id: string, entries: IDayEntry[], user: AuthUser) {
    const sheet = await this.sheets.findOne({ where: { id } });
    if (!sheet) throw new NotFoundException('Not found');
    if (!canSeeAll(user) && sheet.userId !== user.id) throw new ForbiddenException();
    sheet.entries = entries;
    return this.sheets.save(sheet);
  }
}
