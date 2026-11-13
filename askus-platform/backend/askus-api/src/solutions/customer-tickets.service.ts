import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../identity/identity.entities';
import { CounterService } from './counter.service';
import { SolutionsCustomer, Ticket } from './solutions.entities';
import { logEntry } from './tickets.service';

@Injectable()
export class CustomerTicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(SolutionsCustomer) private readonly customers: Repository<SolutionsCustomer>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly counter: CounterService,
  ) {}

  private format(t: Ticket) {
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      ticketType: t.ticketType,
      supportTicketData: t.supportTicketData,
      activityLog: t.activityLog ?? [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  // Maps the shared identity user to a Solutions customer, linking an existing walk-in record when possible.
  private async resolveCustomer(userId: string): Promise<SolutionsCustomer> {
    const linked = await this.customers.findOne({ where: { userId } });
    if (linked) return linked;

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Customer not found');

    const existing =
      (user.mobile && (await this.customers.findOne({ where: { mobile: user.mobile, userId: IsNull() } }))) ||
      (user.email && (await this.customers.findOne({ where: { email: user.email } }))) ||
      null;
    if (existing && !existing.userId) {
      existing.userId = userId;
      return this.customers.save(existing);
    }
    return this.customers.save(
      this.customers.create({
        userId,
        name: user.fullName ?? user.email ?? user.mobile ?? 'Customer',
        mobile: user.mobile ?? '',
        email: existing ? null : user.email,
      }),
    );
  }

  async findAll(userId: string) {
    const customer = await this.resolveCustomer(userId);
    const rows = await this.tickets.find({ where: { customerId: customer.id }, order: { createdAt: 'DESC' } });
    return rows.map((t) => this.format(t));
  }

  async findOne(id: string, userId: string) {
    const customer = await this.resolveCustomer(userId);
    const ticket = await this.tickets.findOne({ where: { id, customerId: customer.id } });
    if (!ticket) throw new NotFoundException('Not found');
    return this.format(ticket);
  }

  async create(userId: string, body: { title: string; ticketType?: string; priority?: string; description?: string }) {
    if (!body.title) throw new BadRequestException('Title is required');
    const customer = await this.resolveCustomer(userId);
    const saved = await this.tickets.save(
      this.tickets.create({
        ticketNumber: await this.counter.nextTicketNumber(),
        title: body.title,
        ticketType: (body.ticketType as Ticket['ticketType']) || 'Support',
        priority: (body.priority as Ticket['priority']) || 'Medium',
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        raisedByCustomer: true,
        supportTicketData: body.description ? { description: body.description } : null,
        activityLog: [logEntry('raised this ticket', customer.name)],
      }),
    );
    return this.format(saved);
  }

  async addComment(id: string, userId: string, note: string) {
    const customer = await this.resolveCustomer(userId);
    const ticket = await this.tickets.findOne({ where: { id, customerId: customer.id } });
    if (!ticket) throw new NotFoundException('Not found');
    ticket.activityLog = [...(ticket.activityLog ?? []), logEntry('added a reply', customer.name, note)];
    await this.tickets.save(ticket);
    return { message: 'Reply added' };
  }
}
