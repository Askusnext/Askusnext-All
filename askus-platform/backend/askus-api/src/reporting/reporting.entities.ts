import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'reporting', name: 'business_summary' })
export class BusinessSummary {
  @PrimaryColumn()
  product: string;

  @Column({ name: 'total_records', default: 0 })
  totalRecords: number;

  @Column({ type: 'numeric', precision: 16, scale: 2, name: 'total_amount', default: 0 })
  totalAmount: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ schema: 'reporting', name: 'daily_metrics' })
@Index(['day', 'product', 'metric'], { unique: true })
export class DailyMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  day: string;

  @Column()
  product: string;

  @Column()
  metric: string;

  @Column({ type: 'numeric', precision: 16, scale: 2 })
  value: string;
}

// Transactional outbox: written in the same DB transaction as the business change, then relayed.
@Entity({ schema: 'reporting', name: 'outbox_events' })
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
