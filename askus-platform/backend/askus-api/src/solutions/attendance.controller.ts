import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { AttendanceService } from './attendance.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

class FixDto {
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) accuracy?: number;
}

class PingDto extends FixDto {
  @IsIn(['active', 'idle']) state: 'active' | 'idle';
}

class ConsentDto {
  @IsString() @MaxLength(20) version: string;
}

class LiveQuery {
  @IsOptional() @Matches(DAY) date?: string;
}

class TrailQuery {
  @IsUUID() userId: string;
  @Matches(DAY) date: string;
}

@ApiTags('solutions-attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('timesheet')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** The signed-in employee's own state: notice accepted?, running session, today's sessions and hours. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.attendance.me(user);
  }

  @Post('consent')
  @HttpCode(200)
  consent(@Body() dto: ConsentDto, @CurrentUser() user: AuthUser) {
    return this.attendance.acceptConsent(user, dto.version);
  }

  @Post('start')
  @HttpCode(200)
  start(@Body() dto: FixDto, @CurrentUser() user: AuthUser) {
    return this.attendance.start(user, dto);
  }

  // One sample every couple of minutes is normal; the limit only stops runaway clients.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('ping')
  @HttpCode(200)
  ping(@Body() dto: PingDto, @CurrentUser() user: AuthUser) {
    return this.attendance.ping(user, dto, dto.state);
  }

  @Post('stop')
  @HttpCode(200)
  stop(@Body() dto: FixDto, @CurrentUser() user: AuthUser) {
    return this.attendance.stop(user, dto);
  }

  /** Everyone's status for a day. Admins and employees only. */
  @Get('live')
  live(@Query() q: LiveQuery, @CurrentUser() user: AuthUser) {
    return this.attendance.live(user, q.date);
  }

  /** One person's sessions and location trail for a day. Admins and employees only. */
  @Get('trail')
  trail(@Query() q: TrailQuery, @CurrentUser() user: AuthUser) {
    return this.attendance.trail(user, q.userId, q.date);
  }
}
