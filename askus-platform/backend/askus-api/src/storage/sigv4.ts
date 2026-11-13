import { createHash, createHmac } from 'crypto';

export interface PresignInput {
  method: 'GET' | 'PUT';
  host: string;
  /** Raw (unencoded) object path, starting with "/". */
  path: string;
  region: string;
  service: string;
  accessKey: string;
  secretKey: string;
  expiresSeconds: number;
  now?: Date;
  /** Extra headers the caller must send unchanged (they become part of the signature). */
  signedHeaders?: Record<string, string>;
  query?: Record<string, string>;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const hmac = (key: Buffer | string, v: string) => createHmac('sha256', key).update(v).digest();
const encode = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// AWS Signature V4, query-string form (works for S3-compatible stores such as Cloudflare R2).
export function presign(i: PresignInput): string {
  const amzDate = (i.now ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;

  const headers: Record<string, string> = { host: i.host };
  for (const [k, v] of Object.entries(i.signedHeaders ?? {})) headers[k.toLowerCase()] = v.trim();
  const names = Object.keys(headers).sort();

  const query: Record<string, string> = {
    ...i.query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${i.accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(i.expiresSeconds),
    'X-Amz-SignedHeaders': names.join(';'),
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encode(k)}=${encode(query[k])}`)
    .join('&');

  const encodedPath = i.path.split('/').map(encode).join('/');
  const canonicalRequest = [
    i.method,
    encodedPath,
    canonicalQuery,
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    names.join(';'),
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secretKey}`, day), i.region), i.service), 'aws4_request');
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');

  return `https://${i.host}${encodedPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
