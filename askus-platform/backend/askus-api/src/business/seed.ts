import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../common/roles';
import { Actor, BusinessService } from './business.service';
import { TABLE_NAMES } from './schema';
import { INSURERS, SEEDS, SETTINGS_SEED } from './seed-data';

const SEEDER: Actor = { id: null, roles: [Role.SuperAdmin], permissions: [] };

/** Parents before children so every relationship resolves. */
const ORDER = [
  'crm_products', 'crm_sources', 'crm_statuses', 'crm_call_outcomes', 'hr_designations', 'hr_departments', 'branches',
  'hr_leave_types', 'hr_expense_categories', 'hr_asset_categories', 'hr_facility_titles', 'hr_cleaning_categories', 'hr_holidays',
  'hr_employees',
  'cst_customers', 'crm_leads', 'crm_lead_products', 'crm_tasks', 'crm_call_updates', 'crm_quotations', 'crm_day_closing',
  'crm_price_requests', 'crm_cst_allocation', 'crm_cst_day_closing', 'cst_renewals', 'cst_feedback', 'cst_escalations',
  'prod_projects', 'prod_tasks', 'prod_timelogs', 'prod_issuance', 'prod_endorsements',
  'hr_attendance', 'hr_leave_requests', 'hr_permission_requests', 'hr_outside_requests', 'hr_expenses', 'hr_jobs', 'hr_candidates',
  'hr_interviews', 'hr_announcements', 'hr_visitors', 'hr_cleaning_sheet', 'hr_facility', 'hr_assets', 'hr_petty_cash',
  'acc_receipts', 'acc_payments', 'acc_invoices', 'acc_commissions', 'acc_bank_accounts',
];

/** Branch managers and department heads point at staff, so they are linked after staff exist. */
const LATER: Record<string, string> = { branches: 'manager', hr_departments: 'head' };

export async function seedBusinessDemo(svc: BusinessService, db: DataSource): Promise<number> {
  const cache = new Map<string, string | null>();
  const later: { key: string; name: string; field: string; value: unknown }[] = [];
  let count = 0;
  try {
    for (const name of INSURERS) { await svc.create('insurers', { name }, SEEDER, cache); count++; }
    for (const key of ORDER) {
      for (const row of SEEDS[key]?.() ?? []) {
        const data: Record<string, unknown> = { ...row };
        const deferred = LATER[key];
        if (deferred && data[deferred]) { later.push({ key, name: String(data.name), field: deferred, value: data[deferred] }); delete data[deferred]; }
        await svc.create(key, data, SEEDER, cache);
        count++;
      }
    }
    for (const l of later) {
      const rows = await svc.list(l.key, SEEDER);
      const target = rows.find((r) => r.name === l.name);
      if (target) await svc.update(l.key, String(target.id), { [l.field]: l.value }, SEEDER);
    }
    for (const [key, value] of Object.entries(SETTINGS_SEED)) { await svc.create(key, value, SEEDER); count++; }
    return count;
  } catch (e) {
    // Leave the schema empty rather than half-filled, so the next start-up retries cleanly.
    new Logger('Business').error(`Sample data could not be loaded: ${(e as Error).message}`);
    await db.query(`TRUNCATE ${TABLE_NAMES.map((t) => `business.${t}`).join(', ')} CASCADE`);
    return 0;
  }
}
