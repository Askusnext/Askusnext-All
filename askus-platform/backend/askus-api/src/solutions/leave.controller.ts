import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { LeaveStatus } from './leave.entities';
import { LeaveService } from './leave.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

class RequestDto {
  @IsUUID() leaveTypeId: string;
  @Matches(DAY) fromDate: string;
  @Matches(DAY) toDate: string;
  @IsString() @MinLength(3, { message: 'Please give a reason' }) @MaxLength(500) reason: string;
}
class DecideDto {
  @IsUUID() id: string;
  @IsIn(['approved', 'rejected']) decision: 'approved' | 'rejected';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
class BalanceQuery {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @Matches(/^\d{4}$/) year?: string;
}
class YearQuery {
  @IsOptional() @Matches(/^\d{4}$/) year?: string;
}
class ListQuery {
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'cancelled']) status?: LeaveStatus;
}
class TypeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(366) defaultDaysPerYear?: number;
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const isAdmin = (u: AuthUser) => u.roles.includes(Role.SuperAdmin) || u.roles.includes(Role.Admin);

@ApiTags('solutions-leave')
@ApiBearerAuth()
@Controller('leave')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('timesheet')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('types')
  types() {
    return this.leave.listTypes();
  }

  @Post('request')
  @HttpCode(200)
  request(@Body() dto: RequestDto, @CurrentUser() user: AuthUser) {
    return this.leave.request(user, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.leave.cancel(user, id);
  }

  /** The caller's own requests, newest first, with their decisions. */
  @Get('my')
  my(@CurrentUser() user: AuthUser) {
    return this.leave.mine(user.id);
  }

  /** Remaining leave by type. Admins may look at someone else with ?userId=. */
  @Get('balance')
  balance(@Query() q: BalanceQuery, @CurrentUser() user: AuthUser) {
    if (q.userId && q.userId !== user.id && !isAdmin(user)) throw new ForbiddenException();
    return this.leave.balance(q.userId ?? user.id, q.year ? Number(q.year) : undefined);
  }

  // ───────── Admin / Super Admin ─────────

  @Roles(Role.Admin)
  @Get('requests')
  requests(@Query() q: ListQuery) {
    return this.leave.list(q.status);
  }

  @Roles(Role.Admin)
  @Post('approve')
  @HttpCode(200)
  approve(@Body() dto: DecideDto, @CurrentUser() user: AuthUser) {
    return this.leave.decide(user, dto);
  }

  @Roles(Role.Admin)
  @Get('balance-summary')
  summary(@Query() q: YearQuery) {
    return this.leave.balanceSummary(q.year ? Number(q.year) : undefined);
  }

  @Roles(Role.Admin)
  @Get('types/all')
  allTypes() {
    return this.leave.listTypes(true);
  }

  @Roles(Role.Admin)
  @Post('types')
  createType(@Body() dto: TypeDto, @CurrentUser() user: AuthUser) {
    return this.leave.saveType(user, null, dto);
  }

  @Roles(Role.Admin)
  @Put('types/:id')
  updateType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TypeDto, @CurrentUser() user: AuthUser) {
    return this.leave.saveType(user, id, dto);
  }
}
