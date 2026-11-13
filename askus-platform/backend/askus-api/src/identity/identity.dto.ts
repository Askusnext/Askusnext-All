import { IsString, Matches, MinLength } from 'class-validator';

const IDENTIFIER = /^(\+?\d{10,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

export class RequestOtpDto {
  @Matches(IDENTIFIER, { message: 'identifier must be a mobile number or email' })
  identifier: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
