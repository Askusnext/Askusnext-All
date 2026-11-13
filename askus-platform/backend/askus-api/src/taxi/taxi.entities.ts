import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'taxi', name: 'drivers' })
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'license_number' })
  licenseNumber: string;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'taxi', name: 'vehicles' })
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'registration_no', unique: true })
  registrationNo: string;

  @Column()
  model: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'taxi', name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column()
  pickup: string;

  @Column({ name: 'drop_off' })
  dropOff: string;

  @Column({ default: 'REQUESTED' })
  status: 'REQUESTED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  fare: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ schema: 'taxi', name: 'trips' })
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, name: 'distance_km', nullable: true })
  distanceKm: string | null;
}
