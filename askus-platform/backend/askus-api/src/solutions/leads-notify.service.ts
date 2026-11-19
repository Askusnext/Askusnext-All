import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadNotification } from './leads.entities';

export interface Contact { email?: string | null; phone?: string | null }
type Channel = LeadNotification['channel'];

const env = (k: string) => process.env[k]?.trim() || undefined;
const digits = (p: string) => p.replace(/[^\d]/g, '').replace(/^(?=\d{10}$)/, '91'); // 10-digit Indian mobile -> with country code

/**
 * Sends the stage alerts and customer messages over email (Resend), SMS (MSG91 flow) and WhatsApp (Meta Cloud API).
 * A channel is used only if it is configured and the person has that contact; every attempt is written to
 * lead_notifications, so "skipped: not configured" is visible instead of the message vanishing.
 */
@Injectable()
export class LeadsNotifyService {
  private readonly logger = new Logger('LeadNotify');

  constructor(@InjectRepository(LeadNotification) private readonly log: Repository<LeadNotification>) {}

  async deliver(leadId: string, kind: string, audience: LeadNotification['audience'], to: Contact, subject: string, text: string) {
    const jobs: { channel: Channel; recipient: string; run: () => Promise<void>; configured: boolean }[] = [];
    if (to.email) jobs.push({ channel: 'email', recipient: to.email, configured: !!env('RESEND_API_KEY'), run: () => this.email(to.email as string, subject, text) });
    if (to.phone) {
      jobs.push({ channel: 'sms', recipient: to.phone, configured: !!(env('MSG91_AUTH_KEY') && env('MSG91_FLOW_ID')), run: () => this.sms(to.phone as string, text) });
      jobs.push({ channel: 'whatsapp', recipient: to.phone, configured: !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_ID') && env('WHATSAPP_TEMPLATE')), run: () => this.whatsapp(to.phone as string, text) });
    }
    const rows: Partial<LeadNotification>[] = [];
    for (const j of jobs) {
      if (!j.configured) { rows.push({ leadId, kind, audience, channel: j.channel, recipient: j.recipient, status: 'skipped', detail: `${j.channel} is not set up on this server` }); continue; }
      try { await j.run(); rows.push({ leadId, kind, audience, channel: j.channel, recipient: j.recipient, status: 'sent', detail: null }); }
      catch (e) { this.logger.warn(`${j.channel} to ${audience} failed: ${(e as Error).message}`); rows.push({ leadId, kind, audience, channel: j.channel, recipient: j.recipient, status: 'failed', detail: (e as Error).message.slice(0, 300) }); }
    }
    if (rows.length) await this.log.save(rows.map((r) => this.log.create(r)));
    return rows;
  }

  /** Whether a notification of this kind and audience was already recorded (renewal reminders must go out once). */
  already(leadId: string, kind: string, audience: LeadNotification['audience']) {
    return this.log.exists({ where: { leadId, kind, audience } });
  }

  private async post(url: string, init: RequestInit, what: string) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${what} answered HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res;
  }

  private email(to: string, subject: string, text: string) {
    return this.post(`${env('RESEND_BASE_URL') ?? 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env('MAIL_FROM') ?? 'AskUs <onboarding@resend.dev>', to: [to], subject, text }),
    }, 'Email provider').then(() => undefined);
  }

  /** MSG91 transactional flow; the DLT-approved template has one variable, ##var1##, that carries the text. */
  private sms(to: string, text: string) {
    return this.post(`${env('MSG91_BASE_URL') ?? 'https://control.msg91.com'}/api/v5/flow/`, {
      method: 'POST',
      headers: { authkey: env('MSG91_AUTH_KEY') as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: env('MSG91_FLOW_ID'), short_url: '0', recipients: [{ mobiles: digits(to), var1: text.slice(0, 450) }] }),
    }, 'SMS provider').then(() => undefined);
  }

  /** WhatsApp Cloud API template message; the approved template has one body variable that carries the text. */
  private whatsapp(to: string, text: string) {
    return this.post(`${env('WHATSAPP_BASE_URL') ?? 'https://graph.facebook.com/v20.0'}/${env('WHATSAPP_PHONE_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: digits(to), type: 'template',
        template: { name: env('WHATSAPP_TEMPLATE'), language: { code: env('WHATSAPP_LANG') ?? 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 900) }] }] },
      }),
    }, 'WhatsApp provider').then(() => undefined);
  }
}
