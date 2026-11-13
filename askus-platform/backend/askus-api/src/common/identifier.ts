// Indian mobile numbers are stored with +91 so typed variants resolve to one user.
export function normalizeIdentifier(raw: string): string {
  const v = raw.trim();
  if (v.includes('@')) return v.toLowerCase();
  const digits = v.replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return digits;
}
