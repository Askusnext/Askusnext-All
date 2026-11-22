import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../common/roles';
import { Access, Field, RESOURCE_BY_KEY, Resource, SETTINGS } from './registry';

/** The caller as the business API sees it. `id` is null for the seeder. */
export interface Actor { id: string | null; roles: string[]; permissions: string[] }

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const STAFF_ROLES = [Role.SuperAdmin, Role.Admin, Role.Employee, Role.Agent, Role.InsuranceAdmin, Role.LoansAdmin, Role.TaxiAdmin, Role.OrganicAdmin] as string[];

export const isAdmin = (a: Actor) => a.roles.includes(Role.SuperAdmin) || a.roles.includes(Role.Admin);
export function allowed(a: Actor, access: Access) {
  if (!a.roles.some((r) => STAFF_ROLES.includes(r))) return false;
  if (access === 'staff') return true;
  if (isAdmin(a)) return true;
  return access === 'payments' && a.permissions.includes('payments');
}

/** Plain-English messages for the database CHECK rules people hit most. */
const RULES: Record<string, string> = {
  feedback_rating_check: 'Rating must be between 1 and 5.',
  leave_requests_check: 'The end date must be on or after the start date.',
  quotes_check: 'The quote cannot expire before it is dated.',
  projects_check: 'The due date must be on or after the start date.',
  employees_check: 'The exit date must be on or after the joining date.',
  invoices_check: 'The paid amount cannot be more than the invoice total.',
  cash_entries_check: 'An entry is either money in or money out, not both.',
  cash_entries_check1: 'Enter an amount for money in or money out.',
  time_logs_hours_check: 'Hours must be more than 0 and at most 16.',
  permission_requests_hours_check: 'A permission must be more than 0 and at most 8 hours.',
  bank_accounts_account_last4_check: 'Store only a masked account number such as XXXX1234.',
  bank_accounts_ifsc_check: 'Enter a valid IFSC code, e.g. SBIN0001234.',
  expense_claims_amount_check: 'The amount must be more than 0.',
  receipts_amount_check: 'The amount must be more than 0.',
  payments_amount_check: 'The amount must be more than 0.',
};

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

@Injectable()
export class BusinessService {
  constructor(private readonly db: DataSource) {}

  resource(key: string): Resource {
    const res = RESOURCE_BY_KEY.get(key);
    if (!res) throw new NotFoundException(`Unknown list "${key}"`);
    return res;
  }

  // ───────────────────────── Reads ─────────────────────────

  private select(res: Resource) {
    const joins: string[] = [];
    const cols = ['t.id AS "id"', `to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"`];
    res.fields.forEach((f, i) => {
      if (f.ref) {
        const a = `r${i}`;
        joins.push(`LEFT JOIN business.${f.ref.table} ${a} ON ${a}.id = t.${f.col}`);
        if (f.ref.orElse) {
          const b = `o${i}`;
          joins.push(`LEFT JOIN business.${f.ref.orElse.table} ${b} ON ${b}.id = t.${f.ref.orElse.col}`);
          cols.push(`COALESCE(${a}.${f.ref.label}, ${b}.${f.ref.orElse.label}) AS "${f.api}"`);
        } else cols.push(`${a}.${f.ref.label} AS "${f.api}"`);
        if (!f.readOnly) cols.push(`t.${f.col} AS "${f.api}Id"`);
      } else if (f.type === 'date') cols.push(`to_char(t.${f.col}, 'YYYY-MM-DD') AS "${f.api}"`);
      else if (f.type === 'time') cols.push(`to_char(t.${f.col}, 'HH24:MI') AS "${f.api}"`);
      else cols.push(`t.${f.col} AS "${f.api}"`);
    });
    const where = Object.keys(res.fixed ?? {}).map((c, i) => `t.${c} = $${i + 1}`);
    return {
      sql: `SELECT ${cols.join(', ')} FROM business.${res.table} t ${joins.join(' ')}`,
      where, params: Object.values(res.fixed ?? {}),
      order: res.order.split(',').map((p) => `t.${p.trim()}`).join(', '),
    };
  }

