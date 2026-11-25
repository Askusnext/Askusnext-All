/**
 * "Get code on WhatsApp" sign-in against the real Nest app and a real Postgres (database `askus_test`, recreated
 * on every run). Meta is not contacted: the notification sender is replaced so each test can see exactly which
 * channel a code was sent on, and make WhatsApp succeed or fail.
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Client } from 'pg';
import { join } from 'path';
import type { Notification } from '../src/notification/notification.service';

require('dotenv').config({ path: join(__dirname, '..', '.env') });

const TEST_DB = 'askus_test';
const baseUrl = new URL(process.env.DATABASE_URL!);
const testUrl = (() => {
  const u = new URL(baseUrl.toString());
  u.pathname = `/${TEST_DB}`;
  return u.toString();
})();

let app: INestApplication;
let base: string;
let sent: Notification[] = [];
let whatsappWorks = true;

const WA_ENV = { WHATSAPP_TOKEN: 'T', WHATSAPP_PHONE_ID: '1', WHATSAPP_OTP_TEMPLATE: 'askus_login_code' };
const enableWhatsApp = () => Object.assign(process.env, WA_ENV);
const disableWhatsApp = () => Object.keys(WA_ENV).forEach((k) => delete process.env[k]);

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, body: json };
}
const request = (b: Record<string, unknown>) => call('POST', '/auth/request-otp', b);
const verify = (b: Record<string, unknown>) => call('POST', '/auth/verify-otp', b);
/** The code that went to one destination (the last one sent there). */
const codeTo = (to: string) => [...sent].reverse().find((n) => n.to === to)!.otp!;
const channelsTo = (to: string) => sent.filter((n) => n.to === to).map((n) => n.channel);

let phoneSeq = 0;
const newPhone = () => `+9190000${String(10000 + ++phoneSeq)}`;
const newEmail = () => `wa${++phoneSeq}-${Date.now().toString(36)}@test.local`;

/** First sign-in over WhatsApp: returns a ready, fully verified customer. */
async function register(phone = newPhone(), email = newEmail()) {
  const r = await request({ identifier: phone, otherIdentifier: email, channel: 'whatsapp' });
  expect(r.status).toBe(200);
  const v = await verify({ identifier: phone, code: codeTo(phone), otherIdentifier: email, otherCode: codeTo(email) });
  expect(v.status).toBe(200);
  return { phone, email, tokens: v.body };
}

