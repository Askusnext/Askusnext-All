import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGuard, JwtAuthGuard, ProductAccess } from '../common/access';
import { LoanApplication } from './loans.entities';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard, AccessGuard)
@ProductAccess('loans')
export class LoansController {
  constructor(@InjectRepository(LoanApplication) private readonly applications: Repository<LoanApplication>) {}

  @Get('applications')
  listApplications() {
    return this.applications.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
