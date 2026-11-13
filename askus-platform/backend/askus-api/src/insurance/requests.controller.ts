import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/access';
import { DocRef } from './insurance.entities';
import { MAX_UPLOAD_BYTES, RequestsService } from './requests.service';
import { VehicleService } from './vehicle.service';

class DocRefDto implements DocRef {
  @IsString() @MaxLength(160) name: string;
  @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) size: number;
  @IsString() @MaxLength(100) mimeType: string;
  @IsString() @MaxLength(200) key: string;
  @IsString() @MaxLength(10) format: string;
  @IsOptional() @IsIn(['rc', 'policy']) kind?: 'rc' | 'policy';
}

class OfflineRequestDto {
  @IsUUID() id: string;
  @IsIn(['car', 'bike']) vehicleType: 'car' | 'bike';
  @IsObject() applicant: Record<string, unknown>;
  @IsObject() vehicle: Record<string, unknown>;
  @IsObject() policy: Record<string, unknown>;
  @IsObject() plan: Record<string, unknown>;
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => DocRefDto) documents: DocRefDto[];
}

class DocumentRequestDto {
  @IsUUID() id: string;
  @IsString() @MaxLength(80) name: string;
  @IsString() @MaxLength(20) mobile: string;
  @IsString() @MaxLength(80) type: string;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => DocRefDto) documents: DocRefDto[];
}

class SignUploadDto {
  @IsUUID() requestId: string;
  @IsInt() @Min(0) @Max(9) index: number;
  @IsIn(['pdf', 'jpg', 'jpeg', 'png', 'webp']) extension: string;
  @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) size: number;
}

class DownloadDto {
  @IsString() @MaxLength(200) key: string;
}

class VehicleLookupDto {
  @Matches(/^([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/, { message: 'Enter a valid registration number.' })
  regNumber: string;
}

@ApiTags('insurance-customer')
@ApiBearerAuth()
@Controller('insurance')
@UseGuards(JwtAuthGuard)
export class InsuranceRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly vehicles: VehicleService,
  ) {}

  @Post('requests/offline')
  createOffline(@Body() dto: OfflineRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.createOffline(user, dto);
  }

  @Post('requests/documents')
  createDocuments(@Body() dto: DocumentRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.createDocuments(user, dto);
  }

  @Get('requests/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.requests.listMine(user.id);
  }

  @Post('documents/sign')
  @HttpCode(200)
  sign(@Body() dto: SignUploadDto, @CurrentUser() user: AuthUser) {
    return this.requests.signUpload(user, dto);
  }

  @Post('documents/download')
  @HttpCode(200)
  download(@Body() dto: DownloadDto, @CurrentUser() user: AuthUser) {
    return this.requests.signDownload(user, dto.key);
  }

  // Paid provider call per lookup, so it is rate limited per client.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('vehicle/lookup')
  @HttpCode(200)
  lookup(@Body() dto: VehicleLookupDto) {
    return this.vehicles.lookup(dto.regNumber);
  }
}
