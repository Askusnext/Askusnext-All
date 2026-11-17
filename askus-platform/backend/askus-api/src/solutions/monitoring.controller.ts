import { Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { Request, Response } from 'express';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { istDay } from './attendance.service';
import { datesBetween } from './attendance-records.service';
import { hoursPdf, hoursXlsx } from './monitoring-export';
import { DeviceContext, MonitoringService, POLICY_VERSION } from './monitoring.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type DeviceRequest = Request & { device: DeviceContext };

/** Authenticates the desktop agent by its device token (not by a person's sign-in). */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly monitoring: MonitoringService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<DeviceRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    req.device = await this.monitoring.authenticateDevice(scheme === 'Bearer' ? token : undefined);
    return true;
  }
}

class RegisterDto {
  @Matches(/^[A-Za-z0-9]{6,12}$/, { message: 'That is not a pairing code' }) code: string;
  @IsString() @MaxLength(100) deviceId: string;
  @IsOptional() @IsString() @MaxLength(120) deviceName?: string;
  @IsIn(['windows', 'mac']) platform: 'windows' | 'mac';
}

/** { employeeId, deviceId, timestamp, status, activeAppName }. Nothing else is accepted: no keystrokes, no coordinates. */
class HeartbeatDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsString() @MaxLength(100) deviceId: string;
  @IsISO8601() timestamp: string;
  @IsIn(['active', 'idle']) status: 'active' | 'idle';
  @IsOptional() @IsString() @MaxLength(120) activeAppName?: string;
}
class BatchDto {
  @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => HeartbeatDto) heartbeats: HeartbeatDto[];
}
class ConsentDto { @IsString() @MaxLength(20) policyVersion: string }
class ManualDto { @IsIn(['start', 'stop']) action: 'start' | 'stop' }
class RangeQuery {
  @Matches(DAY) from: string;
  @Matches(DAY) to: string;
  @IsOptional() @IsUUID() userId?: string;
}
class ExportQuery {
  @Matches(DAY) from: string;
  @Matches(DAY) to: string;
  @IsOptional() @IsIn(['xlsx', 'pdf']) format?: 'xlsx' | 'pdf';
}
class SettingDto {
  @IsIn(['user', 'role']) scope: 'user' | 'role';
  @IsString() @MaxLength(64) target: string;
  @IsOptional() @IsInt() @Min(0) @Max(1440) targetMinutesPerDay?: number | null;
  @IsOptional() @IsIn(['agent', 'manual']) trackingMethod?: 'agent' | 'manual' | null;
}

@ApiTags('solutions-monitoring')
@Controller('agent')
export class AgentController {
  constructor(private readonly monitoring: MonitoringService) {}

  /** Signed-in employee: get a one-time code to pair the desktop agent. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.Employee, Role.Agent)
  @Permissions('timesheet')
  @Post('pairing-code')
  @HttpCode(200)
  pairingCode(@CurrentUser() user: AuthUser) {
    return this.monitoring.createPairingCode(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.Employee, Role.Agent)
  @Permissions('timesheet')
  @Get('devices')
  devices(@CurrentUser() user: AuthUser) {
    return this.monitoring.myDevices(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.Employee, Role.Agent)
  @Permissions('timesheet')
  @Delete('devices/:id')
  removeDevice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.monitoring.revokeDevice(user, id);
  }

  /** The agent swaps the pairing code for a device token. Public, but needs a valid unexpired code. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto) {
    return this.monitoring.registerDevice(dto);
  }

  @ApiBearerAuth()
  @UseGuards(DeviceAuthGuard)
  @Get('status')
  status(@Req() req: DeviceRequest) {
    return this.monitoring.agentStatus(req.device);
  }

  // Heartbeats arrive every 90 s per device, and a queue can flush many at once, so the limit is generous.
  @ApiBearerAuth()
  @UseGuards(DeviceAuthGuard)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(@Body() dto: HeartbeatDto, @Req() req: DeviceRequest) {
    this.assertOwner(dto, req.device);
    return this.monitoring.ingest(req.device, [dto]);
  }

  /** The agent's offline queue, flushed in order once the connection is back. */
  @ApiBearerAuth()
  @UseGuards(DeviceAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('heartbeat/batch')
  @HttpCode(200)
  async batch(@Body() dto: BatchDto, @Req() req: DeviceRequest) {
    dto.heartbeats.forEach((h) => this.assertOwner(h, req.device));
    return this.monitoring.ingest(req.device, dto.heartbeats);
  }

  private assertOwner(dto: HeartbeatDto, device: DeviceContext) {
    // A payload that names another employee is refused, never silently re-assigned.
    if (dto.employeeId && dto.employeeId !== device.userId) throw new ForbiddenException('This device belongs to a different employee.');
  }
}

@ApiTags('solutions-monitoring')
@ApiBearerAuth()
@Controller('time')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('timesheet')
export class TimeController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('policy')
  policy() {
    return this.monitoring.policy();
  }

  /** The caller's own monitoring state: consent, tracking method, manual session, paired devices. */
  @Get('my')
  async my(@CurrentUser() user: AuthUser) {
    return { ...(await this.monitoring.manualState(user)), policy: this.monitoring.policy(), devices: await this.monitoring.myDevices(user.id) };
  }

  @Post('consent')
  @HttpCode(200)
  consent(@Body() dto: ConsentDto, @CurrentUser() user: AuthUser) {
    return this.monitoring.acceptConsent(user, dto.policyVersion ?? POLICY_VERSION);
  }

  /** For people without the desktop agent (field agents): a simple start/stop. */
  @Post('manual-entry')
  @HttpCode(200)
  manual(@Body() dto: ManualDto, @CurrentUser() user: AuthUser) {
    return this.monitoring.manualEntry(user, dto.action);
  }

  /** Live working / idle / offline. Admins see everyone, others only themselves. */
  @Get('active-status')
  activeStatus(@CurrentUser() user: AuthUser) {
    return this.monitoring.activeStatus(user);
  }

  @Get('daily-summary')
  dailySummary(@Query() q: RangeQuery, @CurrentUser() user: AuthUser) {
    return this.monitoring.dailySummary(user, q);
  }

  @Roles(Role.Admin)
  @Get('settings')
  settings() {
    return this.monitoring.settingsView();
  }

  /** Set a person's or a role's tracking method and minimum-hours target. */
  @Roles(Role.Admin)
  @Put('settings')
  saveSetting(@Body() dto: SettingDto, @CurrentUser() user: AuthUser) {
    return this.monitoring.saveSetting(user, dto);
  }

  @Roles(Role.Admin)
  @Delete('settings/:id')
  removeSetting(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.monitoring.removeSetting(user, id);
  }
}

@ApiTags('solutions-monitoring')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Admin)
export class WorkReportsController {
  constructor(private readonly monitoring: MonitoringService) {}

  /** Excel or PDF of the work-hour report for a date range. */
  @Get('export')
  async export(@Query() q: ExportQuery, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const format = q.format ?? 'xlsx';
    const rows = await this.monitoring.dailySummary(user, { from: q.from, to: q.to });
    const buffer = format === 'pdf' ? await hoursPdf(q.from, q.to, rows) : await hoursXlsx(q.from, q.to, rows, datesBetween(q.from, q.to));
    res.set({
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="work-hours-${q.from}_${q.to}-${istDay(new Date())}.${format}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
