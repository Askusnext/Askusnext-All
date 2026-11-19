import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { TicketReportsService } from './ticket-reports.service';

const int = (v: string | undefined, fallback: number) => parseInt(v ?? '', 10) || fallback;

/** Counters and charts are computed from the tickets the caller is allowed to see, never org-wide for everyone. */
@ApiTags('solutions-ticket-reports')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class TicketReportsController {
  constructor(private readonly reports: TicketReportsService) {}

  /** Per-category queue / open / expiring ≤ 30 days / expired. */
  @Permissions('reports')
  @Get('dashboard/counters')
  counters(@CurrentUser() user: AuthUser) {
    return this.reports.counters(user);
  }

  /** Monthly volume, category breakdown and average time to resolve. */
  @Permissions('reports')
  @Get('analytics/ticket-volume')
  volume(@CurrentUser() user: AuthUser, @Query('months') months?: string) {
    return this.reports.ticketVolume(user, int(months, 6));
  }

  /** Policies expiring within `days` (default 30) and those already expired. */
  @Permissions('tickets')
  @Get('renewals/upcoming')
  upcoming(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.reports.upcomingRenewals(user, int(days, 30));
  }

  /** Run the renewal pass now (it also runs by itself every 6 hours). Admins only. */
  @Roles(Role.Admin)
  @Post('renewals/generate')
  @HttpCode(200)
  generate() {
    return this.reports.generateRenewals();
  }
}
