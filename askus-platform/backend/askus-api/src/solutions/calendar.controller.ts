import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { CalendarService } from './calendar.service';
import { CalendarProvider, MeetingScope, TEAMS, Team } from './calendar.entities';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

class ConnectDto { @IsIn(['google', 'microsoft']) provider: CalendarProvider }
class RangeQuery {
  @Matches(DAY) from: string;
  @Matches(DAY) to: string;
  @IsOptional() @IsIn([...TEAMS]) team?: string;
}
class ManualDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsISO8601() startTime: string;
  @IsISO8601() endTime: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) attendeeIds?: string[];
  @IsOptional() @IsIn(['private', 'team']) visibilityScope?: MeetingScope;
}
class UpdateMeetingDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @IsISO8601() startTime?: string;
  @IsOptional() @IsISO8601() endTime?: string;
  @IsOptional() @IsIn(['private', 'team']) visibilityScope?: MeetingScope;
}
class MemberDto {
  @IsIn([...TEAMS]) team: Team;
  @IsUUID() userId: string;
  @IsBoolean() member: boolean;
}

/** Any signed-in staff member. What each role can see is decided inside the service, on the server. */
@ApiTags('solutions-calendar')
@ApiBearerAuth()
@Controller('calendar')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('connections')
  connections(@CurrentUser() user: AuthUser) {
    return this.calendar.connectionsView(user.id);
  }

  /** Starts the Google / Microsoft sign-in. Returns the provider's consent-screen URL to send the browser to. */
  @Post('connect')
  @HttpCode(200)
  connect(@Body() dto: ConnectDto, @CurrentUser() user: AuthUser) {
    return this.calendar.startConnect(user, dto.provider);
  }

  @Delete('connections/:id')
  disconnect(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.calendar.disconnect(user, id);
  }

  /** Pull the latest meetings for the caller's own connected accounts. (The background job does this every 20 minutes.) */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser) {
    return this.calendar.syncMine(user);
  }

  /** Own meetings + leave + status, merged. Employees and agents only ever receive their own data. */
  @Get('my-events')
  myEvents(@Query() q: RangeQuery, @CurrentUser() user: AuthUser) {
    return this.calendar.myEvents(user, q.from, q.to);
  }

  /** Admin: the combined calendar of the people on their team(s). */
  @Roles(Role.Admin)
  @Get('team-view')
  teamView(@Query() q: RangeQuery, @CurrentUser() user: AuthUser) {
    return this.calendar.grid(user, 'team', q.from, q.to, q.team);
  }

  /** Super Admin: every team and venture, optionally filtered to one. */
  @Roles(Role.SuperAdmin)
  @Get('org-view')
  orgView(@Query() q: RangeQuery, @CurrentUser() user: AuthUser) {
    return this.calendar.grid(user, 'org', q.from, q.to, q.team);
  }

  @Roles(Role.Admin)
  @Get('teams')
  teams(@CurrentUser() user: AuthUser) {
    return this.calendar.listTeams(user);
  }

  @Roles(Role.Admin)
  @Put('teams/members')
  setMember(@Body() dto: MemberDto, @CurrentUser() user: AuthUser) {
    return this.calendar.setMember(user, dto);
  }
}

/** Endpoints that are not called with a person's sign-in: the provider's redirect, and an external cron. */
@ApiTags('solutions-calendar')
@Controller('calendar')
export class CalendarPublicController {
  constructor(private readonly calendar: CalendarService) {}

  /** Google / Microsoft send the browser here after the person allows access. The signed `state` says who it is for. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('oauth/callback')
  async callback(@Query() q: Record<string, string>, @Res() res: Response) {
    res.redirect(302, await this.calendar.finishConnect({ code: q.code, state: q.state, error: q.error }));
  }

  /** For an external scheduler: pulls every connected calendar. Needs the CALENDAR_SYNC_KEY in the x-cron-key header. */
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('sync-all')
  @HttpCode(200)
  syncAll(@Headers('x-cron-key') key: string | undefined) {
    this.calendar.assertCronKey(key);
    return this.calendar.syncAll();
  }
}

@ApiTags('solutions-calendar')
@ApiBearerAuth()
@Controller('meetings')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class MeetingsController {
  constructor(private readonly calendar: CalendarService) {}

  /** A meeting that is not in any synced calendar. An Admin can add one for someone on their team. */
  @Post('manual')
  @HttpCode(200)
  create(@Body() dto: ManualDto, @CurrentUser() user: AuthUser) {
    return this.calendar.createManual(user, dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() user: AuthUser) {
    return this.calendar.updateManual(user, id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.calendar.deleteManual(user, id);
  }
}
