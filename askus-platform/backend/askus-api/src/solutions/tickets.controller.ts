import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { TicketStatus } from './solutions.entities';
import { TicketsService } from './tickets.service';

const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

class StatusDto {
  @IsIn(['Open', 'InProgress', 'Completed', 'Closed'])
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
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.tickets.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.findOne(id);
  }

  @Roles(Role.Employee)
  @Post()
  create(@Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    return this.tickets.create(body, user.name);
  }

  @Roles(Role.Employee)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    return this.tickets.update(id, body, user.name);
  }

  @Roles(Role.Employee)
  @Put(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @CurrentUser() user: AuthUser) {
    return this.tickets.updateStatus(id, dto.status, dto.note, user.name);
  }

  @Roles(Role.Employee)
  @Put(':id/payment')
  updatePayment(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>, @CurrentUser() user: AuthUser) {
    return this.tickets.updatePayment(id, body, user.name);
  }

  @Post(':id/comment')
  addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() user: AuthUser) {
    return this.tickets.addComment(id, dto.note, user.name);
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
  addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.tickets.addDocument(id, file, type, user.name);
  }

  @Roles(Role.Employee)
  @Delete(':id/documents/:docId')
  deleteDocument(@Param('id', ParseUUIDPipe) id: string, @Param('docId') docId: string) {
    return this.tickets.deleteDocument(id, docId);
  }
}
