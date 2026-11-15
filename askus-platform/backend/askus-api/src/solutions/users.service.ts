import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { normalizeIdentifier } from '../common/identifier';
import { hashPassword } from '../common/password';
import { PERMISSIONS, Role } from '../common/roles';
import { AuditService } from '../audit/audit.service';
import { User } from '../identity/identity.entities';
import { StorageService } from '../storage/storage.service';

export type TmsRole = 'SuperAdmin' | 'Admin' | 'Employee' | 'Agent' | 'Customer';
export type StaffRole = Exclude<TmsRole, 'SuperAdmin' | 'Customer'>;

const TO_TMS: Partial<Record<Role, TmsRole>> = {
  [Role.SuperAdmin]: 'SuperAdmin',
  [Role.Admin]: 'Admin',
  [Role.Employee]: 'Employee',
  [Role.Agent]: 'Agent',
};
const FROM_TMS: Record<StaffRole, Role> = {
  Admin: Role.Admin,
  Employee: Role.Employee,
  Agent: Role.Agent,
};

const AADHAAR_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const AADHAAR_MAX_BYTES = 5 * 1024 * 1024;
const AADHAAR_KEY = /^aadhaar\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export const toTmsRole = (roles: Role[]): TmsRole =>
  (['SuperAdmin', 'Admin', 'Employee', 'Agent'] as const).find((r) => roles.some((x) => TO_TMS[x] === r)) ?? 'Customer';

export const toTmsUser = (u: User) => ({
  id: u.id,
  name: u.fullName ?? u.email ?? u.mobile ?? 'User',
  email: u.email,
  mobile: u.mobile,
  role: toTmsRole(u.roles),
  permissions: u.permissions ?? [],
  hasAadhaar: !!u.aadhaarKey,
  branchId: 'branch-001',
});

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    return toTmsUser(user);
  }

  // Super Admin may manage Admins, Employees and Agents; Admin only Employees and Agents.
  private assignable(actor: AuthUser): StaffRole[] {
    return actor.roles.includes(Role.SuperAdmin) ? ['Admin', 'Employee', 'Agent'] : ['Employee', 'Agent'];
  }

  private async getManaged(actor: AuthUser, id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    const role = toTmsRole(user.roles);
    if (role === 'SuperAdmin' || role === 'Customer' || !this.assignable(actor).includes(role)) {
      throw new ForbiddenException('You cannot manage this user');
    }
    return user;
  }

  private cleanPermissions(role: StaffRole, permissions?: string[]) {
    if (role === 'Admin') return [];
    const bad = (permissions ?? []).filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
    if (bad.length) throw new BadRequestException(`Unknown permission: ${bad.join(', ')}`);
    return [...new Set(permissions ?? [])];
  }

  async findStaff(actor: AuthUser) {
    const roles = this.assignable(actor).map((r) => FROM_TMS[r]);
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere(
        '(' + roles.map((_, i) => `u.roles LIKE :r${i}`).join(' OR ') + ')',
        Object.fromEntries(roles.map((r, i) => [`r${i}`, `%${r}%`])),
      )
      .orderBy('u.createdAt', 'ASC')
      .getMany();
    return rows.map(toTmsUser);
  }

  /** Signed upload URL for a private Aadhaar document; the returned key is then passed to create(). */
  aadhaarUploadUrl(body: { contentType: string; size: number }) {
    const ext = AADHAAR_TYPES[body.contentType];
    if (!ext) throw new BadRequestException('Aadhaar must be a JPG, PNG or PDF');
    if (body.size > AADHAAR_MAX_BYTES) throw new BadRequestException('Aadhaar file must be 5 MB or smaller');
    const key = `aadhaar/${randomUUID()}.${ext}`;
    return { key, uploadUrl: this.storage.signUpload(key, body.contentType, body.size) };
  }

  async aadhaarDownloadUrl(actor: AuthUser, id: string) {
    const user = await this.getManaged(actor, id);
    if (!user.aadhaarKey) throw new NotFoundException('No Aadhaar uploaded');
    await this.audit.log({ actorId: actor.id, action: 'staff.aadhaar.view', resource: `user:${id}` });
    return { url: this.storage.signDownload(user.aadhaarKey, `aadhaar-${id}`) };
  }

  async create(
    actor: AuthUser,
    body: {
      name: string;
      email: string;
      mobile?: string;
      role: StaffRole;
      aadhaarKey: string;
      permissions?: string[];
      password?: string;
    },
  ) {
    if (!this.assignable(actor).includes(body.role)) throw new ForbiddenException(`You cannot create a ${body.role}`);
    if (!AADHAAR_KEY.test(body.aadhaarKey)) throw new BadRequestException('Upload the Aadhaar document first');
    const permissions = this.cleanPermissions(body.role, body.permissions);
    const email = normalizeIdentifier(body.email);
    const mobile = body.mobile ? normalizeIdentifier(body.mobile) : null;
    const clash = await this.users.findOne({ where: [{ email }, ...(mobile ? [{ mobile }] : [])] });
    if (clash) throw new ConflictException('A user with this email or mobile already exists');

    const user = await this.users.save(
      this.users.create({
        fullName: body.name,
        email,
        mobile,
        roles: [FROM_TMS[body.role]],
        permissions,
        aadhaarKey: body.aadhaarKey,
        createdBy: actor.id,
        passwordHash: body.password ? await hashPassword(body.password) : null,
      }),
    );
    await this.audit.log({ actorId: actor.id, action: 'staff.create', resource: `user:${user.id}`, metadata: { role: body.role } });
    return toTmsUser(user);
  }

  // Sets (or replaces) a user's password and clears any lockout.
  async setPassword(actor: AuthUser, id: string, password: string) {
    const user = await this.getManaged(actor, id);
    user.passwordHash = await hashPassword(password);
    user.failedLogins = 0;
    user.lockedUntil = null;
    await this.users.save(user);
    return { message: 'Password updated' };
  }

  async setPermissions(actor: AuthUser, id: string, permissions: string[]) {
    const user = await this.getManaged(actor, id);
    user.permissions = this.cleanPermissions(toTmsRole(user.roles) as StaffRole, permissions);
    await this.users.save(user);
    await this.audit.log({
      actorId: actor.id,
      action: 'staff.permissions',
      resource: `user:${id}`,
      metadata: { permissions: user.permissions },
    });
    return toTmsUser(user);
  }

  async update(actor: AuthUser, id: string, body: { name?: string; mobile?: string; role?: StaffRole }) {
    const user = await this.getManaged(actor, id);
    if (body.role && !this.assignable(actor).includes(body.role)) throw new ForbiddenException(`You cannot assign ${body.role}`);
    if (body.name !== undefined) user.fullName = body.name;
    if (body.mobile !== undefined) user.mobile = normalizeIdentifier(body.mobile);
    if (body.role) {
      user.roles = [FROM_TMS[body.role]];
      if (body.role === 'Admin') user.permissions = [];
    }
    return toTmsUser(await this.users.save(user));
  }

  async deactivate(actor: AuthUser, id: string) {
    await this.getManaged(actor, id);
    await this.users.update({ id }, { isActive: false });
    return { message: 'User deactivated' };
  }
}
