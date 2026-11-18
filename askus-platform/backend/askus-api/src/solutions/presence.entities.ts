import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

// Browser presence is deliberately separate from desktop monitoring (monitoring.entities.ts) and
// attendance. Nothing here is read by payroll or attendance code.
const SCHEMA = 'solutions';

export type PresenceState = 'active' | 'background' | 'away' | 'offline';
export type ConsentDecision = 'accepted' | 'deferred' | 'withdrawn';

/** Every change of a staff member's Admin, written in the same transaction as the change. */
@Entity({ schema: SCHEMA, name: 'staff_assignment_audit' })
@Index(['subjectId', 'createdAt'])
export class StaffAssignmentAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Server-authenticated Super Admin who made the change. */
  @Column({ type: 'uuid' })
  actorId: string;

  @Index()
  @Column({ type: 'uuid' })
  subjectId: string;

  @Column({ type: 'uuid', nullable: true })
  oldAdminId: string | null;

  /** Null means the person was unassigned. */
  @Column({ type: 'uuid', nullable: true })
  newAdminId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** One row per person: their latest decision about the current browser-presence notice. */
@Entity({ schema: SCHEMA, name: 'presence_consents' })
export class PresenceConsent {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  /** The notice version the decision was made against. A newer notice needs a new decision. */
  @Column({ type: 'varchar', length: 20 })
  noticeVersion: string;

  @Column({ type: 'varchar', length: 12 })
  decision: ConsentDecision;

  @Column({ type: 'timestamptz' })
  decidedAt: Date;
}

/** One browser tab / device. The id is random and opaque, never an auth token. */
@Entity({ schema: SCHEMA, name: 'presence_sessions' })
@Index(['userId', 'endedAt'])
export class PresenceSession {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** True while the tab is visible AND focused, as last reported. */
  @Column({ default: false })
  inView: boolean;

  /** Highest heartbeat sequence accepted; older or repeated ones are ignored. */
  @Column({ type: 'int', default: 0 })
  seq: number;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  /** Server receipt time of the last accepted heartbeat. Client clocks are never used. */
  @Column({ type: 'timestamptz' })
  lastSeenAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  endReason: 'logout' | 'withdrawn' | 'replaced' | null;
}

/** Aggregate state across all of a person's sessions. `version` only ever increases. */
@Entity({ schema: SCHEMA, name: 'presence_states' })
export class PresenceCurrent {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 12, default: 'offline' })
  state: PresenceState;

  /** When the current state began (server time). */
  @Column({ type: 'timestamptz' })
  stateSince: Date;

  /** When the person last left the in-view state; drives the Away threshold. */
  @Column({ type: 'timestamptz', nullable: true })
  backgroundSince: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) } })
  version: number;
}

/** Meaningful state changes only; individual heartbeats are never stored as history. */
@Entity({ schema: SCHEMA, name: 'presence_transitions' })
@Index(['userId', 'at'])
@Index(['at'])
export class PresenceTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  fromState: PresenceState | null;

  @Column({ type: 'varchar', length: 12 })
  toState: PresenceState;

  @Column({ type: 'timestamptz' })
  at: Date;
}
