import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { PERMISSIONS, Role } from '../common/roles';
import { UsersService } from './users.service';

const STAFF_ROLES = ['Admin', 'Employee', 'Agent'] as const;
const MOBILE = /^(\+?\d{10,15})$/;

class CreateStaffDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @Matches(MOBILE, { message: 'mobile must be 10-15 digits' })
  mobile?: string;

  @IsIn(STAFF_ROLES)
  role: (typeof STAFF_ROLES)[number];

  // Object key returned by POST /users/aadhaar-upload-url after the file was uploaded.
  @IsString()
  aadhaarKey: string;

  @IsOptional()
  @IsArray()
  @IsIn(PERMISSIONS, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

class AadhaarUploadDto {
  @IsString()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  size: number;
}

class PermissionsDto {
  @IsArray()
  @IsIn(PERMISSIONS, { each: true })
  permissions: string[];
}

class SetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
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

// Super Admin passes every guard. Admin may manage Employees and Agents; the service blocks anything
// else (creating or editing Admins is Super Admin only).
@ApiTags('solutions-users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Admin)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Any signed-in user (staff or customer) can read their own profile.
  @Roles()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @Roles(Role.Employee)
  @Permissions('users')
  @Get()
  findStaff(@CurrentUser() actor: AuthUser) {
    return this.users.findStaff(actor);
  }

  @Roles(Role.SuperAdmin)
  @Get('pending')
  pending() {
    return this.users.findPending();
  }

  @Roles(Role.SuperAdmin)
  @Post(':id/approve')
  approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.review(actor, id, true);
  }

  @Roles(Role.SuperAdmin)
  @Post(':id/reject')
  reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.review(actor, id, false);
  }

  @Post('aadhaar-upload-url')
  aadhaarUploadUrl(@Body() dto: AadhaarUploadDto) {
    return this.users.aadhaarUploadUrl(dto);
  }

  @Get(':id/aadhaar')
  aadhaar(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.aadhaarDownloadUrl(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateStaffDto) {
    return this.users.create(actor, dto);
  }

  @Put(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.users.update(actor, id, dto);
  }

  @Put(':id/permissions')
  setPermissions(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PermissionsDto) {
    return this.users.setPermissions(actor, id, dto.permissions);
  }

  @Put(':id/password')
  setPassword(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPasswordDto) {
    return this.users.setPassword(actor, id, dto.password);
  }

  @Delete(':id')
  deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deactivate(actor, id);
  }
}
