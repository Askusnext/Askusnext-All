import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityModuleName = 'loans' | 'insurance' | 'tickets' | 'timesheet' | 'attendance' | 'tracking' | 'auth' | 'system';

/**
 * One line of "who did what, when, on which item". Written by the loans, insurance, tickets, timesheet,
 * tracking and login code, and read by the Activity screen. Append-only: rows are never edited.
 */
@Entity({ schema: 'admin', name: 'activity_logs' })
@Index(['actorId', 'createdAt'])
@Index(['module', 'createdAt'])
@Index(['entityType', 'entityId'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** The person who acted. Null for system events. */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar' })
  actorName: string;

  /** Admin, Employee, Agent or Customer. */
  @Column({ type: 'varchar' })
  actorRole: string;

  @Column({ type: 'varchar' })
  module: ActivityModuleName;

  /** Short machine name, for example `loan.status_changed`. */
  @Column({ type: 'varchar' })
  action: string;

  /** What it happened to: `loan_journey`, `loan_form`, `insurance_request`, `ticket`, ... */
  @Column({ type: 'varchar', nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  /** Human label for the item, for example the reference number. */
  @Column({ type: 'varchar', nullable: true })
  entityLabel: string | null;

  /** One readable sentence. */
  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
