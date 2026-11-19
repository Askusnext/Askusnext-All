import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../common/access';
import { CounterService } from './counter.service';
import { IActivityLog, SolutionsCustomer, SolutionsVehicle, TICKET_STATUSES, Ticket, TicketStatus } from './solutions.entities';
import { TicketAccessService, isAdminOrSuper } from './ticket-access.service';
import { TicketComment, TicketHistory } from './ticketing.entities';

// Fields a client may set; id, ticketNumber, documents, history and timestamps are server-owned.
const WRITABLE_FIELDS = [
  'title', 'status', 'priority', 'ticketType', 'assignedToId', 'assignedToName', 'dueDate', 'internalNotes',
  'customerName', 'customerMobile', 'vehicleRegNo', 'vehicleName', 'policy', 'payment',
  'paymentTicketData', 'officeTicketData', 'otherTicketData', 'o2TaxiTicketData',
  'dailyActivityTicketData', 'supportTicketData', 'generalTicketData',
] as const;

function pickWritable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) if (body[key] !== undefined) out[key] = body[key];
  return out;
}

/** Stand-in policy for tickets that are not about insurance (General, Support, Daily Activity, ...). */
const EMPTY_POLICY = {
  insurer: '', policyType: 'Comprehensive' as const, netPremium: 0, gst: 0, totalPremium: 0, ncbPercent: 0,
  startDate: '', expiryDate: '', insuranceStatus: 'NewPolicy' as const,
};

/** Which status a ticket may move to from each status. Reopened is for a ticket closed or resolved in error. */
export const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  Open: ['InProgress', 'AwaitingResponse', 'Resolved', 'Closed'],
  InProgress: ['Open', 'AwaitingResponse', 'Resolved', 'Closed'],
  AwaitingResponse: ['InProgress', 'Resolved', 'Closed'],
  Resolved: ['InProgress', 'Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['InProgress', 'AwaitingResponse', 'Resolved', 'Closed'],
};

