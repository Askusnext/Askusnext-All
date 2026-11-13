import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PolicyType = 'Comprehensive' | 'ThirdParty' | 'OwnDamage' | 'ZeroDep';
export type InsuranceStatus = 'Active' | 'ExpiringSoon' | 'Expired' | 'Cancelled' | 'NewPolicy';
export type PaymentStatus = 'Pending' | 'Paid' | 'Partial' | 'Refunded';
export type TicketStatus = 'Open' | 'InProgress' | 'Completed' | 'Closed';
export type Priority = 'High' | 'Medium' | 'Low';
export type TicketType = 'Insurance' | 'O2Taxi' | 'General' | 'DailyActivity' | 'Support' | 'Payment' | 'Office' | 'Other';
export type KBCategory = 'O2Taxi' | 'AlphaaInsurance' | 'AlphaaLoans' | 'General';
export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Holiday' | 'Leave';
export type FuelType = 'Petrol' | 'Diesel' | 'Electric' | 'CNG' | 'Hybrid';

export interface IInsurancePolicy {
  insurer: string;
  policyNumber?: string;
  policyType: PolicyType;
  idv?: number;
  netPremium: number;
  gst: number;
  totalPremium: number;
  ncbPercent: number;
  startDate: string;
  expiryDate: string;
  renewalDate?: string;
  insuranceStatus: InsuranceStatus;
}

export interface ITicketPayment {
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMode?: string;
  transactionId?: string;
  paidAt?: string;
}

export interface ITicketDocument {
  id: string;
  type: 'RC' | 'Insurance' | 'Other';
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface IActivityLog {
  id: string;
  action: string;
  note?: string;
  performedByName: string;
  createdAt: string;
}

export interface IDayEntry {
  date: string;
  status: AttendanceStatus;
  hours: number;
}

const SCHEMA = 'solutions';

@Entity({ schema: SCHEMA, name: 'customers' })
export class SolutionsCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Link to the shared identity user once the customer signs in to the portal.
  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  name: string;

  @Index()
  @Column()
  mobile: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  pincode: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity({ schema: SCHEMA, name: 'vehicles' })
export class SolutionsVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  registrationNo: string;

  @Column()
  make: string;

  @Column()
  vehicleModel: string;

  @Column()
  year: number;

  @Column({ type: 'varchar', default: 'Petrol' })
  fuelType: FuelType;

  @Column({ type: 'int', nullable: true })
  engineCC: number | null;

  @Column({ type: 'varchar', nullable: true })
  chassisNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  engineNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  colour: string | null;

  @Column({ type: 'uuid' })
  customerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity({ schema: SCHEMA, name: 'counters' })
export class Counter {
  @PrimaryColumn()
  id: string;

  @Column({ default: 0 })
  seq: number;
}

@Entity({ schema: SCHEMA, name: 'tickets' })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  ticketNumber: string;

  @Column()
  title: string;

  @Index()
  @Column({ type: 'varchar', default: 'Open' })
  status: TicketStatus;

  @Column({ type: 'varchar', default: 'Medium' })
  priority: Priority;

  @Column({ type: 'varchar', default: 'Insurance' })
  ticketType: TicketType;

  @Column({ type: 'varchar', nullable: true })
  assignedToId: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedToName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true })
  internalNotes: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column()
  customerName: string;

  @Column()
  customerMobile: string;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  vehicleRegNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  policy: IInsurancePolicy | null;

  @Column({ type: 'jsonb', default: () => `'{"amount": 0, "paymentStatus": "Pending"}'` })
  payment: ITicketPayment;

  @Column({ default: false })
  raisedByCustomer: boolean;

  @Column({ type: 'jsonb', nullable: true })
  paymentTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  officeTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  otherTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  o2TaxiTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  dailyActivityTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  supportTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  generalTicketData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  documents: ITicketDocument[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  activityLog: IActivityLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity({ schema: SCHEMA, name: 'timesheets' })
@Index(['userId', 'weekStart'], { unique: true })
export class Timesheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  employeeName: string;

  @Column()
  employeeId: string;

  @Column()
  role: string;

  @Column()
  weekStart: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  entries: IDayEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity({ schema: SCHEMA, name: 'kb_articles' })
export class KBArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column({ type: 'varchar', default: 'General' })
  category: KBCategory;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: true })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
