import { z } from 'zod';

export const identifierSchema = z
  .string()
  .trim()
  .regex(/^(\+?\d{10,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, 'Enter a valid mobile number or email');

export const requestOtpSchema = z.object({ identifier: identifierSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = requestOtpSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
