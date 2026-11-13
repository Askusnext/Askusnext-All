import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './solutions.entities';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().split('T')[0];

@Injectable()
export class DashboardService {
  constructor(@InjectRepository(Ticket) private readonly tickets: Repository<Ticket>) {}

  async getKPIs() {
    const now = new Date();
    const today = isoDate(now);
    const in30 = isoDate(new Date(now.getTime() + 30 * DAY_MS));

    const sumPayments = (statuses: string[]) =>
      this.tickets
        .createQueryBuilder('t')
        .select(`COALESCE(SUM((t.payment ->> 'amount')::numeric), 0)`, 'total')
        .where(`t.payment ->> 'paymentStatus' IN (:...statuses)`, { statuses })
        .getRawOne<{ total: string }>();

    const [total, open, expiring, expired, byType, paid, pending] = await Promise.all([
      this.tickets.count(),
      this.tickets.createQueryBuilder('t').where('t.status IN (:...s)', { s: ['Open', 'InProgress'] }).getCount(),
      this.tickets
        .createQueryBuilder('t')
        .where(`t.policy ->> 'expiryDate' >= :today AND t.policy ->> 'expiryDate' <= :in30`, { today, in30 })
        .getCount(),
      this.tickets.createQueryBuilder('t').where(`t.policy ->> 'insuranceStatus' = 'Expired'`).getCount(),
      this.tickets
        .createQueryBuilder('t')
        .select('t.ticketType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.ticketType')
        .getRawMany<{ type: string; count: string }>(),
      sumPayments(['Paid']),
      sumPayments(['Pending', 'Partial']),
    ]);

    const count = (type: string) => Number(byType.find((r) => r.type === type)?.count ?? 0);
    return {
      totalTickets: total,
      openTickets: open,
      expiringIn30Days: expiring,
      expiredPolicies: expired,
      premiumCollected: Number(paid?.total ?? 0),
      pendingPayments: Number(pending?.total ?? 0),
      insuranceTickets: count('Insurance'),
      o2TaxiTickets: count('O2Taxi'),
      generalTickets: count('General'),
      dailyActivityTickets: count('DailyActivity'),
      supportTickets: count('Support'),
      paymentTickets: count('Payment'),
      officeTickets: count('Office'),
      otherTickets: count('Other'),
    };
  }

  async getExpiryAlerts(days: number) {
    const cutoff = isoDate(new Date(Date.now() + days * DAY_MS));
    return this.tickets
      .createQueryBuilder('t')
      .where(`t.policy ->> 'expiryDate' <= :cutoff`, { cutoff })
      .orderBy(`t.policy ->> 'expiryDate'`, 'ASC')
      .limit(20)
      .getMany();
  }

  async getMonthly() {
    const from = new Date();
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);

    const rows = await this.tickets
      .createQueryBuilder('t')
      .select('EXTRACT(YEAR FROM t.createdAt)', 'year')
      .addSelect('EXTRACT(MONTH FROM t.createdAt)', 'month')
      .addSelect('COUNT(*)', 'tickets')
      .addSelect(`COALESCE(SUM((t.policy ->> 'totalPremium')::numeric), 0)`, 'premium')
      .where('t.createdAt >= :from', { from })
      .groupBy('year')
      .addGroupBy('month')
      .orderBy('year', 'ASC')
      .addOrderBy('month', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      month: MONTHS[Number(r.month) - 1],
      tickets: Number(r.tickets),
      premium: Number(r.premium),
    }));
  }
}
