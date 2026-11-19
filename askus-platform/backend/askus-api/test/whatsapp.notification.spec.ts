/**
 * The WhatsApp one-time-code sender, with Meta's API replaced by a fake fetch. Nothing here talks to the network.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NotificationService } from '../src/notification/notification.service';

const KEYS = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_OTP_TEMPLATE', 'WHATSAPP_OTP_LANG', 'WHATSAPP_LANG', 'WHATSAPP_OTP_BUTTON', 'WHATSAPP_BASE_URL', 'DUMMY_OTP_CODE', 'NODE_ENV', 'RESEND_API_KEY', 'MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'] as const;
const saved: Record<string, string | undefined> = {};
const realFetch = global.fetch;

let calls: { url: string; init: any }[] = [];
const respond = (status: number, body: unknown) => {
  global.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) } as any;
  }) as any;
};

const configure = () => Object.assign(process.env, { WHATSAPP_TOKEN: 'TOKEN', WHATSAPP_PHONE_ID: '1234567890', WHATSAPP_OTP_TEMPLATE: 'askus_login_code' });
const wa = (to: string, otp = '482916') => ({ channel: 'whatsapp' as const, to, otp, message: `code ${otp}` });
const payload = () => JSON.parse(calls[0].init.body);

beforeEach(() => {
  KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.NODE_ENV = 'test';
  calls = [];
});
afterEach(() => {
  KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('WhatsApp availability', () => {
  it('is configured only when the token, phone id and OTP template are all set', () => {
    const n = new NotificationService();
    expect(n.whatsappConfigured()).toBe(false);
    process.env.WHATSAPP_TOKEN = 'T';
    process.env.WHATSAPP_PHONE_ID = '1';
    expect(n.whatsappConfigured()).toBe(false); // the login template is separate from the leads template
    process.env.WHATSAPP_OTP_TEMPLATE = 'askus_login_code';
    expect(n.whatsappConfigured()).toBe(true);
  });

  it('is offered in development with the test code, but never in production without real settings', () => {
    const n = new NotificationService();
    expect(n.whatsappAvailable()).toBe(false);
    process.env.DUMMY_OTP_CODE = '123456';
    expect(n.whatsappAvailable()).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(n.whatsappAvailable()).toBe(false);
    configure();
    expect(n.whatsappAvailable()).toBe(true);
  });
});

describe('sending a code on WhatsApp', () => {
  it('posts the approved authentication template with the code as body and button parameter', async () => {
    configure();
    respond(200, { messages: [{ id: 'wamid.1' }] });
    expect(await new NotificationService().send(wa('+919876543210'))).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/1234567890/messages');
    expect(calls[0].init.headers.Authorization).toBe('Bearer TOKEN');
    expect(payload()).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'askus_login_code',
        language: { code: 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '482916' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482916' }] },
        ],
      },
    });
  });

  it('sends the number as digits with the country code (no plus, and 91 added to a bare 10-digit number)', async () => {
    configure();
    respond(200, { messages: [{ id: 'x' }] });
    const n = new NotificationService();
    await n.send(wa('+91 98765-43210'));
    await n.send(wa('9876543210'));
    expect(JSON.parse(calls[0].init.body).to).toBe('919876543210');
    expect(JSON.parse(calls[1].init.body).to).toBe('919876543210');
  });

  it('honours the language, base URL and a template without a copy-code button', async () => {
    configure();
    Object.assign(process.env, { WHATSAPP_OTP_LANG: 'en_US', WHATSAPP_OTP_BUTTON: 'false', WHATSAPP_BASE_URL: 'https://graph.facebook.com/v99.0' });
    respond(200, { messages: [{ id: 'x' }] });
    await new NotificationService().send(wa('+919876543210'));
    expect(calls[0].url).toBe('https://graph.facebook.com/v99.0/1234567890/messages');
    expect(payload().template.language.code).toBe('en_US');
    expect(payload().template.components).toEqual([{ type: 'body', parameters: [{ type: 'text', text: '482916' }] }]);
  });

  it('falls back to the leads language setting when no OTP language is set', async () => {
    configure();
    process.env.WHATSAPP_LANG = 'hi';
    respond(200, { messages: [{ id: 'x' }] });
    await new NotificationService().send(wa('+919876543210'));
    expect(payload().template.language.code).toBe('hi');
  });

  it('reports failure when Meta refuses (bad token, unapproved template, number not on WhatsApp)', async () => {
    configure();
    for (const [status, body] of [
      [401, { error: { code: 190, message: 'Invalid OAuth access token' } }],
      [400, { error: { code: 132001, message: 'Template name does not exist in the translation' } }],
      [400, { error: { code: 131026, message: 'Message undeliverable' } }],
      [200, { contacts: [] }], // accepted but no message id
      [500, 'Bad gateway'],
    ] as [number, unknown][]) {
      respond(status, body);
      expect(await new NotificationService().send(wa('+919876543210'))).toBe(false);
    }
  });

  it('reports failure on a network error or timeout instead of throwing', async () => {
    configure();
    global.fetch = (async () => { throw new Error('socket hang up'); }) as any;
    expect(await new NotificationService().send(wa('+919876543210'))).toBe(false);
  });

  it('never writes the code into the logs, even when Meta refuses', async () => {
    configure();
    const lines: string[] = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((m: any) => { lines.push(String(m)); });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m: any) => { lines.push(String(m)); });
    respond(400, { error: { code: 132001, message: 'Template name does not exist' } });
    await new NotificationService().send(wa('+919876543210', '735190'));
    global.fetch = (async () => { throw new Error('boom'); }) as any;
    await new NotificationService().send(wa('+919876543210', '735190'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain('735190');
  });

  it('refuses without a code', async () => {
    configure();
    respond(200, { messages: [{ id: 'x' }] });
    expect(await new NotificationService().send({ channel: 'whatsapp', to: '+919876543210', message: 'hi' })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('in development with no settings it only logs and says yes, without calling Meta', async () => {
    respond(200, {});
    expect(await new NotificationService().send(wa('+919876543210'))).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('in production with no settings it says no (so the caller falls back to SMS) and calls nothing', async () => {
    process.env.NODE_ENV = 'production';
    respond(200, {});
    expect(await new NotificationService().send(wa('+919876543210'))).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('the other channels now say whether they delivered', () => {
  it('email: true on success, false when Resend refuses', async () => {
    process.env.RESEND_API_KEY = 're_x';
    respond(200, {});
    expect(await new NotificationService().send({ channel: 'email', to: 'a@b.co', message: 'm' })).toBe(true);
    respond(403, 'domain not verified');
    expect(await new NotificationService().send({ channel: 'email', to: 'a@b.co', message: 'm' })).toBe(false);
  });

  it('sms: true on success, false when MSG91 answers with an error body', async () => {
    Object.assign(process.env, { MSG91_AUTH_KEY: 'k', MSG91_TEMPLATE_ID: 't' });
    respond(200, { type: 'success' });
    expect(await new NotificationService().send({ channel: 'sms', to: '+919876543210', otp: '123456', message: 'm' })).toBe(true);
    respond(200, { type: 'error', message: 'template not found' });
    expect(await new NotificationService().send({ channel: 'sms', to: '+919876543210', otp: '123456', message: 'm' })).toBe(false);
  });
});
