import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'loans', name: 'applications' })
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ name: 'tenure_months' })
  tenureMonths: number;

  @Column({ default: 'SUBMITTED' })
  status: 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'DISBURSED' | 'REJECTED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// Append-only ledger: rows are inserted, never updated or deleted. Corrections are new reversing entries.
@Entity({ schema: 'loans', name: 'transactions' })
export class LoanTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column()
  type: 'DISBURSEMENT' | 'REPAYMENT' | 'FEE' | 'REVERSAL';

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', name: 'gateway_ref', nullable: true })
  gatewayRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'loans', name: 'settlements' })
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'timestamptz', name: 'settled_at' })
  settledAt: Date;
}
