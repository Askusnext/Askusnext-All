import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const SCHEMA = 'solutions';

/** One row per field that changed on a ticket: who, what, old → new, when. Written in the same transaction as the change. */
@Entity({ schema: SCHEMA, name: 'ticket_history' })
export class TicketHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'uuid', nullable: true })
  changedById: string | null;

  @Column()
  changedByName: string;

  /** For example `status`, `priority`, `assignedTo`, `created`, `deleted`, `payment`, `document`. */
  @Column()
  fieldChanged: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt: Date;
}

/** Append-only notes and replies. Never edited or deleted. */
@Entity({ schema: SCHEMA, name: 'ticket_comments' })
export class TicketComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  userName: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
