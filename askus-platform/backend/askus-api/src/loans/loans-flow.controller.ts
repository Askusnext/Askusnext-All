import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Put,
  Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { ActivityService } from '../activity/activity.service';
import { LoansFilesService, MAX_LOAN_FILE_BYTES } from './loans-files.service';
import { isLoansReviewer, LoansFlowService, QUOTE_STATUSES, QUOTE_STEPS, QuoteStatus } from './loans-flow.service';

const KEY = /^[a-z0-9_-]{1,40}__[a-z0-9_-]{1,40}$/i;
const SLOT = /^[a-z0-9_]{1,40}$/;

class SaveDetailsDto {
  @IsObject() details: Record<string, unknown>;
}

class QuoteBaseDto {
  @Matches(/^[a-z0-9_-]{1,40}$/i) loanType: string;
  @Matches(/^[a-z0-9_-]{1,40}$/i) lenderId: string;
  @IsNumber() @Min(0) @Max(1_000_000_000) amount: number;
  @IsInt() @Min(1) @Max(480) tenureMonths: number;
  @IsNumber() @Min(0) @Max(100) roi: number;
  @IsOptional() @IsString() @MaxLength(200) purpose?: string;
}

class SaveQuoteDto extends QuoteBaseDto {
  @IsIn(QUOTE_STEPS) step: string;
}

class SubmitQuoteDto extends QuoteBaseDto {
  @IsString() @MinLength(1) @MaxLength(40) consentVersion: string;
}

class SaveDocDto {
  @Matches(SLOT) slot: string;
  @IsString() @MaxLength(120) label: string;
  @IsString() @MaxLength(160) fileName: string;
  @IsInt() @Min(1) @Max(MAX_LOAN_FILE_BYTES) fileSize: number;
  @IsString() @MaxLength(100) mimeType: string;
  @IsString() @MaxLength(250) storageKey: string;
  @IsString() @MaxLength(60) fileId: string;
  @IsString() @MaxLength(10) fileFormat: string;
  @IsOptional() @IsInt() @Min(0) fileVersion?: number;
  @IsOptional() @IsString() @MaxLength(40) period?: string;
}

class UploadDto {
  @IsUUID() draftId: string;
  @Matches(SLOT) documentType: string;
}

class FormSubmitDto {
  @IsObject() data: Record<string, unknown>;
  @IsArray() documents: Record<string, unknown>[];
}

class TicketDto {
  @IsString() @MinLength(3) @MaxLength(160) subject: string;
  @IsString() @MinLength(3) @MaxLength(4000) message: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(120) userName?: string;
  @IsOptional() @IsString() @MaxLength(20) userMobile?: string;
}

class StatusDto {
  @IsIn(QUOTE_STATUSES) to: QuoteStatus;
  @IsOptional() @IsString() @MaxLength(500) message?: string;
  @IsOptional() @IsString() @MaxLength(1000) internalNote?: string;
}

