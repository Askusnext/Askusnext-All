import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const SCHEMA = 'solutions';

export type CalendarProvider = 'google' | 'microsoft';
export type MeetingScope = 'private' | 'team';

/** The ventures an Admin's "team" is made of. SuperAdmin sees all of them. */
export const TEAMS = ['AskUs Taxi', 'Alphaa Insurance', 'Alphaa Loans', 'Organic Port', 'Software team'] as const;
export type Team = (typeof TEAMS)[number];

/** An employee's linked Google or Microsoft work calendar. Tokens are stored encrypted. */
@Entity({ schema: SCHEMA, name: 'calendar_connections' })
@Index(['userId', 'provider'], { unique: true })
export class CalendarConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  provider: CalendarProvider;

  /** The mailbox that was connected, shown so people can tell which account is linked. */
  @Column({ type: 'varchar', nullable: true })
  accountEmail: string | null;

  /** AES-256-GCM encrypted. Never returned by any endpoint. */
  @Column({ type: 'text' })
  oauthToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  /** active, or revoked / error when the provider no longer accepts the saved sign-in. */
  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'revoked' | 'error';

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** A meeting: pulled from the provider, or added by hand. Only title, time and attendees are kept: no body, no inbox. */
@Entity({ schema: SCHEMA, name: 'meetings' })
@Index(['userId', 'startTime'])
@Index(['userId', 'provider', 'externalId'], { unique: true })
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'varchar', default: 'manual' })
  source: 'synced' | 'manual';

  /** 'private' hides the title from everyone but the owner (providers mark some events private). */
  @Column({ type: 'varchar', default: 'team' })
  visibilityScope: MeetingScope;

  @Column({ type: 'varchar', nullable: true })
  provider: CalendarProvider | null;

  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  /** Who created a manual meeting (an Admin can add one for someone on their team). */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ schema: SCHEMA, name: 'meeting_attendees' })
@Index(['meetingId'])
@Index(['employeeId'])
export class MeetingAttendee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  meetingId: string;

  /** Set when the invitee's email matches a staff member, so team views can show meetings they are invited to. */
  @Column({ type: 'uuid', nullable: true })
  employeeId: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;
}

/** One row per person per day per item, linking to leave_requests, meetings or attendance_records. */
@Entity({ schema: SCHEMA, name: 'activity_feed' })
@Index(['userId', 'type', 'refId', 'date'], { unique: true })
@Index(['date'])
export class ActivityFeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: 'leave' | 'meeting' | 'status';

  @Column({ type: 'uuid' })
  refId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;
}

/** Which people belong to which team (venture). An Admin's team is every team they belong to. */
@Entity({ schema: SCHEMA, name: 'team_members' })
@Index(['team', 'userId'], { unique: true })
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  team: Team;

  @Column({ type: 'uuid' })
  userId: string;
}
