import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const IDENTIFIER = /^(\+?\d{10,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

export class RequestOtpDto {
  @Matches(IDENTIFIER, { message: 'identifier must be a mobile number or email' })
  identifier: string;

  // The staff app sets this so it can show an account's pending/rejected status instead of sending a code.
  @IsOptional()
  @IsIn(['staff'])
  app?: 'staff';
}

export class VerifyOtpDto extends RequestOtpDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class LoginPasswordDto extends RequestOtpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
