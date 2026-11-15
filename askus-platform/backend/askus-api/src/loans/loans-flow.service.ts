import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { User } from '../identity/identity.entities';
import { ActivityLog } from '../activity/activity.entities';
import { ActivityService, roleLabel } from '../activity/activity.service';
import { LoansFilesService } from './loans-files.service';
import {
  CustomerDetails, FormApplication, LoanSupportTicket, LoansAuditLog, QuoteAdminNote, QuoteApplication,
  QuoteDocument, QuoteHistory, QuoteSnapshot,
} from './loans-flow.entities';

export type QuoteStatus =
  | 'in_progress' | 'submitted' | 'under_review' | 'documents_required' | 'approved' | 'rejected' | 'disbursed' | 'closed';

export const QUOTE_STATUSES: QuoteStatus[] = [
  'in_progress', 'submitted', 'under_review', 'documents_required', 'approved', 'rejected', 'disbursed', 'closed',
];
export const QUOTE_STEPS = ['know_you', 'details_confirmed', 'personal_details', 'documents', 'documents_uploaded', 'submitted'];

/** Allowed reviewer moves. Mirrors the screens' ADMIN_TRANSITIONS. */
const ADMIN_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  in_progress: [],
  submitted: ['under_review', 'documents_required', 'rejected'],
  under_review: ['documents_required', 'approved', 'rejected'],
  documents_required: ['under_review', 'rejected'],
  approved: ['disbursed', 'closed'],
  rejected: ['under_review', 'closed'],
  disbursed: ['closed'],
  closed: [],
};

/** Fields a customer may store in their loan profile. */
export const DETAIL_KEYS = [
  'fullName', 'email', 'dateOfBirth', 'address', 'pinCode', 'panNumber', 'employmentType', 'employerName', 'monthlyIncome',
  'gender', 'maritalStatus', 'qualification', 'salaryBank', 'addressLine2', 'city', 'state',
] as const;

