import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { PresenceService } from './presence.service';
import { StaffHierarchyService } from './staff-hierarchy.service';

class NoticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  noticeVersion?: string;
}

class StartDto {
  @IsBoolean()
  inView: boolean;
}

class HeartbeatDto {
  @Matches(/^[A-Za-z0-9_-]{20,40}$/)
  sessionId: string;

  @IsBoolean()
  inView: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  seq: number;
}

class EndDto {
  @Matches(/^[A-Za-z0-9_-]{20,40}$/)
  sessionId: string;
}

class TeamQuery {
  @IsOptional() @IsIn(['Admin', 'Employee', 'Agent']) role?: string;
  @IsOptional() @IsIn(['active', 'background', 'away', 'offline', 'not_enabled']) state?: string;
  @IsOptional() @IsString() @MaxLength(36) adminId?: string;
  @IsOptional() @IsIn(['name', 'state', 'lastSeen']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) dir?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

class HistoryQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class AssignDto {
  /** A valid Admin id, or null to unassign. */
  @ValidateIf((o) => o.adminId !== null)
  @IsUUID()
  adminId: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class AuditQuery {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

// Admin holds Employee and Agent implicitly; Agents hold only AGENT, so both are listed.
const SELF = [Role.Employee, Role.Agent] as const;
const FEW = { default: { limit: 10, ttl: 60_000 } };
const BEAT = { default: { limit: 40, ttl: 60_000 } };

/**
 * Browser presence. Identity always comes from the verified token (the database then decides the role);
 * no endpoint accepts a subject, role, actor or team id from the client for self-service calls.
 * Route guards here only keep the obvious roles out; the services are the real boundary.
 */
@ApiTags('solutions-presence')
@ApiBearerAuth()
@Controller('presence')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly hierarchy: StaffHierarchyService,
  ) {}

  // ── the signed-in person's own consent and tracking (Admin / Employee / Agent) ──

  @Roles(...SELF)
  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.presence.me(u);
  }

  @Roles(...SELF)
  @Throttle(FEW)
  @Post('consent/accept')
  accept(@CurrentUser() u: AuthUser, @Body() dto: NoticeDto) {
    return this.presence.decide(u, 'accepted', dto.noticeVersion);
  }

  @Roles(...SELF)
  @Throttle(FEW)
  @Post('consent/defer')
  defer(@CurrentUser() u: AuthUser, @Body() dto: NoticeDto) {
    return this.presence.decide(u, 'deferred', dto.noticeVersion);
  }

  @Roles(...SELF)
  @Throttle(FEW)
  @Post('consent/withdraw')
  withdraw(@CurrentUser() u: AuthUser) {
    return this.presence.decide(u, 'withdrawn');
  }

  @Roles(...SELF)
  @Throttle(FEW)
  @Post('sessions')
  start(@CurrentUser() u: AuthUser, @Body() dto: StartDto) {
    return this.presence.startSession(u, dto.inView);
  }

  @Roles(...SELF)
  @Throttle(BEAT)
  @Post('heartbeat')
  heartbeat(@CurrentUser() u: AuthUser, @Body() dto: HeartbeatDto) {
    return this.presence.heartbeat(u, dto);
  }

  @Roles(...SELF)
  @Throttle(FEW)
  @Post('sessions/end')
  end(@CurrentUser() u: AuthUser, @Body() dto: EndDto) {
    return this.presence.endSession(u, dto.sessionId);
  }

  // ── managers: Admin (own reports only) and Super Admin (everyone) ──

  @Roles(Role.Admin)
  @Get('team')
  team(@CurrentUser() u: AuthUser, @Query() q: TeamQuery) {
    return this.presence.team(u, q);
  }

  // Declared before :userId so "export" is never read as an id.
  @Roles(Role.Admin)
  @Throttle(FEW)
  @Get('team/export')
  async export(@CurrentUser() u: AuthUser, @Res() res: Response) {
    const csv = await this.presence.exportCsv(u);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="presence.csv"');
    res.send(csv);
  }

  @Roles(Role.Admin)
  @Get('team/:userId/history')
  history(@CurrentUser() u: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Query() q: HistoryQuery) {
    return this.presence.history(u, userId, q.limit);
  }

  // ── assignment: Super Admin only ──

  @Roles(Role.SuperAdmin)
  @Get('admins')
  async admins(@CurrentUser() u: AuthUser) {
    await this.hierarchy.superAdmin(u);
    return this.hierarchy.listAdmins();
  }

  @Roles(Role.SuperAdmin)
  @Throttle(FEW)
  @Put('assignments/:userId')
  assign(@CurrentUser() u: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AssignDto) {
    return this.hierarchy.assign(u, userId, dto.adminId, dto.reason);
  }

  @Roles(Role.SuperAdmin)
  @Get('assignments/audit')
  audit(@CurrentUser() u: AuthUser, @Query() q: AuditQuery) {
    return this.hierarchy.auditFor(u, q.userId, q.limit ?? 50);
  }
}
