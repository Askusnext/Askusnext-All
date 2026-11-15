import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

const SCHEMA = 'solutions';
const coord = { type: 'double precision' as const, nullable: true };

/** An employee's agreement to the location-tracking notice. Nothing is recorded without it. */
@Entity({ schema: SCHEMA, name: 'tracking_consents' })
export class TrackingConsent {
  @PrimaryColumn('uuid')
  userId: string;

  /** Which version of the notice they accepted. */
  @Column()
  version: string;

  @CreateDateColumn()
  acceptedAt: Date;
}

/** One stretch of work, started and stopped by the employee. */
@Entity({ schema: SCHEMA, name: 'work_sessions' })
@Index(['userId', 'day'])
export class WorkSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  /** Calendar day (India time) the session started on, YYYY-MM-DD. */
  @Column()
  day: string;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  /** 'manual' when the employee stopped it, 'auto' when it was closed because the signal was lost. */
  @Column({ type: 'varchar', nullable: true })
  endReason: 'manual' | 'auto' | null;

  @Column(coord) startLat: number | null;
  @Column(coord) startLng: number | null;
  @Column({ ...coord }) startAccuracy: number | null;
  @Column(coord) endLat: number | null;
  @Column(coord) endLng: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastPingAt: Date | null;

  @Column(coord) lastLat: number | null;
  @Column(coord) lastLng: number | null;
  @Column({ ...coord }) lastAccuracy: number | null;

  @Column({ type: 'varchar', default: 'active' })
  lastState: 'active' | 'idle';
}

/** A location sample taken while a session is running. */
@Entity({ schema: SCHEMA, name: 'location_pings' })
export class LocationPing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'timestamptz' })
  at: Date;

  @Column(coord) lat: number | null;
  @Column(coord) lng: number | null;
  @Column({ ...coord }) accuracy: number | null;

  /** 'active' = recent keyboard / mouse use; 'idle' = none for a while. */
  @Column({ type: 'varchar', default: 'active' })
  state: 'active' | 'idle';
}
