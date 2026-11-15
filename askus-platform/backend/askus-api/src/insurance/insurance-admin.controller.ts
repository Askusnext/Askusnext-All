import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { REQUEST_STATUSES, RequestStatus } from './insurance.entities';
import { RequestsService } from './requests.service';

class ReviewDto {
  @IsIn(REQUEST_STATUSES as unknown as string[]) status: RequestStatus;
  @IsString() @MaxLength(2000) adminNote: string;
}

class AssignDto {
  /** A staff member's id, or null to release. */
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

@ApiTags('insurance-admin')
@ApiBearerAuth()
@Controller('insurance/admin')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.InsuranceAdmin)
export class InsuranceAdminController {
  constructor(private readonly requests: RequestsService) {}

  @Get('requests')
  list() {
    return this.requests.listAll();
  }

  @Patch('requests/:id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto, @CurrentUser() staff: AuthUser) {
    return this.requests.assign(id, dto.assigneeId ?? null, staff);
  }

  @Patch('requests/:id')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @CurrentUser() staff: AuthUser) {
    return this.requests.review(id, dto, staff);
  }
}
