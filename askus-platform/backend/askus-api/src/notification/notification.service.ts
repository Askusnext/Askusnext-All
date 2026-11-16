import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  channel: 'sms' | 'email' | 'push';
  to: string;
  message: string;
  /** Raw one-time code, for providers (MSG91) that fill their own DLT-approved template. */
  otp?: string;
}

// Email goes out through Resend (https://resend.com) when RESEND_API_KEY is set.
// SMS OTP goes out through MSG91 when MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are set.
// Push (FCM/APNs) plugs in here later.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async send(n: Notification) {
    if (n.channel === 'email' && process.env.RESEND_API_KEY) {
      await this.sendEmail(n);
      return;
    }
    if (n.channel === 'sms' && n.otp && process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
      await this.sendSmsOtp(n.to, n.otp);
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      // Never log the message body in production: it can contain an OTP.
      this.logger.warn(`No ${n.channel} provider configured; dropping message to ${n.to}`);
      return;
    }
    this.logger.debug(`[DEV ${n.channel}] ${n.to}: ${n.message}`);
  }

  // MSG91 OTP API (v5). The message text comes from the DLT-approved template, not from us.
  private async sendSmsOtp(to: string, otp: string) {
    const authkey = process.env.MSG91_AUTH_KEY as string;
    const params = new URLSearchParams({
      template_id: process.env.MSG91_TEMPLATE_ID as string,
      mobile: to.replace(/^\+/, ''), // MSG91 wants the country code without '+'
      authkey,
      otp,
    });
    try {
      const res = await fetch(`https://control.msg91.com/api/v5/otp?${params}`, {
        method: 'POST',
        headers: { authkey, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      // MSG91 can answer HTTP 200 with {"type":"error", ...}; treat that as a failure too.
      let failed = !res.ok;
      try {
        failed ||= JSON.parse(text).type === 'error';
      } catch {
        /* non-JSON body: rely on the HTTP status */
      }
      if (failed) this.logger.error(`MSG91 rejected SMS to ${to}: ${res.status} ${text.slice(0, 300)}`);
    } catch (err) {
      this.logger.error(`SMS send to ${to} failed: ${(err as Error).message}`);
    }
  }

  private async sendEmail(n: Notification) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM ?? 'AskUs <onboarding@resend.dev>',
          to: [n.to],
          subject: 'Your AskUs verification code',
          text: n.message,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // Log status/provider error only (not the message body, which holds the OTP).
        this.logger.error(`Resend rejected email to ${n.to}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
    } catch (err) {
      this.logger.error(`Email send to ${n.to} failed: ${(err as Error).message}`);
    }
  }
}
