import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Put, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { StorageService } from './storage.service';

const MAX_BYTES = 10 * 1024 * 1024;

// Only the insurance document layout is accepted here, so nothing else can be written or read through this door.
const KEY = /^insurance\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/doc_\d\.(pdf|jpg|png|webp)$/i;

const TYPES: Record<string, { mime: string; magic: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', magic: (b) => b.subarray(0, 4).toString('latin1') === '%PDF' },
  jpg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { mime: 'image/png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  webp: { mime: 'image/webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

/**
 * Stand-in for Cloudflare R2 while R2_* is not configured: the browser PUTs and GETs files through short-lived
 * signed links (see StorageService.signLocal). There is no login header on these requests, the signature is the proof.
 */
@Controller('files/local')
export class LocalFilesController {
  private readonly root = join(__dirname, '..', '..', 'private-uploads');

  constructor(private readonly storage: StorageService) {}

  private parse(key: string, ext?: boolean) {
    const m = KEY.exec(key ?? '');
    if (!m) throw new BadRequestException('Invalid file reference.');
    return ext ? m[1].toLowerCase() : key;
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Put()
  @HttpCode(200)
  async upload(
    @Query('key') key: string, @Query('size') size: string, @Query('exp') exp: string, @Query('sig') sig: string,
    @Req() req: Request,
  ) {
    this.parse(key);
    const declared = Number(size);
    if (!Number.isInteger(declared) || declared < 1 || declared > MAX_BYTES) throw new BadRequestException('Invalid size.');
    if (!this.storage.verifyLocal('PUT', key, declared, Number(exp), sig)) throw new ForbiddenException('This upload link is not valid or has expired.');

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      total += (chunk as Buffer).length;
      if (total > declared) throw new BadRequestException('The file is larger than approved.');
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);
    const ext = this.parse(key, true);
    if (!TYPES[ext].magic(body)) throw new BadRequestException('The file content does not match its type.');

    const full = join(this.root, ...key.split('/'));
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { stored: true };
  }

  @Get()
  async download(
    @Query('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response,
  ) {
    this.parse(key);
    if (!this.storage.verifyLocal('GET', key, 0, Number(exp), sig)) throw new ForbiddenException('This link is not valid or has expired.');
    try {
      const ext = this.parse(key, true);
      const buffer = await fs.readFile(join(this.root, ...key.split('/')));
      res.setHeader('Content-Type', TYPES[ext].mime);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(buffer);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new NotFoundException('File not found.');
    }
  }
}
