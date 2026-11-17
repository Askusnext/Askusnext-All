import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../common/access';
import { CounterService } from './counter.service';
import { Priority, Ticket, TicketType } from './solutions.entities';
import { TicketAccessService } from './ticket-access.service';
import { TicketHistory } from './ticketing.entities';

const DAY_MS = 86_400_000;
const istDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const plusDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** The API's category names for the ticket types. */
export const CATEGORY_KEY: Record<TicketType, string> = {
  Insurance: 'insurance', O2Taxi: 'taxi', General: 'general', DailyActivity: 'daily_activity', Support: 'support',
  Payment: 'payment', Office: 'office', Other: 'other',
};
const CATEGORIES = Object.keys(CATEGORY_KEY) as TicketType[];
const OPEN_STATES = ['Open', 'InProgress', 'AwaitingResponse', 'Reopened'];

/** Renewals open this many days before a policy expires (override with RENEWAL_WINDOW_DAYS). */
const windowDays = () => Math.min(120, Math.max(1, parseInt(process.env.RENEWAL_WINDOW_DAYS ?? '30', 10) || 30));

/**
 * A policy that still needs attention: an insurance ticket with an expiry date that nobody has renewed yet (no other
 * ticket for the same vehicle carries a later expiry). A renewal ticket starts out with a copy of the old policy, so it
 * only counts as a policy of its own once staff have entered the new expiry date. Counters, the Renewals list and the
 * auto-renewal job all use this one definition, so they always agree.
 */
const LIVE_POLICY = `t.policy IS NOT NULL
  AND (t.renewal_of_id IS NULL OR (t.policy ->> 'expiryDate') <> t.renewal_for)
  AND COALESCE(t.policy ->> 'expiryDate', '') <> '' AND COALESCE(t.policy ->> 'insuranceStatus', '') <> 'Cancelled'
  AND NOT EXISTS (SELECT 1 FROM solutions.tickets t2 WHERE t2.deleted_at IS NULL AND t2.id <> t.id AND t2.vehicle_reg_no = t.vehicle_reg_no
                  AND t2.vehicle_reg_no IS NOT NULL AND COALESCE(t2.policy ->> 'expiryDate', '') > (t.policy ->> 'expiryDate'))`;

