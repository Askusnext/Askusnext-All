import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { DashboardService } from './dashboard.service';

@ApiTags('solutions-dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('reports')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  kpis(@CurrentUser() user: AuthUser) {
    return this.dashboard.getKPIs(user);
  }

  @Get('expiry-alerts')
  expiryAlerts(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.dashboard.getExpiryAlerts(user, Math.min(365, parseInt(days || '60', 10) || 60));
  }

  @Get('monthly')
  monthly(@CurrentUser() user: AuthUser) {
    return this.dashboard.getMonthly(user);
  }
}
