import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './solutions.entities';
import { logEntry } from './tickets.service';

const CF_API_VERSION = '2023-08-01';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    private readonly config: ConfigService,
  ) {}

  private get cashfree() {
    const appId = this.config.get<string>('CASHFREE_APP_ID');
    const secret = this.config.get<string>('CASHFREE_SECRET_KEY');
    if (!appId || !secret) {
      throw new InternalServerErrorException('Cashfree not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.');
    }
    const env = (this.config.get<string>('CASHFREE_ENV') ?? 'sandbox').toLowerCase();
    return {
      env,
      base: env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': appId,
        'x-client-secret': secret,
        'x-api-version': CF_API_VERSION,
      },
    };
  }

  async createOrder(ticketId: string) {
    const cf = this.cashfree;
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const amount = Number(ticket.payment?.amount || 0);
    if (amount <= 0) throw new BadRequestException('Ticket payment amount must be greater than 0');
    if (ticket.payment?.paymentStatus === 'Paid') throw new BadRequestException('Ticket is already paid');

    const orderId = `TKT_${ticket.ticketNumber}_${Date.now()}`;
    const returnBase = this.config.get<string>('SOLUTIONS_WEB_URL') ?? 'http://localhost:3005';
    const res = await fetch(`${cf.base}/orders`, {
      method: 'POST',
      headers: cf.headers,
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: String(ticket.customerId),
          customer_name: ticket.customerName || 'Customer',
          customer_email: 'customer@askussolutions.in',
          customer_phone: (ticket.customerMobile || '').replace(/\D/g, '').slice(-10) || '9999999999',
        },
        order_meta: { return_url: `${returnBase}/tickets/${ticketId}?order_id={order_id}` },
        order_note: `Payment for ticket ${ticket.ticketNumber}`,
      }),
    });
    const data = (await res.json()) as { payment_session_id?: string; message?: string };
    if (!res.ok) throw new InternalServerErrorException(data?.message || 'Failed to create Cashfree order');

    ticket.payment = { ...ticket.payment, transactionId: orderId, paymentStatus: ticket.payment.paymentStatus || 'Pending' };
    await this.tickets.save(ticket);
    return { orderId, paymentSessionId: data.payment_session_id, env: cf.env, amount };
  }

  async verify(ticketId: string, orderId: string, by: string) {
    const cf = this.cashfree;
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // Only an order this ticket created may mark it paid.
    if (ticket.payment?.transactionId !== orderId) throw new BadRequestException('Order does not belong to this ticket');

    const res = await fetch(`${cf.base}/orders/${encodeURIComponent(orderId)}`, { headers: cf.headers });
    const data = (await res.json()) as { order_status?: string; message?: string };
    if (!res.ok) throw new InternalServerErrorException(data?.message || 'Failed to fetch order');

    if (data.order_status === 'PAID' && ticket.payment.paymentStatus !== 'Paid') {
      ticket.payment = {
        ...ticket.payment,
        paymentStatus: 'Paid',
        paymentMode: 'Cashfree',
        transactionId: orderId,
        paidAt: new Date().toISOString(),
      };
      ticket.activityLog = [
        ...(ticket.activityLog ?? []),
        logEntry(`recorded online payment of ₹${ticket.payment.amount}`, by),
      ];
      await this.tickets.save(ticket);
    }
    return { orderStatus: data.order_status, paymentStatus: ticket.payment.paymentStatus };
  }
}
