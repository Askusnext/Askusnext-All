import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

const SCHEMA = 'solutions';

export type LeadVertical = 'insurance' | 'loan';
export const LEAD_VERTICALS: LeadVertical[] = ['insurance', 'loan'];

/** New → Assigned → Quote Shared → Payment Pending → Payment Link/Copy Uploaded → Policy/Loan Issued → Closed (or Rejected). */
export type LeadStatus = 'New' | 'Assigned' | 'QuoteShared' | 'PaymentPending' | 'PaymentUploaded' | 'Issued' | 'Closed' | 'Rejected';
export const LEAD_STATUSES: LeadStatus[] = ['New', 'Assigned', 'QuoteShared', 'PaymentPending', 'PaymentUploaded', 'Issued', 'Closed', 'Rejected'];

export type LeadDocKind = 'previous_policy' | 'kyc' | 'income_proof' | 'payment_copy' | 'issued_copy' | 'other';
export const LEAD_DOC_KINDS: LeadDocKind[] = ['previous_policy', 'kyc', 'income_proof', 'payment_copy', 'issued_copy', 'other'];

export const INSURERS = ['HDFC Ergo', 'ICICI Lombard', 'Bajaj Allianz', 'Tata AIG', 'New India Assurance', 'Digit', 'Other'];
export const LENDERS = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Bajaj Finserv', 'Tata Capital', 'Other'];

/** Postgres numeric comes back as a string; the API deals in numbers. */
const num = { to: (v?: number | null) => v, from: (v: string | null) => (v === null || v === undefined ? null : Number(v)) };

/** One insurance or loan lead. Creating it is what generates the ticket: no separate "create ticket" step. */
@Entity({ schema: SCHEMA, name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  ticketNumber: string;

  @Index()
  @Column({ type: 'varchar' })
  vertical: LeadVertical;

  @Index()
  @Column({ type: 'varchar', default: 'New' })
  status: LeadStatus;

  @Column()
  customerName: string;

  @Column()
  customerPhone: string;

  @Column({ type: 'varchar', nullable: true })
  customerEmail: string | null;

  @Index()
  @Column({ type: 'uuid' })
  createdById: string;

  @Column()
  createdByName: string;

  // insurance
  @Column({ type: 'varchar', nullable: true }) vehicleRegNo: string | null;
  @Column({ type: 'varchar', nullable: true }) vehicleType: string | null;
  @Column({ type: 'varchar', nullable: true }) insurer: string | null;
  @Column({ type: 'varchar', nullable: true }) policyType: string | null;

  // loan
  @Column({ type: 'varchar', nullable: true }) loanType: string | null;
  @Column({ type: 'numeric', nullable: true, transformer: num }) loanAmount: number | null;
  @Column({ type: 'varchar', nullable: true }) lender: string | null;

  // the claim lock
  @Index()
  @Column({ type: 'uuid', nullable: true })
  claimedById: string | null;

  @Column({ type: 'varchar', nullable: true })
  claimedByName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  /** Last status update, comment or upload by the person holding the lock. The lock times out from here. */
  @Column({ type: 'timestamptz', nullable: true })
  lastActivityAt: Date | null;

  // quote, payment, issuance
  @Column({ type: 'numeric', nullable: true, transformer: num }) quoteAmount: number | null;
  @Column({ type: 'varchar', nullable: true }) paymentLinkUrl: string | null;
  @Column({ type: 'varchar', default: 'pending' }) paymentStatus: 'pending' | 'collected';
  @Column({ type: 'numeric', nullable: true, transformer: num }) paidAmount: number | null;
  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ type: 'numeric', nullable: true, transformer: num }) issuedAmount: number | null;
  @Column({ type: 'varchar', nullable: true }) policyNumber: string | null;
  @Column({ type: 'varchar', nullable: true }) policyExpiryDate: string | null;
  @Column({ type: 'timestamptz', nullable: true }) issuedAt: Date | null;
  @Column({ type: 'text', nullable: true }) rejectedReason: string | null;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;

  // SLA
  @Column({ default: false }) urgent: boolean;
  @Index()
  @Column({ type: 'timestamptz' }) slaDueAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) slaBreachedAt: Date | null;

  // commission for the marketing person, set when the lead is issued
  @Column({ type: 'numeric', nullable: true, transformer: num }) commissionAmount: number | null;
  @Column({ type: 'varchar', nullable: true }) commissionBasis: string | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

/** The full trail: every status change, claim, release, upload, view and alert, with who and when. */
@Entity({ schema: SCHEMA, name: 'lead_events' })
export class LeadEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) leadId: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column() userName: string;
  @Column() action: string;
  @Column({ type: 'varchar', nullable: true }) fromStatus: string | null;
  @Column({ type: 'varchar', nullable: true }) toStatus: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Metadata for an uploaded file. The file itself is encrypted on disk under `storageKey`. */
@Entity({ schema: SCHEMA, name: 'lead_documents' })
export class LeadDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) leadId: string;
  @Column({ type: 'varchar' }) kind: LeadDocKind;
  @Column() fileName: string;
  @Column() mimeType: string;
  @Column({ type: 'int' }) sizeBytes: number;
  @Column() storageKey: string;
  @Column({ type: 'uuid' }) uploadedById: string;
  @Column() uploadedByName: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Every message the system tried to send, and what happened to it (sent, skipped because the channel is not set up, or failed). */
@Entity({ schema: SCHEMA, name: 'lead_notifications' })
export class LeadNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) leadId: string;
  /** For example `claimed`, `payment_uploaded`, `issued`, `payment_link`, `policy_copy`, `renewal_30`, `sla_breach`. */
  @Index() @Column() kind: string;
  @Column({ type: 'varchar' }) audience: 'marketing' | 'customer' | 'admin';
  @Column({ type: 'varchar' }) channel: 'email' | 'sms' | 'whatsapp';
  @Column() recipient: string;
  @Column({ type: 'varchar' }) status: 'sent' | 'skipped' | 'failed';
  @Column({ type: 'text', nullable: true }) detail: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** What the marketing person earns on an issued lead: a percentage or a flat amount, per insurer/lender ('*' = default). */
@Entity({ schema: SCHEMA, name: 'commission_rules' })
@Index(['vertical', 'partner'], { unique: true })
export class CommissionRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar' }) vertical: LeadVertical;
  @Column() partner: string;
  @Column({ type: 'varchar' }) kind: 'percent' | 'flat';
  @Column({ type: 'numeric', transformer: num }) value: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
