import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

const num = { to: (v?: number | null) => v, from: (v: string | null) => (v === null || v === undefined ? v : Number(v)) };

/** Customer-editable profile used by the loan journeys (name, PAN, employment, income ...). */
@Entity({ schema: 'loans', name: 'customer_details' })
export class CustomerDetails {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** An application started from the loan quotes page: one per customer and lender. */
@Entity({ schema: 'loans', name: 'quote_applications' })
@Index(['userId', 'appKey'], { unique: true })
export class QuoteApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** `${loanType}__${lenderId}`, the id the screens use. */
  @Column({ name: 'app_key' })
  appKey: string;

  @Column({ name: 'loan_type' })
  loanType: string;

  @Column({ name: 'lender_id' })
  lenderId: string;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: num })
  amount: number;

  @Column({ name: 'tenure_months', type: 'int' })
  tenureMonths: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: num })
  roi: number;

  @Index()
  @Column({ default: 'in_progress' })
  status: string;

  @Column({ default: 'know_you' })
  step: string;

  @Column({ type: 'varchar', nullable: true })
  purpose: string | null;

  @Column({ name: 'document_draft_id', type: 'uuid', nullable: true })
  documentDraftId: string | null;

  @Column({ name: 'reference_number', type: 'varchar', nullable: true })
  referenceNumber: string | null;

  @Column({ name: 'consent_version', type: 'varchar', nullable: true })
  consentVersion: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'review_message', type: 'text', nullable: true })
  reviewMessage: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  resubmissions: number;

  /** The staff member working on this item. */
  @Index()
  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ name: 'assigned_to_name', type: 'varchar', nullable: true })
  assignedToName: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'resubmitted_at', type: 'timestamptz', nullable: true })
  resubmittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ schema: 'loans', name: 'quote_documents' })
@Index(['applicationId', 'slot'], { unique: true })
export class QuoteDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column()
  slot: string;

  @Column()
  label: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  /** Key of the private file on the server, `loans/<userId>/<draftId>/<name>`. */
  @Index()
  @Column({ name: 'storage_key' })
  storageKey: string;

  @Column({ name: 'file_id' })
  fileId: string;

  @Column({ name: 'file_format' })
  fileFormat: string;

  @Column({ name: 'file_version', type: 'int', default: 0 })
  fileVersion: number;

  @Column({ type: 'varchar', nullable: true })
  period: string | null;

  @Column({ name: 'review_status', type: 'varchar', nullable: true })
  reviewStatus: 'verified' | 'rejected' | null;

  @Column({ name: 'review_note', type: 'varchar', nullable: true })
  reviewNote: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}

/** Timeline the customer and the reviewers both see. */
@Entity({ schema: 'loans', name: 'quote_history' })
export class QuoteHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @CreateDateColumn({ name: 'at' })
  at: Date;

  @Column()
  actor: 'admin' | 'customer';

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column()
  event: string;

  @Column({ name: 'from_status' })
  fromStatus: string;

  @Column({ name: 'to_status' })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;
}

/** Internal reviewer notes. The customer never sees these. */
@Entity({ schema: 'loans', name: 'quote_admin_notes' })
export class QuoteAdminNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'by_id', type: 'uuid' })
  byId: string;

  @Column({ name: 'by_email', type: 'varchar', nullable: true })
  byEmail: string | null;

  @CreateDateColumn({ name: 'at' })
  at: Date;
}

/** The customer's details frozen at the moment of (re)submission. */
@Entity({ schema: 'loans', name: 'quote_snapshots' })
export class QuoteSnapshot {
  @PrimaryColumn('uuid', { name: 'application_id' })
  applicationId: string;

  @Column({ type: 'jsonb' })
  profile: Record<string, unknown>;

  @Column({ name: 'taken_at', type: 'timestamptz' })
  takenAt: Date;
}

/** The full multi-step application form (employment, documents, status history). */
@Entity({ schema: 'loans', name: 'form_applications' })
export class FormApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'reference_number' })
  referenceNumber: string;

  @Index()
  @Column({ default: 'submitted' })
  status: string;

  /** All applicant, loan and employment fields as entered on the form. */
  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  documents: Record<string, unknown>[];

  @Column({ name: 'status_history', type: 'jsonb', default: () => "'[]'" })
  statusHistory: Record<string, unknown>[];

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  /** The staff member working on this item. */
  @Index()
  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ name: 'assigned_to_name', type: 'varchar', nullable: true })
  assignedToName: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ schema: 'loans', name: 'support_tickets' })
export class LoanSupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  userName: string | null;

  @Column({ name: 'user_mobile', type: 'varchar', nullable: true })
  userMobile: string | null;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'general' })
  category: string;

  @Column({ default: 'open' })
  status: 'open' | 'in_progress' | 'resolved';

  @Column({ type: 'text', nullable: true })
  reply: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ schema: 'loans', name: 'audit_logs' })
export class LoansAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'actor_email', type: 'varchar', nullable: true })
  actorEmail: string | null;

  @Column({ name: 'actor_role' })
  actorRole: 'admin' | 'customer';

  @Index()
  @Column()
  action: string;

  @Column({ name: 'application_id', type: 'varchar', nullable: true })
  applicationId: string | null;

  @Column({ name: 'reference_number', type: 'varchar', nullable: true })
  referenceNumber: string | null;

  @Column({ type: 'text' })
  details: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