/** Documents every submitted application needs (same rule the upload screen shows). */
function missingRequired(slots: Set<string>): string[] {
  const out: string[] = [];
  if (!slots.has('salary_slip_1')) out.push('1st salary slip');
  if (!slots.has('salary_slip_2')) out.push('2nd salary slip');
  if (!slots.has('salary_slip_3')) out.push('3rd salary slip');
  if (!slots.has('bank_statement')) out.push('bank statement');
  if (!(slots.has('aadhaar_both') || (slots.has('aadhaar_front') && slots.has('aadhaar_back')))) out.push('address proof');
  if (!slots.has('pan_card')) out.push('PAN card');
  return out;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
const hex = (bytes: number) => randomBytes(bytes).toString('hex').toUpperCase();

export const isLoansReviewer = (user: AuthUser) =>
  user.roles.includes(Role.SuperAdmin) || user.roles.includes(Role.LoansAdmin) || user.roles.includes(Role.Employee);

@Injectable()
export class LoansFlowService {
  constructor(
    private readonly db: DataSource,
    private readonly files: LoansFilesService,
    private readonly activity: ActivityService,
    @InjectRepository(CustomerDetails) private readonly details: Repository<CustomerDetails>,
    @InjectRepository(QuoteApplication) private readonly apps: Repository<QuoteApplication>,
    @InjectRepository(QuoteDocument) private readonly docs: Repository<QuoteDocument>,
    @InjectRepository(QuoteHistory) private readonly historyRepo: Repository<QuoteHistory>,
    @InjectRepository(QuoteAdminNote) private readonly notes: Repository<QuoteAdminNote>,
    @InjectRepository(QuoteSnapshot) private readonly snapshots: Repository<QuoteSnapshot>,
    @InjectRepository(FormApplication) private readonly forms: Repository<FormApplication>,
    @InjectRepository(LoanSupportTicket) private readonly tickets: Repository<LoanSupportTicket>,
    @InjectRepository(LoansAuditLog) private readonly audits: Repository<LoansAuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ───────────────────────── customer profile ─────────────────────────

  async getDetails(userId: string) {
    const row = await this.details.findOne({ where: { userId } });
    const d = (row?.data ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
    return {
      fullName: str('fullName'), email: str('email'), dateOfBirth: str('dateOfBirth'), address: str('address'),
      pinCode: str('pinCode'), panNumber: str('panNumber'), employmentType: str('employmentType'),
      employerName: str('employerName'), monthlyIncome: typeof d.monthlyIncome === 'number' ? d.monthlyIncome : null,
      gender: str('gender'), maritalStatus: str('maritalStatus'), qualification: str('qualification'),
      salaryBank: str('salaryBank'), addressLine2: str('addressLine2'), city: str('city'), state: str('state'),
    };
  }

  async saveDetails(userId: string, input: Record<string, unknown>) {
    const row = (await this.details.findOne({ where: { userId } })) ?? this.details.create({ userId, data: {} });
    const next = { ...row.data };
    for (const key of DETAIL_KEYS) {
      const value = input[key];
      if (value === null || value === undefined || value === '') continue; // omitted fields stay untouched
      if (key === 'monthlyIncome') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) throw new BadRequestException('Invalid monthly income.');
        next[key] = Math.round(value);
      } else {
        if (typeof value !== 'string' || value.length > 250) throw new BadRequestException(`Invalid ${key}.`);
        next[key] = value.trim();
      }
    }
    row.data = next;
    await this.details.save(row);
    return this.getDetails(userId);
  }

  // ───────────────────────── quote applications ─────────────────────────

  private dto(a: QuoteApplication) {
    return {
      id: a.appKey, uid: a.userId, loanType: a.loanType, lenderId: a.lenderId, amount: a.amount, tenureMonths: a.tenureMonths,
      roi: a.roi, status: a.status, step: a.step, purpose: a.purpose ?? undefined,
      documentDraftId: a.documentDraftId ?? undefined, referenceNumber: a.referenceNumber ?? undefined,
      consentVersion: a.consentVersion ?? undefined, submittedAt: iso(a.submittedAt), reviewMessage: a.reviewMessage ?? undefined,
      reviewedBy: a.reviewedBy ?? undefined, reviewedAt: iso(a.reviewedAt), resubmissions: a.resubmissions,
      resubmittedAt: iso(a.resubmittedAt), createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt)!,
      assignedToId: a.assignedToId ?? undefined, assignedToName: a.assignedToName ?? undefined, assignedAt: iso(a.assignedAt),
    };
  }

  private docDto(d: QuoteDocument) {
    return {
      slot: d.slot, label: d.label, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType,
      storageKey: d.storageKey, fileId: d.fileId, fileFormat: d.fileFormat, fileVersion: d.fileVersion,
      period: d.period ?? undefined, uploadedAt: iso(d.uploadedAt)!, reviewStatus: d.reviewStatus ?? undefined,
      reviewNote: d.reviewNote ?? undefined, reviewedAt: iso(d.reviewedAt), reviewedBy: d.reviewedBy ?? undefined,
    };
  }

  private checkKey(key: string) {
    if (!/^[a-z0-9_-]{1,40}__[a-z0-9_-]{1,40}$/i.test(key)) throw new BadRequestException('Invalid application id.');
  }

  private async mine(userId: string, key: string, em?: EntityManager) {
    this.checkKey(key);
    const repo = em ? em.getRepository(QuoteApplication) : this.apps;
    const app = await repo.findOne({ where: { userId, appKey: key } });
    if (!app) throw new NotFoundException('This application was not found.');
    return app;
  }

  async listQuoteApps(userId: string) {
    const rows = await this.apps.find({ where: { userId }, order: { updatedAt: 'DESC' }, take: 20 });
    return rows.map((a) => this.dto(a));
  }

  async getQuoteApp(userId: string, key: string) {
    this.checkKey(key);
    const app = await this.apps.findOne({ where: { userId, appKey: key } });
    return app ? this.dto(app) : null;
  }

  async saveQuoteApp(
    userId: string,
    input: { loanType: string; lenderId: string; amount: number; tenureMonths: number; roi: number; step: string; purpose?: string },
  ) {
    const key = `${input.loanType}__${input.lenderId}`;
    this.checkKey(key);
    const existing = await this.apps.findOne({ where: { userId, appKey: key } });
    if (existing && existing.status !== 'in_progress') throw new BadRequestException('This application has already been submitted.');
    const app = existing ?? this.apps.create({ userId, appKey: key, loanType: input.loanType, lenderId: input.lenderId });
    app.amount = Math.round(input.amount);
    app.tenureMonths = Math.round(input.tenureMonths);
    app.roi = input.roi;
    app.status = 'in_progress';
    app.step = input.step;
    if (input.purpose) app.purpose = input.purpose;
    await this.apps.save(app);
  }

  async ensureDraftId(userId: string, key: string) {
    const app = await this.mine(userId, key);
    if (app.documentDraftId) return app.documentDraftId;
    app.documentDraftId = randomUUID();
    await this.apps.save(app);
    return app.documentDraftId;
  }

  async deleteQuoteApp(userId: string, key: string) {
    const app = await this.mine(userId, key);
    if (app.status !== 'in_progress') throw new ForbiddenException('A submitted application cannot be deleted.');
    const docs = await this.docs.find({ where: { applicationId: app.id } });
    await this.db.transaction(async (em) => {
      await em.delete(QuoteDocument, { applicationId: app.id });
      await em.delete(QuoteHistory, { applicationId: app.id });
      await em.delete(QuoteSnapshot, { applicationId: app.id });
      await em.delete(QuoteApplication, { id: app.id });
    });
    for (const d of docs) await this.removeIfOrphan(d.storageKey);
  }

  /** Records consent, freezes a copy of the customer's details and marks the application submitted. */
  async submitQuote(user: AuthUser, input: { loanType: string; lenderId: string; amount: number; tenureMonths: number; roi: number; purpose?: string; consentVersion: string }) {
    const key = `${input.loanType}__${input.lenderId}`;
    const details = await this.getDetails(user.id);
    const referenceNumber = `QA-${new Date().getFullYear()}-${hex(5)}`;
    await this.db.transaction(async (em) => {
      const app = await this.mine(user.id, key, em);
      if (app.status !== 'in_progress') throw new BadRequestException('This application has already been submitted.');
      app.amount = Math.round(input.amount);
      app.tenureMonths = Math.round(input.tenureMonths);
      app.roi = input.roi;
      app.status = 'submitted';
      app.step = 'submitted';
      app.consentVersion = input.consentVersion;
      app.referenceNumber = referenceNumber;
      app.submittedAt = new Date();
      if (input.purpose) app.purpose = input.purpose;
      await em.save(app);
      await em.save(em.create(QuoteHistory, {
        applicationId: app.id, actor: 'customer', actorId: user.id, event: 'submitted', fromStatus: 'in_progress',
        toStatus: 'submitted', message: 'Application submitted with consent.',
      }));
      await em.save(em.create(QuoteSnapshot, { applicationId: app.id, profile: this.cleanProfile(details), takenAt: new Date() }));
    });
    await this.activity.log(user, {
      module: 'loans', action: 'loan.submitted', entityType: 'loan_journey', entityId: `${user.id}/${key}`, entityLabel: referenceNumber,
      summary: `${referenceNumber}: customer submitted a loan application`, metadata: { amount: input.amount, tenureMonths: input.tenureMonths },
    });
    return referenceNumber;
  }

  async resubmitQuote(user: AuthUser, key: string) {
    const details = await this.getDetails(user.id);
    await this.db.transaction(async (em) => {
      const app = await this.mine(user.id, key, em);
      if (app.status !== 'documents_required') throw new BadRequestException('This application is not waiting for documents.');
      const docs = await em.find(QuoteDocument, { where: { applicationId: app.id } });
      if (docs.some((d) => d.reviewStatus === 'rejected')) {
        throw new BadRequestException('Replace the documents marked "Needs changes" before you resubmit.');
      }
      const missing = missingRequired(new Set(docs.map((d) => d.slot)));
      if (missing.length) throw new BadRequestException(`Still needed: ${missing.join('; ')}.`);
      app.status = 'submitted';
      app.resubmissions += 1;
      app.resubmittedAt = new Date();
      await em.save(app);
      await em.save(em.create(QuoteHistory, {
        applicationId: app.id, actor: 'customer', actorId: user.id, event: 'resubmitted', fromStatus: 'documents_required',
        toStatus: 'submitted', message: 'Customer updated the documents and resubmitted.',
      }));
      await em.save(em.create(QuoteSnapshot, { applicationId: app.id, profile: this.cleanProfile(details), takenAt: new Date() }));
    });
  }

  private cleanProfile(details: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(details)) if (v !== null && v !== '') out[k] = v;
    return out;
  }

  // ───────────────────────── quote documents ─────────────────────────

  async listQuoteDocs(userId: string, key: string) {
    const app = await this.mine(userId, key);
    return (await this.docs.find({ where: { applicationId: app.id } })).map((d) => this.docDto(d));
  }

  async saveQuoteDoc(
    userId: string,
    key: string,
    input: { slot: string; label: string; fileName: string; fileSize: number; mimeType: string; storageKey: string; fileId: string; fileFormat: string; fileVersion?: number; period?: string },
  ) {
    const app = await this.mine(userId, key);
    if (app.status !== 'in_progress' && app.status !== 'documents_required') {
      throw new ForbiddenException('Documents can no longer be changed on this application.');
    }
    this.files.assertOwner(input.storageKey, userId);
    this.files.parseKey(input.storageKey);
    const existing = await this.docs.findOne({ where: { applicationId: app.id, slot: input.slot } });
    const doc = existing ?? this.docs.create({ applicationId: app.id, slot: input.slot });
    const oldKey = existing?.storageKey;
    Object.assign(doc, {
      label: input.label, fileName: input.fileName, fileSize: input.fileSize, mimeType: input.mimeType,
      storageKey: input.storageKey, fileId: input.fileId, fileFormat: input.fileFormat, fileVersion: input.fileVersion ?? 0,
      period: input.period ?? null,
      // a replaced file starts unreviewed
      reviewStatus: null, reviewNote: null, reviewedAt: null, reviewedBy: null,
    });
    await this.docs.save(doc);
    if (oldKey && oldKey !== input.storageKey) await this.removeIfOrphan(oldKey);
  }

  async deleteQuoteDoc(userId: string, key: string, slot: string) {
    const app = await this.mine(userId, key);
    if (app.status !== 'in_progress' && app.status !== 'documents_required') {
      throw new ForbiddenException('Documents can no longer be changed on this application.');
    }
    const doc = await this.docs.findOne({ where: { applicationId: app.id, slot } });
    if (!doc) return;
    await this.docs.delete({ id: doc.id });
    await this.removeIfOrphan(doc.storageKey);
  }

  /** Documents already uploaded for another of the customer's applications, so they need not upload again. */
  async findReusable(userId: string, excludeKey: string) {
    const others = await this.apps.find({ where: { userId, appKey: Not(excludeKey) }, order: { updatedAt: 'DESC' }, take: 20 });
    for (const o of others) {
      const docs = (await this.docs.find({ where: { applicationId: o.id } })).filter((d) => d.reviewStatus !== 'rejected');
      if (docs.length) return { appId: o.appKey, lenderId: o.lenderId, loanType: o.loanType, docs: docs.map((d) => this.docDto(d)) };
    }
    return null;
  }

  async history(userId: string, key: string) {
    const app = await this.mine(userId, key);
    return this.historyOf(app.id);
  }

  private async historyOf(applicationId: string) {
    const rows = await this.historyRepo.find({ where: { applicationId }, order: { at: 'ASC' } });
    return rows.map((h) => ({
      id: h.id, at: iso(h.at)!, actor: h.actor, event: h.event, from: h.fromStatus, to: h.toStatus, message: h.message ?? undefined,
    }));
  }

  // ───────────────────────── reviewer side (quote applications) ─────────────────────────

  async adminListQuoteApps(limit = 300) {
    const rows = await this.apps.find({ order: { updatedAt: 'DESC' }, take: limit });
    const ids = [...new Set(rows.map((r) => r.userId))];
    const [accounts, details] = ids.length
      ? await Promise.all([this.users.find({ where: { id: In(ids) } }), this.details.find({ where: { userId: In(ids) } })])
      : [[], []];
    const mobile = new Map(accounts.map((u) => [u.id, u.mobile ?? '']));
    const name = new Map(accounts.map((u) => [u.id, u.fullName ?? '']));
    const fullName = new Map(details.map((d) => [d.userId, (d.data.fullName as string) ?? '']));
    return rows.map((a) => ({
      ...this.dto(a),
      customerName: fullName.get(a.userId) || name.get(a.userId) || '',
      customerMobile: mobile.get(a.userId) ?? '',
    }));
  }

  private async byOwner(uid: string, key: string) {
    this.checkKey(key);
    const app = await this.apps.findOne({ where: { userId: uid, appKey: key } });
    if (!app) throw new NotFoundException('Application not found.');
    return app;
  }

  async adminGetQuoteApp(uid: string, key: string) {
    return this.dto(await this.byOwner(uid, key));
  }

  async adminDocs(uid: string, key: string) {
    const app = await this.byOwner(uid, key);
    return (await this.docs.find({ where: { applicationId: app.id } })).map((d) => this.docDto(d));
  }

  async adminHistory(uid: string, key: string) {
    return this.historyOf((await this.byOwner(uid, key)).id);
  }

  async adminNotes(uid: string, key: string) {
    const app = await this.byOwner(uid, key);
    const rows = await this.notes.find({ where: { applicationId: app.id }, order: { at: 'ASC' } });
    return rows.map((n) => ({ id: n.id, text: n.text, byEmail: n.byEmail ?? '', at: iso(n.at)! }));
  }

  async adminAddNote(admin: AuthUser, uid: string, key: string, text: string) {
    const app = await this.byOwner(uid, key);
    const trimmed = text.trim();
    if (!trimmed) throw new BadRequestException('Write a note first.');
    await this.notes.save(this.notes.create({
      applicationId: app.id, text: trimmed.slice(0, 1000), byId: admin.id, byEmail: await this.emailOf(admin.id),
    }));
    await this.activity.log(admin, {
      module: 'loans', action: 'loan.note_added', entityType: 'loan_journey', entityId: `${uid}/${key}`, entityLabel: app.referenceNumber ?? key,
      summary: `${app.referenceNumber ?? key}: added an internal note`,
    });
  }

  async adminSnapshot(uid: string, key: string) {
    const app = await this.byOwner(uid, key);
    const s = await this.snapshots.findOne({ where: { applicationId: app.id } });
    return s ? { ...s.profile, takenAt: iso(s.takenAt) } : null;
  }

  async adminSetStatus(admin: AuthUser, uid: string, key: string, input: { to: QuoteStatus; message?: string; internalNote?: string }) {
    const email = await this.emailOf(admin.id);
    await this.db.transaction(async (em) => {
      const app = await em.findOne(QuoteApplication, { where: { userId: uid, appKey: key }, lock: { mode: 'pessimistic_write' } });
      if (!app) throw new NotFoundException('Application not found.');
      const from = app.status as QuoteStatus;
      if (!ADMIN_TRANSITIONS[from]?.includes(input.to)) {
        throw new BadRequestException(`This application is now "${from}" and can no longer move to "${input.to}". Refresh to see the latest status.`);
      }
      const message = (input.message ?? '').trim().slice(0, 500);
      if ((input.to === 'rejected' || input.to === 'documents_required') && !message) throw new BadRequestException('Write a message for the customer.');
      app.status = input.to;
      app.reviewMessage = message; // always written so an old message never lingers
      app.reviewedBy = admin.id;
      app.reviewedAt = new Date();
      await em.save(app);
      await em.save(em.create(QuoteHistory, {
        applicationId: app.id, actor: 'admin', actorId: admin.id, event: 'status_changed', fromStatus: from, toStatus: input.to,
        message: message || null,
      }));
      await this.audit(em, admin, email, 'QUOTE_APPLICATION_STATUS_UPDATED', `Status ${from} -> ${input.to}.`, `${uid}/${key}`, app.referenceNumber);
      const note = input.internalNote?.trim();
      if (note) await em.save(em.create(QuoteAdminNote, { applicationId: app.id, text: note.slice(0, 1000), byId: admin.id, byEmail: email }));
    });
  }

  async adminReviewDoc(admin: AuthUser, uid: string, key: string, slot: string, input: { reviewStatus: 'verified' | 'rejected'; note?: string }) {
    const note = input.note?.trim().slice(0, 300);
    if (input.reviewStatus === 'rejected' && !note) throw new BadRequestException('Say what is wrong with this document.');
    const app = await this.byOwner(uid, key);
    const doc = await this.docs.findOne({ where: { applicationId: app.id, slot } });
    if (!doc) throw new NotFoundException('Document not found.');
    const email = await this.emailOf(admin.id);
    await this.db.transaction(async (em) => {
      doc.reviewStatus = input.reviewStatus;
      doc.reviewNote = input.reviewStatus === 'rejected' ? note ?? '' : '';
      doc.reviewedAt = new Date();
      doc.reviewedBy = admin.id;
      await em.save(doc);
      await this.audit(em, admin, email, 'QUOTE_DOCUMENT_REVIEWED', `${slot} marked ${input.reviewStatus}.`, `${uid}/${key}`, app.referenceNumber);
    });
  }

  /** Give a loan journey to a staff member, or release it (assigneeId null). */
  async assignJourney(actor: AuthUser, uid: string, key: string, assigneeId: string | null) {
    const app = await this.byOwner(uid, key);
    const who = await this.activity.assignee(actor, assigneeId, app.assignedToId);
    app.assignedToId = who?.id ?? null;
    app.assignedToName = who?.name ?? null;
    app.assignedAt = who ? new Date() : null;
    await this.apps.save(app);
    await this.activity.log(actor, {
      module: 'loans', action: who ? 'loan.assigned' : 'loan.released', entityType: 'loan_journey', entityId: `${uid}/${key}`, entityLabel: app.referenceNumber ?? key,
      summary: who ? `${app.referenceNumber ?? key}: assigned to ${who.name}` : `${app.referenceNumber ?? key}: released (no one assigned)`,
      metadata: { assigneeId: who?.id ?? null },
    });
    return this.dto(app);
  }

  // ───────────────────────── full application form ─────────────────────────

  private formDto(f: FormApplication) {
    return {
      ...f.data, id: f.id, referenceNumber: f.referenceNumber, userId: f.userId, status: f.status, documents: f.documents,
      statusHistory: f.statusHistory, adminNotes: f.adminNotes ?? undefined, createdAt: iso(f.createdAt)!, updatedAt: iso(f.updatedAt)!,
      assignedToId: f.assignedToId ?? undefined, assignedToName: f.assignedToName ?? undefined, assignedAt: iso(f.assignedAt),
    };
  }

  async submitForm(user: AuthUser, input: { data: Record<string, unknown>; documents: Record<string, unknown>[] }) {
    const account = await this.users.findOneBy({ id: user.id });
    if (!account?.mobile) throw new ForbiddenException('A signed-in customer with a verified phone is required.');
    // Every attached file must be one this customer uploaded.
    for (const d of input.documents) {
      if (typeof d.storageKey === 'string' && d.storageKey) this.files.assertOwner(d.storageKey, user.id);
    }
    const now = new Date().toISOString();
    const reference = `AF-${new Date().getFullYear()}-${hex(6)}`;
    const { id: _i, referenceNumber: _r, userId: _u, status: _s, statusHistory: _h, createdAt: _c, updatedAt: _up, documents: _d, ...rest } = input.data;
    void [_i, _r, _u, _s, _h, _c, _up, _d];
    const documents = input.documents.map((d) => ({ ...d, status: 'pending', uploadedAt: d.storageKey ? now : undefined }));
    const form = await this.db.transaction(async (em) => {
      const saved = await em.save(em.create(FormApplication, {
        userId: user.id, referenceNumber: reference, status: 'submitted',
        data: { ...rest, userName: rest.fullName ?? account.fullName ?? '', userMobile: account.mobile, userEmail: account.email ?? '' },
        documents,
        statusHistory: [{ status: 'submitted', timestamp: now, note: 'Application submitted by applicant.' }],
      }));
      await this.audit(em, user, account.email, 'APPLICATION_SUBMITTED', 'Customer submitted an application.', saved.id, reference, 'customer');
      return saved;
    });
    return this.formDto(form);
  }

  async myForms(userId: string) {
    return (await this.forms.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 })).map((f) => this.formDto(f));
  }

  async allForms() {
    return (await this.forms.find({ order: { createdAt: 'DESC' }, take: 100 })).map((f) => this.formDto(f));
  }

  async formById(user: AuthUser, id: string) {
    const f = await this.forms.findOneBy({ id });
    if (!f || (f.userId !== user.id && !isLoansReviewer(user))) return null;
    return this.formDto(f);
  }

  async setFormStatus(admin: AuthUser, id: string, status: string, note?: string) {
    const email = await this.emailOf(admin.id);
    await this.db.transaction(async (em) => {
      const f = await em.findOne(FormApplication, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!f) throw new NotFoundException('Application not found.');
      f.status = status;
      f.statusHistory = [...f.statusHistory, { status, timestamp: new Date().toISOString(), note: note || `Status updated to ${status}`, updatedBy: admin.id }];
      f.adminNotes = note || f.adminNotes;
      await em.save(f);
      await this.audit(em, admin, email, 'APPLICATION_STATUS_UPDATED', `Application updated to ${status}.`, id, f.referenceNumber);
    });
  }

  async assignForm(actor: AuthUser, id: string, assigneeId: string | null) {
    const f = await this.forms.findOneBy({ id });
    if (!f) throw new NotFoundException('Application not found.');
    const who = await this.activity.assignee(actor, assigneeId, f.assignedToId);
    f.assignedToId = who?.id ?? null;
    f.assignedToName = who?.name ?? null;
    f.assignedAt = who ? new Date() : null;
    await this.forms.save(f);
    await this.activity.log(actor, {
      module: 'loans', action: who ? 'loan.form_assigned' : 'loan.form_released', entityType: 'loan_form', entityId: id, entityLabel: f.referenceNumber,
      summary: who ? `${f.referenceNumber}: assigned to ${who.name}` : `${f.referenceNumber}: released (no one assigned)`,
      metadata: { assigneeId: who?.id ?? null },
    });
    return this.formDto(f);
  }

  async setFormDocStatus(admin: AuthUser, id: string, docId: string, status: string, rejectionReason?: string) {
    const email = await this.emailOf(admin.id);
    await this.db.transaction(async (em) => {
      const f = await em.findOne(FormApplication, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!f) throw new NotFoundException('Application not found.');
      f.documents = f.documents.map((d) =>
        d.id === docId ? { ...d, status, rejectionReason: rejectionReason ?? '', verifiedAt: status === 'verified' ? new Date().toISOString() : '' } : d,
      );
      await em.save(f);
      await this.audit(em, admin, email, 'APPLICATION_DOCUMENTS_UPDATED', `Document ${docId} marked ${status}.`, id, f.referenceNumber);
    });
  }

  // ───────────────────────── support, customers, audit ─────────────────────────

  private ticketDto(t: LoanSupportTicket) {
    return {
      id: t.id, userId: t.userId, userName: t.userName ?? '', userMobile: t.userMobile ?? '', subject: t.subject, message: t.message,
      category: t.category, status: t.status, reply: t.reply ?? undefined, createdAt: iso(t.createdAt)!,
    };
  }

  async myTickets(userId: string) {
    return (await this.tickets.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 })).map((t) => this.ticketDto(t));
  }

  async createTicket(userId: string, input: { subject: string; message: string; category?: string; userName?: string; userMobile?: string }) {
    const t = await this.tickets.save(this.tickets.create({
      userId, subject: input.subject.trim(), message: input.message.trim(), category: input.category || 'general',
      userName: input.userName ?? null, userMobile: input.userMobile ?? null,
    }));
    return this.ticketDto(t);
  }

  async adminCustomers(limit = 100) {
    const users = await this.users.createQueryBuilder('u').where('u.roles LIKE :r', { r: `%${Role.Customer}%` }).orderBy('u.created_at', 'DESC').take(limit).getMany();
    const rows = await this.details.find({ where: { userId: In(users.map((u) => u.id)) } });
    const byId = new Map(rows.map((r) => [r.userId, r.data]));
    return users.map((u) => {
      const d = byId.get(u.id) ?? {};
      return {
        uid: u.id, displayName: (d.fullName as string) || u.fullName || undefined, mobileNumber: u.mobile ?? '',
        isMobileVerified: Boolean(u.mobile), email: u.email ?? undefined, role: 'customer' as const,
        createdAt: iso(u.createdAt)!, updatedAt: iso(u.updatedAt)!,
      };
    });
  }

  async auditLogs(limit = 100) {
    return (await this.audits.find({ order: { createdAt: 'DESC' }, take: limit })).map((l) => ({
      id: l.id, adminId: l.actorId, adminEmail: l.actorEmail ?? undefined, action: l.action, applicationId: l.applicationId ?? undefined,
      referenceNumber: l.referenceNumber ?? undefined, details: l.details, timestamp: iso(l.createdAt)!,
    }));
  }

  // ───────────────────────── helpers ─────────────────────────

  private async emailOf(userId: string) {
    return (await this.users.findOneBy({ id: userId }))?.email ?? null;
  }

  private audit(em: EntityManager, actor: AuthUser, email: string | null, action: string, details: string, applicationId: string, referenceNumber: string | null, role: 'admin' | 'customer' = 'admin') {
    const kind: Record<string, [string, string]> = {
      QUOTE_APPLICATION_STATUS_UPDATED: ['loan.status_changed', 'loan_journey'],
      QUOTE_DOCUMENT_REVIEWED: ['loan.document_reviewed', 'loan_journey'],
      APPLICATION_SUBMITTED: ['loan.form_submitted', 'loan_form'],
      APPLICATION_STATUS_UPDATED: ['loan.form_status_changed', 'loan_form'],
      APPLICATION_DOCUMENTS_UPDATED: ['loan.form_document_reviewed', 'loan_form'],
    };
    const [activityAction, entityType] = kind[action] ?? [`loan.${action.toLowerCase()}`, 'loan'];
    return Promise.all([
      em.save(em.create(LoansAuditLog, { actorId: actor.id, actorEmail: email, actorRole: role, action, details, applicationId, referenceNumber })),
      em.save(em.create(ActivityLog, {
        actorId: actor.id, actorName: actor.name, actorRole: role === 'customer' ? 'Customer' : roleLabel(actor.roles),
        module: 'loans', action: activityAction, entityType, entityId: applicationId, entityLabel: referenceNumber,
        summary: `${referenceNumber ?? 'Loan application'}: ${details}`, metadata: { details },
      })),
    ]);
  }

  /** Deletes a stored file once no document row refers to it any more. */
  async removeIfOrphan(storageKey: string) {
    if (!(await this.isReferenced(storageKey))) await this.files.remove(storageKey);
  }

  async isReferenced(storageKey: string) {
    if ((await this.docs.count({ where: { storageKey } })) > 0) return true;
    // also files attached to a submitted full form
    const rows = await this.forms.createQueryBuilder('f').where('f.documents::text LIKE :k', { k: `%${storageKey}%` }).getCount();
    return rows > 0;
  }
}
