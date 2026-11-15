import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { ActivityService } from './activity.service';

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

class ListQuery {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsIn(['loans', 'insurance', 'tickets', 'timesheet', 'tracking', 'auth', 'system']) module?: string;
  @IsOptional() @IsString() @MaxLength(60) action?: string;
  @IsOptional() @IsString() @MaxLength(80) entityId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Matches(ISO) from?: string;
  @IsOptional() @Matches(ISO) to?: string;
  @IsOptional() @Matches(ISO) before?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class SummaryQuery {
  @Matches(ISO) from: string;
  @Matches(ISO) to: string;
}

class ViewDto {
  @IsIn(['loans', 'insurance', 'tickets']) module: 'loans' | 'insurance' | 'tickets';
  @IsString() @MaxLength(40) entityType: string;
  @IsString() @MaxLength(80) entityId: string;
  @IsOptional() @IsString() @MaxLength(120) entityLabel?: string;
}

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** The activity feed: everyone's for an admin, your own for everybody else. */
  @Get()
  list(@Query() q: ListQuery, @CurrentUser() user: AuthUser) {
    return this.activity.list(user, q);
  }

  /** Per-person totals for a period. */
  @Get('summary')
  summary(@Query() q: SummaryQuery, @CurrentUser() user: AuthUser) {
    return this.activity.summary(user, q.from, q.to);
  }

  /** Staff who can be given work (for the "assign to" lists). */
  @Get('staff')
  staff(@CurrentUser() user: AuthUser) {
    return this.activity.staff(user);
  }

  /** Open work per staff member and what nobody owns yet. */
  @Get('workload')
  workload(@CurrentUser() user: AuthUser) {
    return this.activity.workload(user);
  }

  /** A staff member opened a customer's record. Repeats within 10 minutes are ignored. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('view')
  @HttpCode(200)
  view(@Body() dto: ViewDto, @CurrentUser() user: AuthUser) {
    return this.activity.recordView(user, dto);
  }
}