beforeAll(async () => {
  const admin = new Client({ connectionString: new URL('/postgres', baseUrl).toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  Object.assign(process.env, { DATABASE_URL: testUrl, NODE_ENV: 'test', DISABLE_RATE_LIMIT: 'true', DUMMY_OTP_CODE: '', SUPER_ADMIN_IDENTIFIER: '', ADMIN_IDENTIFIER: '' });
  disableWhatsApp();
  const { ensureSchemas } = await import('../src/common/ensure-schemas');
  await ensureSchemas(testUrl, false);
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const { NotificationService } = await import('../src/notification/notification.service');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  await app.listen(0);
  base = `${await app.getUrl()}`.replace('[::1]', '127.0.0.1').replace('//[::]', '//127.0.0.1') + '/api';

  // Meta is never called: record every message, and let each test decide whether WhatsApp "works".
  jest.spyOn(app.get(NotificationService), 'send').mockImplementation(async (n: Notification) => {
    sent.push(n);
    return n.channel === 'whatsapp' ? whatsappWorks : true;
  });
}, 900_000);

beforeEach(() => { sent = []; whatsappWorks = true; enableWhatsApp(); });
afterAll(async () => { disableWhatsApp(); await app?.close(); });

describe('what the sign-in screens may offer', () => {
  it('GET /auth/options says whether WhatsApp is available, and carries nothing secret', async () => {
    disableWhatsApp();
    expect((await call('GET', '/auth/options')).body).toEqual({ whatsapp: false });
    enableWhatsApp();
    const on = await call('GET', '/auth/options');
    expect(on.body).toEqual({ whatsapp: true });
    expect(JSON.stringify(on.body)).not.toMatch(/TOKEN|askus_login_code/);
  });
});

describe('first sign-in on WhatsApp', () => {
  it('sends the mobile code on WhatsApp and the email code by email, and signs the customer in', async () => {
    const phone = newPhone(), email = newEmail();
    const r = await request({ identifier: phone, otherIdentifier: email, channel: 'whatsapp' });
    expect(r.body).toEqual({ sent: true, channels: ['whatsapp', 'email'] });
    expect(channelsTo(phone)).toEqual(['whatsapp']);
    expect(channelsTo(email)).toEqual(['email']);
    expect(channelsTo(phone)).not.toContain('sms'); // WhatsApp replaced the SMS, it did not add to it

    const v = await verify({ identifier: phone, code: codeTo(phone), otherIdentifier: email, otherCode: codeTo(email) });
    expect(v.status).toBe(200);
    expect(v.body.accessToken).toBeTruthy();
    const me = await fetch(`${base}/customer/me`, { headers: { Authorization: `Bearer ${v.body.accessToken}` } });
    expect((await me.json()).mobile).toBe(phone);
  });

  it('works when the person started from their email (staff style) and WhatsApp goes to the mobile they give', async () => {
    const phone = newPhone(), email = newEmail();
    const r = await request({ identifier: email, otherIdentifier: phone, channel: 'whatsapp' });
    expect(r.body.channels).toEqual(['whatsapp', 'email']);
    expect(channelsTo(phone)).toEqual(['whatsapp']);
    const v = await verify({ identifier: email, code: codeTo(email), otherIdentifier: phone, otherCode: codeTo(phone) });
    expect(v.status).toBe(200);
  });

  it('still asks for the email first, without sending anything', async () => {
    const r = await request({ identifier: newPhone(), channel: 'whatsapp' });
    expect(r.body).toEqual({ sent: false, needs: 'email' });
    expect(sent).toHaveLength(0);
  });

  it('a wrong WhatsApp code does not sign anyone in', async () => {
    const phone = newPhone(), email = newEmail();
    await request({ identifier: phone, otherIdentifier: email, channel: 'whatsapp' });
    const wrong = codeTo(phone) === '000000' ? '111111' : '000000';
    expect((await verify({ identifier: phone, code: wrong, otherIdentifier: email, otherCode: codeTo(email) })).status).toBe(401);
  });

  it('without the channel it behaves exactly as before: SMS and email', async () => {
    const phone = newPhone(), email = newEmail();
    const r = await request({ identifier: phone, otherIdentifier: email });
    expect(r.body).toEqual({ sent: true, channels: ['sms', 'email'] });
    expect(channelsTo(phone)).toEqual(['sms']);
  });
});

describe('a verified customer signs in on WhatsApp', () => {
  it('gets one code on WhatsApp at the number on the account, with a masked hint and no email', async () => {
    const { phone, email } = await register();
    sent = [];
    const r = await request({ identifier: phone, channel: 'whatsapp' });
    expect(r.body.channels).toEqual(['whatsapp']);
    expect(r.body.mobileHint).toMatch(/^\+91 \*+\d{4}$/);
    expect(r.body.mobileHint).not.toContain(phone.slice(3, 9)); // only the last four digits show
    expect(sent.map((n) => [n.channel, n.to])).toEqual([['whatsapp', phone]]);

    const v = await verify({ identifier: phone, code: codeTo(phone) });
    expect(v.status).toBe(200);

    sent = [];
    // the same works when they type their email: the code still goes to their WhatsApp
    expect((await request({ identifier: email, channel: 'whatsapp' })).body.channels).toEqual(['whatsapp']);
    expect(sent.map((n) => [n.channel, n.to])).toEqual([['whatsapp', phone]]);
    expect((await verify({ identifier: email, code: codeTo(phone) })).status).toBe(200);
  });

  it('a code is single-use', async () => {
    const { phone } = await register();
    await request({ identifier: phone, channel: 'whatsapp' });
    const code = codeTo(phone);
    expect((await verify({ identifier: phone, code })).status).toBe(200);
    expect((await verify({ identifier: phone, code })).status).toBe(401);
  });

  it('without the channel they still get the email code only (no WhatsApp cost)', async () => {
    const { phone } = await register();
    sent = [];
    const r = await request({ identifier: phone });
    expect(r.body.channels).toEqual(['email']);
    expect(channelsTo(phone)).toEqual([]); // nothing to the phone at all
    expect(sent.map((n) => n.channel)).toEqual(['email']);
  });
});

describe('when WhatsApp cannot deliver, the code still arrives another way and the answer says so', () => {
  it('first sign-in: falls back to SMS', async () => {
    whatsappWorks = false;
    const phone = newPhone(), email = newEmail();
    const r = await request({ identifier: phone, otherIdentifier: email, channel: 'whatsapp' });
    expect(r.body).toEqual({ sent: true, channels: ['sms', 'email'], whatsappFailed: true });
    expect(channelsTo(phone)).toEqual(['whatsapp', 'sms']);
    const v = await verify({ identifier: phone, code: codeTo(phone), otherIdentifier: email, otherCode: codeTo(email) });
    expect(v.status).toBe(200); // the SMS code (the latest) is the one that works
  });

  it('verified customer: falls back to email', async () => {
    const { phone, email } = await register();
    sent = [];
    whatsappWorks = false;
    const r = await request({ identifier: phone, channel: 'whatsapp' });
    expect(r.body.channels).toEqual(['email']);
    expect(r.body.whatsappFailed).toBe(true);
    expect(r.body.emailHint).toBeTruthy();
    expect(sent.map((n) => [n.channel, n.to])).toEqual([['whatsapp', phone], ['email', email]]);
    expect((await verify({ identifier: phone, code: codeTo(email) })).status).toBe(200);
  });

  it('WhatsApp not set up at all: the request is still served by SMS, WhatsApp is never tried', async () => {
    disableWhatsApp();
    const phone = newPhone(), email = newEmail();
    const r = await request({ identifier: phone, otherIdentifier: email, channel: 'whatsapp' });
    expect(r.body).toEqual({ sent: true, channels: ['sms', 'email'], whatsappFailed: true });
    expect(channelsTo(phone)).toEqual(['sms']);
  });
});

describe('limits and validation', () => {
  it('a number gets only a few WhatsApp codes per window, then is told to use SMS or email', async () => {
    const { phone } = await register(); // this used one
    let last = 200;
    for (let i = 0; i < 6 && last === 200; i++) last = (await request({ identifier: phone, channel: 'whatsapp' })).status;
    expect(last).toBe(429);
    const blocked = await request({ identifier: phone, channel: 'whatsapp' });
    expect(blocked.body.message).toMatch(/SMS or email/);
    // email still works for that person
    expect((await request({ identifier: phone })).status).toBe(200);
  });

  it('the limit is per number, so one person cannot block another', async () => {
    const a = await register();
    for (let i = 0; i < 6; i++) await request({ identifier: a.phone, channel: 'whatsapp' });
    const b = await register();
    expect((await request({ identifier: b.phone, channel: 'whatsapp' })).status).toBe(200);
  });

  it('only "whatsapp" is accepted as a channel', async () => {
    for (const channel of ['telegram', 'sms', 'email', '']) {
      expect((await request({ identifier: newPhone(), channel })).status).toBe(400);
    }
    expect(sent).toHaveLength(0);
  });

  it('the channel cannot be used to pick someone else\'s number: the code goes to the account\'s own mobile', async () => {
    const victim = await register();
    sent = [];
    await request({ identifier: victim.email, otherIdentifier: '+919999999999', channel: 'whatsapp' });
    expect(sent.map((n) => n.to)).not.toContain('+919999999999'); // a verified account ignores the supplied contact
    expect(sent.map((n) => n.to)).toEqual([victim.phone]);
  });
});
