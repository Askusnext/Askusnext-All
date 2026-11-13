import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, ProductAccess } from '../common/access';
import { REQUEST_STATUSES, RequestStatus } from './insurance.entities';
import { RequestsService } from './requests.service';

class ReviewDto {
  @IsIn(REQUEST_STATUSES as unknown as string[]) status: RequestStatus;
  @IsString() @MaxLength(2000) adminNote: string;
}

@ApiTags('insurance-admin')
@ApiBearerAuth()
@Controller('insurance/admin')
@UseGuards(JwtAuthGuard, AccessGuard)
@ProductAccess('insurance')
export class InsuranceAdminController {
  constructor(private readonly requests: RequestsService) {}

  @Get('requests')
  list() {
    return this.requests.listAll();
  }

  @Patch('requests/:id')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @CurrentUser() staff: AuthUser) {
    return this.requests.review(id, dto, staff);
  }
}
