import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { UsersService } from './users.service';

const STAFF_ROLES = ['Admin', 'Employee', 'Agent'] as const;
const MOBILE = /^(\+?\d{10,15})$/;

class CreateStaffDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(MOBILE, { message: 'mobile must be 10-15 digits' })
  mobile?: string;

  @IsIn(STAFF_ROLES)
  role: (typeof STAFF_ROLES)[number];
}

class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(MOBILE, { message: 'mobile must be 10-15 digits' })
  mobile?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: (typeof STAFF_ROLES)[number];
}

@ApiTags('solutions-users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.SuperAdmin)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Any signed-in user (staff or customer) can read their own profile.
  @Roles()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @Get()
  findStaff() {
    return this.users.findStaff();
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.users.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.deactivate(id);
  }
}
