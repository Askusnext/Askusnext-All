import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Product } from '../common/roles';

// user_id doubles as the shared customer ID used by every product schema.
@Entity({ schema: 'identity', name: 'customer_profiles' })
export class CustomerProfile {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'display_name', nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  pincode: string | null;

  // Contact email for quotes; separate from the login identifier on the user.
  @Column({ type: 'varchar', name: 'contact_email', nullable: true })
  contactEmail: string | null;

  @Column('simple-array', { default: '' })
  products: Product[];

  @Column({ name: 'kyc_status', default: 'PENDING' })
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
