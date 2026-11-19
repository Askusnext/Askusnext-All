import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

const SCHEMA = 'solutions';

export type TrackingMethod = 'agent' | 'manual';

/**
 * One ping from the desktop agent (every 90 s) or one manual start/stop. Only an idle/active flag and the
 * foreground app's name are stored: never keystrokes, mouse positions, window titles or screen contents.
 * Raw rows are purged after 90 days; the daily summary is kept.
 */
@Entity({ schema: SCHEMA, name: 'activity_heartbeats' })
@Index(['userId', 'timestamp'])
@Index(['userId', 'deviceId', 'timestamp'], { unique: true })
@Index(['timestamp'])
export class ActivityHeartbeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** The paired device, or 'manual' for a start/stop entered by hand. */
  @Column({ type: 'varchar', length: 100 })
  deviceId: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ default: false })
  idleFlag: boolean;

  @Column({ type: 'varchar', default: 'agent' })
  source: 'agent' | 'manual';

  @Column({ type: 'varchar', length: 120, nullable: true })
  activeApp: string | null;
}

/** One continuous block of work, built from heartbeats (or a manual start/stop). Times are kept in seconds for accuracy. */
@Entity({ schema: SCHEMA, name: 'activity_sessions' })
@Index(['userId', 'day'])
export class ActivitySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** India calendar day the session started on, YYYY-MM-DD. */
  @Column({ type: 'varchar', length: 10 })
  day: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'int', default: 0 })
  activeSeconds: number;

  @Column({ type: 'int', default: 0 })
  idleSeconds: number;

  @Column({ type: 'varchar', default: 'agent' })
  source: 'agent' | 'manual';

  /** A manual session that has been started and not yet stopped. */
  @Column({ default: false })
  open: boolean;
}

/** One row per person per day, rolled up from sessions. This is what the dashboard and reports read. */
@Entity({ schema: SCHEMA, name: 'daily_summary' })
@Index(['userId', 'date'], { unique: true })
@Index(['date'])
export class DailySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'int', default: 0 })
  totalActiveMinutes: number;

  @Column({ type: 'int', default: 0 })
  totalIdleMinutes: number;

  @Column({ type: 'timestamptz', nullable: true })
  firstActivity: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastActivity: Date | null;
}

/** Which desktop agent belongs to which employee. Only a hash of the token is stored. */
@Entity({ schema: SCHEMA, name: 'device_tokens' })
@Index(['userId', 'deviceId'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  deviceId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', default: 'windows' })
  platform: 'windows' | 'mac';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}

/** A short-lived code an employee generates in the web app and types into the agent once to pair it. */
@Entity({ schema: SCHEMA, name: 'agent_pairing_codes' })
export class AgentPairingCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}

/** The one-time signed acknowledgment that company devices are monitored for active/idle status and app usage. */
@Entity({ schema: SCHEMA, name: 'monitoring_consents' })
export class MonitoringConsent {
  @PrimaryColumn('uuid')
  userId: string;

  /** Which version of the policy wording was accepted. */
  @Column({ type: 'varchar', length: 20 })
  policyVersion: string;

  @Column({ type: 'timestamptz' })
  consentAcceptedAt: Date;
}

/** Tracking method and minimum-hours target for one person or one role. A person rule beats a role rule beats the default. */
@Entity({ schema: SCHEMA, name: 'monitoring_settings' })
@Index(['scope', 'target'], { unique: true })
export class MonitoringSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  scope: 'user' | 'role';

  /** A user id, or a role name (Admin / Employee / Agent). */
  @Column()
  target: string;

  /** Minutes of active time expected per working day, averaged over the week. Null = inherit. */
  @Column({ type: 'int', nullable: true })
  targetMinutesPerDay: number | null;

  @Column({ type: 'varchar', nullable: true })
  trackingMethod: TrackingMethod | null;
}
