import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RefreshDto, RequestOtpDto, VerifyOtpDto } from './identity.dto';
import { IdentityService } from './identity.service';

@ApiTags('auth')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-otp')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.identity.requestOtp(dto.identifier);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.identity.verifyOtp(dto.identifier, dto.code);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.identity.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.identity.logout(dto.refreshToken);
  }
}
