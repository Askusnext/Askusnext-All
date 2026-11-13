import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayNotEmpty, IsEnum } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';

class SetRolesDto {
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  roles: Role[];
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.SuperAdmin)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  listUsers() {
    return this.users.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  @Patch('users/:id/roles')
  async setRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolesDto, @CurrentUser() actor: AuthUser) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.roles = dto.roles;
    await this.users.save(user);
    await this.audit.log({ actorId: actor.id, action: 'admin.set_roles', resource: `user:${id}`, metadata: { roles: dto.roles } });
    return user;
  }
}
