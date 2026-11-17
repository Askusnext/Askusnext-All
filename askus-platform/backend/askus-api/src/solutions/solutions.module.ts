import { Module } from '@nestjs/common';
import { User } from '../identity/identity.entities';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceRecordsController, HolidaysController } from './attendance-records.controller';
import { AttendanceRecordsService } from './attendance-records.service';
import { LocationPing, TrackingConsent, WorkSession } from './attendance.entities';
import { CalendarController, CalendarPublicController, MeetingsController } from './calendar.controller';
import { ActivityFeedItem, CalendarConnection, Meeting, MeetingAttendee, TeamMember } from './calendar.entities';
import { CalendarService } from './calendar.service';
import { LeadsController, LeadsPublicController } from './leads.controller';
import { CommissionRule, Lead, LeadDocument, LeadEvent, LeadNotification } from './leads.entities';
import { LeadsNotifyService } from './leads-notify.service';
import { LeadsService } from './leads.service';
import { LeaveController } from './leave.controller';
import { AgentController, DeviceAuthGuard, TimeController, WorkReportsController } from './monitoring.controller';
import { ActivityHeartbeat, ActivitySession, AgentPairingCode, DailySummary, DeviceToken, MonitoringConsent, MonitoringSetting } from './monitoring.entities';
import { MonitoringService } from './monitoring.service';
import { AttendanceConfig, AttendanceRecord, Holiday, LeaveBalance, LeaveRequest, LeaveType, WeekOffRule } from './leave.entities';
import { LeaveService } from './leave.service';
import { AttendanceService } from './attendance.service';
import { CounterService } from './counter.service';
import { CustomerTicketsController } from './customer-tickets.controller';
import { CustomerTicketsService } from './customer-tickets.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { KbController } from './kb.controller';
import { KbService } from './kb.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Counter, KBArticle, SolutionsCustomer, SolutionsVehicle, Ticket, Timesheet } from './solutions.entities';
import { TicketAccessService } from './ticket-access.service';
import { TicketReportsController } from './ticket-reports.controller';
import { TicketReportsService } from './ticket-reports.service';
import { TicketComment, TicketHistory } from './ticketing.entities';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// AskUs Solutions ticket management (migrated from the standalone TMS backend).
@Module({
  imports: [TypeOrmModule.forFeature([Ticket, SolutionsCustomer, SolutionsVehicle, Counter, Timesheet, KBArticle, TrackingConsent, WorkSession, LocationPing,
    LeaveType, LeaveBalance, LeaveRequest, Holiday, AttendanceRecord, AttendanceConfig, WeekOffRule, User,
    ActivityHeartbeat, ActivitySession, DailySummary, DeviceToken, AgentPairingCode, MonitoringConsent, MonitoringSetting,
    CalendarConnection, Meeting, MeetingAttendee, ActivityFeedItem, TeamMember, TicketHistory, TicketComment,
    Lead, LeadEvent, LeadDocument, LeadNotification, CommissionRule])],
  controllers: [
    TicketsController,
    TicketReportsController,
    LeadsController,
    LeadsPublicController,
    CustomerTicketsController,
    DashboardController,
    TimesheetController,
    AttendanceController,
    AttendanceRecordsController,
    LeaveController,
    HolidaysController,
    AgentController,
    TimeController,
    WorkReportsController,
    CalendarController,
    CalendarPublicController,
    MeetingsController,
    KbController,
    PaymentsController,
    UsersController,
  ],
  providers: [
    CounterService,
    TicketsService,
    TicketAccessService,
    TicketReportsService,
    LeadsService,
    LeadsNotifyService,
    CustomerTicketsService,
    DashboardService,
    TimesheetService,
    AttendanceService,
    AttendanceRecordsService,
    LeaveService,
    MonitoringService,
    CalendarService,
    DeviceAuthGuard,
    KbService,
    PaymentsService,
    UsersService,
  ],
})
export class SolutionsModule {}
