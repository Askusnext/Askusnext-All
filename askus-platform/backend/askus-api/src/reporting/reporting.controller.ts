import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGuard, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { BusinessSummary } from './reporting.entities';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('reporting')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.SuperAdmin)
export class ReportingController {
  constructor(@InjectRepository(BusinessSummary) private readonly summary: Repository<BusinessSummary>) {}

  @Get('summary')
  getSummary() {
    return this.summary.find({ order: { product: 'ASC' } });
  }
}
