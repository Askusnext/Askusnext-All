import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.SuperAdmin)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  logs() {
    return this.audit.recent();
  }
}
