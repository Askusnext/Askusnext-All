import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../common/roles';

@Entity({ schema: 'identity', name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  mobile: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', name: 'full_name', nullable: true })
  fullName: string | null;

  @Column('simple-array', { default: Role.Customer })
  roles: Role[];

  @Column('simple-array', { default: '' })
  permissions: string[];

  // Private R2 object keys of the uploaded Aadhaar document (front/back); only Super Admin/Admin can open them.
  @Column({ type: 'varchar', name: 'aadhaar_key', nullable: true })
  aadhaarKey: string | null;

  @Column({ type: 'varchar', name: 'aadhaar_back_key', nullable: true })
  aadhaarBackKey: string | null;

  // PAN number and the private R2 keys of its image (front/back); only Super Admin/Admin can read them.
  @Column({ type: 'varchar', name: 'pan_number', nullable: true })
  panNumber: string | null;

  @Column({ type: 'varchar', name: 'pan_key', nullable: true })
  panKey: string | null;

  @Column({ type: 'varchar', name: 'pan_back_key', nullable: true })
  panBackKey: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  // Solutions staff hierarchy: the one Admin an Employee/Agent reports to. Null = unassigned.
  // Only a Super Admin changes it (see StaffHierarchyService); never set for any other role.
  @Index()
  @Column({ type: 'uuid', name: 'reporting_admin_id', nullable: true })
  reportingAdminId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Staff created by an Admin stay PENDING (and inactive) until a Super Admin approves them.
  @Column({ type: 'varchar', name: 'approval_status', default: 'APPROVED' })
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';

  // Optional password sign-in alongside OTP. Never selected by default; the login query opts in.
  @Column({ type: 'varchar', name: 'password_hash', nullable: true, select: false })
  passwordHash: string | null;

  // Set once each contact is proven by OTP; sign-in OTPs go to email only after both are set.
  @Column({ type: 'timestamptz', name: 'mobile_verified_at', nullable: true })
  mobileVerifiedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'failed_logins', default: 0 })
  failedLogins: number;

  @Column({ type: 'timestamptz', name: 'locked_until', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ schema: 'identity', name: 'otp_codes' })
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  identifier: string;

  @Column({ name: 'code_hash' })
  codeHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  consumed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'identity', name: 'sessions' })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Index({ unique: true })
  @Column({ name: 'refresh_hash' })
  refreshHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'identity', name: 'mfa_methods' })
export class MfaMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  type: 'TOTP' | 'SMS' | 'EMAIL';

  @Column({ type: 'varchar', nullable: true })
  secret: string | null;

  @Column({ default: false })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