  private shape(res: Resource, row: Row, actor: Actor): Row {
    const out: Row = { id: row.id, createdAt: row.createdAt };
    const admin = isAdmin(actor);
    for (const f of res.fields) {
      if (f.sensitive && !admin) continue;
      let v = row[f.api];
      if (v !== null && v !== undefined && ['int', 'number', 'money'].includes(f.type ?? '')) v = Number(v);
      if (f.type === 'yesno') v = v ? 'Yes' : 'No';
      if (f.type === 'paid') v = v ? 'Paid' : 'Unpaid';
      if (f.ref?.nullLabel && (v === null || v === undefined)) v = f.ref.nullLabel;
      out[f.api] = v ?? '';
      if (f.ref && !f.readOnly) out[`${f.api}Id`] = row[`${f.api}Id`] ?? null;
    }
    return out;
  }

  async list(key: string, actor: Actor): Promise<Row[]> {
    if (key in SETTINGS) return this.readSettings(key, actor);
    const res = this.resource(key);
    if (!allowed(actor, res.read)) throw new ForbiddenException();
    const q = this.select(res);
    const rows: Row[] = await this.db.query(`${q.sql}${q.where.length ? ` WHERE ${q.where.join(' AND ')}` : ''} ORDER BY ${q.order}`, q.params);
    return rows.map((r) => this.shape(res, r, actor));
  }

  private async one(res: Resource, id: string, actor: Actor): Promise<Row> {
    const q = this.select(res);
    const where = [...q.where, `t.id = $${q.params.length + 1}`];
    const [row] = await this.db.query(`${q.sql} WHERE ${where.join(' AND ')}`, [...q.params, id]);
    if (!row) throw new NotFoundException('Record not found');
    return this.shape(res, row, actor);
  }

  // ───────────────────────── Writes ─────────────────────────

  /** Turn a label such as "Divya Ramesh" or "LD-42501" into the referenced row's id. */
  async resolve(f: Field, value: unknown, cache?: Map<string, string | null>): Promise<{ col: string; id: string | null }[]> {
    const ref = f.ref!;
    const label = String(value).trim();
    if (isEmpty(value) || (ref.nullLabel && label === ref.nullLabel)) {
      return [{ col: f.col, id: null }, ...(ref.orElse ? [{ col: ref.orElse.col, id: null }] : [])];
    }
    const lookup = async (table: string, col: string, alt: string[] = []): Promise<{ id: string }[]> => {
      const key = `${table}:${col}:${label.toLowerCase()}`;
      if (cache?.has(key)) { const id = cache.get(key); return id ? [{ id }] : []; }
      const match = [col, ...alt].map((c) => `lower(${c}::text) = lower($1)`).join(' OR ');
      // Enquiry company names repeat; link to the most recent one. Everything else must be unambiguous.
      const rows: { id: string }[] = await this.db.query(`SELECT id FROM business.${table} WHERE ${match} ORDER BY created_at DESC LIMIT 2`, [label]);
      if (rows.length > 1 && table !== 'leads') throw new BadRequestException(`"${label}" matches more than one ${table.replace(/_/g, ' ')}; choose it from the list instead.`);
      cache?.set(key, rows[0]?.id ?? null);
      return rows.slice(0, 1);
    };
    const [hit] = await lookup(ref.table, ref.label, ref.alt);
    if (hit) return [{ col: f.col, id: hit.id }, ...(ref.orElse ? [{ col: ref.orElse.col, id: null }] : [])];
    if (ref.orElse) {
      const [other] = await lookup(ref.orElse.table, ref.orElse.label);
      if (other) return [{ col: f.col, id: null }, { col: ref.orElse.col, id: other.id }];
    }
    throw new BadRequestException(`"${label}" was not found in ${ref.table.replace(/_/g, ' ')}.`);
  }

  private convert(f: Field, raw: unknown): unknown {
    if (isEmpty(raw)) return null;
    const bad = (why: string) => new BadRequestException(`${f.api}: ${why}`);
    switch (f.type) {
      case 'int': {
        const n = Number(raw);
        if (!Number.isInteger(n)) throw bad('must be a whole number');
        return n;
      }
      case 'number': case 'money': {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw bad('must be a number');
        if (f.type === 'money' && n < 0) throw bad('cannot be negative');
        return n;
      }
      case 'date': if (!DAY.test(String(raw))) throw bad('must be a date (YYYY-MM-DD)'); return String(raw);
      case 'time': if (!TIME.test(String(raw))) throw bad('must be a time (HH:MM)'); return String(raw);
      case 'yesno': if (raw === true || raw === 'Yes') return true; if (raw === false || raw === 'No') return false; throw bad('must be Yes or No');
      case 'paid': if (raw === 'Paid') return true; if (raw === 'Unpaid') return false; throw bad('must be Paid or Unpaid');
      default: {
        const s = String(raw).trim();
        if (f.max && s.length > f.max) throw bad(`must be at most ${f.max} characters`);
        if (f.values && !f.values.includes(s)) throw bad(`must be one of ${f.values.join(', ')}`);
        return s;
      }
    }
  }

