import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

const SCHEMA = 'solutions';

/** What an employee's day looked like. Lateness is a flag on a Present/Half-day record, not a status of its own. */
export type AttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'OnLeave' | 'Holiday' | 'WeekOff';
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'HalfDay', 'OnLeave', 'Holiday', 'WeekOff'];

/** self = the employee checked in; admin = corrected by an admin; leave = set by an approved leave; system = auto-marked. */
export type AttendanceSource = 'self' | 'admin' | 'leave' | 'system';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Configurable leave categories (Casual, Sick, Earned, Unpaid). */
@Entity({ schema: SCHEMA, name: 'leave_types' })
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  defaultDaysPerYear: number;

  /** Unpaid leave has no yearly entitlement, so it is never checked against a balance. */
  @Column({ default: true })
  isPaid: boolean;

  @Column({ default: true })
  isActive: boolean;
}

/** One person's entitlement for one leave type in one year. Remaining is always total - used. */
@Entity({ schema: SCHEMA, name: 'leave_balances' })
@Index(['userId', 'leaveTypeId', 'year'], { unique: true })
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int', default: 0 })
  totalAllotted: number;

  @Column({ type: 'int', default: 0 })
  used: number;
}

@Entity({ schema: SCHEMA, name: 'leave_requests' })
@Index(['userId', 'fromDate'])
@Index(['status', 'createdAt'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  userName: string;

  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @Column()
  leaveTypeName: string;

  /** Inclusive range, YYYY-MM-DD, India calendar. */
  @Column({ type: 'varchar', length: 10 })
  fromDate: string;

  @Column({ type: 'varchar', length: 10 })
  toDate: string;

  /** Working days only: holidays and week-offs inside the range are not charged to the balance. */
  @Column({ type: 'int' })
  days: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: LeaveStatus;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** Company holidays. attendance auto-marks "Holiday" on these dates. */
@Entity({ schema: SCHEMA, name: 'holiday_calendar' })
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column()
  name: string;

  /** 'all' or a region name. Only 'all' is applied today; region filtering plugs in when staff have regions. */
  @Column({ default: 'all' })
  applicableTo: string;
}

/** One row per employee per day. */
@Entity({ schema: SCHEMA, name: 'attendance_records' })
@Index(['userId', 'date'], { unique: true })
@Index(['date'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar' })
  status: AttendanceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  checkInTime: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutTime: Date | null;

  /** Minutes after shift start, only when beyond the grace period. 0 = on time. */
  @Column({ type: 'int', default: 0 })
  lateByMinutes: number;

  /** Checked in, never checked out: flagged the next day for an admin to review. */
  @Column({ default: false })
  missedCheckout: boolean;

  @Column({ type: 'varchar', default: 'system' })
  source: AttendanceSource;

  /** The admin who last corrected this row by hand. */
  @Column({ type: 'uuid', nullable: true })
  markedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** Single row (id = 'default'): shift start, grace period and the half-day threshold. */
@Entity({ schema: SCHEMA, name: 'attendance_config' })
export class AttendanceConfig {
  @PrimaryColumn()
  id: string;

  /** HH:mm, India time. */
  @Column({ default: '09:30' })
  shiftStart: string;

  @Column({ type: 'int', default: 10 })
  graceMinutes: number;

  /** Worked less than this between check-in and check-out = Half-day. */
  @Column({ type: 'int', default: 240 })
  halfDayMinutes: number;

  /** Weekdays off for everyone unless a rule below says otherwise. CSV of 0 (Sun) - 6 (Sat). */
  @Column({ default: '0' })
  weekOffDays: string;
}

/** Week-off override for one employee or one role. A user rule beats a role rule beats the default. */
@Entity({ schema: SCHEMA, name: 'week_off_rules' })
@Index(['scope', 'target'], { unique: true })
export class WeekOffRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  scope: 'user' | 'role';

  /** A user id, or a role name (Admin / Employee / Agent). */
  @Column()
  target: string;

  /** CSV of 0 (Sun) - 6 (Sat). Empty = no week-off. */
  @Column({ default: '' })
  days: string;
}
