import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeIdentifier } from '../common/identifier';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';

export type TmsRole = 'Admin' | 'Employee' | 'Agent' | 'Customer';

const TO_TMS: Partial<Record<Role, TmsRole>> = {
  [Role.SuperAdmin]: 'Admin',
  [Role.Employee]: 'Employee',
  [Role.Agent]: 'Agent',
};
const FROM_TMS: Record<Exclude<TmsRole, 'Customer'>, Role> = {
  Admin: Role.SuperAdmin,
  Employee: Role.Employee,
  Agent: Role.Agent,
};

export const toTmsRole = (roles: Role[]): TmsRole =>
  (['Admin', 'Employee', 'Agent'] as const).find((r) => roles.some((x) => TO_TMS[x] === r)) ?? 'Customer';

export const toTmsUser = (u: User) => ({
  id: u.id,
  name: u.fullName ?? u.email ?? u.mobile ?? 'User',
  email: u.email,
  mobile: u.mobile,
  role: toTmsRole(u.roles),
  branchId: 'branch-001',
});

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    return toTmsUser(user);
  }

  async findStaff() {
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere(`(u.roles LIKE '%SUPER_ADMIN%' OR u.roles LIKE '%EMPLOYEE%' OR u.roles LIKE '%AGENT%')`)
      .orderBy('u.createdAt', 'ASC')
      .getMany();
    return rows.map(toTmsUser);
  }

  async create(body: { name: string; email?: string; mobile?: string; role: Exclude<TmsRole, 'Customer'> }) {
    const email = body.email ? normalizeIdentifier(body.email) : null;
    const mobile = body.mobile ? normalizeIdentifier(body.mobile) : null;
    const clash = await this.users.findOne({
      where: [...(email ? [{ email }] : []), ...(mobile ? [{ mobile }] : [])],
    });
    if (clash) throw new ConflictException('A user with this email or mobile already exists');

    const user = await this.users.save(
      this.users.create({ fullName: body.name, email, mobile, roles: [FROM_TMS[body.role]] }),
    );
    return toTmsUser(user);
  }

  async update(id: string, body: { name?: string; mobile?: string; role?: Exclude<TmsRole, 'Customer'> }) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    if (body.name !== undefined) user.fullName = body.name;
    if (body.mobile !== undefined) user.mobile = normalizeIdentifier(body.mobile);
    if (body.role) user.roles = [FROM_TMS[body.role]];
    return toTmsUser(await this.users.save(user));
  }

  async deactivate(id: string) {
    await this.users.update({ id }, { isActive: false });
    return { message: 'User deactivated' };
  }
}
