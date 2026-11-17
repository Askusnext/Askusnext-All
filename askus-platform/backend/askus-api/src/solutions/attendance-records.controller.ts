import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { istDay } from './attendance.service';
import { registerPdf, registerXlsx } from './attendance-export';
import { AttendanceRecordsService } from './attendance-records.service';
import { ATTENDANCE_STATUSES, AttendanceStatus } from './leave.entities';
import { LeaveService } from './leave.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

class RangeQuery {
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
}
class MonthQuery {
  @Matches(MONTH, { message: 'month must look like 2026-11' }) month: string;
}
class ExportQuery extends MonthQuery {
  @IsOptional() @IsIn(['xlsx', 'pdf']) format?: 'xlsx' | 'pdf';
}
class ManualDto {
  @IsUUID() userId: string;
  @Matches(DAY) date: string;
  @IsIn(ATTENDANCE_STATUSES) status: AttendanceStatus;
  @IsOptional() @Matches(HM) checkIn?: string;
  @IsOptional() @Matches(HM) checkOut?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
class ConfigDto {
  @IsOptional() @Matches(HM) shiftStart?: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) graceMinutes?: number;
  @IsOptional() @IsInt() @Min(30) @Max(720) halfDayMinutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekOffDays?: number[];
}
class WeekOffRuleDto {
  @IsIn(['user', 'role']) scope: 'user' | 'role';
  @IsString() @MinLength(1) @MaxLength(64) target: string;
  @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) days: number[];
}
class HolidayQuery {
  @IsOptional() @Matches(/^\d{4}$/) year?: string;
}
class HolidayDto {
  @Matches(DAY) date: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) applicableTo?: string;
}

/**
 * Office attendance: check-in/out, the monthly register and manual corrections. Separate from the
 * work-hour tracking in attendance.controller.ts, which measures activity, not presence.
 */
@ApiTags('solutions-attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('timesheet')
export class AttendanceRecordsController {
  constructor(private readonly records: AttendanceRecordsService, private readonly leave: LeaveService) {}

  @Post('check-in')
  @HttpCode(200)
  checkIn(@CurrentUser() user: AuthUser) {
    return this.records.checkIn(user);
  }

  @Post('check-out')
  @HttpCode(200)
  checkOut(@CurrentUser() user: AuthUser) {
    return this.records.checkOut(user);
  }

  /** Today's status for the signed-in person; the screen polls this so it stays live. */
  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.records.today(user);
  }

  @Get('my-record')
  myRecord(@Query() q: RangeQuery, @CurrentUser() user: AuthUser) {
    const today = istDay(new Date());
    return this.records.myRecord(user, q.from ?? `${today.slice(0, 8)}01`, q.to ?? today);
  }

  // ───────── Admin / Super Admin ─────────

  @Roles(Role.Admin)
  @Get('register')
  register(@Query() q: MonthQuery) {
    return this.records.register(q.month);
  }

  @Roles(Role.Admin)
  @Get('late-report')
  lateReport(@Query() q: MonthQuery) {
    return this.records.lateReport(q.month);
  }

  @Roles(Role.Admin)
  @Get('missed-checkouts')
  missedCheckouts() {
    return this.records.missedCheckouts();
  }

  /** Excel or PDF of a month's register, for payroll. */
  @Roles(Role.Admin)
  @Get('export')
  async export(@Query() q: ExportQuery, @Res() res: Response) {
    const format = q.format ?? 'xlsx';
    const reg = await this.records.register(q.month);
    const buffer = format === 'pdf'
      ? await registerPdf(reg)
      : await registerXlsx(reg, await this.records.lateReport(q.month), await this.leave.balanceSummary(Number(q.month.slice(0, 4))));
    res.set({
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance-${q.month}.${format}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  /** Mark or correct a day by hand, e.g. a forgotten check-in. Logged with who changed what. */
  @Roles(Role.Admin)
  @Put('manual')
  manual(@Body() dto: ManualDto, @CurrentUser() user: AuthUser) {
    return this.records.manualMark(user, dto);
  }

  @Roles(Role.Admin)
  @Get('config')
  config() {
    return this.records.configView();
  }

  @Roles(Role.Admin)
  @Put('config')
  updateConfig(@Body() dto: ConfigDto, @CurrentUser() user: AuthUser) {
    return this.records.updateConfig(user, dto);
  }

  @Roles(Role.Admin)
  @Put('week-off')
  weekOff(@Body() dto: WeekOffRuleDto, @CurrentUser() user: AuthUser) {
    return this.records.setWeekOffRule(user, dto);
  }

  @Roles(Role.Admin)
  @Delete('week-off/:id')
  removeWeekOff(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.records.removeWeekOffRule(user, id);
  }
}

@ApiTags('solutions-attendance')
@ApiBearerAuth()
@Controller('holidays')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('timesheet')
export class HolidaysController {
  constructor(private readonly records: AttendanceRecordsService) {}

  @Get()
  list(@Query() q: HolidayQuery) {
    return this.records.listHolidays(q.year ? Number(q.year) : undefined);
  }

  @Roles(Role.Admin)
  @Post()
  add(@Body() dto: HolidayDto, @CurrentUser() user: AuthUser) {
    return this.records.addHoliday(user, dto);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.records.removeHoliday(user, id);
  }
}
