import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// AskUs Solutions ticket management (migrated from the standalone TMS backend).
@Module({
  imports: [TypeOrmModule.forFeature([Ticket, SolutionsCustomer, SolutionsVehicle, Counter, Timesheet, KBArticle])],
  controllers: [
    TicketsController,
    CustomerTicketsController,
    DashboardController,
    TimesheetController,
    KbController,
    PaymentsController,
    UsersController,
  ],
  providers: [
    CounterService,
    TicketsService,
    CustomerTicketsService,
    DashboardService,
    TimesheetService,
    KbService,
    PaymentsService,
    UsersService,
  ],
})
export class SolutionsModule {}
