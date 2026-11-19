import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { LEAD_STATUSES, LeadStatus, LeadVertical } from './leads.entities';
import { LeadsService } from './leads.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

class CreateLeadDto {
  @IsIn(['insurance', 'loan']) vertical: LeadVertical;
  @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @Matches(/^[+\d][\d\s-]{8,14}$/, { message: 'Enter a valid phone number' }) customerPhone: string;
  @IsOptional() @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Enter a valid email' }) customerEmail?: string;
  @IsOptional() @IsString() @MaxLength(20) vehicleRegNo?: string;
  @IsOptional() @IsString() @MaxLength(60) vehicleType?: string;
  @IsOptional() @IsString() @MaxLength(80) insurer?: string;
  @IsOptional() @IsIn(['Comprehensive', 'Third-party', 'Renewal']) policyType?: string;
  @IsOptional() @IsString() @MaxLength(60) loanType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(1_000_000_000) loanAmount?: number;
  @IsOptional() @IsString() @MaxLength(80) lender?: string;
}
class ListQuery {
  @IsOptional() @IsIn(['mine', 'pool', 'working', 'claimed', 'all']) scope?: string;
  @IsOptional() @IsIn(['insurance', 'loan']) vertical?: string;
  @IsOptional() @IsIn(LEAD_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class StatusDto {
  @IsIn(LEAD_STATUSES) status: LeadStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) quoteAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) issuedAmount?: number;
  @IsOptional() @IsString() @MaxLength(80) policyNumber?: string;
  @IsOptional() @Matches(DAY) policyExpiryDate?: string;
  @IsOptional() @IsString() @MaxLength(500) rejectedReason?: string;
}
class LinkDto { @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) url: string }
class ReportQuery {
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @IsIn(['insurance', 'loan']) vertical?: string;
}
class RuleDto {
  @IsIn(['insurance', 'loan']) vertical: LeadVertical;
  @IsString() @MaxLength(80) partner: string;
  @IsIn(['percent', 'flat']) kind: 'percent' | 'flat';
  @Type(() => Number) @IsNumber() @Min(0) @Max(100_000_000) value: number;
}

const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const noStore = (res: Response) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); };

/**
 * Insurance and loan leads. Marketing/Sales (Employee/Agent with the Insurance or Loans module permission) raise and follow their
 * own leads; Admin/Ops of the vertical's team work the pool; the Super Admin sees everything. The rules are enforced in the service.
 */
@ApiTags('solutions-leads')
@ApiBearerAuth()
@Controller('leads')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser) {
    return this.leads.create(user, dto);
  }

  @Get()
  list(@Query() q: ListQuery, @CurrentUser() user: AuthUser) {
    return this.leads.list(user, q);
  }

  // ── reports and rules (before :id so they are not read as ids) ──
  @Roles(Role.Admin) @Get('reports/conversion') conversion(@Query() q: ReportQuery, @CurrentUser() u: AuthUser) { return this.leads.conversion(u, q); }
  @Roles(Role.Admin) @Get('reports/split') split(@Query() q: ReportQuery, @CurrentUser() u: AuthUser) { return this.leads.split(u, q); }
  @Roles(Role.Admin) @Get('reports/revenue') revenue(@Query() q: ReportQuery, @CurrentUser() u: AuthUser) { return this.leads.revenue(u, q); }
  @Roles(Role.Admin) @Get('reports/sla') sla(@Query() q: ReportQuery, @CurrentUser() u: AuthUser) { return this.leads.sla(u, q); }
  @Roles(Role.Admin) @Get('reports/commissions') commissions(@Query() q: ReportQuery, @CurrentUser() u: AuthUser) { return this.leads.commissions(u, q); }

  @Roles(Role.Admin) @Get('commission-rules') rules() { return this.leads.listRules(); }
  @Roles(Role.Admin) @Put('commission-rules') saveRule(@Body() dto: RuleDto, @CurrentUser() u: AuthUser) { return this.leads.saveRule(u, dto); }
  @Roles(Role.Admin) @Delete('commission-rules/:id') deleteRule(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.leads.deleteRule(u, id); }

  /** Runs the claim-timeout, SLA and reminder passes now (they also run on their own). Super Admin only. */
  @Roles(Role.SuperAdmin) @Post('maintenance/run') @HttpCode(200) maintenance() { return this.leads.runMaintenance(); }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.leads.detail(user, id);
  }

  @Roles(Role.Admin) @Post(':id/claim') @HttpCode(200)
  claim(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.leads.claim(user, id); }

  @Roles(Role.Admin) @Post(':id/release') @HttpCode(200)
  release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.leads.release(user, id); }

  @Roles(Role.Admin) @Put(':id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @CurrentUser() user: AuthUser) { return this.leads.setStatus(user, id, dto); }

  /** Creates a gateway payment link (Razorpay) for the quoted amount. */
  @Roles(Role.Admin) @Post(':id/payment-link/generate') @HttpCode(200)
  generateLink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.leads.generatePaymentLink(user, id); }

  @Roles(Role.Admin) @Put(':id/payment-link')
  setLink(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkDto, @CurrentUser() user: AuthUser) { return this.leads.setPaymentLink(user, id, dto.url); }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/documents') @HttpCode(200) @UseInterceptors(upload)
  uploadDoc(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: { buffer: Buffer; originalname: string; size: number } | undefined,
    @Body('kind') kind: string, @Body('paidAmount') paid: string | undefined, @CurrentUser() user: AuthUser) {
    const paidAmount = paid !== undefined && paid !== '' && Number.isFinite(Number(paid)) && Number(paid) > 0 ? Number(paid) : undefined;
    return this.leads.uploadDocument(user, id, file, kind, { paidAmount });
  }

  @Get(':id/documents/:docId')
  async download(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const { data, doc } = await this.leads.download(user, id, docId);
    noStore(res);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`);
    res.send(data);
  }
}

/** The customer's emailed link to the issued policy/loan copy. Signed and time-limited; it opens that one file and nothing else. */
@ApiTags('solutions-leads')
@Controller('leads/public')
export class LeadsPublicController {
  constructor(private readonly leads: LeadsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('doc/:token')
  async doc(@Param('token') token: string, @Res() res: Response) {
    const { data, doc } = await this.leads.downloadByToken(token);
    noStore(res);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`);
    res.send(data);
  }
}