class ReviewDocDto {
  @IsIn(['verified', 'rejected']) reviewStatus: 'verified' | 'rejected';
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class AssignDto {
  /** A staff member's id, or null to release. */
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

class NoteDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

const FORM_STATUSES = [
  'draft', 'submitted', 'under_review', 'documents_required', 'verification_pending', 'approved', 'rejected', 'disbursed', 'closed',
];
class FormStatusDto {
  @IsIn(FORM_STATUSES) status: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class FormDocStatusDto {
  @IsIn(['pending', 'verified', 'rejected', 'reupload_required']) status: string;
  @IsOptional() @IsString() @MaxLength(300) rejectionReason?: string;
}

function checkKey(key: string) {
  if (!KEY.test(key)) throw new BadRequestException('Invalid application id.');
  return key;
}

function checkSlot(slot: string) {
  if (!SLOT.test(slot)) throw new BadRequestException('Invalid document.');
  return slot;
}

// ───────────────────────── customer ─────────────────────────

@ApiTags('loans-customer')
@ApiBearerAuth()
@Controller('loans/me')
@UseGuards(JwtAuthGuard)
export class LoansCustomerController {
  constructor(private readonly flow: LoansFlowService) {}

  @Get('details')
  details(@CurrentUser() u: AuthUser) {
    return this.flow.getDetails(u.id);
  }

  @Put('details')
  saveDetails(@CurrentUser() u: AuthUser, @Body() dto: SaveDetailsDto) {
    return this.flow.saveDetails(u.id, dto.details);
  }

  @Get('quote-applications')
  list(@CurrentUser() u: AuthUser) {
    return this.flow.listQuoteApps(u.id);
  }

  @Put('quote-applications')
  save(@CurrentUser() u: AuthUser, @Body() dto: SaveQuoteDto) {
    return this.flow.saveQuoteApp(u.id, dto);
  }

  @Post('quote-applications/submit')
  @HttpCode(200)
  async submit(@CurrentUser() u: AuthUser, @Body() dto: SubmitQuoteDto) {
    return { referenceNumber: await this.flow.submitQuote(u, dto) };
  }

  @Get('quote-applications/reusable-documents')
  reusable(@CurrentUser() u: AuthUser, @Query('exclude') exclude: string) {
    return this.flow.findReusable(u.id, checkKey(exclude ?? ''));
  }

  @Get('quote-applications/:key')
  one(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    return this.flow.getQuoteApp(u.id, checkKey(key));
  }

  @Delete('quote-applications/:key')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    await this.flow.deleteQuoteApp(u.id, checkKey(key));
  }

  @Post('quote-applications/:key/draft-id')
  @HttpCode(200)
  async draft(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    return { draftId: await this.flow.ensureDraftId(u.id, checkKey(key)) };
  }

  @Post('quote-applications/:key/resubmit')
  @HttpCode(204)
  async resubmit(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    await this.flow.resubmitQuote(u, checkKey(key));
  }

  @Get('quote-applications/:key/history')
  history(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    return this.flow.history(u.id, checkKey(key));
  }

  @Get('quote-applications/:key/documents')
  docs(@CurrentUser() u: AuthUser, @Param('key') key: string) {
    return this.flow.listQuoteDocs(u.id, checkKey(key));
  }

  @Put('quote-applications/:key/documents')
  saveDoc(@CurrentUser() u: AuthUser, @Param('key') key: string, @Body() dto: SaveDocDto) {
    return this.flow.saveQuoteDoc(u.id, checkKey(key), dto);
  }

  @Delete('quote-applications/:key/documents/:slot')
  @HttpCode(204)
  async deleteDoc(@CurrentUser() u: AuthUser, @Param('key') key: string, @Param('slot') slot: string) {
    await this.flow.deleteQuoteDoc(u.id, checkKey(key), checkSlot(slot));
  }

  @Get('applications')
  forms(@CurrentUser() u: AuthUser) {
    return this.flow.myForms(u.id);
  }

  @Post('applications')
  submitForm(@CurrentUser() u: AuthUser, @Body() dto: FormSubmitDto) {
    return this.flow.submitForm(u, dto);
  }

  @Get('support-tickets')
  tickets(@CurrentUser() u: AuthUser) {
    return this.flow.myTickets(u.id);
  }

  @Post('support-tickets')
  createTicket(@CurrentUser() u: AuthUser, @Body() dto: TicketDto) {
    return this.flow.createTicket(u.id, dto);
  }
}

// ───────────────────────── private files ─────────────────────────

@ApiTags('loans-files')
@ApiBearerAuth()
@Controller('loans/files')
@UseGuards(JwtAuthGuard)
export class LoansFilesController {
  constructor(
    private readonly files: LoansFilesService,
    private readonly flow: LoansFlowService,
    private readonly activity: ActivityService,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_LOAN_FILE_BYTES, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @Body() dto: UploadDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    return this.files.save(u.id, dto.draftId, dto.documentType, file);
  }

  @Get()
  async download(@CurrentUser() u: AuthUser, @Query('key') key: string, @Res() res: Response) {
    const { buffer, mime } = await this.files.read(key, u.id, isLoansReviewer(u));
    const owner = this.files.parseKey(key).ownerId;
    if (owner !== u.id) {
      // a staff member opened a customer's document
      await this.activity.log(u, {
        module: 'loans', action: 'loan.document_viewed', entityType: 'loan_file', entityId: key, entityLabel: key.split('/').pop(),
        summary: `Opened customer document ${key.split('/').pop()}`, metadata: { customerId: owner },
      });
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Query('key') key: string) {
    this.files.assertOwner(key, u.id);
    if (!(await this.flow.isReferenced(key))) await this.files.remove(key);
  }
}

// ───────────────────────── reviewers ─────────────────────────

@ApiTags('loans-admin')
@ApiBearerAuth()
@Controller('loans/admin')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.LoansAdmin)
export class LoansAdminController {
  constructor(private readonly flow: LoansFlowService) {}

  @Get('quote-applications')
  list() {
    return this.flow.adminListQuoteApps();
  }

  @Get('users/:uid/quote-applications/:key')
  one(@Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string) {
    return this.flow.adminGetQuoteApp(uid, checkKey(key));
  }

  @Get('users/:uid/quote-applications/:key/documents')
  docs(@Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string) {
    return this.flow.adminDocs(uid, checkKey(key));
  }

  @Get('users/:uid/quote-applications/:key/history')
  history(@Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string) {
    return this.flow.adminHistory(uid, checkKey(key));
  }

  @Get('users/:uid/quote-applications/:key/notes')
  notes(@Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string) {
    return this.flow.adminNotes(uid, checkKey(key));
  }

  @Post('users/:uid/quote-applications/:key/notes')
  @HttpCode(204)
  async addNote(@CurrentUser() a: AuthUser, @Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string, @Body() dto: NoteDto) {
    await this.flow.adminAddNote(a, uid, checkKey(key), dto.text);
  }

  @Get('users/:uid/quote-applications/:key/snapshot')
  async snapshot(@Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string) {
    return (await this.flow.adminSnapshot(uid, checkKey(key))) ?? null;
  }

  @Post('users/:uid/quote-applications/:key/status')
  @HttpCode(204)
  async setStatus(@CurrentUser() a: AuthUser, @Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string, @Body() dto: StatusDto) {
    await this.flow.adminSetStatus(a, uid, checkKey(key), dto);
  }

  @Post('users/:uid/quote-applications/:key/documents/:slot/review')
  @HttpCode(204)
  async reviewDoc(
    @CurrentUser() a: AuthUser, @Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string,
    @Param('slot') slot: string, @Body() dto: ReviewDocDto,
  ) {
    await this.flow.adminReviewDoc(a, uid, checkKey(key), checkSlot(slot), dto);
  }

  @Post('users/:uid/quote-applications/:key/assign')
  @HttpCode(200)
  assign(@CurrentUser() a: AuthUser, @Param('uid', ParseUUIDPipe) uid: string, @Param('key') key: string, @Body() dto: AssignDto) {
    return this.flow.assignJourney(a, uid, checkKey(key), dto.assigneeId ?? null);
  }

  @Get('applications')
  forms() {
    return this.flow.allForms();
  }

  @Post('applications/:id/assign')
  @HttpCode(200)
  assignForm(@CurrentUser() a: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.flow.assignForm(a, id, dto.assigneeId ?? null);
  }

  @Put('applications/:id/status')
  @HttpCode(204)
  async formStatus(@CurrentUser() a: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FormStatusDto) {
    await this.flow.setFormStatus(a, id, dto.status, dto.note);
  }

  @Put('applications/:id/documents/:docId')
  @HttpCode(204)
  async formDoc(@CurrentUser() a: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('docId') docId: string, @Body() dto: FormDocStatusDto) {
    await this.flow.setFormDocStatus(a, id, docId.slice(0, 80), dto.status, dto.rejectionReason);
  }

  @Get('customers')
  customers() {
    return this.flow.adminCustomers();
  }

  @Get('audit-logs')
  audit() {
    return this.flow.auditLogs();
  }
}

// Owner-or-reviewer read of one full application.
@ApiTags('loans-customer')
@ApiBearerAuth()
@Controller('loans/applications')
@UseGuards(JwtAuthGuard)
export class LoansApplicationLookupController {
  constructor(private readonly flow: LoansFlowService) {}

  @Get(':id')
  async one(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const f = await this.flow.formById(u, id);
    if (!f) throw new NotFoundException('Application not found.');
    return f;
  }
}
