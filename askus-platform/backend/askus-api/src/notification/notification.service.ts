import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  channel: 'sms' | 'email' | 'push' | 'whatsapp';
  to: string;
  message: string;
  /** Raw one-time code, for providers (MSG91, WhatsApp) that fill their own approved template. */
  otp?: string;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

// Email goes out through Resend (https://resend.com) when RESEND_API_KEY is set.
// SMS OTP goes out through MSG91 when MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are set.
// WhatsApp OTP goes out through the Meta WhatsApp Cloud API when WHATSAPP_TOKEN, WHATSAPP_PHONE_ID and
// WHATSAPP_OTP_TEMPLATE (an approved "Authentication" template) are set. The token and phone id are the same
// ones the leads module already uses.
// Push (FCM/APNs) plugs in here later.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** All three settings present: codes can really be delivered on WhatsApp. */
  whatsappConfigured() {
    return !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_ID') && env('WHATSAPP_OTP_TEMPLATE'));
  }

  /**
   * Whether the sign-in screens should offer "Get code on WhatsApp". True with real settings, or in development
   * with the fixed test code (so the screens can be tried without a Meta account). Never true in production
   * without real settings.
   */
  whatsappAvailable() {
    return this.whatsappConfigured() || (process.env.NODE_ENV !== 'production' && !!env('DUMMY_OTP_CODE'));
  }

  /**
   * Delivers one message. Resolves true when the provider accepted it (or, outside production with no provider,
   * when it was only logged), false when it could not be sent. Callers that have a fallback (WhatsApp -> SMS) use that.
   */
  async send(n: Notification): Promise<boolean> {
    if (n.channel === 'whatsapp') return this.sendWhatsApp(n);
    if (n.channel === 'email' && process.env.RESEND_API_KEY) {
      return this.sendEmail(n);
    }
    if (n.channel === 'sms' && n.otp && process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
      return this.sendSmsOtp(n.to, n.otp);
    }
    if (process.env.NODE_ENV === 'production') {
      // Never log the message body in production: it can contain an OTP.
      this.logger.warn(`No ${n.channel} provider configured; dropping message to ${n.to}`);
      return false;
    }
    this.logger.debug(`[DEV ${n.channel}] ${n.to}: ${n.message}`);
    return true;
  }

  // MSG91 OTP API (v5). The message text comes from the DLT-approved template, not from us.
  private async sendSmsOtp(to: string, otp: string): Promise<boolean> {
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
      return !failed;
    } catch (err) {
      this.logger.error(`SMS send to ${to} failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * WhatsApp Cloud API, "Authentication" template. Meta fixes the wording of these templates ("<code> is your
   * verification code") and requires the code as the body variable and, when the template has a "Copy code" button,
   * again as the button parameter. We send only the code and the template name; the text comes from Meta.
   */
  private async sendWhatsApp(n: Notification): Promise<boolean> {
    if (!n.otp) return false;
    if (!this.whatsappConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(`WhatsApp is not configured; not sending to ${n.to}`);
        return false;
      }
      this.logger.debug(`[DEV whatsapp] ${n.to}: ${n.message}`);
      return true;
    }
    let to = n.to.replace(/\D/g, '');
    if (to.length === 10) to = `91${to}`; // the API needs the country code
    const components: unknown[] = [{ type: 'body', parameters: [{ type: 'text', text: n.otp }] }];
    if (env('WHATSAPP_OTP_BUTTON') !== 'false') {
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: n.otp }] });
    }
    const base = env('WHATSAPP_BASE_URL') ?? 'https://graph.facebook.com/v20.0';
    try {
      const res = await fetch(`${base}/${env('WHATSAPP_PHONE_ID')}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: env('WHATSAPP_OTP_TEMPLATE'),
            language: { code: env('WHATSAPP_OTP_LANG') ?? env('WHATSAPP_LANG') ?? 'en' },
            components,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let body: { messages?: { id?: string }[]; error?: { code?: number; message?: string } } = {};
      try {
        body = JSON.parse(text);
      } catch {
        /* non-JSON body: rely on the HTTP status */
      }
      if (!res.ok || !body.messages?.length) {
        // Provider code and message only (never the request body, which holds the OTP).
        this.logger.error(`WhatsApp rejected message to ${n.to}: ${res.status} code=${body.error?.code ?? '?'} ${(body.error?.message ?? text).slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`WhatsApp send to ${n.to} failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async sendEmail(n: Notification): Promise<boolean> {
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
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Email send to ${n.to} failed: ${(err as Error).message}`);
      return false;
    }
  }
}
