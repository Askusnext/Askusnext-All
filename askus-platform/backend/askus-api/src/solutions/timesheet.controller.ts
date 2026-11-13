import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { AttendanceStatus } from './solutions.entities';
import { TimesheetService } from './timesheet.service';

class DayEntryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsIn(['Present', 'Absent', 'Half Day', 'Holiday', 'Leave'])
  status: AttendanceStatus;

  @IsNumber()
  @Min(0)
  @Max(24)
  hours: number;
}

class UpsertTimesheetDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart: string;

  @IsArray()
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => DayEntryDto)
  entries: DayEntryDto[];
}

class UpdateEntriesDto {
  @IsArray()
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => DayEntryDto)
  entries: DayEntryDto[];
}

@ApiTags('solutions-timesheet')
@ApiBearerAuth()
@Controller('timesheet')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class TimesheetController {
  constructor(private readonly timesheets: TimesheetService) {}

  @Get()
  findAll(@Query('weekStart') weekStart: string | undefined, @CurrentUser() user: AuthUser) {
    return this.timesheets.findAll(weekStart, user);
  }

  @Post()
  upsert(@Body() dto: UpsertTimesheetDto, @CurrentUser() user: AuthUser) {
    return this.timesheets.upsert(user, dto.weekStart, dto.entries);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntriesDto, @CurrentUser() user: AuthUser) {
    return this.timesheets.update(id, dto.entries, user);
  }
}
