import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { presign } from './sigv4';

// Private Cloudflare R2 bucket; the browser uploads/downloads directly through short-lived signed URLs.
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  // ── Local fallback (development, before R2 is configured) ──────────────────────
  // Same idea as an R2 signed URL: a short-lived link, signed with the server secret, that the browser can PUT or GET
  // without a login header. The files live on this server's disk and are served by LocalFilesController.

  private localSig(method: string, key: string, size: number, exp: number) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${method}|${key}|${size}|${exp}`).digest('hex');
  }

  signLocal(method: 'PUT' | 'GET', key: string, size: number, baseUrl: string, expiresSeconds = 600) {
    const exp = Math.floor(Date.now() / 1000) + expiresSeconds;
    const sig = this.localSig(method, key, size, exp);
    return `${baseUrl}/files/local?key=${encodeURIComponent(key)}&size=${size}&exp=${exp}&sig=${sig}`;
  }

  verifyLocal(method: 'PUT' | 'GET', key: string, size: number, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const want = Buffer.from(this.localSig(method, key, size, exp));
    const got = Buffer.from(sig ?? '');
    return want.length === got.length && timingSafeEqual(want, got);
  }

  /** True when the R2_* variables are all set. */
  get configured(): boolean {
    return !['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].some((k) => !this.config.get<string>(k));
  }

  private get r2() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKey = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET');
    if (!accountId || !accessKey || !secretKey || !bucket) {
      throw new ServiceUnavailableException('Document storage is not configured (set R2_* variables).');
    }
    return { host: `${accountId}.r2.cloudflarestorage.com`, accessKey, secretKey, bucket };
  }

  /** Signs content-type and content-length so the upload cannot differ from what was approved. */
  signUpload(key: string, contentType: string, size: number, expiresSeconds = 600) {
    const r = this.r2;
    return presign({
      method: 'PUT',
      host: r.host,
      path: `/${r.bucket}/${key}`,
      region: 'auto',
      service: 's3',
      accessKey: r.accessKey,
      secretKey: r.secretKey,
      expiresSeconds,
      signedHeaders: { 'content-type': contentType, 'content-length': String(size) },
    });
  }

  signDelete(key: string, expiresSeconds = 120) {
    const r = this.r2;
    return presign({
      method: 'DELETE',
      host: r.host,
      path: `/${r.bucket}/${key}`,
      region: 'auto',
      service: 's3',
      accessKey: r.accessKey,
      secretKey: r.secretKey,
      expiresSeconds,
    });
  }

  signDownload(key: string, fileName: string, expiresSeconds = 600) {
    const r = this.r2;
    return presign({
      method: 'GET',
      host: r.host,
      path: `/${r.bucket}/${key}`,
      region: 'auto',
      service: 's3',
      accessKey: r.accessKey,
      secretKey: r.secretKey,
      expiresSeconds,
      query: { 'response-content-disposition': `inline; filename="${fileName.replace(/[^\w.-]/g, '_')}"` },
    });
  }

  async delete(key: string) {
    const r = this.r2;
    const url = presign({
      method: 'DELETE',
      host: r.host,
      path: `/${r.bucket}/${key}`,
      region: 'auto',
      service: 's3',
      accessKey: r.accessKey,
      secretKey: r.secretKey,
      expiresSeconds: 60,
    });
    const res = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(10_000) });
    if (!res.ok && res.status !== 404) throw new ServiceUnavailableException('Could not delete the stored document.');
  }
}
