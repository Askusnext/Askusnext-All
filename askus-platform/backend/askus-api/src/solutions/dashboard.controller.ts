import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { DashboardService } from './dashboard.service';

@ApiTags('solutions-dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  kpis() {
    return this.dashboard.getKPIs();
  }

  @Get('expiry-alerts')
  expiryAlerts(@Query('days') days?: string) {
    return this.dashboard.getExpiryAlerts(Math.min(365, parseInt(days || '60', 10) || 60));
  }

  @Get('monthly')
  monthly() {
    return this.dashboard.getMonthly();
  }
}
