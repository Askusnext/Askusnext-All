import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const IDENTIFIER = /^(\+?\d{10,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

export class RequestOtpDto {
  @Matches(IDENTIFIER, { message: 'identifier must be a mobile number or email' })
  identifier: string;

  // The staff app sets this so it can show an account's pending/rejected status instead of sending a code.
  @IsOptional()
  @IsIn(['staff'])
  app?: 'staff';

  // Ask for the mobile code on WhatsApp instead of SMS/email. Falls back by itself when WhatsApp cannot deliver.
  @IsOptional()
  @IsIn(['whatsapp'])
  channel?: 'whatsapp';

  // First sign-in only: the other contact (email if identifier is a mobile, and vice versa).
  @IsOptional()
  @Matches(IDENTIFIER, { message: 'otherIdentifier must be a mobile number or email' })
  otherIdentifier?: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  // First sign-in only: the code sent to otherIdentifier.
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'otherCode must be 6 digits' })
  otherCode?: string;
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