  /** Validate a request body into column → value pairs (only registry columns ever reach SQL). */
  async toColumns(res: Resource, body: Row, creating: boolean, cache?: Map<string, string | null>) {
    const cols = new Map<string, unknown>();
    for (const f of res.fields) {
      if (f.readOnly) continue;
      const idKey = `${f.api}Id`;
      if (f.ref && idKey in body && !isEmpty(body[idKey])) {
        if (!UUID.test(String(body[idKey]))) throw new BadRequestException(`${idKey}: not a valid id`);
        cols.set(f.col, body[idKey]);
        if (f.ref.orElse) cols.set(f.ref.orElse.col, null);
      } else if (f.api in body) {
        if (f.ref) for (const { col, id } of await this.resolve(f, body[f.api], cache)) cols.set(col, id);
        else cols.set(f.col, this.convert(f, body[f.api]));
      }
      if (f.required && (creating ? isEmpty(cols.get(f.col)) && !(f.ref?.orElse && cols.get(f.ref.orElse.col)) : cols.has(f.col) && cols.get(f.col) === null && !(f.ref?.orElse && cols.get(f.ref.orElse.col)))) {
        throw new BadRequestException(`${f.api} is required`);
      }
    }
    // Never write a null into a NOT NULL column with a default; let the database default apply.
    if (creating) for (const [c, v] of cols) if (v === null && !res.fields.some((f) => f.col === c && f.ref)) cols.delete(c);
    return cols;
  }

  private async guardApproval(res: Resource, cols: Map<string, unknown>, actor: Actor, current: Row | null) {
    const a = res.approval;
    if (!a) return;
    const statusCol = res.fields.find((f) => f.api === a.field)!.col;
    const adminCols = (a.adminFields ?? []).map((api) => res.fields.find((f) => f.api === api)!.col);
    if (isAdmin(actor)) {
      const next = cols.get(statusCol);
      if (next !== undefined && next !== a.pending && (!current || current[a.field] !== next)) {
        cols.set('decided_by', actor.id);
        cols.set('decided_at', new Date().toISOString());
      }
      return;
    }
    if (!current) {
      cols.delete(statusCol);
      adminCols.forEach((c) => cols.delete(c));
      return;
    }
    const changesStatus = cols.has(statusCol) && cols.get(statusCol) !== current[a.field];
    const changesAdmin = adminCols.some((c) => cols.has(c) && String(cols.get(c) ?? '') !== String(current[res.fields.find((f) => f.col === c)!.api] ?? ''));
    if (changesStatus || changesAdmin) throw new ForbiddenException('Only an admin can approve or reject this.');
    if (current[a.field] !== a.pending) throw new ForbiddenException('This request has already been decided.');
  }

  private dbError(e: unknown): never {
    const err = e as { code?: string; constraint?: string; detail?: string };
    if (err.code === '23505') throw new ConflictException(`This already exists${err.detail ? `: ${err.detail.replace(/^Key \((.+)\)=\((.+)\).*$/, '$1 = $2')}` : ''}.`);
    if (err.code === '23503') throw new ConflictException('This record is linked to other records, so it cannot be removed or changed this way.');
    if (err.code === '23514') throw new BadRequestException(RULES[err.constraint ?? ''] ?? 'A value is outside what is allowed.');
    if (err.code === '22P02' || err.code === '22007' || err.code === '22008') throw new BadRequestException('A value has the wrong format.');
    throw e;
  }

