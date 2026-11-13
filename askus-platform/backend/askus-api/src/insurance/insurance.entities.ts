import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'issued', 'closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface DocRef {
  name: string;
  size: number;
  mimeType: string;
  key: string;
  format: string;
  kind?: 'rc' | 'policy';
}

// Customer-initiated requests handled manually by the team: offline car/bike quotes and document submissions.
@Entity({ schema: 'insurance', name: 'requests' })
export class InsuranceRequest {
  // Client-generated so document keys (insurance/{user}/{id}/doc_n) can be signed before the row exists.
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar' })
  kind: 'offline' | 'upload';

  @Index()
  @Column({ type: 'varchar', default: 'new' })
  status: RequestStatus;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleType: 'car' | 'bike' | null;

  @Column({ type: 'int', nullable: true })
  cashbackUpTo: number | null;

  @Column({ type: 'jsonb', nullable: true })
  applicant: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  vehicle: Record<string, string | boolean> | null;

  @Column({ type: 'jsonb', nullable: true })
  policy: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: Record<string, unknown> | null;

  // Document-upload submissions only
  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactMobile: string | null;

  @Column({ type: 'varchar', nullable: true })
  docType: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  documents: DocRef[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity({ schema: 'insurance', name: 'quotes' })
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'product_type' })
  productType: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  premium: string;

  @Column({ default: 'DRAFT' })
  status: 'DRAFT' | 'ISSUED' | 'EXPIRED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'insurance', name: 'policies' })
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId: string;

  @Column({ name: 'policy_number', unique: true })
  policyNumber: string;

  @Column({ default: 'ACTIVE' })
  status: 'ACTIVE' | 'LAPSED' | 'CANCELLED';

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'insurance', name: 'claims' })
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ default: 'SUBMITTED' })
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
