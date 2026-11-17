import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Brackets, DataSource, In, IsNull, LessThan, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { istDay } from './attendance.service';
import { Team, TeamMember } from './calendar.entities';
import { decryptBuffer, encryptBuffer, sniffType } from './leads-crypto';
import { LeadsNotifyService } from './leads-notify.service';
import {
  CommissionRule, Lead, LeadDocKind, LeadDocument, LeadEvent, LeadNotification, LeadStatus, LeadVertical, LEAD_DOC_KINDS, LEAD_VERTICALS,
} from './leads.entities';

const SECURE_DIR = join(__dirname, '..', '..', 'secure-uploads');
if (!existsSync(SECURE_DIR)) mkdirSync(SECURE_DIR, { recursive: true });

const MAX_FILE = 10 * 1024 * 1024;
const HOUR = 3_600_000;
const DAY_MS = 86_400_000;
const envNum = (k: string, d: number) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? n : d; };
/** A claimed lead with no activity for this long goes back to the pool. */
export const claimTimeoutMinutes = () => envNum('CLAIM_TIMEOUT_MINUTES', 15);
const slaHours = (urgent: boolean) => (urgent ? envNum('URGENT_SLA_HOURS', 4) : envNum('LEAD_SLA_HOURS', 48));

const isSuper = (u: AuthUser) => u.roles.includes(Role.SuperAdmin);
const isAdmin = (u: AuthUser) => isSuper(u) || u.roles.includes(Role.Admin);

/** The Admin's vertical is decided by the team they work in. */
const TEAM_VERTICAL: Partial<Record<Team, LeadVertical>> = { 'Alphaa Insurance': 'insurance', 'Alphaa Loans': 'loan' };
/** The module permission an Employee/Agent needs in order to raise leads for a vertical. */
const CREATE_PERMISSION: Record<LeadVertical, string> = { insurance: 'insurance', loan: 'loans' };

const FLOW: Record<LeadStatus, LeadStatus[]> = {
  New: [], // a New lead is only ever moved by being claimed
  Assigned: ['QuoteShared', 'Rejected'],
  QuoteShared: ['PaymentPending', 'Rejected'],
  PaymentPending: ['PaymentUploaded', 'Rejected'],
  PaymentUploaded: ['Issued', 'Rejected'],
  Issued: ['Closed'],
  Closed: [],
  Rejected: [],
};
const TERMINAL: LeadStatus[] = ['Closed', 'Rejected'];
const STAGE_LABEL: Record<LeadStatus, string> = {
  New: 'New', Assigned: 'Assigned', QuoteShared: 'Quote shared', PaymentPending: 'Payment pending', PaymentUploaded: 'Payment link/copy uploaded', Issued: 'Policy/Loan issued', Closed: 'Closed', Rejected: 'Rejected',
};

export interface CreateLeadInput {
  vertical: LeadVertical;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleRegNo?: string; vehicleType?: string; insurer?: string; policyType?: string;
  loanType?: string; loanAmount?: number; lender?: string;
}

export interface StatusInput {
  status: LeadStatus;
  note?: string;
  quoteAmount?: number;
  issuedAmount?: number;
  policyNumber?: string;
  policyExpiryDate?: string;
  rejectedReason?: string;
}

