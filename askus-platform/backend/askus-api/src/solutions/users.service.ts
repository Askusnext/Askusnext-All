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
import { StaffHierarchyService } from './staff-hierarchy.service';
import { StaffRole, TmsRole, toTmsRole } from './tms-role';

// Re-exported so existing imports from './users.service' keep working.
export type { TmsRole, StaffRole };
export { toTmsRole };

const FROM_TMS: Record<StaffRole, Role> = {
  Admin: Role.Admin,
  Employee: Role.Employee,
  Agent: Role.Agent,
};

const AADHAAR_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const AADHAAR_MAX_BYTES = 5 * 1024 * 1024;
const AADHAAR_KEY = /^aadhaar\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;
const PAN_NUMBER = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PAN_KEY = /^pan\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

const maskPan = (n: string) => `${n.slice(0, 2)}******${n.slice(-2)}`;

export const toTmsUser = (u: User) => ({
  id: u.id,
  name: u.fullName ?? u.email ?? u.mobile ?? 'User',
  email: u.email,
  mobile: u.mobile,
  role: toTmsRole(u.roles),
  permissions: u.permissions ?? [],
  hasAadhaar: !!u.aadhaarKey,
  hasPan: !!u.panKey,
  panMasked: u.panNumber ? maskPan(u.panNumber) : null,
  approvalStatus: u.approvalStatus,
  createdBy: u.createdBy,
  reportingAdminId: u.reportingAdminId,
  branchId: 'branch-001',
});

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly hierarchy: StaffHierarchyService,
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

  private async getManaged(actor: AuthUser, id: string, allowRequest = false) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    if (allowRequest && user.approvalStatus === 'PENDING' && user.roles.every((r) => r === Role.Customer)) return user;
    const role = toTmsRole(user.roles);
    if (role === 'SuperAdmin' || role === 'Customer' || !this.assignable(actor).includes(role)) {
      throw new ForbiddenException('You cannot manage this user');
    }
    // An Admin reaches only their own reports, or staff they created themselves (not yet assigned). Other Admins' people look absent.
    if (!actor.roles.includes(Role.SuperAdmin) && user.reportingAdminId !== actor.id && user.createdBy !== actor.id) {
      throw new NotFoundException('Not found');
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
    const me = await this.hierarchy.viewer(actor);
    if (!me) throw new ForbiddenException();
    // Employees/Agents holding the 'users' permission see only themselves; peers are not exposed.
    if (me.role === 'Employee' || me.role === 'Agent') return (await this.users.find({ where: { id: me.id } })).map(toTmsUser);
    const roles = this.assignable(actor).map((r) => FROM_TMS[r]);
    const qb = this.users
      .createQueryBuilder('u')
      .where("(u.isActive = true OR u.approvalStatus = 'PENDING')")
      .andWhere(
        '(' + roles.map((_, i) => `u.roles LIKE :r${i}`).join(' OR ') + ` OR u.approvalStatus = 'PENDING')`,
        Object.fromEntries(roles.map((r, i) => [`r${i}`, `%${r}%`])),
      );
    // An Admin sees their own reports, people they created, and pending access requests to review; never other Admins' teams.
    if (me.role === 'Admin') qb.andWhere("(u.reportingAdminId = :me OR u.createdBy = :me OR u.approvalStatus = 'PENDING')", { me: me.id });
    const rows = await qb.orderBy('u.createdAt', 'ASC').getMany();
    return rows.map(toTmsUser);
  }

  /** Signed upload URL for a private Aadhaar document; the returned key is then passed to create(). */
  aadhaarUploadUrl(body: { contentType: string; size: number }) {
    return this.documentUploadUrl('aadhaar', 'Aadhaar', body);
  }

  panUploadUrl(body: { contentType: string; size: number }) {
    return this.documentUploadUrl('pan', 'PAN', body);
  }

  private documentUploadUrl(prefix: 'aadhaar' | 'pan', label: string, body: { contentType: string; size: number }) {
    const ext = AADHAAR_TYPES[body.contentType];
    if (!ext) throw new BadRequestException(`${label} must be a JPG, PNG or PDF`);
    if (body.size > AADHAAR_MAX_BYTES) throw new BadRequestException(`${label} file must be 5 MB or smaller`);
    const key = `${prefix}/${randomUUID()}.${ext}`;
    return { key, uploadUrl: this.storage.signUpload(key, body.contentType, body.size) };
  }

  async aadhaarDownloadUrl(actor: AuthUser, id: string) {
    const user = await this.getManaged(actor, id, true);
    if (!user.aadhaarKey) throw new NotFoundException('No Aadhaar uploaded');
    await this.audit.log({ actorId: actor.id, action: 'staff.aadhaar.view', resource: `user:${id}` });
    return { url: this.storage.signDownload(user.aadhaarKey, `aadhaar-${id}`) };
  }

  private cleanPanNumber(raw: string) {
    const pan = raw.trim().toUpperCase();
    if (!PAN_NUMBER.test(pan)) throw new BadRequestException('Enter a valid PAN number (for example ABCDE1234F)');
    return pan;
  }

  // The key must come from pan-upload-url and not already belong to anyone, so one user's file cannot be claimed or deleted via another.
  private async assertPanKeyFree(key: string, exceptUserId?: string) {
    if (!PAN_KEY.test(key)) throw new BadRequestException('Upload the PAN image first');
    const owner = await this.users.findOne({ where: { panKey: key } });
    if (owner && owner.id !== exceptUserId) throw new ConflictException('This PAN image is already in use');
  }

  /** Full PAN number and a signed link to its image; Admin/Super Admin only, and audited. */
  async panDetails(actor: AuthUser, id: string) {
    const user = await this.getManaged(actor, id);
    await this.audit.log({ actorId: actor.id, action: 'staff.pan.view', resource: `user:${id}` });
    return {
      panNumber: user.panNumber,
      url: user.panKey ? this.storage.signDownload(user.panKey, `pan-${id}`) : null,
    };
  }

  async updatePan(actor: AuthUser, id: string, body: { panNumber?: string; panKey?: string }) {
    const user = await this.getManaged(actor, id);
    if (body.panNumber === undefined && body.panKey === undefined) throw new BadRequestException('Nothing to update');

    if (body.panNumber !== undefined) user.panNumber = this.cleanPanNumber(body.panNumber);
    let replaced: string | null = null;
    if (body.panKey !== undefined && body.panKey !== user.panKey) {
      await this.assertPanKeyFree(body.panKey, id);
      replaced = user.panKey;
      user.panKey = body.panKey;
    }
    await this.users.save(user);
    if (replaced) await this.storage.delete(replaced);
    await this.audit.log({ actorId: actor.id, action: 'staff.pan.update', resource: `user:${id}` });
    return toTmsUser(user);
  }

  async deletePan(actor: AuthUser, id: string) {
    const user = await this.getManaged(actor, id);
    // Remove the stored file first: if that fails nothing has changed and the delete can be retried.
    if (user.panKey) await this.storage.delete(user.panKey);
    user.panNumber = null;
    user.panKey = null;
    await this.users.save(user);
    await this.audit.log({ actorId: actor.id, action: 'staff.pan.delete', resource: `user:${id}` });
    return toTmsUser(user);
  }

  async create(
    actor: AuthUser,
    body: {
      name: string;
      email: string;
      mobile?: string;
      role: StaffRole;
      aadhaarKey: string;
      panNumber: string;
      panKey: string;
      permissions?: string[];
      password?: string;
    },
  ) {
    if (!this.assignable(actor).includes(body.role)) throw new ForbiddenException(`You cannot create a ${body.role}`);
    if (!AADHAAR_KEY.test(body.aadhaarKey)) throw new BadRequestException('Upload the Aadhaar document first');
    const panNumber = this.cleanPanNumber(body.panNumber);
    await this.assertPanKeyFree(body.panKey);
    const isSuper = actor.roles.includes(Role.SuperAdmin);
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
        // Contacts entered by an Admin/Super Admin are trusted, so no first-time OTP check is needed.
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: mobile ? new Date() : null,
        roles: [FROM_TMS[body.role]],
        permissions,
        aadhaarKey: body.aadhaarKey,
        panNumber,
        panKey: body.panKey,
        createdBy: actor.id,
        // Admins need a Super Admin's sign-off; Super Admin creations are live immediately.
        approvalStatus: isSuper ? 'APPROVED' : 'PENDING',
        isActive: isSuper,
        passwordHash: body.password ? await hashPassword(body.password) : null,
      }),
    );
    await this.audit.log({
      actorId: actor.id,
      action: isSuper ? 'staff.create' : 'staff.request',
      resource: `user:${user.id}`,
      metadata: { role: body.role },
    });
    return toTmsUser(user);
  }

  /** Super Admin only: staff created by Admins that are waiting for sign-off. */
  async findPending() {
    const rows = await this.users.find({ where: { approvalStatus: 'PENDING' }, order: { createdAt: 'ASC' } });
    return rows.map(toTmsUser);
  }

  /**
   * Approve or reject a pending account. Staff an Admin created need a Super Admin; a self-service
   * access request (a Customer who asked for staff access) can be reviewed by an Admin too, and
   * approval picks the role and permissions.
   */
  async review(actor: AuthUser, id: string, approve: boolean, body: { role?: StaffRole; permissions?: string[] } = {}) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Not found');
    if (user.approvalStatus !== 'PENDING') throw new BadRequestException('This request is not pending');

    const selfRequest = !user.createdBy && user.roles.every((r) => r === Role.Customer);
    if (!selfRequest && !actor.roles.includes(Role.SuperAdmin)) {
      throw new ForbiddenException('Only a Super Admin can review this account');
    }

    if (selfRequest && approve) {
      if (!body.role) throw new BadRequestException('Choose a role for this person');
      if (!this.assignable(actor).includes(body.role)) throw new ForbiddenException(`You cannot assign ${body.role}`);
      user.roles = [FROM_TMS[body.role]];
      user.permissions = this.cleanPermissions(body.role, body.permissions);
      user.isActive = true;
    } else if (!selfRequest) {
      user.isActive = approve;
    }
    user.approvalStatus = approve ? 'APPROVED' : 'REJECTED';
    await this.users.save(user);
    await this.audit.log({
      actorId: actor.id,
      action: approve ? 'staff.approve' : 'staff.reject',
      resource: `user:${id}`,
      metadata: approve && selfRequest ? { role: body.role } : undefined,
    });
    return toTmsUser(user);
  }

  /** Self-service: a signed-in Customer asks for staff access. An Admin reviews it. */
  async requestAccess(
    actor: AuthUser,
    body: { name: string; email?: string; mobile?: string; aadhaarKey?: string },
  ) {
    const user = await this.users.findOne({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('Not found');
    if (user.roles.some((r) => r !== Role.Customer)) throw new BadRequestException('You already have staff access');
    if (user.approvalStatus === 'PENDING') throw new BadRequestException('Your request is already being reviewed');
    if (body.aadhaarKey && !AADHAAR_KEY.test(body.aadhaarKey)) throw new BadRequestException('Upload the Aadhaar document first');

    // The identity they signed in with is already verified by OTP; only fill in what is missing.
    if (!user.email) {
      if (!body.email) throw new BadRequestException('Enter your email address');
      const email = normalizeIdentifier(body.email);
      if (await this.users.findOne({ where: { email } })) throw new ConflictException('This email is already registered');
      user.email = email;
    }
    if (!user.mobile && body.mobile) {
      const mobile = normalizeIdentifier(body.mobile);
      if (await this.users.findOne({ where: { mobile } })) throw new ConflictException('This mobile number is already registered');
      user.mobile = mobile;
    }
    user.fullName = body.name.trim();
    if (body.aadhaarKey) user.aadhaarKey = body.aadhaarKey;
    user.approvalStatus = 'PENDING';
    await this.users.save(user);
    await this.audit.log({ actorId: actor.id, action: 'staff.access_request', resource: `user:${user.id}` });
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
    if (body.mobile !== undefined) {
      const mobile = normalizeIdentifier(body.mobile);
      // Admin-entered contacts are trusted; with the email already on file, the next sign-in is email OTP only.
      if (mobile !== user.mobile) user.mobileVerifiedAt = new Date();
      if (user.email && !user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      user.mobile = mobile;
    }
    const wasAdmin = toTmsRole(user.roles) === 'Admin';
    if (body.role) {
      user.roles = [FROM_TMS[body.role]];
      if (body.role === 'Admin') user.permissions = [];
    }
    const saved = await this.users.save(user);
    // Only Employees/Agents report to an Admin. Becoming an Admin drops the person's own Admin; ceasing to be one drops their reports.
    if (body.role === 'Admin') await this.hierarchy.clearLinks(actor.id, { subjectId: id }, 'Role changed to Admin');
    if (wasAdmin && body.role && body.role !== 'Admin') await this.hierarchy.clearLinks(actor.id, { adminId: id }, 'Admin role removed');
    return toTmsUser(saved);
  }

  async deactivate(actor: AuthUser, id: string) {
    await this.getManaged(actor, id);
    await this.users.update({ id }, { isActive: false });
    // A disabled Admin's reports become unassigned (audited), and a disabled person leaves their Admin's team.
    await this.hierarchy.clearLinks(actor.id, { adminId: id }, 'Admin deactivated');
    await this.hierarchy.clearLinks(actor.id, { subjectId: id }, 'Staff member deactivated');
    return { message: 'User deactivated' };
  }
}
