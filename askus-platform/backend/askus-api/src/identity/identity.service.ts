import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { normalizeIdentifier } from '../common/identifier';
import { verifyAgainstDummy, verifyPassword } from '../common/password';
import { Role } from '../common/roles';
import { ActivityService } from '../activity/activity.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { OtpCode, Session, User } from './identity.entities';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// A sign-in lasts 12 hours in total: refresh rotation never extends it.
const REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;
const PASSWORD_MAX_FAILURES = 5;
const PASSWORD_LOCK_MS = 15 * 60 * 1000;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
};

// +919876543210 -> +91 ******3210
const maskMobile = (mobile: string) => `${mobile.slice(0, 3)} ${'*'.repeat(Math.max(mobile.length - 7, 1))}${mobile.slice(-4)}`;

// WhatsApp messages cost money and can be abused to pester a stranger, so a number gets only a few per window.
const WHATSAPP_MAX_PER_WINDOW = 5;
const WHATSAPP_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class IdentityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityService.name);
  private readonly whatsappSends = new Map<string, number[]>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  // Without this, a fresh database has no staff able to sign in. Each env var is a comma-separated
  // list of emails/mobiles; 
  async onApplicationBootstrap() {
    if (this.config.get<string>('DUMMY_OTP_CODE')) this.logger.warn('DUMMY_OTP_CODE is set: logins use a fixed test code. Do not use this for real customers.');
    const seeds: [string, Role[]][] = [
      ['SUPER_ADMIN_IDENTIFIER', [Role.SuperAdmin]],
      ['ADMIN_IDENTIFIERS', [Role.Admin]],
      ['EMPLOYEE_IDENTIFIERS', [Role.Employee]],
      ['AGENT_IDENTIFIERS', [Role.Agent]],
    ];
    for (const [key, roles] of seeds) {
      const raw = this.config.get<string>(key);
      for (const entry of (raw ?? '').split(',').map((v) => v.trim()).filter(Boolean)) {
        const user = await this.findOrCreateUser(normalizeIdentifier(entry));
        const missing = roles.filter((r) => !user.roles.includes(r));
        if (!missing.length) continue;
        user.roles = [...user.roles, ...missing];
        await this.users.save(user);
        this.logger.log(`Granted ${missing.join(',')} to ${entry}`);
      }
    }
  }

  // A fully verified account gets a single email OTP (no SMS cost). Until both mobile and email are
  // proven, the first sign-in needs an OTP on each; `needs` tells the client which contact to ask for.
  /** Whether the sign-in screens may offer "Get code on WhatsApp". */
  whatsappAvailable() {
    return this.notifications.whatsappAvailable();
  }

  /**
   * `channel: 'whatsapp'` asks for the mobile code to arrive on WhatsApp instead of SMS (first sign-in) or instead
   * of email (later sign-ins). If WhatsApp cannot deliver, the code goes by SMS or email as before and the answer
   * says so (`whatsappFailed`), so a customer is never left waiting for a message that was not sent.
   */
  async requestOtp(rawIdentifier: string, app?: 'staff', rawOther?: string, channel?: 'whatsapp') {
    const identifier = normalizeIdentifier(rawIdentifier);
    const existing = await this.findByIdentifier(identifier);
    const wantsWhatsApp = channel === 'whatsapp';

    // Staff sign-in: someone whose request is still waiting (or was declined) is told so up front
    // instead of being sent a code that cannot get them in. Only these two states are revealed.
    if (app === 'staff' && existing && (existing.approvalStatus === 'PENDING' || existing.approvalStatus === 'REJECTED')) {
      return { sent: false, status: existing.approvalStatus };
    }

    if (existing?.mobileVerifiedAt && existing.emailVerifiedAt && existing.email) {
      // A verified account may take its code on WhatsApp, at the mobile number already on the account.
      if (wantsWhatsApp && existing.mobile && this.notifications.whatsappAvailable()) {
        this.takeWhatsAppSlot(existing.mobile);
        if (await this.sendOtp(identifier, 'whatsapp', existing.mobile)) {
          return { sent: true, channels: ['whatsapp'] as ('sms' | 'email' | 'whatsapp')[], mobileHint: maskMobile(existing.mobile) };
        }
      }
      await this.sendOtp(identifier, 'email', existing.email);
      return {
        sent: true,
        channels: ['email'] as ('sms' | 'email' | 'whatsapp')[],
        emailHint: maskEmail(existing.email),
        ...(wantsWhatsApp ? { whatsappFailed: true } : {}),
      };
    }

    const other = await this.resolveOtherContact(identifier, existing, rawOther);
    if (!other) return { sent: false, needs: identifier.includes('@') ? ('mobile' as const) : ('email' as const) };

    // First sign-in: one code to the mobile (WhatsApp or SMS) and one to the email.
    const mobile = identifier.includes('@') ? other : identifier;
    const email = identifier.includes('@') ? identifier : other;
    // Each code is stored under the contact it was sent to, which is what verifyOtp checks it against.
    const mobileChannel = await this.sendMobileOtp(mobile, mobile, wantsWhatsApp);
    await this.sendOtp(email, 'email', email);
    return {
      sent: true,
      channels: [mobileChannel.channel, 'email'] as ('sms' | 'email' | 'whatsapp')[],
      ...(wantsWhatsApp && mobileChannel.channel !== 'whatsapp' ? { whatsappFailed: true } : {}),
    };
  }

  /** Sends the mobile code on WhatsApp when asked and possible, otherwise (or if WhatsApp fails) by SMS. */
  private async sendMobileOtp(key: string, mobile: string, viaWhatsApp: boolean): Promise<{ channel: 'whatsapp' | 'sms' }> {
    if (viaWhatsApp && this.notifications.whatsappAvailable()) {
      this.takeWhatsAppSlot(mobile);
      if (await this.sendOtp(key, 'whatsapp', mobile)) return { channel: 'whatsapp' };
    }
    await this.sendOtp(key, 'sms', mobile);
    return { channel: 'sms' };
  }

  /** Counts a WhatsApp send against the number; refuses once it has had its share for the window. */
  private takeWhatsAppSlot(mobile: string) {
    const now = Date.now();
    const recent = (this.whatsappSends.get(mobile) ?? []).filter((t) => now - t < WHATSAPP_WINDOW_MS);
    if (recent.length >= WHATSAPP_MAX_PER_WINDOW) {
      this.whatsappSends.set(mobile, recent);
      throw new HttpException('Too many WhatsApp codes for this number. Try again in a few minutes, or use SMS or email.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.whatsappSends.set(mobile, recent);
    // keep the map small
    if (this.whatsappSends.size > 5000) for (const [k, v] of this.whatsappSends) if (!v.some((t) => now - t < WHATSAPP_WINDOW_MS)) this.whatsappSends.delete(k);
  }

  /**
   * Test mode: when DUMMY_OTP_CODE is set (for example 123456) every login uses that code and no SMS is needed.
   * Outside production it applies to every identifier. In production it applies only to mobile numbers of
   * customer-only accounts, so a staff account (admin, employee, agent) can never be opened with a known code.
   */
  private async dummyCode(identifier: string): Promise<string | null> {
    const code = this.config.get<string>('DUMMY_OTP_CODE')?.trim();
    if (!code) return null;
    if (!/^\d{6}$/.test(code)) {
      this.logger.warn('DUMMY_OTP_CODE must be exactly 6 digits; ignoring it.');
      return null;
    }
    if (this.config.get<string>('NODE_ENV') !== 'production') return code;
    if (identifier.includes('@')) return null;
    const user = await this.users.findOne({ where: { mobile: identifier } });
    const staff = user?.roles.some((r) => r !== Role.Customer) ?? false;
    return staff ? null : code;
  }

  async verifyOtp(rawIdentifier: string, code: string, rawOther?: string, otherCode?: string) {
    const identifier = normalizeIdentifier(rawIdentifier);
    let user = await this.findByIdentifier(identifier);

    if (user?.mobileVerifiedAt && user.emailVerifiedAt) {
      const otp = await this.checkOtp(identifier, code);
      otp.consumed = true;
      await this.otps.save(otp);
    } else {
      if (!otherCode) throw new BadRequestException('Enter the codes sent to both your mobile and email');
      const other = await this.resolveOtherContact(identifier, user, rawOther);
      if (!other) throw new UnauthorizedException('Invalid or expired code');

      // Both must pass before either is consumed, so one typo does not burn the other code.
      const first = await this.checkOtp(identifier, code);
      const second = await this.checkOtp(other, otherCode);
      first.consumed = second.consumed = true;
      await this.otps.save([first, second]);

      const email = identifier.includes('@') ? identifier : other;
      const mobile = identifier.includes('@') ? other : identifier;
      const now = new Date();
      user = user ?? this.users.create({ roles: [Role.Customer] });
      user.email = email;
      user.mobile = mobile;
      user.emailVerifiedAt = now;
      user.mobileVerifiedAt = now;
      user = await this.users.save(user);
    }

    if (user.approvalStatus === 'PENDING' && user.roles.some((r) => r !== Role.Customer)) throw new ForbiddenException('Awaiting Super Admin approval');
    if (!user.isActive) throw new ForbiddenException('Account disabled');

    await this.audit.log({ actorId: user.id, action: 'auth.login', resource: `user:${user.id}` });
    // customers sign in all the time; only staff sign-ins go to the activity screen
    if (user.roles.some((r) => r !== Role.Customer)) {
      await this.activity.log({ id: user.id, name: user.fullName ?? user.email ?? user.mobile ?? 'User', roles: user.roles }, { module: 'auth', action: 'auth.login', summary: 'Signed in' });
    }
    return this.issueTokens(user, randomUUID());
  }

  // Mobile number (or email) + password. One generic error for every failure so the response
  // never reveals whether an account exists; repeated failures lock the account for a while.
  async loginWithPassword(rawIdentifier: string, password: string) {
    const identifier = normalizeIdentifier(rawIdentifier);
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where(identifier.includes('@') ? 'u.email = :id' : 'u.mobile = :id', { id: identifier })
      .getOne();

    if (!user || !user.passwordHash || !user.isActive) {
      await verifyAgainstDummy(password);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      user.failedLogins += 1;
      if (user.failedLogins >= PASSWORD_MAX_FAILURES) {
        user.lockedUntil = new Date(Date.now() + PASSWORD_LOCK_MS);
        user.failedLogins = 0;
      }
      await this.users.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLogins !== 0 || user.lockedUntil) {
      user.failedLogins = 0;
      user.lockedUntil = null;
      await this.users.save(user);
    }
    await this.audit.log({ actorId: user.id, action: 'auth.login.password', resource: `user:${user.id}` });
    return this.issueTokens(user, randomUUID());
  }

  async refresh(refreshToken: string) {
    const session = await this.sessions.findOne({ where: { refreshHash: sha256(refreshToken) } });
    if (!session) throw new UnauthorizedException();

    // A revoked token being replayed means the family may be stolen: revoke all of it.
    if (session.revokedAt) {
      await this.sessions.update({ familyId: session.familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new UnauthorizedException();
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException();

    session.revokedAt = new Date();
    await this.sessions.save(session);

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return this.issueTokens(user, session.familyId, session.expiresAt);
  }

  async logout(refreshToken: string) {
    await this.sessions.update({ refreshHash: sha256(refreshToken), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  // sessionEnd carries the original sign-in expiry through refresh rotations.
  private async issueTokens(user: User, familyId: string, sessionEnd?: Date) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      roles: user.roles,
      permissions: user.permissions ?? [],
      name: user.fullName ?? user.email ?? user.mobile ?? 'User',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        familyId,
        refreshHash: sha256(refreshToken),
        expiresAt: sessionEnd ?? new Date(Date.now() + REFRESH_TTL_MS),
        revokedAt: null,
      }),
    );
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  private findByIdentifier(identifier: string) {
    return this.users.findOne({ where: identifier.includes('@') ? { email: identifier } : { mobile: identifier } });
  }

  // The contact of the other kind: the one already on the account, else the one the client supplied.
  // Returns null when it is still unknown. A contact owned by a different account is rejected.
  private async resolveOtherContact(identifier: string, existing: User | null, rawOther?: string) {
    const isEmail = identifier.includes('@');
    const stored = isEmail ? existing?.mobile : existing?.email;
    if (stored) return stored;
    if (!rawOther) return null;

    const other = normalizeIdentifier(rawOther);
    if (other.includes('@') === isEmail) {
      throw new BadRequestException(isEmail ? 'Enter a mobile number' : 'Enter an email address');
    }
    if (await this.findByIdentifier(other)) {
      throw new ConflictException(`This ${isEmail ? 'mobile number' : 'email'} is already registered`);
    }
    return other;
  }

  private async sendOtp(key: string, channel: 'sms' | 'email' | 'whatsapp', to: string): Promise<boolean> {
    const code = (await this.dummyCode(key)) ?? String(randomInt(100000, 1000000));
    await this.otps.save(
      this.otps.create({
        identifier: key,
        codeHash: this.hashOtp(key, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      }),
    );
    return this.notifications.send({
      channel,
      to,
      message: `Your AskUs verification code is ${code}. It is valid for 5 minutes.`,
      otp: code,
    });
  }

  private async checkOtp(identifier: string, code: string) {
    const otp = await this.otps.findOne({
      where: { identifier, consumed: false, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw new UnauthorizedException('Invalid or expired code');

    const expected = Buffer.from(otp.codeHash);
    const actual = Buffer.from(this.hashOtp(identifier, code));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      otp.attempts += 1;
      await this.otps.save(otp);
      throw new UnauthorizedException('Invalid or expired code');
    }
    return otp;
  }

  private async findOrCreateUser(identifier: string) {
    const isEmail = identifier.includes('@');
    const existing = await this.users.findOne({ where: isEmail ? { email: identifier } : { mobile: identifier } });
    if (existing) return existing;
    return this.users.save(
      this.users.create(
        isEmail
          ? { email: identifier, roles: [Role.Customer] }
          : { mobile: identifier, roles: [Role.Customer] },
      ),
    );
  }

  private hashOtp(identifier: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('OTP_SECRET'))
      .update(`${identifier}:${code}`)
      .digest('hex');
  }
}
