import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'organic', name: 'products' })
export class OrganicProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'organic', name: 'orders' })
export class OrganicOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  total: string;

  @Column({ default: 'PLACED' })
  status: 'PLACED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'organic', name: 'inventory' })
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ default: 0 })
  quantity: number;
}
