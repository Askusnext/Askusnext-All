import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/access';
import { User } from '../identity/identity.entities';
import { CustomerProfile } from './customer.entity';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(250) address?: string;
  @IsOptional() @Matches(/^(\d{6})?$/, { message: 'pincode must be 6 digits' }) pincode?: string;
  @IsOptional() @IsEmail() @MaxLength(120) contactEmail?: string;
}

@ApiTags('customer')
@ApiBearerAuth()
@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(
    @InjectRepository(CustomerProfile) private readonly profiles: Repository<CustomerProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async load(userId: string) {
    const profile =
      (await this.profiles.findOne({ where: { userId } })) ?? (await this.profiles.save(this.profiles.create({ userId })));
    const account = await this.users.findOneByOrFail({ id: userId });
    return { ...profile, mobile: account.mobile, loginEmail: account.email };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.load(user.id);
  }

  @Patch('me')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    await this.load(user.id);
    await this.profiles.update({ userId: user.id }, dto);
    // Keep the account name in step so tokens and staff screens show it.
    if (dto.displayName?.trim()) await this.users.update({ id: user.id }, { fullName: dto.displayName.trim() });
    return this.load(user.id);
  }
}
