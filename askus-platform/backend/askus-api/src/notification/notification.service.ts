import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  channel: 'sms' | 'email' | 'push';
  to: string;
  message: string;
}

// Email goes out through Resend (https://resend.com) when RESEND_API_KEY is set.
// SMS (gateway) and push (FCM/APNs) providers plug in here later.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async send(n: Notification) {
    if (n.channel === 'email' && process.env.RESEND_API_KEY) {
      await this.sendEmail(n);
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      // Never log the message body in production: it can contain an OTP.
      this.logger.warn(`No ${n.channel} provider configured; dropping message to ${n.to}`);
      return;
    }
    this.logger.debug(`[DEV ${n.channel}] ${n.to}: ${n.message}`);
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
