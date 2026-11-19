import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * KYC and policy documents are encrypted at rest (AES-256-GCM, a fresh random IV per file). The key comes from
 * LEADS_DOC_KEY (or JWT_SECRET if that is not set). A file on disk is: 12-byte IV | 16-byte tag | ciphertext.
 */
const key = () => {
  const secret = process.env.LEADS_DOC_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('Set LEADS_DOC_KEY (or JWT_SECRET) so lead documents can be stored encrypted.');
  return createHash('sha256').update(`askus-lead-docs:${secret}`).digest();
};

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}

export function decryptBuffer(stored: Buffer): Buffer {
  const d = createDecipheriv('aes-256-gcm', key(), stored.subarray(0, 12));
  d.setAuthTag(stored.subarray(12, 28));
  return Buffer.concat([d.update(stored.subarray(28)), d.final()]);
}

/** The file type from the first bytes, so a renamed .exe cannot pass as a PDF. */
export function sniffType(b: Buffer): { mime: string; ext: string } | null {
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return { mime: 'application/pdf', ext: '.pdf' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  return null;
}