export const logEntry = (action: string, by: string, note?: string): IActivityLog => ({
  id: randomUUID(),
  action,
  note,
  performedByName: by || 'System',
  createdAt: new Date().toISOString(),
});

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 2000 ? `${s.slice(0, 1997)}...` : s;
};
const dateText = (v: unknown) => { const d = v ? new Date(v as string) : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null; };

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketHistory) private readonly history: Repository<TicketHistory>,
    @InjectRepository(TicketComment) private readonly comments: Repository<TicketComment>,
    @InjectRepository(SolutionsCustomer) private readonly customers: Repository<SolutionsCustomer>,
    @InjectRepository(SolutionsVehicle) private readonly vehicles: Repository<SolutionsVehicle>,
    private readonly counter: CounterService,
    private readonly access: TicketAccessService,
  ) {}

  format(t: Ticket) {
    // Only insurance tickets carry a policy. Everything else gets an empty one so no screen has to special-case null.
    return { ...t, policy: t.policy ?? EMPTY_POLICY, documents: t.documents ?? [], activityLog: t.activityLog ?? [] };
  }

  async findAll(user: AuthUser, query: {
    search?: string; status?: string; priority?: string; insurer?: string;
    ticketType?: string; assignedToId?: string; page?: string; pageSize?: string;
  }) {
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));

    const qb = this.tickets.createQueryBuilder('t');
    this.access.restrict(qb, 't', await this.access.scopeFor(user));
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.ticketType) qb.andWhere('t.ticketType = :ticketType', { ticketType: query.ticketType });
    if (query.assignedToId) qb.andWhere('t.assignedToId = :assignee', { assignee: query.assignedToId });
    if (query.insurer) qb.andWhere(`t.policy ->> 'insurer' = :insurer`, { insurer: query.insurer });
    if (query.search) {
      qb.andWhere(
        '(t.customerName ILIKE :search OR t.vehicleRegNo ILIKE :search OR t.ticketNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy('t.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data: data.map((t) => this.format(t)), total, page, pageSize };
  }

  /** Full detail: the ticket plus one chronological log built from the old log, the change history and the comments. */
  async findOne(id: string, user: AuthUser) {
    const { ticket } = await this.load(id, user);
    const [rows, notes] = await Promise.all([
      this.history.find({ where: { ticketId: id }, order: { changedAt: 'ASC' } }),
      this.comments.find({ where: { ticketId: id }, order: { createdAt: 'ASC' } }),
    ]);
    const timeline: IActivityLog[] = [
      ...(ticket.activityLog ?? []),
      ...rows.map((h) => ({ id: h.id, action: this.describe(h), performedByName: h.changedByName, createdAt: h.changedAt.toISOString() })),
      ...notes.map((c) => ({ id: c.id, action: 'added a comment', note: c.body, performedByName: c.userName, createdAt: c.createdAt.toISOString() })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { ...this.format(ticket), activityLog: timeline, history: rows, comments: notes };
  }

  private describe(h: TicketHistory) {
    const v = (x: string | null) => (x === null ? 'empty' : `"${x.length > 80 ? `${x.slice(0, 77)}...` : x}"`);
    switch (h.fieldChanged) {
      case 'created': return 'created this ticket';
      case 'deleted': return 'deleted this ticket';
      case 'status': return `changed status from ${h.oldValue ?? 'none'} to ${h.newValue}`;
      case 'assignedToName': return `reassigned from ${h.oldValue ?? 'nobody'} to ${h.newValue ?? 'nobody'}`;
      case 'document': return h.newValue ? `uploaded ${h.newValue}` : `removed ${h.oldValue}`;
      case 'payment': return `updated payment: ${h.newValue}`;
      default: return `changed ${h.fieldChanged} from ${v(h.oldValue)} to ${v(h.newValue)}`;
    }
  }

  async create(body: Record<string, any>, user: AuthUser) {
    const ticketNumber = await this.counter.nextTicketNumber();

    let customer = body.customerMobile
      ? await this.customers.findOne({ where: { mobile: body.customerMobile } })
      : null;
    if (!customer) {
      customer = await this.customers.save(
        this.customers.create({
          name: body.customerName || 'Unknown',
          mobile: body.customerMobile || '',
          email: body.customerEmail || null,
        }),
      );
    }

    const regNo = String(body.vehicleRegNo || '').toUpperCase();
    let vehicle = regNo ? await this.vehicles.findOne({ where: { registrationNo: regNo } }) : null;
    if (!vehicle && regNo) {
      const [make, ...rest] = String(body.vehicleName || 'Unknown').split(' ');
      vehicle = await this.vehicles.save(
        this.vehicles.create({
          registrationNo: regNo,
          make: make || 'Unknown',
          vehicleModel: rest.join(' ') || 'Unknown',
          year: body.vehicleYear || new Date().getFullYear(),
          fuelType: body.vehicleFuelType || 'Petrol',
          customerId: customer.id,
        }),
      );
    }

    const fields = pickWritable(body) as Record<string, any>;
    if (fields.status && !TICKET_STATUSES.includes(fields.status)) throw new BadRequestException('Unknown status');
    // Only an Admin may hand a ticket to someone else while creating it.
    if (!isAdminOrSuper(user)) { delete fields.assignedToId; delete fields.assignedToName; }

    return this.tickets.manager.transaction(async (m) => {
      const saved = await m.getRepository(Ticket).save(
        m.getRepository(Ticket).create({ ...fields, ticketNumber, customerId: customer!.id, vehicleId: vehicle?.id ?? null, createdById: user.id }),
      );
      await m.getRepository(TicketHistory).save(m.getRepository(TicketHistory).create({
        ticketId: saved.id, changedById: user.id, changedByName: user.name, fieldChanged: 'created', oldValue: null, newValue: ticketNumber,
      }));
      return this.format(saved);
    });
  }

  /**
   * The single path for every change to a ticket (edit, status move, reassignment, payment): the row is updated and a
   * ticket_history row is written for each field that really changed, in one transaction. Nothing changes silently.
   */
  async update(id: string, body: Record<string, any>, user: AuthUser) {
    const { ticket } = await this.load(id, user);
    const { note, ...rest } = body;
    const changes = pickWritable(rest) as Record<string, any>;
    return this.tickets.manager.transaction(async (m) => {
      await this.applyChanges(m, ticket, changes, user);
      if (typeof note === 'string' && note.trim() && 'status' in changes) await this.insertComment(m, ticket.id, note.trim(), user);
      return this.format(ticket);
    });
  }

  async updateStatus(id: string, status: TicketStatus, note: string | undefined, user: AuthUser) {
    await this.update(id, { status, note }, user);
    return { message: 'Status updated' };
  }

  async updatePayment(id: string, body: Record<string, any>, user: AuthUser) {
    const { ticket } = await this.load(id, user);
    await this.update(id, { payment: { ...ticket.payment, ...body } }, user);
    return { message: 'Payment updated' };
  }

  private async applyChanges(m: EntityManager, ticket: Ticket, changes: Record<string, any>, user: AuthUser) {
    const rows: Partial<TicketHistory>[] = [];
    const log = (field: string, oldV: unknown, newV: unknown) => rows.push({
      ticketId: ticket.id, changedById: user.id, changedByName: user.name, fieldChanged: field, oldValue: asText(oldV), newValue: asText(newV),
    });

    for (const [key, next] of Object.entries(changes)) {
      const prev = (ticket as unknown as Record<string, unknown>)[key];
      const same = key === 'dueDate' ? dateText(prev) === dateText(next) : asText(prev) === asText(next);
      if (same) continue;

      if (key === 'status') {
        if (!TICKET_STATUSES.includes(next)) throw new BadRequestException('Unknown status');
        if (!STATUS_FLOW[ticket.status]?.includes(next)) throw new BadRequestException(`A ${ticket.status} ticket cannot move to ${next}.`);
        ticket.status = next;
        const now = new Date();
        if (next === 'Resolved') ticket.resolvedAt = now;
        if (next === 'Closed') { ticket.closedAt = now; ticket.resolvedAt ??= now; }
        if (next === 'Reopened') { ticket.resolvedAt = null; ticket.closedAt = null; }
      } else if (key === 'assignedToId' || key === 'assignedToName') {
        if (!isAdminOrSuper(user)) throw new ForbiddenException('Only an admin can assign a ticket.');
        (ticket as unknown as Record<string, unknown>)[key] = next ?? null;
      } else if (key === 'ticketType' && !isAdminOrSuper(user)) {
        throw new ForbiddenException('Only an admin can change the category.');
      } else {
        (ticket as unknown as Record<string, unknown>)[key] = key === 'dueDate' ? (next ? new Date(next) : null) : next;
      }
      if (key === 'payment') {
        const p = next as { paymentStatus?: string; amount?: number };
        log('payment', null, `${p?.paymentStatus ?? 'updated'}${p?.amount ? ` — ₹${p.amount}` : ''}`);
      } else log(key, prev, next);
    }
    // A reassignment already reads clearly from the name; the raw id row would just be noise.
    if (rows.some((r) => r.fieldChanged === 'assignedToName')) rows.splice(0, rows.length, ...rows.filter((r) => r.fieldChanged !== 'assignedToId'));
    if (!rows.length) return;
    await m.getRepository(Ticket).save(ticket);
    await m.getRepository(TicketHistory).save(rows.map((r) => m.getRepository(TicketHistory).create(r)));
  }

  private async insertComment(m: EntityManager, ticketId: string, body: string, user: AuthUser) {
    return m.getRepository(TicketComment).save(m.getRepository(TicketComment).create({ ticketId, userId: user.id, userName: user.name, body }));
  }

  /** Comments are append-only: they can be added, never edited or removed. */
  async addComment(id: string, note: string, user: AuthUser) {
    await this.load(id, user);
    await this.insertComment(this.tickets.manager, id, note, user);
    return { message: 'Comment added' };
  }

  async addDocument(id: string, file: Express.Multer.File, type: string, user: AuthUser) {
    const { ticket } = await this.load(id, user);
    const docType = (['RC', 'Insurance'].includes(type) ? type : 'Other') as 'RC' | 'Insurance' | 'Other';
    const fileUrl = `/uploads/${file.filename}`;
    await this.tickets.manager.transaction(async (m) => {
      ticket.documents = [
        ...(ticket.documents ?? []),
        { id: randomUUID(), type: docType, fileName: file.originalname, fileUrl, fileSizeBytes: file.size, uploadedAt: new Date().toISOString() },
      ];
      await m.getRepository(Ticket).save(ticket);
      await m.getRepository(TicketHistory).save(m.getRepository(TicketHistory).create({
        ticketId: id, changedById: user.id, changedByName: user.name, fieldChanged: 'document', oldValue: null, newValue: `${docType} copy (${file.originalname})`,
      }));
    });
    return { message: 'Document uploaded', fileUrl };
  }

  async deleteDocument(id: string, docId: string, user: AuthUser) {
    const { ticket } = await this.load(id, user);
    const doc = (ticket.documents ?? []).find((d) => d.id === docId);
    if (!doc) throw new NotFoundException('Document not found');
    await this.tickets.manager.transaction(async (m) => {
      ticket.documents = ticket.documents.filter((d) => d.id !== docId);
      await m.getRepository(Ticket).save(ticket);
      await m.getRepository(TicketHistory).save(m.getRepository(TicketHistory).create({
        ticketId: id, changedById: user.id, changedByName: user.name, fieldChanged: 'document', oldValue: `${doc.type} copy (${doc.fileName})`, newValue: null,
      }));
    });
    return { message: 'Document deleted' };
  }

  /** Soft delete: the row stays (with deleted_at) so its history is never lost. Admins only. */
  async remove(id: string, user: AuthUser) {
    if (!isAdminOrSuper(user)) throw new ForbiddenException('Only an admin can delete a ticket.');
    const { ticket } = await this.load(id, user);
    await this.tickets.manager.transaction(async (m) => {
      await m.getRepository(TicketHistory).save(m.getRepository(TicketHistory).create({
        ticketId: id, changedById: user.id, changedByName: user.name, fieldChanged: 'deleted', oldValue: ticket.ticketNumber, newValue: null,
      }));
      await m.getRepository(Ticket).softRemove(ticket);
    });
    return { message: 'Ticket deleted' };
  }

  /** Loads a ticket this person may use. Anything else looks exactly like "not found", so ids cannot be probed. */
  private async load(id: string, user: AuthUser) {
    const ticket = await this.tickets.findOne({ where: { id } });
    const scope = await this.access.scopeFor(user);
    if (!ticket || !this.access.canAccess(ticket, scope)) throw new NotFoundException('Not found');
    return { ticket, scope };
  }
}