@Injectable()
export class TicketReportsService implements OnModuleInit {
  private readonly logger = new Logger('Renewals');

  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    private readonly access: TicketAccessService,
    private readonly counter: CounterService,
  ) {}

  onModuleInit() {
    const run = () => this.generateRenewals().then((r) => r.created && this.logger.log(`Opened ${r.created} renewal ticket(s)`)).catch((e) => this.logger.warn(`Renewal pass failed: ${(e as Error).message}`));
    setTimeout(run, 120_000).unref();
    setInterval(run, 6 * 60 * 60_000).unref();
  }

  private async visible(user: AuthUser): Promise<SelectQueryBuilder<Ticket>> {
    return this.access.restrict(this.tickets.createQueryBuilder('t'), 't', await this.access.scopeFor(user));
  }

  // ───────────────────────── dashboard counters ─────────────────────────

  /**
   * Per category: queue (open or reopened and not yet picked up), open (anything still in progress),
   * and, for insurance, policies expiring within 30 days and already expired.
   */
  async counters(user: AuthUser) {
    const today = istDay();
    const in30 = plusDays(today, 30);
    const base = () => this.visible(user);
    const [queue, open, expiring, expired] = await Promise.all([
      (await base()).select('t.ticketType', 'type').addSelect('COUNT(*)', 'n').where(`t.status IN ('Open','Reopened') AND t.assignedToId IS NULL`).groupBy('t.ticketType').getRawMany<{ type: TicketType; n: string }>(),
      (await base()).select('t.ticketType', 'type').addSelect('COUNT(*)', 'n').where('t.status IN (:...open)', { open: OPEN_STATES }).groupBy('t.ticketType').getRawMany<{ type: TicketType; n: string }>(),
      (await base()).where(LIVE_POLICY).andWhere(`t.ticketType = 'Insurance' AND t.policy ->> 'expiryDate' >= :today AND t.policy ->> 'expiryDate' <= :in30`, { today, in30 }).getCount(),
      (await base()).where(LIVE_POLICY).andWhere(`t.ticketType = 'Insurance' AND t.policy ->> 'expiryDate' < :today`, { today }).getCount(),
    ]);
    const n = (rows: { type: TicketType; n: string }[], c: TicketType) => Number(rows.find((r) => r.type === c)?.n ?? 0);
    const categories = CATEGORIES.map((c) => ({
      category: CATEGORY_KEY[c], ticketType: c, queue: n(queue, c), open: n(open, c),
      expiring: c === 'Insurance' ? expiring : 0, expired: c === 'Insurance' ? expired : 0,
    }));
    const sum = (k: 'queue' | 'open' | 'expiring' | 'expired') => categories.reduce((a, c) => a + c[k], 0);
    return { asOf: today, categories, totals: { queue: sum('queue'), open: sum('open'), expiring: sum('expiring'), expired: sum('expired') } };
  }

  // ───────────────────────── analytics ─────────────────────────

  async ticketVolume(user: AuthUser, monthsBack: number) {
    const months = Math.min(24, Math.max(1, monthsBack || 6));
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const [vol, res] = await Promise.all([
      (await this.visible(user)).select(`to_char(t.createdAt AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`, 'm').addSelect('t.ticketType', 'type').addSelect('COUNT(*)', 'n')
        .where('t.createdAt >= :from', { from }).groupBy('m').addGroupBy('t.ticketType').getRawMany<{ m: string; type: TicketType; n: string }>(),
      (await this.visible(user)).select('t.ticketType', 'type').addSelect('COUNT(*)', 'n')
        .addSelect('AVG(EXTRACT(EPOCH FROM (t.resolvedAt - t.createdAt)) / 3600)', 'hours')
        .where('t.resolvedAt IS NOT NULL AND t.createdAt >= :from', { from }).groupBy('t.ticketType').getRawMany<{ type: TicketType; n: string; hours: string }>(),
    ]);
    const keys = Array.from({ length: months }, (_, i) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
    const label = (k: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(new Date(`${k}-01T00:00:00Z`));
    const byCategory = new Map<string, number>();
    const rows = keys.map((k) => {
      const mine = vol.filter((v) => v.m === k);
      for (const v of mine) byCategory.set(CATEGORY_KEY[v.type], (byCategory.get(CATEGORY_KEY[v.type]) ?? 0) + Number(v.n));
      return { month: k, label: label(k), total: mine.reduce((a, v) => a + Number(v.n), 0), byCategory: Object.fromEntries(mine.map((v) => [CATEGORY_KEY[v.type], Number(v.n)])) };
    });
    const resolvedCount = res.reduce((a, r) => a + Number(r.n), 0);
    const avgHours = resolvedCount ? res.reduce((a, r) => a + Number(r.hours) * Number(r.n), 0) / resolvedCount : null;
    return {
      months: rows,
      categoryBreakdown: [...byCategory].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      resolution: {
        resolvedCount, avgHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
        byCategory: res.map((r) => ({ category: CATEGORY_KEY[r.type], resolvedCount: Number(r.n), avgHours: Math.round(Number(r.hours) * 10) / 10 })),
      },
    };
  }

  // ───────────────────────── renewals ─────────────────────────

  /** Policies expiring within `days` (default 30) and those already expired, each with its renewal ticket if one exists. */
  async upcomingRenewals(user: AuthUser, days = 30) {
    const today = istDay();
    const until = plusDays(today, Math.min(365, Math.max(1, days)));
    const rows = await (await this.visible(user))
      .where(LIVE_POLICY).andWhere(`t.ticketType = 'Insurance' AND t.policy ->> 'expiryDate' <= :until`, { until })
      .orderBy(`t.policy ->> 'expiryDate'`, 'ASC').limit(300).getMany();
    const reg = rows.map((r) => r.vehicleRegNo).filter((x): x is string => !!x);
    const renewals = reg.length ? await this.tickets.createQueryBuilder('r').where('r.renewalOfId IS NOT NULL AND r.vehicleRegNo IN (:...reg)', { reg }).getMany() : [];
    const out = rows.map((t) => {
      const expiry = t.policy!.expiryDate;
      const daysLeft = Math.round((new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
      const renewal = renewals.find((r) => r.vehicleRegNo === t.vehicleRegNo && r.renewalFor === expiry);
      return {
        ticketId: t.id, ticketNumber: t.ticketNumber, customerName: t.customerName, customerMobile: t.customerMobile,
        vehicleRegNo: t.vehicleRegNo, insurer: t.policy!.insurer, expiryDate: expiry, daysLeft, state: daysLeft < 0 ? 'expired' as const : 'expiring' as const,
        renewalTicket: renewal ? { id: renewal.id, ticketNumber: renewal.ticketNumber, status: renewal.status } : null,
      };
    });
    return { asOf: today, windowDays: days, expiring: out.filter((r) => r.state === 'expiring'), expired: out.filter((r) => r.state === 'expired') };
  }

  /**
   * Opens a renewal ticket for every finished policy that is inside the renewal window and has none yet.
   * One per vehicle per expiry date, so running it again (or from several servers) does not duplicate.
   */
  async generateRenewals(): Promise<{ created: number; tickets: string[] }> {
    const today = istDay();
    const limit = plusDays(today, windowDays());
    const due = await this.tickets.createQueryBuilder('t')
      .where(LIVE_POLICY).andWhere(`t.ticketType = 'Insurance' AND t.status IN ('Resolved','Closed') AND t.vehicleRegNo IS NOT NULL AND t.policy ->> 'expiryDate' <= :limit`, { limit })
      .andWhere(`NOT EXISTS (SELECT 1 FROM solutions.tickets r WHERE r.deleted_at IS NULL AND r.renewal_for = (t.policy ->> 'expiryDate') AND r.vehicle_reg_no = t.vehicle_reg_no AND r.renewal_of_id IS NOT NULL)`)
      .orderBy(`t.policy ->> 'expiryDate'`, 'ASC').limit(200).getMany();

    const made: string[] = [];
    for (const src of due) {
      const expiry = src.policy!.expiryDate;
      const left = Math.round((new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
      const priority: Priority = left <= 7 ? 'Critical' : left <= 15 ? 'High' : 'Medium';
      const ticketNumber = await this.counter.nextTicketNumber();
      await this.tickets.manager.transaction(async (m) => {
        const saved = await m.getRepository(Ticket).save(m.getRepository(Ticket).create({
          ticketNumber, title: `Renewal due: ${src.vehicleRegNo} (${src.policy!.insurer || 'policy'}) ${left < 0 ? `expired ${expiry}` : `expires ${expiry}`}`,
          status: 'Open', priority, ticketType: 'Insurance', dueDate: new Date(`${expiry}T00:00:00+05:30`),
          customerId: src.customerId, customerName: src.customerName, customerMobile: src.customerMobile,
          vehicleId: src.vehicleId, vehicleRegNo: src.vehicleRegNo, vehicleName: src.vehicleName,
          policy: { ...src.policy! }, createdById: null, renewalOfId: src.id, renewalFor: expiry,
        }));
        await m.getRepository(TicketHistory).save(m.getRepository(TicketHistory).create({
          ticketId: saved.id, changedById: null, changedByName: 'System (renewals)', fieldChanged: 'created', oldValue: null, newValue: `${ticketNumber} — renewal of ${src.ticketNumber}`,
        }));
      });
      made.push(ticketNumber);
    }
    return { created: made.length, tickets: made };
  }
}
