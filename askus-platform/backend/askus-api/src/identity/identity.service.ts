import { ForbiddenException, Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { normalizeIdentifier } from '../common/identifier';
import { Role } from '../common/roles';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { OtpCode, Session, User } from './identity.entities';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class IdentityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  // Without this, a fresh database has no staff able to sign in.
  async onApplicationBootstrap() {
    const raw = this.config.get<string>('SUPER_ADMIN_IDENTIFIER');
    if (!raw) return;
    const user = await this.findOrCreateUser(normalizeIdentifier(raw));
    if (!user.roles.includes(Role.SuperAdmin)) {
      user.roles = [...user.roles, Role.SuperAdmin];
      await this.users.save(user);
      this.logger.log(`Granted SUPER_ADMIN to ${raw}`);
    }
  }

  async requestOtp(rawIdentifier: string) {
    const identifier = normalizeIdentifier(rawIdentifier);
    const code = String(randomInt(100000, 1000000));
    await this.otps.save(
      this.otps.create({
        identifier,
        codeHash: this.hashOtp(identifier, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      }),
    );
    await this.notifications.send({
      channel: identifier.includes('@') ? 'email' : 'sms',
      to: identifier,
      message: `Your AskUs verification code is ${code}. It is valid for 5 minutes.`,
    });
    return { sent: true };
  }

  async verifyOtp(rawIdentifier: string, code: string) {
    const identifier = normalizeIdentifier(rawIdentifier);
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
    otp.consumed = true;
    await this.otps.save(otp);

    const user = await this.findOrCreateUser(identifier);
    if (!user.isActive) throw new ForbiddenException('Account disabled');

    await this.audit.log({ actorId: user.id, action: 'auth.login', resource: `user:${user.id}` });
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
    return this.issueTokens(user, session.familyId);
  }

  async logout(refreshToken: string) {
    await this.sessions.update({ refreshHash: sha256(refreshToken), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issueTokens(user: User, familyId: string) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      roles: user.roles,
      name: user.fullName ?? user.email ?? user.mobile ?? 'User',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        familyId,
        refreshHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        revokedAt: null,
      }),
    );
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
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
