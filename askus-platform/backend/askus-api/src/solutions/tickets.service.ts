import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CounterService } from './counter.service';
import { IActivityLog, SolutionsCustomer, SolutionsVehicle, Ticket, TicketStatus } from './solutions.entities';

// Fields a client may set; id, ticketNumber, documents, activityLog and timestamps are server-owned.
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

export const logEntry = (action: string, by: string, note?: string): IActivityLog => ({
  id: randomUUID(),
  action,
  note,
  performedByName: by || 'System',
  createdAt: new Date().toISOString(),
});

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(SolutionsCustomer) private readonly customers: Repository<SolutionsCustomer>,
    @InjectRepository(SolutionsVehicle) private readonly vehicles: Repository<SolutionsVehicle>,
    private readonly counter: CounterService,
  ) {}

  format(t: Ticket) {
    return { ...t, documents: t.documents ?? [], activityLog: t.activityLog ?? [] };
  }

  async findAll(query: {
    search?: string; status?: string; priority?: string; insurer?: string;
    ticketType?: string; page?: string; pageSize?: string;
  }) {
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));

    const qb = this.tickets.createQueryBuilder('t');
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.ticketType) qb.andWhere('t.ticketType = :ticketType', { ticketType: query.ticketType });
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

  async findOne(id: string) {
    return this.format(await this.findRaw(id));
  }

  async create(body: Record<string, any>, by: string) {
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

    const saved = await this.tickets.save(
      this.tickets.create({
        ...pickWritable(body),
        ticketNumber,
        customerId: customer.id,
        vehicleId: vehicle?.id ?? null,
        activityLog: [logEntry('created this ticket', by)],
      }),
    );
    return this.format(saved);
  }

  async update(id: string, body: Record<string, any>, by: string) {
    const ticket = await this.findRaw(id);
    const { status, ...rest } = pickWritable(body) as Record<string, any>;
    Object.assign(ticket, rest);

    if (status && status !== ticket.status) {
      ticket.status = status;
      ticket.activityLog = [...(ticket.activityLog ?? []), logEntry(`changed status to ${status}`, by, body.note)];
    }
    return this.format(await this.tickets.save(ticket));
  }

  async updateStatus(id: string, status: TicketStatus, note: string | undefined, by: string) {
    const ticket = await this.findRaw(id);
    ticket.status = status;
    ticket.activityLog = [...(ticket.activityLog ?? []), logEntry(`changed status to ${status}`, by, note)];
    await this.tickets.save(ticket);
    return { message: 'Status updated' };
  }

  async updatePayment(id: string, body: Record<string, any>, by: string) {
    const ticket = await this.findRaw(id);
    ticket.payment = { ...ticket.payment, ...body };
    ticket.activityLog = [...(ticket.activityLog ?? []), logEntry(`payment updated — ${body.paymentStatus}`, by)];
    await this.tickets.save(ticket);
    return { message: 'Payment updated' };
  }

  async addComment(id: string, note: string, by: string) {
    const ticket = await this.findRaw(id);
    ticket.activityLog = [...(ticket.activityLog ?? []), logEntry('added a comment', by, note)];
    await this.tickets.save(ticket);
    return { message: 'Comment added' };
  }

  async addDocument(id: string, file: Express.Multer.File, type: string, by: string) {
    const ticket = await this.findRaw(id);
    const docType = (['RC', 'Insurance'].includes(type) ? type : 'Other') as 'RC' | 'Insurance' | 'Other';
    const fileUrl = `/uploads/${file.filename}`;
    ticket.documents = [
      ...(ticket.documents ?? []),
      {
        id: randomUUID(),
        type: docType,
        fileName: file.originalname,
        fileUrl,
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      },
    ];
    ticket.activityLog = [...(ticket.activityLog ?? []), logEntry(`uploaded ${docType} copy`, by)];
    await this.tickets.save(ticket);
    return { message: 'Document uploaded', fileUrl };
  }

  async deleteDocument(id: string, docId: string) {
    const ticket = await this.findRaw(id);
    ticket.documents = (ticket.documents ?? []).filter((d) => d.id !== docId);
    await this.tickets.save(ticket);
    return { message: 'Document deleted' };
  }

  private async findRaw(id: string) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Not found');
    return ticket;
  }
}
