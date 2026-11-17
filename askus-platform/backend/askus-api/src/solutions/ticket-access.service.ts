import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../common/access';
import { Role } from '../common/roles';
import { Team, TeamMember } from './calendar.entities';
import { Ticket, TicketType } from './solutions.entities';

/** Which ticket categories belong to which venture/team. An Admin works the categories of the teams they are in. */
export const TEAM_CATEGORIES: Record<Team, TicketType[]> = {
  'AskUs Taxi': ['O2Taxi'],
  'Alphaa Insurance': ['Insurance', 'Payment'],
  'Alphaa Loans': [],
  'Organic Port': [],
  'Software team': ['Support'],
};

/** Not tied to a single venture, so every Admin handles them. */
export const SHARED_CATEGORIES: TicketType[] = ['General', 'DailyActivity', 'Office', 'Other'];

export const isSuperAdmin = (u: AuthUser) => u.roles.includes(Role.SuperAdmin);
export const isAdminOrSuper = (u: AuthUser) => isSuperAdmin(u) || u.roles.includes(Role.Admin);

export interface TicketScope {
  /** Super Admin: every ticket. */
  all: boolean;
  userId: string;
  /** Admin: the categories they may work on (their teams' plus the shared ones). Empty for Employee/Agent. */
  categories: TicketType[];
}

/**
 * The one place that decides who may see or change a ticket (so a guessed ticket id gives nothing):
 *  - Employee / Agent: tickets they created or are assigned to
 *  - Admin: those, plus every ticket in their teams' categories
 *  - Super Admin: everything
 */
@Injectable()
export class TicketAccessService {
  constructor(@InjectRepository(TeamMember) private readonly members: Repository<TeamMember>) {}

  async scopeFor(user: AuthUser): Promise<TicketScope> {
    if (isSuperAdmin(user)) return { all: true, userId: user.id, categories: [] };
    if (!isAdminOrSuper(user)) return { all: false, userId: user.id, categories: [] };
    const teams = (await this.members.find({ where: { userId: user.id } })).map((m) => m.team);
    const cats = new Set<TicketType>(SHARED_CATEGORIES);
    for (const t of teams) for (const c of TEAM_CATEGORIES[t] ?? []) cats.add(c);
    return { all: false, userId: user.id, categories: [...cats] };
  }

  /** Narrows a ticket query to what this person may see. `alias` is the ticket alias in the query. */
  restrict<T extends object>(qb: SelectQueryBuilder<T>, alias: string, scope: TicketScope): SelectQueryBuilder<T> {
    if (scope.all) return qb;
    return qb.andWhere(new Brackets((w) => {
      w.where(`${alias}.createdById = :scopeUser`, { scopeUser: scope.userId })
        .orWhere(`${alias}.assignedToId = :scopeUserText`, { scopeUserText: scope.userId });
      if (scope.categories.length) w.orWhere(`${alias}.ticketType IN (:...scopeCats)`, { scopeCats: scope.categories });
    }));
  }

  canAccess(t: Pick<Ticket, 'createdById' | 'assignedToId' | 'ticketType'>, scope: TicketScope): boolean {
    return scope.all || t.createdById === scope.userId || t.assignedToId === scope.userId || scope.categories.includes(t.ticketType);
  }
}
