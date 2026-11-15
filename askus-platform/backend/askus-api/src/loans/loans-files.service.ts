import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { StorageService } from '../storage/storage.service';

export const MAX_LOAN_FILE_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, { mime: string; magic: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', magic: (b) => b.subarray(0, 4).toString('latin1') === '%PDF' },
  jpg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { mime: 'image/png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
};

const KEY_RE = /^loans\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([a-z0-9_]{1,40})-([0-9a-f-]{36})\.(pdf|jpe?g|png)$/;

/**
 * Private document storage. Files go to the private Cloudflare R2 bucket when the R2_* variables are set;
 * otherwise (local development) they are kept on disk outside the public /uploads folder.
 * Either way, files are only ever returned through an authenticated endpoint that checks ownership.
 */
@Injectable()
export class LoansFilesService {
  private readonly logger = new Logger(LoansFilesService.name);
  private readonly root = join(__dirname, '..', '..', 'private-uploads');

  constructor(private readonly storage: StorageService) {}

  get usesR2() {
    return this.storage.configured;
  }

  /** Splits a storage key and rejects anything that is not exactly our own format. */
  parseKey(key: string) {
    const m = KEY_RE.exec(key ?? '');
    if (!m) throw new BadRequestException('Invalid file reference.');
    return { ownerId: m[1], draftId: m[2], type: m[3], fileId: m[4], ext: m[5] };
  }

  private path(key: string) {
    return join(this.root, ...key.split('/'));
  }

  async save(userId: string, draftId: string, documentType: string, file: { buffer: Buffer; originalname: string; size: number }) {
    if (!/^[a-z0-9_]{1,40}$/.test(documentType)) throw new BadRequestException('Invalid document type.');
    if (file.size > MAX_LOAN_FILE_BYTES) throw new BadRequestException('File is larger than 5 MB.');
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    const type = TYPES[ext];
    if (!type) throw new BadRequestException('Only PDF, JPG or PNG files are allowed.');
    if (!type.magic(file.buffer)) throw new BadRequestException('The file content does not match its type.');

    const fileId = randomUUID();
    const key = `loans/${userId}/${draftId}/${documentType}-${fileId}.${ext}`;
    if (this.usesR2) {
      const url = this.storage.signUpload(key, type.mime, file.size);
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type.mime }, body: new Uint8Array(file.buffer) }).catch(() => null);
      if (!res?.ok) {
        this.logger.error(`R2 upload failed: ${res?.status ?? 'no response'}`);
        throw new BadGatewayException('The file could not be stored. Please try again.');
      }
    } else {
      const full = this.path(key);
      await fs.mkdir(dirname(full), { recursive: true });
      await fs.writeFile(full, file.buffer);
    }
    return {
      fileName: file.originalname.slice(0, 160),
      fileSize: file.size,
      mimeType: type.mime,
      storageKey: key,
      fileId,
      fileFormat: ext === 'jpeg' ? 'jpg' : ext,
      fileVersion: 0,
    };
  }

  /** The owner or a loans reviewer may read a file. */
  async read(key: string, userId: string, canReviewAll: boolean) {
    const { ownerId, ext } = this.parseKey(key);
    if (ownerId !== userId && !canReviewAll) throw new ForbiddenException();
    if (this.usesR2) {
      const res = await fetch(this.storage.signDownload(key, 'document')).catch(() => null);
      if (res?.status === 404) throw new NotFoundException('File not found.');
      if (!res?.ok) throw new BadGatewayException('The file could not be read right now.');
      return { buffer: Buffer.from(await res.arrayBuffer()), mime: TYPES[ext].mime };
    }
    try {
      return { buffer: await fs.readFile(this.path(key)), mime: TYPES[ext].mime };
    } catch {
      throw new NotFoundException('File not found.');
    }
  }

  async remove(key: string) {
    if (this.usesR2) {
      const res = await fetch(this.storage.signDelete(key), { method: 'DELETE' }).catch(() => null);
      if (!res || (!res.ok && res.status !== 404)) this.logger.warn(`R2 delete failed for ${key}: ${res?.status ?? 'no response'}`);
      return;
    }
    await fs.rm(this.path(key), { force: true });
  }

  assertOwner(key: string, userId: string) {
    if (this.parseKey(key).ownerId !== userId) throw new ForbiddenException();
  }
}