@Injectable()
export class LeadsService implements OnModuleInit {
  private readonly logger = new Logger('Leads');

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadEvent) private readonly events: Repository<LeadEvent>,
    @InjectRepository(LeadDocument) private readonly docs: Repository<LeadDocument>,
    @InjectRepository(LeadNotification) private readonly notes: Repository<LeadNotification>,
    @InjectRepository(CommissionRule) private readonly rules: Repository<CommissionRule>,
    @InjectRepository(TeamMember) private readonly members: Repository<TeamMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
    private readonly notify: LeadsNotifyService,
  ) {}

  onModuleInit() {
    const guard = (name: string, fn: () => Promise<unknown>) => () => fn().catch((e) => this.logger.warn(`${name} failed: ${(e as Error).message}`));
    setInterval(guard('Claim release', () => this.releaseStale()), 60_000).unref();
    setTimeout(guard('SLA check', () => this.checkSla()), 30_000).unref();
    setInterval(guard('SLA check', () => this.checkSla()), 5 * 60_000).unref();
    setTimeout(guard('Renewal reminders', () => this.sendRenewalReminders()), 150_000).unref();
    setInterval(guard('Renewal reminders', () => this.sendRenewalReminders()), 6 * HOUR).unref();
  }

  // ───────────────────────── who can do what ─────────────────────────

  /** The verticals whose pool and leads this person can work: Super Admin both, an Admin their teams', nobody else any. */
  async verticalsFor(user: AuthUser): Promise<LeadVertical[]> {
    if (isSuper(user)) return [...LEAD_VERTICALS];
    if (!isAdmin(user)) return [];
    const teams = (await this.members.find({ where: { userId: user.id } })).map((m) => TEAM_VERTICAL[m.team]).filter((v): v is LeadVertical => !!v);
    return [...new Set(teams)];
  }

  private canCreate(user: AuthUser, vertical: LeadVertical) {
    if (isSuper(user)) return true;
    if (isAdmin(user)) return false; // Admin/Ops work the pool; they do not raise leads
    return user.permissions.includes(CREATE_PERMISSION[vertical]);
  }

  private async load(id: string, user: AuthUser) {
    const lead = await this.leads.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const mine = lead.createdById === user.id;
    const staff = (await this.verticalsFor(user)).includes(lead.vertical);
    if (!mine && !staff) throw new NotFoundException('Lead not found'); // same answer as "no such lead", so ids cannot be probed
    return { lead, mine, staff };
  }

  private mustHold(lead: Lead, user: AuthUser) {
    if (isSuper(user)) return;
    if (lead.claimedById !== user.id) throw new ForbiddenException(lead.claimedById ? `This lead is being worked by ${lead.claimedByName}.` : 'Claim this lead first.');
  }

  private async event(leadId: string, user: Pick<AuthUser, 'id' | 'name'> | null, action: string, extra: { from?: string; to?: string; note?: string } = {}) {
    await this.events.save(this.events.create({ leadId, userId: user?.id ?? null, userName: user?.name ?? 'System', action, fromStatus: extra.from ?? null, toStatus: extra.to ?? null, note: extra.note ?? null }));
  }

  private async logActivity(user: AuthUser, lead: Lead, action: string, summary: string) {
    await this.activity.log(user, { module: 'leads', action, entityType: 'lead', entityId: lead.id, entityLabel: lead.ticketNumber, summary });
  }

  // ───────────────────────── creating ─────────────────────────

  private async nextNumber(vertical: LeadVertical) {
    const prefix = vertical === 'insurance' ? 'INS' : 'LN';
    const year = istDay(new Date()).slice(0, 4);
    const rows: { seq: number }[] = await this.db.query(
      `INSERT INTO solutions.counters (id, seq) VALUES ($1, 1) ON CONFLICT (id) DO UPDATE SET seq = solutions.counters.seq + 1 RETURNING seq`, [`lead:${prefix}:${year}`]);
    return `${prefix}-${year}-${String(rows[0].seq).padStart(4, '0')}`;
  }

  /** Submitting a lead is what creates the ticket and puts it in its vertical's unassigned pool. */
  async create(user: AuthUser, dto: CreateLeadInput) {
    if (!this.canCreate(user, dto.vertical)) throw new ForbiddenException(`You do not have access to ${dto.vertical === 'insurance' ? 'Insurance' : 'Loan'} leads.`);
    const phone = dto.customerPhone.replace(/[\s-]/g, '');
    if (dto.vertical === 'insurance') {
      if (!dto.vehicleRegNo || !dto.vehicleType || !dto.insurer || !dto.policyType) throw new BadRequestException('Vehicle registration, vehicle type, insurer and policy type are required for an insurance lead.');
    } else if (!dto.loanType || !dto.loanAmount || !dto.lender) throw new BadRequestException('Loan type, required amount and preferred lender are required for a loan lead.');

    const urgent = dto.vertical === 'insurance' && dto.policyType === 'Renewal';
    const lead = await this.leads.save(this.leads.create({
      ticketNumber: await this.nextNumber(dto.vertical), vertical: dto.vertical, status: 'New',
      customerName: dto.customerName.trim(), customerPhone: phone, customerEmail: dto.customerEmail?.trim().toLowerCase() || null,
      createdById: user.id, createdByName: user.name,
      vehicleRegNo: dto.vertical === 'insurance' ? dto.vehicleRegNo!.toUpperCase().replace(/\s/g, '') : null,
      vehicleType: dto.vertical === 'insurance' ? dto.vehicleType! : null, insurer: dto.vertical === 'insurance' ? dto.insurer! : null, policyType: dto.vertical === 'insurance' ? dto.policyType! : null,
      loanType: dto.vertical === 'loan' ? dto.loanType! : null, loanAmount: dto.vertical === 'loan' ? dto.loanAmount! : null, lender: dto.vertical === 'loan' ? dto.lender! : null,
      urgent, slaDueAt: new Date(Date.now() + slaHours(urgent) * HOUR),
    }));
    await this.event(lead.id, user, 'created', { to: 'New', note: urgent ? 'Urgent (renewal): short SLA applies' : undefined });
    await this.logActivity(user, lead, 'lead.created', `Created ${lead.vertical} lead ${lead.ticketNumber}`);
    return this.view(lead);
  }

  // ───────────────────────── listing and detail ─────────────────────────

  private view(l: Lead) {
    const lockExpiresAt = l.status === 'Assigned' && l.lastActivityAt ? new Date(l.lastActivityAt.getTime() + claimTimeoutMinutes() * 60_000).toISOString() : null;
    return { ...l, lockExpiresAt, slaOverdue: !l.resolvedAt && !TERMINAL.includes(l.status) && l.slaDueAt.getTime() < Date.now() };
  }

  /**
   * scope: `mine` (leads I raised), `pool` (unassigned, my verticals), `working` (claimed by me, not finished),
   * `claimed` (claimed by others, read-only), `all` (everything in my verticals).
   */
  async list(user: AuthUser, q: { scope?: string; vertical?: string; status?: string; search?: string; page?: number; pageSize?: number }) {
    const verticals = await this.verticalsFor(user);
    const qb: SelectQueryBuilder<Lead> = this.leads.createQueryBuilder('l');
    const scope = q.scope ?? 'mine';
    if (scope === 'mine') qb.where('l.createdById = :me', { me: user.id });
    else {
      if (!verticals.length) return { data: [], total: 0, page: 1, pageSize: 20 };
      qb.where('l.vertical IN (:...verticals)', { verticals });
      if (scope === 'pool') qb.andWhere(`l.status = 'New' AND l.claimedById IS NULL`);
      else if (scope === 'working') qb.andWhere(`l.claimedById = :me AND l.status NOT IN ('Closed','Rejected')`, { me: user.id });
      else if (scope === 'claimed') qb.andWhere(`l.claimedById IS NOT NULL AND l.claimedById <> :me AND l.status NOT IN ('Closed','Rejected')`, { me: user.id });
      else if (scope !== 'all') throw new BadRequestException('Unknown scope');
    }
    if (q.vertical && LEAD_VERTICALS.includes(q.vertical as LeadVertical)) qb.andWhere('l.vertical = :v', { v: q.vertical });
    if (q.status) qb.andWhere('l.status = :st', { st: q.status });
    if (q.search) qb.andWhere(new Brackets((w) => w.where('l.customerName ILIKE :s OR l.ticketNumber ILIKE :s OR l.vehicleRegNo ILIKE :s OR l.customerPhone ILIKE :s', { s: `%${q.search}%` })));
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize || 20));
    const [rows, total] = await qb.orderBy(scope === 'pool' ? 'l.slaDueAt' : 'l.createdAt', scope === 'pool' ? 'ASC' : 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { data: rows.map((r) => this.view(r)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string) {
    const { lead } = await this.load(id, user);
    const [events, documents, notifications] = await Promise.all([
      this.events.find({ where: { leadId: id }, order: { createdAt: 'ASC' } }),
      this.docs.find({ where: { leadId: id }, order: { createdAt: 'ASC' } }),
      this.notes.find({ where: { leadId: id }, order: { createdAt: 'DESC' }, take: 100 }),
    ]);
    return {
      ...this.view(lead), events, notifications,
      documents: documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes, uploadedByName: d.uploadedByName, createdAt: d.createdAt })),
      canWork: isSuper(user) || lead.claimedById === user.id,
    };
  }

  // ───────────────────────── claim lock ─────────────────────────

  /** One atomic UPDATE decides the winner: it only succeeds while the lead is still unclaimed, so two admins cannot both get it. */
  async claim(user: AuthUser, id: string) {
    const verticals = await this.verticalsFor(user);
    if (!verticals.length) throw new ForbiddenException('Only Admin/Ops users of the Insurance or Loans team can claim leads.');
    const res = await this.leads.createQueryBuilder().update(Lead)
      .set({ status: 'Assigned', claimedById: user.id, claimedByName: user.name, claimedAt: () => 'now()', lastActivityAt: () => 'now()' })
      .where(`id = :id AND status = 'New' AND claimed_by_id IS NULL AND vertical IN (:...verticals)`, { id, verticals }).execute();
    const lead = await this.leads.findOne({ where: { id } });
    if (!res.affected) {
      if (!lead || !verticals.includes(lead.vertical)) throw new NotFoundException('Lead not found');
      throw new ConflictException(lead.claimedByName ? `Already claimed by ${lead.claimedByName}.` : 'This lead is no longer in the pool.');
    }
    await this.event(id, user, 'claimed', { from: 'New', to: 'Assigned' });
    await this.logActivity(user, lead!, 'lead.claimed', `Claimed ${lead!.ticketNumber}`);
    await this.tellMarketing(lead!, 'claimed', `Lead ${lead!.ticketNumber} (${lead!.customerName}) was claimed by ${user.name} and is now being worked.`);
    return this.detail(user, id);
  }

  /** Hands a lead back to the pool. The holder can do it while nothing has been shared yet; the Super Admin at any open stage. */
  async release(user: AuthUser, id: string) {
    const { lead } = await this.load(id, user);
    this.mustHold(lead, user);
    if (!(lead.status === 'Assigned' || (isSuper(user) && !['New', 'Closed', 'Rejected', 'Issued'].includes(lead.status)))) throw new ConflictException('Only a lead that has not moved past "Assigned" can be released.');
    await this.leads.update({ id }, { status: 'New', claimedById: null, claimedByName: null, claimedAt: null, lastActivityAt: null });
    await this.event(id, user, 'released', { from: lead.status, to: 'New' });
    await this.logActivity(user, lead, 'lead.released', `Released ${lead.ticketNumber} to the pool`);
    return this.detail(user, id);
  }

  /** Runs every minute: puts back leads that were claimed but not touched within the timeout. */
  async releaseStale(): Promise<number> {
    const cutoff = new Date(Date.now() - claimTimeoutMinutes() * 60_000);
    const stale = await this.leads.find({ where: { status: 'Assigned', lastActivityAt: LessThan(cutoff) } });
    let n = 0;
    for (const l of stale) {
      const res = await this.leads.createQueryBuilder().update(Lead).set({ status: 'New', claimedById: null, claimedByName: null, claimedAt: null, lastActivityAt: null })
        .where(`id = :id AND status = 'Assigned' AND last_activity_at < :cutoff`, { id: l.id, cutoff }).execute();
      if (!res.affected) continue; // updated by its holder a moment ago
      n += 1;
      await this.event(l.id, null, 'auto_released', { from: 'Assigned', to: 'New', note: `No update from ${l.claimedByName} for ${claimTimeoutMinutes()} minutes` });
      await this.tellMarketing(l, 'auto_released', `Lead ${l.ticketNumber} went back to the pool: ${l.claimedByName} did not update it within ${claimTimeoutMinutes()} minutes.`);
    }
    return n;
  }

  // ───────────────────────── moving a lead along ─────────────────────────

  async setStatus(user: AuthUser, id: string, dto: StatusInput) {
    const { lead } = await this.load(id, user);
    this.mustHold(lead, user);
    const to = dto.status;
    if (!FLOW[lead.status]?.includes(to)) throw new BadRequestException(`A lead at "${STAGE_LABEL[lead.status]}" cannot move to "${STAGE_LABEL[to] ?? to}".`);
    const patch: Partial<Lead> = { status: to, lastActivityAt: new Date() };

    if (to === 'QuoteShared') {
      const amount = dto.quoteAmount ?? lead.quoteAmount;
      if (!amount || amount <= 0) throw new BadRequestException('Enter the quoted amount.');
      patch.quoteAmount = amount;
    }
    if (to === 'PaymentUploaded') {
      const hasCopy = await this.docs.exists({ where: { leadId: id, kind: 'payment_copy' } });
      if (!lead.paymentLinkUrl && !hasCopy) throw new BadRequestException('Add a payment link or upload the payment copy first.');
    }
    if (to === 'Rejected') {
      if (!dto.rejectedReason?.trim()) throw new BadRequestException('Give a reason for rejecting this lead.');
      patch.rejectedReason = dto.rejectedReason.trim();
    }
    if (to === 'Issued') {
      if (!(await this.docs.exists({ where: { leadId: id, kind: 'issued_copy' } }))) throw new BadRequestException(`Upload the ${lead.vertical === 'insurance' ? 'policy' : 'loan'} copy first.`);
      if (lead.vertical === 'insurance' && lead.paymentStatus !== 'collected') throw new BadRequestException('The payment has not been recorded yet. Upload the payment copy first.');
      const amount = dto.issuedAmount ?? lead.quoteAmount ?? lead.loanAmount;
      if (!amount || amount <= 0) throw new BadRequestException(lead.vertical === 'insurance' ? 'Enter the premium.' : 'Enter the sanctioned loan amount.');
      patch.issuedAmount = amount;
      patch.issuedAt = new Date();
      if (lead.vertical === 'insurance') {
        if (!dto.policyExpiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(dto.policyExpiryDate)) throw new BadRequestException('Enter the policy expiry date (YYYY-MM-DD); renewal reminders depend on it.');
        patch.policyExpiryDate = dto.policyExpiryDate;
      }
      if (dto.policyNumber?.trim()) patch.policyNumber = dto.policyNumber.trim();
      Object.assign(patch, await this.commissionFor({ ...lead, issuedAmount: amount }));
    }
    if (to === 'Issued' || to === 'Rejected') {
      patch.resolvedAt = new Date();
      if (lead.slaDueAt.getTime() < patch.resolvedAt.getTime() && !lead.slaBreachedAt) patch.slaBreachedAt = patch.resolvedAt;
    }
    if (to === 'Closed') patch.closedAt = new Date();

    await this.leads.update({ id }, patch);
    await this.event(id, user, 'status_changed', { from: lead.status, to, note: dto.note?.trim() || (to === 'Rejected' ? dto.rejectedReason : undefined) });
    await this.logActivity(user, lead, 'lead.status', `${lead.ticketNumber}: ${STAGE_LABEL[lead.status]} → ${STAGE_LABEL[to]}`);
    const fresh = (await this.leads.findOne({ where: { id } }))!;
    await this.tellMarketing(fresh, `status_${to}`, `Lead ${fresh.ticketNumber} (${fresh.customerName}) is now: ${STAGE_LABEL[to]}.${to === 'Rejected' ? ` Reason: ${fresh.rejectedReason}` : ''}`);
    return this.detail(user, id);
  }

  // ───────────────────────── payment ─────────────────────────

  /** Creates a Razorpay payment link for the quoted amount and sends it to the customer. */
  async generatePaymentLink(user: AuthUser, id: string) {
    const { lead } = await this.load(id, user);
    this.mustHold(lead, user);
    if (!['QuoteShared', 'PaymentPending'].includes(lead.status)) throw new ConflictException('Share the quote before creating a payment link.');
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !secret) throw new ConflictException('The payment gateway is not set up on this server. Paste a payment link instead, or upload the payment copy.');
    if (!lead.quoteAmount) throw new BadRequestException('There is no quoted amount yet.');
    const res = await fetch(`${process.env.RAZORPAY_BASE_URL?.trim() || 'https://api.razorpay.com'}/v1/payment_links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` },
      body: JSON.stringify({ amount: Math.round(lead.quoteAmount * 100), currency: 'INR', reference_id: lead.ticketNumber, description: `${lead.ticketNumber} — ${lead.vertical === 'insurance' ? 'insurance premium' : 'loan processing'}`, customer: { name: lead.customerName, contact: lead.customerPhone } }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { short_url?: string };
    if (!res.ok || !body.short_url) throw new ConflictException('The payment gateway did not create the link. Try again, or paste one manually.');
    return this.attachPaymentLink(user, lead, body.short_url, 'generated through the gateway');
  }

  async setPaymentLink(user: AuthUser, id: string, url: string) {
    const { lead } = await this.load(id, user);
    this.mustHold(lead, user);
    if (!['QuoteShared', 'PaymentPending'].includes(lead.status)) throw new ConflictException('Share the quote before adding a payment link.');
    return this.attachPaymentLink(user, lead, url, 'added manually');
  }

  private async attachPaymentLink(user: AuthUser, lead: Lead, url: string, how: string) {
    await this.leads.update({ id: lead.id }, { paymentLinkUrl: url, lastActivityAt: new Date() });
    await this.event(lead.id, user, 'payment_link', { note: how });
    await this.notify.deliver(lead.id, 'payment_link', 'customer', { email: lead.customerEmail, phone: lead.customerPhone }, `Payment link for ${lead.ticketNumber}`,
      `Hello ${lead.customerName}, please complete your payment of ₹${lead.quoteAmount ?? ''} using this secure link: ${url} (ref ${lead.ticketNumber}). — AskUs`);
    return this.detail(user, lead.id);
  }

  // ───────────────────────── documents ─────────────────────────

  async uploadDocument(user: AuthUser, id: string, file: { buffer: Buffer; originalname: string; size: number } | undefined, kind: string, extra: { paidAmount?: number } = {}) {
    const { lead, mine } = await this.load(id, user);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to upload.');
    if (file.size > MAX_FILE) throw new BadRequestException('The file is larger than 10 MB.');
    if (!LEAD_DOC_KINDS.includes(kind as LeadDocKind)) throw new BadRequestException('Unknown document type.');
    const k = kind as LeadDocKind;
    const holder = isSuper(user) || lead.claimedById === user.id;
    const intake: LeadDocKind[] = ['previous_policy', 'kyc', 'income_proof', 'other'];
    if (!holder && !(mine && intake.includes(k))) throw new ForbiddenException(holder === false && lead.claimedById ? `This lead is being worked by ${lead.claimedByName}.` : 'You cannot upload this kind of document.');
    if (TERMINAL.includes(lead.status)) throw new ConflictException('This lead is finished; documents can no longer be added.');
    if (k === 'payment_copy' && !['QuoteShared', 'PaymentPending', 'PaymentUploaded'].includes(lead.status)) throw new ConflictException('A payment copy can be added once the quote has been shared.');
    if (k === 'issued_copy' && !['PaymentUploaded', 'Issued'].includes(lead.status)) throw new ConflictException('Upload the issued copy once the payment is recorded.');

    const type = sniffType(file.buffer);
    if (!type) throw new BadRequestException('Only PDF, JPG and PNG files are accepted.');
    const storageKey = `${randomUUID()}.enc`;
    await writeFile(join(SECURE_DIR, storageKey), encryptBuffer(file.buffer), { mode: 0o600 });
    const doc = await this.docs.save(this.docs.create({ leadId: id, kind: k, fileName: file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 120), mimeType: type.mime, sizeBytes: file.size, storageKey, uploadedById: user.id, uploadedByName: user.name }));
    await this.event(id, user, 'document_uploaded', { note: `${k.replace('_', ' ')}: ${doc.fileName}` });
    if (lead.claimedById === user.id) await this.leads.update({ id }, { lastActivityAt: new Date() });

    if (k === 'payment_copy') {
      const amount = extra.paidAmount ?? lead.quoteAmount;
      await this.leads.update({ id }, { paymentStatus: 'collected', paidAmount: amount ?? null, paidAt: new Date() });
      await this.event(id, user, 'payment_recorded', { note: amount ? `₹${amount}` : undefined });
      await this.tellMarketing(lead, 'payment_uploaded', `Payment for ${lead.ticketNumber} (${lead.customerName}) has been uploaded${amount ? `: ₹${amount}` : ''}.`);
    }
    if (k === 'issued_copy') {
      const link = await this.customerLink(doc);
      await this.notify.deliver(id, 'policy_copy', 'customer', { email: lead.customerEmail, phone: lead.customerPhone }, `Your ${lead.vertical === 'insurance' ? 'policy' : 'loan'} document — ${lead.ticketNumber}`,
        `Hello ${lead.customerName}, your ${lead.vertical === 'insurance' ? 'policy' : 'loan'} document is ready. Download it here (link valid for 7 days): ${link} — AskUs`);
      await this.event(id, null, 'copy_sent_to_customer', { note: 'Sent the issued copy to the customer' });
    }
    return this.detail(user, id);
  }

  private async customerLink(doc: LeadDocument) {
    const token = await this.jwt.signAsync({ doc: doc.id, purpose: 'lead-doc' }, { expiresIn: '7d' });
    return `${(process.env.API_PUBLIC_URL?.trim() || 'http://localhost:4000').replace(/\/$/, '')}/api/leads/public/doc/${token}`;
  }

  private async fileOf(doc: LeadDocument) {
    try { return decryptBuffer(await readFile(join(SECURE_DIR, doc.storageKey))); } catch { throw new NotFoundException('The file is no longer available.'); }
  }

  /** Staff download: only the person who raised the lead, whoever holds it, the vertical's admins and the Super Admin. Every view is logged. */
  async download(user: AuthUser, id: string, docId: string) {
    const { lead } = await this.load(id, user);
    const doc = await this.docs.findOne({ where: { id: docId, leadId: id } });
    if (!doc) throw new NotFoundException('Document not found');
    const data = await this.fileOf(doc);
    await this.event(id, user, 'document_viewed', { note: `${doc.kind.replace('_', ' ')}: ${doc.fileName}` });
    await this.logActivity(user, lead, 'lead.document_viewed', `Opened ${doc.kind.replace('_', ' ')} of ${lead.ticketNumber}`);
    return { data, doc };
  }

  /** The customer's link: signed, expires after 7 days, and only ever opens the issued policy/loan copy. */
  async downloadByToken(token: string) {
    let claims: { doc?: string; purpose?: string };
    try { claims = await this.jwt.verifyAsync(token); } catch { throw new UnauthorizedException('This link has expired.'); }
    if (claims.purpose !== 'lead-doc' || !claims.doc) throw new UnauthorizedException();
    const doc = await this.docs.findOne({ where: { id: claims.doc, kind: 'issued_copy' } });
    if (!doc) throw new NotFoundException();
    await this.event(doc.leadId, null, 'customer_opened_copy');
    return { data: await this.fileOf(doc), doc };
  }

  // ───────────────────────── notifications ─────────────────────────

  /** Tells the person who raised the lead (so they need not chase the admin). */
  private async tellMarketing(lead: Lead, kind: string, text: string) {
    const person = await this.users.findOneBy({ id: lead.createdById });
    if (!person) return;
    await this.notify.deliver(lead.id, kind, 'marketing', { email: person.email, phone: person.mobile }, `${lead.ticketNumber}: update on your lead`, `${text} — AskUs`);
  }

  // ───────────────────────── commission ─────────────────────────

  async commissionFor(lead: Pick<Lead, 'vertical' | 'insurer' | 'lender' | 'issuedAmount'>): Promise<Partial<Lead>> {
    const partner = (lead.vertical === 'insurance' ? lead.insurer : lead.lender) ?? '*';
    const rule = (await this.rules.findOneBy({ vertical: lead.vertical, partner })) ?? (await this.rules.findOneBy({ vertical: lead.vertical, partner: '*' }));
    if (!rule || !lead.issuedAmount) return { commissionAmount: null, commissionBasis: null };
    const amount = rule.kind === 'percent' ? Math.round(lead.issuedAmount * rule.value) / 100 : rule.value;
    return { commissionAmount: amount, commissionBasis: `${rule.partner === '*' ? 'default rule' : rule.partner}: ${rule.kind === 'percent' ? `${rule.value}%` : `₹${rule.value} flat`}` };
  }

  listRules() { return this.rules.find({ order: { vertical: 'ASC', partner: 'ASC' } }); }

  async saveRule(user: AuthUser, dto: { vertical: LeadVertical; partner: string; kind: 'percent' | 'flat'; value: number }) {
    if (!isSuper(user)) throw new ForbiddenException('Only the Super Admin can change commission rules.');
    if (dto.kind === 'percent' && dto.value > 100) throw new BadRequestException('A percentage cannot be more than 100.');
    const partner = dto.partner.trim() || '*';
    const row = (await this.rules.findOneBy({ vertical: dto.vertical, partner })) ?? this.rules.create({ vertical: dto.vertical, partner });
    Object.assign(row, { kind: dto.kind, value: dto.value });
    await this.rules.save(row);
    return this.listRules();
  }

  async deleteRule(user: AuthUser, id: string) {
    if (!isSuper(user)) throw new ForbiddenException('Only the Super Admin can change commission rules.');
    await this.rules.delete({ id });
    return this.listRules();
  }

  // ───────────────────────── SLA ─────────────────────────

  /** Flags leads that are past their deadline and still not resolved, and alerts whoever holds them (or the vertical's admins). */
  async checkSla(): Promise<number> {
    const late = await this.leads.find({ where: { status: Not(In(['Issued', 'Closed', 'Rejected'])), slaDueAt: LessThan(new Date()), slaBreachedAt: IsNull() } });
    for (const l of late) {
      const res = await this.leads.update({ id: l.id, slaBreachedAt: IsNull() }, { slaBreachedAt: new Date() });
      if (!res.affected) continue;
      await this.event(l.id, null, 'sla_breached', { note: `${l.urgent ? 'Urgent' : 'Standard'} deadline passed` });
      const text = `SLA breach: ${l.ticketNumber} (${l.customerName})${l.urgent ? ' — URGENT renewal' : ''} is past its deadline and still at "${STAGE_LABEL[l.status]}".`;
      for (const who of await this.alertRecipients(l)) await this.notify.deliver(l.id, 'sla_breach', 'admin', { email: who.email, phone: who.mobile }, `SLA breach: ${l.ticketNumber}`, `${text} — AskUs`);
      await this.tellMarketing(l, 'sla_breach', text);
    }
    return late.length;
  }

  private async alertRecipients(l: Lead): Promise<User[]> {
    if (l.claimedById) { const u = await this.users.findOneBy({ id: l.claimedById }); if (u) return [u]; }
    const team: Team = l.vertical === 'insurance' ? 'Alphaa Insurance' : 'Alphaa Loans';
    const ids = (await this.members.find({ where: { team } })).map((m) => m.userId);
    const staff = ids.length ? await this.users.find({ where: { id: In(ids) } }) : [];
    const admins = staff.filter((u) => u.roles.includes(Role.Admin));
    return admins.length ? admins : (await this.users.find()).filter((u) => u.roles.includes(Role.SuperAdmin));
  }

  // ───────────────────────── renewal reminders ─────────────────────────

  /** 30, 15 and 7 days before an issued policy expires, the customer and the marketing person are reminded, once each. */
  async sendRenewalReminders(): Promise<number> {
    const today = istDay(new Date());
    const horizon = new Date(new Date(`${today}T00:00:00Z`).getTime() + 30 * DAY_MS).toISOString().slice(0, 10);
    const due = await this.leads.createQueryBuilder('l')
      .where(`l.vertical = 'insurance' AND l.status IN ('Issued','Closed') AND l.policyExpiryDate IS NOT NULL AND l.policyExpiryDate >= :today AND l.policyExpiryDate <= :horizon`, { today, horizon }).getMany();
    let sent = 0;
    for (const l of due) {
      const left = Math.round((new Date(`${l.policyExpiryDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
      const step = left <= 7 ? 7 : left <= 15 ? 15 : 30; // the window this lead is in right now
      const kind = `renewal_${step}`;
      const text = `Reminder: the ${l.insurer ?? ''} policy for ${l.vehicleRegNo} (${l.customerName}) expires on ${l.policyExpiryDate} — ${left === 0 ? 'today' : `in ${left} day${left > 1 ? 's' : ''}`}. Please renew in time.`;
      if (!(await this.notify.already(l.id, kind, 'customer'))) {
        await this.notify.deliver(l.id, kind, 'customer', { email: l.customerEmail, phone: l.customerPhone }, `Your policy expires on ${l.policyExpiryDate}`, `Hello ${l.customerName}, ${text} Contact AskUs to renew. — AskUs`);
        sent += 1;
      }
      if (!(await this.notify.already(l.id, kind, 'marketing'))) { await this.tellMarketing(l, kind, text); sent += 1; }
    }
    return sent;
  }

  async runMaintenance() {
    return { released: await this.releaseStale(), slaFlagged: await this.checkSla(), reminders: await this.sendRenewalReminders() };
  }

  // ───────────────────────── reports ─────────────────────────

  private async reportBase(user: AuthUser, from?: string, to?: string, vertical?: string) {
    const verticals = (await this.verticalsFor(user)).filter((v) => !vertical || v === vertical);
    if (!verticals.length) throw new ForbiddenException('Reports are for Admin/Ops of the Insurance or Loans team and the Super Admin.');
    const qb = this.leads.createQueryBuilder('l').where('l.vertical IN (:...verticals)', { verticals });
    if (from) qb.andWhere('l.createdAt >= :from', { from: new Date(`${from}T00:00:00+05:30`) });
    if (to) qb.andWhere('l.createdAt < :to', { to: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY_MS) });
    return qb;
  }

  /** Leads raised vs issued vs rejected, per marketing person. */
  async conversion(user: AuthUser, q: { from?: string; to?: string; vertical?: string }) {
    const rows = await (await this.reportBase(user, q.from, q.to, q.vertical)).select('l.createdById', 'id').addSelect('l.createdByName', 'name')
      .addSelect('COUNT(*)', 'created').addSelect(`COUNT(*) FILTER (WHERE l.issuedAt IS NOT NULL)`, 'issued').addSelect(`COUNT(*) FILTER (WHERE l.status = 'Rejected')`, 'rejected')
      .groupBy('l.createdById').addGroupBy('l.createdByName').orderBy('created', 'DESC').getRawMany<{ id: string; name: string; created: string; issued: string; rejected: string }>();
    return rows.map((r) => ({ userId: r.id, name: r.name, created: +r.created, issued: +r.issued, rejected: +r.rejected, open: +r.created - +r.issued - +r.rejected, conversionPct: +r.created ? Math.round((+r.issued / +r.created) * 1000) / 10 : 0 }));
  }

  /** Business by insurer / lender: how many were issued and for how much. */
  async split(user: AuthUser, q: { from?: string; to?: string; vertical?: string }) {
    const rows = await (await this.reportBase(user, q.from, q.to, q.vertical)).select('l.vertical', 'vertical').addSelect(`COALESCE(l.insurer, l.lender, 'Unspecified')`, 'partner')
      .addSelect('COUNT(*)', 'leads').addSelect(`COUNT(*) FILTER (WHERE l.issuedAt IS NOT NULL)`, 'issued').addSelect(`COALESCE(SUM(l.issuedAmount) FILTER (WHERE l.issuedAt IS NOT NULL), 0)`, 'amount')
      .groupBy('l.vertical').addGroupBy('partner').orderBy('amount', 'DESC').getRawMany<{ vertical: string; partner: string; leads: string; issued: string; amount: string }>();
    return rows.map((r) => ({ vertical: r.vertical, partner: r.partner, leads: +r.leads, issued: +r.issued, amount: +r.amount }));
  }

  /** Collected vs pending, by month and by marketing person. Pending = quoted and not rejected but no payment recorded yet. */
  async revenue(user: AuthUser, q: { from?: string; to?: string; vertical?: string }) {
    const base = () => this.reportBase(user, q.from, q.to, q.vertical);
    const pending = `COALESCE(SUM(l.quoteAmount) FILTER (WHERE l.paymentStatus = 'pending' AND l.status IN ('QuoteShared','PaymentPending','PaymentUploaded','Issued','Closed')), 0)`;
    const collected = `COALESCE(SUM(l.paidAmount) FILTER (WHERE l.paymentStatus = 'collected'), 0)`;
    const [byMonth, byAgent] = await Promise.all([
      (await base()).select(`to_char(l.createdAt AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`, 'month').addSelect(collected, 'collected').addSelect(pending, 'pending').groupBy('month').orderBy('month', 'ASC').getRawMany<{ month: string; collected: string; pending: string }>(),
      (await base()).select('l.createdById', 'id').addSelect('l.createdByName', 'name').addSelect(collected, 'collected').addSelect(pending, 'pending').groupBy('l.createdById').addGroupBy('l.createdByName').orderBy('collected', 'DESC').getRawMany<{ id: string; name: string; collected: string; pending: string }>(),
    ]);
    return {
      byMonth: byMonth.map((r) => ({ month: r.month, collected: +r.collected, pending: +r.pending })),
      byAgent: byAgent.map((r) => ({ userId: r.id, name: r.name, collected: +r.collected, pending: +r.pending })),
      totals: { collected: byMonth.reduce((a, r) => a + +r.collected, 0), pending: byMonth.reduce((a, r) => a + +r.pending, 0) },
    };
  }

  /** Time to resolve and SLA performance. */
  async sla(user: AuthUser, q: { from?: string; to?: string; vertical?: string }) {
    const r = await (await this.reportBase(user, q.from, q.to, q.vertical))
      .select('COUNT(*)', 'total').addSelect('COUNT(l.resolvedAt)', 'resolved').addSelect('COUNT(l.slaBreachedAt)', 'breached')
      .addSelect(`COUNT(*) FILTER (WHERE l.slaBreachedAt IS NULL AND l.resolvedAt IS NULL AND l.status NOT IN ('Closed','Rejected') AND l.slaDueAt < now())`, 'overdueNow')
      .addSelect(`COALESCE(AVG(EXTRACT(EPOCH FROM (l.resolvedAt - l.createdAt)) / 3600), 0)`, 'avgHours')
      .addSelect(`COUNT(*) FILTER (WHERE l.urgent AND l.slaBreachedAt IS NOT NULL)`, 'urgentBreached')
      .getRawOne<Record<string, string>>();
    return { total: +r!.total, resolved: +r!.resolved, breached: +r!.breached, overdueNow: +r!.overdueNow, urgentBreached: +r!.urgentBreached, avgHoursToResolve: Math.round(+r!.avgHours * 10) / 10 };
  }

  /** Leads closed per marketing person and the commission they earned. */
  async commissions(user: AuthUser, q: { from?: string; to?: string; vertical?: string }) {
    const qb = await this.reportBase(user, q.from, q.to, q.vertical);
    const rows = await qb.andWhere('l.issuedAt IS NOT NULL').select('l.createdById', 'id').addSelect('l.createdByName', 'name').addSelect('l.vertical', 'vertical')
      .addSelect('COUNT(*)', 'leads').addSelect('COALESCE(SUM(l.issuedAmount), 0)', 'business').addSelect('COALESCE(SUM(l.commissionAmount), 0)', 'commission')
      .groupBy('l.createdById').addGroupBy('l.createdByName').addGroupBy('l.vertical').orderBy('commission', 'DESC').getRawMany<{ id: string; name: string; vertical: string; leads: string; business: string; commission: string }>();
    return rows.map((r) => ({ userId: r.id, name: r.name, vertical: r.vertical, leadsClosed: +r.leads, business: +r.business, commission: +r.commission }));
  }
}