  async create(key: string, body: Row, actor: Actor, cache?: Map<string, string | null>): Promise<Row> {
    if (key in SETTINGS) return this.writeSettings(key, body, actor);
    const res = this.resource(key);
    if (!allowed(actor, res.write)) throw new ForbiddenException();
    const cols = await this.toColumns(res, body, true, cache);
    await this.guardApproval(res, cols, actor, null);
    for (const [c, v] of Object.entries(res.fixed ?? {})) cols.set(c, v);
    if (typeof body.id === 'string' && UUID.test(body.id)) cols.set('id', body.id);
    cols.set('created_by', actor.id);

    const names = [...cols.keys()];
    const params = [...cols.values()];
    let sql = `INSERT INTO business.${res.table} (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})`;
    if (res.upsertOn) {
      const updates = names.filter((n) => !['id', 'created_by', ...res.upsertOn!].includes(n)).map((n) => `${n} = EXCLUDED.${n}`);
      sql += ` ON CONFLICT (${res.upsertOn.join(', ')}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`;
    }
    try {
      const [row] = await this.db.query(`${sql} RETURNING id`, params);
      return this.one(res, row.id, actor);
    } catch (e) { this.dbError(e); }
  }

  async update(key: string, id: string, body: Row, actor: Actor): Promise<Row> {
    if (key in SETTINGS) return this.writeSettings(key, body, actor);
    const res = this.resource(key);
    if (!allowed(actor, res.write)) throw new ForbiddenException();
    if (!UUID.test(id)) throw new BadRequestException('Not a valid id');
    const current = await this.one(res, id, { ...actor, roles: [Role.SuperAdmin] });
    const cols = await this.toColumns(res, body, false);
    await this.guardApproval(res, cols, actor, current);
    if (!cols.size) return this.one(res, id, actor);
    const names = [...cols.keys()];
    const fixed = Object.entries(res.fixed ?? {});
    const params = [...cols.values(), id, ...fixed.map(([, v]) => v)];
    const where = [`id = $${names.length + 1}`, ...fixed.map(([c], i) => `${c} = $${names.length + 2 + i}`)];
    try {
      const rows = await this.db.query(`UPDATE business.${res.table} SET ${names.map((n, i) => `${n} = $${i + 1}`).join(', ')} WHERE ${where.join(' AND ')} RETURNING id`, params);
      if (!rows[0]?.length && !rows.length) throw new NotFoundException('Record not found');
    } catch (e) { if (e instanceof NotFoundException) throw e; this.dbError(e); }
    return this.one(res, id, actor);
  }

  async remove(key: string, id: string, actor: Actor): Promise<void> {
    const res = this.resource(key);
    if (!allowed(actor, res.write)) throw new ForbiddenException();
    if (!UUID.test(id)) throw new BadRequestException('Not a valid id');
    if (res.approval && !isAdmin(actor)) {
      const current = await this.one(res, id, { ...actor, roles: [Role.SuperAdmin] });
      if (current[res.approval.field] !== res.approval.pending) throw new ForbiddenException('A decided request cannot be deleted.');
    }
    const fixed = Object.entries(res.fixed ?? {});
    try {
      await this.db.query(`DELETE FROM business.${res.table} WHERE id = $1${fixed.map(([c], i) => ` AND ${c} = $${i + 2}`).join('')}`, [id, ...fixed.map(([, v]) => v)]);
    } catch (e) { this.dbError(e); }
  }

  // ───────────────────────── Rules documents ─────────────────────────

  private async readSettings(key: string, actor: Actor): Promise<Row[]> {
    if (!allowed(actor, 'staff')) throw new ForbiddenException();
    const s = SETTINGS[key];
    const rows: { value: Row }[] = await this.db.query('SELECT value FROM business.settings WHERE key = $1', [s.key]);
    return rows.length ? [{ id: s.key, ...rows[0].value }] : [];
  }

  private async writeSettings(key: string, body: Row, actor: Actor): Promise<Row> {
    if (!allowed(actor, 'admin')) throw new ForbiddenException();
    const s = SETTINGS[key];
    const value: Row = {};
    for (const [name, type] of Object.entries(s.fields)) {
      if (!(name in body) || isEmpty(body[name])) continue;
      const v = body[name];
      if (type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${name} must be a positive number`);
        value[name] = n;
      } else if (type === 'time') {
        if (!TIME.test(String(v))) throw new BadRequestException(`${name} must be a time (HH:MM)`);
        value[name] = String(v);
      } else value[name] = String(v).slice(0, 40);
    }
    await this.db.query(
      `INSERT INTO business.settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = business.settings.value || EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [s.key, JSON.stringify(value), actor.id],
    );
    return (await this.readSettings(key, actor))[0];
  }
}
