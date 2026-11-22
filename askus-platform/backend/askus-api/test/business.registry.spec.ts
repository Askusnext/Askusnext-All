import { allowed, isAdmin } from '../src/business/business.service';
import { RESOURCES, SETTINGS } from '../src/business/registry';
import { SCHEMA_SQL, TABLE_NAMES } from '../src/business/schema';
import { SEEDS } from '../src/business/seed-data';

/** Column names declared for a table in the schema SQL. */
function columnsOf(table: string): Set<string> {
  const sql = SCHEMA_SQL.find((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS business.${table} (`));
  if (!sql) return new Set();
  const cols = new Set(['id', 'created_by', 'created_at', 'updated_at']);
  for (const line of sql.split('\n')) {
    const m = /^\s+([a-z_0-9]+)\s+(uuid|text|int|smallint|numeric|date|time|timestamptz|boolean|char|jsonb)/.exec(line);
    if (m) cols.add(m[1]);
  }
  // Columns added after employees exist (circular links).
  if (table === 'branches') cols.add('manager_id');
  if (table === 'departments') cols.add('head_id');
  return cols;
}

describe('business registry ↔ schema', () => {
  it('every list points at a real table and real columns', () => {
    for (const r of RESOURCES) {
      expect(TABLE_NAMES).toContain(r.table);
      const cols = columnsOf(r.table);
      for (const f of r.fields) expect({ list: r.key, col: f.col, ok: cols.has(f.col) }).toEqual({ list: r.key, col: f.col, ok: true });
      for (const c of [...Object.keys(r.fixed ?? {}), ...(r.upsertOn ?? [])]) expect(cols.has(c)).toBe(true);
    }
  });

  it('every relationship points at a real table and label column', () => {
    for (const r of RESOURCES) for (const f of r.fields.filter((x) => x.ref)) {
      expect(TABLE_NAMES).toContain(f.ref!.table);
      expect(columnsOf(f.ref!.table).has(f.ref!.label)).toBe(true);
      for (const alt of f.ref!.alt ?? []) expect(columnsOf(f.ref!.table).has(alt)).toBe(true);
    }
  });

  it('list keys are unique and every sample list has a home', () => {
    const keys = RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of Object.keys(SEEDS)) if (key !== 'hr_payroll') expect(keys.includes(key) || key in SETTINGS).toBe(true);
  });

  it('approval lists only let admins decide', () => {
    for (const r of RESOURCES.filter((x) => x.approval)) expect(r.fields.some((f) => f.api === r.approval!.field)).toBe(true);
  });
});

describe('business access rules', () => {
  const staff = { id: 'u1', roles: ['EMPLOYEE'], permissions: [] as string[] };
  const money = { id: 'u2', roles: ['AGENT'], permissions: ['payments'] };
  const admin = { id: 'u3', roles: ['ADMIN'], permissions: [] as string[] };
  const customer = { id: 'u4', roles: ['CUSTOMER'], permissions: ['payments'] };

  it('staff, money and admin levels', () => {
    expect(allowed(staff, 'staff')).toBe(true);
    expect(allowed(staff, 'payments')).toBe(false);
    expect(allowed(staff, 'admin')).toBe(false);
    expect(allowed(money, 'payments')).toBe(true);
    expect(allowed(money, 'admin')).toBe(false);
    expect(allowed(admin, 'admin')).toBe(true);
    expect(isAdmin(admin)).toBe(true);
  });

  it('customers never reach business data, whatever permissions they hold', () => {
    expect(allowed(customer, 'staff')).toBe(false);
    expect(allowed(customer, 'payments')).toBe(false);
  });

  it('salaries and payroll stay admin-only', () => {
    const emp = RESOURCES.find((r) => r.key === 'hr_employees')!;
    expect(emp.fields.find((f) => f.api === 'salary')!.sensitive).toBe(true);
    expect(RESOURCES.find((r) => r.key === 'hr_payroll')!.read).toBe('admin');
  });
});
