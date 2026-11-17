import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ActivityService } from '../activity/activity.service';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Permissions, Roles } from '../common/access';
import { Role } from '../common/roles';
import { TICKET_STATUSES, TicketStatus } from './solutions.entities';
import { TicketsService } from './tickets.service';

const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

class StatusDto {
  @IsIn(TICKET_STATUSES)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class CommentDto {
  @IsString()
  @MaxLength(2000)
  note: string;
}

@ApiTags('solutions-tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee, Role.Agent)
@Permissions('tickets')
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly activity: ActivityService,
  ) {}

  /** Records what a staff member did to a ticket. */
  private async track(user: AuthUser, id: string, action: string, summary: (label: string) => string, metadata?: Record<string, unknown>, known?: string) {
    let label = known ?? id;
    if (!known) {
      try { label = ((await this.tickets.findOne(id, user)) as { ticketNumber?: string }).ticketNumber ?? id; } catch { /* keep the id */ }
    }
    await this.activity.log(user, { module: 'tickets', action, entityType: 'ticket', entityId: id, entityLabel: label, summary: summary(label), metadata });
  }

  @Get()
  findAll(@Query() query: Record<string, string>, @CurrentUser() user: AuthUser) {
    return this.tickets.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.findOne(id, user);
  }

  @Roles(Role.Employee)
  @Post()
  async create(@Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    const t = (await this.tickets.create(body, user)) as { id: string; ticketNumber?: string };
    await this.track(user, t.id, 'ticket.created', (l) => `Created ticket ${l}`, { type: body.ticketType, priority: body.priority }, t.ticketNumber);
    return t;
  }

  @Roles(Role.Employee)
  @Patch(':id')
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    return this.update(id, body, user);
  }

  @Roles(Role.Employee)
  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    const t = (await this.tickets.update(id, body, user)) as { ticketNumber?: string };
    const fields = Object.keys(body ?? {}).filter((k) => !['note'].includes(k)).slice(0, 12);
    await this.track(user, id, 'ticket.updated', (l) => `Updated ticket ${l}${body.status ? ` (status ${body.status})` : ''}`, { fields, status: body.status, assignedToName: body.assignedToName }, t.ticketNumber);
    return t;
  }

  @Roles(Role.Employee)
  @Put(':id/status')
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @CurrentUser() user: AuthUser) {
    const r = await this.tickets.updateStatus(id, dto.status, dto.note, user);
    await this.track(user, id, 'ticket.status_changed', (l) => `Ticket ${l}: status changed to ${dto.status}`, { status: dto.status, note: dto.note });
    return r;
  }

  @Roles(Role.Employee)
  @Put(':id/payment')
  async updatePayment(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    const r = await this.tickets.updatePayment(id, body, user);
    await this.track(user, id, 'ticket.payment_updated', (l) => `Ticket ${l}: payment ${body.paymentStatus ?? 'updated'}`, { paymentStatus: body.paymentStatus, amount: body.amount });
    return r;
  }

  /** `/comment` is kept for the existing screens; `/comments` is the documented name. */
  @Post(':id/comments')
  comments(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() user: AuthUser) {
    return this.addComment(id, dto, user);
  }

  @Post(':id/comment')
  async addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() user: AuthUser) {
    const r = await this.tickets.addComment(id, dto.note, user);
    await this.track(user, id, 'ticket.commented', (l) => `Ticket ${l}: added a comment`, { note: dto.note.slice(0, 200) });
    return r;
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      fileFilter: (_req, file, cb) =>
        ALLOWED_EXT.includes(extname(file.originalname).toLowerCase())
          ? cb(null, true)
          : cb(new BadRequestException('Only PDF, JPG and PNG files are allowed'), false),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const r = await this.tickets.addDocument(id, file, type, user);
    await this.track(user, id, 'ticket.document_added', (l) => `Ticket ${l}: attached ${file.originalname}`, { type });
    return r;
  }

  @Roles(Role.Employee)
  @Delete(':id/documents/:docId')
  async deleteDocument(@Param('id', ParseUUIDPipe) id: string, @Param('docId') docId: string, @CurrentUser() user: AuthUser) {
    const r = await this.tickets.deleteDocument(id, docId, user);
    await this.track(user, id, 'ticket.document_removed', (l) => `Ticket ${l}: removed a document`, { docId });
    return r;
  }

  /** Soft delete (admins only): the ticket and its history stay in the database. */
  @Roles(Role.Admin)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.track(user, id, 'ticket.deleted', (l) => `Deleted ticket ${l}`);
    return this.tickets.remove(id, user);
  }
}
