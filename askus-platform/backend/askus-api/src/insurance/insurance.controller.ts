import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGuard, JwtAuthGuard, ProductAccess } from '../common/access';
import { Claim, Policy } from './insurance.entities';

@ApiTags('insurance')
@ApiBearerAuth()
@Controller('insurance')
@UseGuards(JwtAuthGuard, AccessGuard)
@ProductAccess('insurance')
export class InsuranceController {
  constructor(
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    @InjectRepository(Claim) private readonly claims: Repository<Claim>,
  ) {}

  @Get('policies')
  listPolicies() {
    return this.policies.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  @Get('claims')
  listClaims() {
    return this.claims.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
