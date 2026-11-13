import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { presign } from './sigv4';

// Private Cloudflare R2 bucket; the browser uploads/downloads directly through short-lived signed URLs.
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

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
}
