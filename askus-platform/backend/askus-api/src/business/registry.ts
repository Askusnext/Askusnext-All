/**
 * One entry per screen collection. The API speaks the same field names as the web app; this registry maps
 * them to normalised columns and foreign keys.
 *
 * Relationship fields (`ref`) are returned twice: `field` = the readable label (e.g. the staff member's name)
 * and `fieldId` = the foreign-key id. On writes the client may send either `fieldId` (preferred) or the label,
 * which is resolved against the referenced table (and rejected if unknown or ambiguous).
 */
export type FieldType = 'text' | 'int' | 'number' | 'money' | 'date' | 'time' | 'yesno' | 'paid';
export type Access = 'staff' | 'admin' | 'payments';

export interface Ref {
  table: string;
  /** Column shown as the label and matched when a label is sent. */
  label: string;
  /** Other unique columns a label may match (e.g. a lead number). */
  alt?: string[];
  /** Label used for "no link" (stored as NULL), e.g. "All branches". */
  nullLabel?: string;
  /** Calls belong to either a lead or a customer. */
  orElse?: { col: string; table: string; label: string };
}

export interface Field {
  api: string;
  col: string;
  type?: FieldType;
  required?: boolean;
  max?: number;
  values?: readonly string[];
  ref?: Ref;
  /** Computed by the database or another field; never written by the API. */
  readOnly?: boolean;
  /** Hidden from non-admin staff. */
  sensitive?: boolean;
}

export interface Resource {
  key: string;
  table: string;
  fields: Field[];
  read: Access;
  write: Access;
  order: string;
  /** Row values every read and write is pinned to (one table shared by two screens). */
  fixed?: Record<string, string>;
  /** Approval workflow: only admins may move `field` off its pending value or change `adminFields`. */
  approval?: { field: string; pending: string; adminFields?: string[] };
  /** Unique columns used to update instead of insert (e.g. one attendance row per person per day). */
  upsertOn?: string[];
}

const DAY_STATUS = ['Present', 'Half Day', 'Absent', 'On Leave', 'Holiday'] as const;
const APPROVAL = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
const PRIORITY = ['High', 'Medium', 'Low'] as const;

const staffRef = (api: string, col: string, extra: Partial<Field> = {}): Field => ({ api, col, ref: { table: 'employees', label: 'name', alt: ['code'] }, ...extra });
const named = (api: string, col: string, table: string, extra: Partial<Field> = {}, ref: Partial<Ref> = {}): Field => ({ api, col, ref: { table, label: 'name', ...ref }, ...extra });
const lookupList = (key: string, table: string, extra: Field[] = []): Resource => ({
  key, table, read: 'staff', write: 'admin', order: 'name',
  fields: [{ api: 'name', col: 'name', required: true, max: 80 }, ...extra],
});

export const RESOURCES: Resource[] = [
  // ───────── Settings lists ─────────
  lookupList('branches', 'branches', [
    { api: 'code', col: 'code', max: 20 }, { api: 'city', col: 'city', max: 60 }, { api: 'phone', col: 'phone', max: 20 },
    staffRef('manager', 'manager_id'),
  ]),
  lookupList('hr_departments', 'departments', [staffRef('head', 'head_id'), { api: 'description', col: 'description', max: 300 }]),
  lookupList('hr_designations', 'designations'),
  lookupList('insurers', 'insurers'),
  lookupList('crm_products', 'products', [
    { api: 'category', col: 'category', values: ['Motor', 'Health', 'Life', 'Commercial', 'Other'] },
    { api: 'basePremium', col: 'base_premium', type: 'money' }, { api: 'commissionPct', col: 'commission_pct', type: 'number' },
    { api: 'active', col: 'active', type: 'yesno' },
  ]),
  lookupList('crm_sources', 'lead_sources', [{ api: 'active', col: 'active', type: 'yesno' }]),
  { ...lookupList('crm_statuses', 'lead_stages', [{ api: 'order', col: 'sort_order', type: 'int' }, { api: 'color', col: 'color', max: 20 }]), order: 'sort_order' },
  lookupList('crm_call_outcomes', 'call_outcomes'),
  lookupList('hr_leave_types', 'leave_types', [
    { api: 'code', col: 'code', max: 10 }, { api: 'annualQuota', col: 'annual_quota', type: 'number', required: true },
    { api: 'paid', col: 'is_paid', type: 'paid' }, { api: 'carryForward', col: 'carry_forward', type: 'yesno' },
    { api: 'maxConsecutive', col: 'max_consecutive', type: 'int' },
  ]),
  lookupList('hr_expense_categories', 'expense_categories', [{ api: 'monthlyLimit', col: 'monthly_limit', type: 'money' }]),
  lookupList('hr_asset_categories', 'asset_categories'),
  lookupList('hr_facility_titles', 'facility_types'),
  lookupList('hr_cleaning_categories', 'cleaning_tasks', [{ api: 'frequency', col: 'frequency', values: ['Daily', 'Weekly', 'Monthly'] }]),
  { key: 'hr_holidays', table: 'holidays', read: 'staff', write: 'admin', order: 'date', fields: [
    { api: 'name', col: 'name', required: true, max: 80 }, { api: 'date', col: 'date', type: 'date', required: true },
    { api: 'type', col: 'type', values: ['Public', 'Optional', 'Branch'] },
  ] },

  // ───────── Staff ─────────
  { key: 'hr_employees', table: 'employees', read: 'staff', write: 'admin', order: 'code', fields: [
    { api: 'code', col: 'code', required: true, max: 20 }, { api: 'name', col: 'name', required: true, max: 100 },
    named('designation', 'designation_id', 'designations'), named('department', 'department_id', 'departments'), named('branch', 'branch_id', 'branches'),
    { api: 'mobile', col: 'mobile', required: true, max: 20 }, { api: 'email', col: 'email', max: 120 },
    { api: 'joinDate', col: 'join_date', type: 'date', required: true }, { api: 'dob', col: 'dob', type: 'date', sensitive: true },
    { api: 'salary', col: 'salary', type: 'money', sensitive: true }, staffRef('reportingTo', 'reporting_to_id'),
    { api: 'type', col: 'type', values: ['Employee', 'Intern'] }, { api: 'status', col: 'status', values: ['Active', 'Resigned'] },
    { api: 'college', col: 'college', max: 120 }, { api: 'endDate', col: 'end_date', type: 'date' }, { api: 'exitDate', col: 'exit_date', type: 'date' },
  ] },
  { key: 'hr_attendance', table: 'attendance', read: 'staff', write: 'admin', order: 'date DESC', upsertOn: ['employee_id', 'date'], fields: [
    staffRef('employee', 'employee_id', { required: true }), { api: 'date', col: 'date', type: 'date', required: true },
    { api: 'status', col: 'status', values: DAY_STATUS, required: true }, { api: 'checkIn', col: 'check_in', type: 'time' }, { api: 'checkOut', col: 'check_out', type: 'time' },
    { api: 'lateMinutes', col: 'late_minutes', type: 'int' }, { api: 'location', col: 'location', max: 60 }, { api: 'source', col: 'source', max: 40 },
  ] },
  { key: 'hr_leave_requests', table: 'leave_requests', read: 'staff', write: 'staff', order: 'from_date DESC', approval: { field: 'status', pending: 'Pending' }, fields: [
    staffRef('employee', 'employee_id', { required: true }), named('leaveType', 'leave_type_id', 'leave_types', { required: true }),
    { api: 'fromDate', col: 'from_date', type: 'date', required: true }, { api: 'toDate', col: 'to_date', type: 'date', required: true },
    { api: 'reason', col: 'reason', required: true, max: 500 }, { api: 'appliedOn', col: 'applied_on', type: 'date' },
    { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'hr_permission_requests', table: 'permission_requests', read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending' }, fields: [
    staffRef('employee', 'employee_id', { required: true }), { api: 'date', col: 'date', type: 'date', required: true },
    { api: 'hours', col: 'hours', type: 'number', required: true }, { api: 'reason', col: 'reason', required: true, max: 300 },
    { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'hr_outside_requests', table: 'field_visits', read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending', adminFields: ['remarks'] }, fields: [
    staffRef('employee', 'employee_id', { required: true }), { api: 'type', col: 'type', values: ['Check-in', 'Check-out'], required: true },
    { api: 'date', col: 'date', type: 'date', required: true }, { api: 'time', col: 'time', type: 'time', required: true },
    { api: 'reason', col: 'reason', required: true, max: 300 }, { api: 'location', col: 'location', required: true, max: 200 },
    { api: 'remarks', col: 'remarks', max: 300 }, { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'hr_expenses', table: 'expense_claims', read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending', adminFields: ['stage', 'remarks'] }, fields: [
    staffRef('applicant', 'employee_id', { required: true }), named('category', 'category_id', 'expense_categories', { required: true }),
    { api: 'amount', col: 'amount', type: 'money', required: true }, { api: 'description', col: 'description', required: true, max: 500 },
    { api: 'receipt', col: 'receipt', values: ['Attached', 'Not available'] }, { api: 'stage', col: 'stage', type: 'int' },
    { api: 'date', col: 'date', type: 'date' }, { api: 'remarks', col: 'remarks', max: 300 }, { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'hr_payroll', table: 'payslips', read: 'admin', write: 'admin', order: 'month DESC', upsertOn: ['month', 'employee_id'], fields: [
    { api: 'month', col: 'month', required: true, max: 7 }, staffRef('employee', 'employee_id', { required: true }),
    { api: 'code', col: 'employee_id', ref: { table: 'employees', label: 'code' }, readOnly: true },
    { api: 'designation', col: 'designation', max: 80 }, { api: 'department', col: 'department', max: 80 }, { api: 'type', col: 'employee_type', max: 20 },
    ...['gross', 'perDay', 'lopDeduction', 'earned', 'pf', 'esi', 'pt', 'net'].map((api) => ({ api, col: api.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), type: 'money' as const })),
    { api: 'lopDays', col: 'lop_days', type: 'number' }, { api: 'payableDays', col: 'payable_days', type: 'number' },
    { api: 'status', col: 'status', values: ['Draft', 'Processed', 'Paid'] }, { api: 'processedOn', col: 'processed_on', type: 'date' }, { api: 'paidOn', col: 'paid_on', type: 'date' },
  ] },
  { key: 'hr_jobs', table: 'job_openings', read: 'admin', write: 'admin', order: 'posted_on DESC', fields: [
    { api: 'title', col: 'title', required: true, max: 100 }, named('department', 'department_id', 'departments'), named('branch', 'branch_id', 'branches'),
    { api: 'openings', col: 'openings', type: 'int' }, { api: 'experience', col: 'experience', max: 60 }, { api: 'postedOn', col: 'posted_on', type: 'date' },
    { api: 'status', col: 'status', values: ['Open', 'On Hold', 'Closed'] },
  ] },
  { key: 'hr_candidates', table: 'applicants', read: 'admin', write: 'admin', order: 'applied_on DESC', fields: [
    { api: 'name', col: 'name', required: true, max: 100 }, { api: 'position', col: 'job_id', ref: { table: 'job_openings', label: 'title' }, required: true },
    { api: 'mobile', col: 'mobile', required: true, max: 20 }, { api: 'source', col: 'source', max: 40 }, { api: 'expectedCtc', col: 'expected_ctc', type: 'money' },
    { api: 'appliedOn', col: 'applied_on', type: 'date' }, { api: 'stage', col: 'stage', values: ['Screening', 'Interview', 'Offered', 'Joined', 'Rejected'] },
  ] },
  { key: 'hr_interviews', table: 'interviews', read: 'admin', write: 'admin', order: 'date DESC', fields: [
    named('candidate', 'applicant_id', 'applicants', { required: true }), { api: 'position', col: 'job_id', ref: { table: 'job_openings', label: 'title' } },
    { api: 'date', col: 'date', type: 'date', required: true }, { api: 'time', col: 'time', type: 'time' }, staffRef('interviewer', 'interviewer_id', { required: true }),
    { api: 'round', col: 'round', values: ['Round 1', 'Round 2', 'HR Round'] }, { api: 'status', col: 'status', values: ['Scheduled', 'Selected', 'Rejected', 'No Show'] },
    { api: 'feedback', col: 'feedback', max: 1000 },
  ] },
  { key: 'hr_announcements', table: 'notices', read: 'staff', write: 'admin', order: 'publish_on DESC', fields: [
    { api: 'title', col: 'title', required: true, max: 120 }, { api: 'message', col: 'message', required: true, max: 2000 },
    named('branch', 'branch_id', 'branches', {}, { nullLabel: 'All branches' }), { api: 'publishOn', col: 'publish_on', type: 'date' },
    { api: 'status', col: 'status', values: ['Published', 'Draft'] },
  ] },
  { key: 'hr_visitors', table: 'visitors', read: 'admin', write: 'admin', order: 'date DESC', fields: [
    { api: 'name', col: 'name', required: true, max: 100 }, { api: 'type', col: 'type', values: ['Candidate', 'Customer', 'Partner', 'Delivery', 'Others'], required: true },
    { api: 'mobile', col: 'mobile', required: true, max: 20 }, staffRef('whomToMeet', 'host_id'), { api: 'purpose', col: 'purpose', max: 200 },
    { api: 'date', col: 'date', type: 'date' }, { api: 'inTime', col: 'in_time', type: 'time' }, { api: 'outTime', col: 'out_time', type: 'time' },
    { api: 'status', col: 'status', values: ['Checked In', 'Checked Out'] },
  ] },
  { key: 'hr_cleaning_sheet', table: 'cleaning_log', read: 'admin', write: 'admin', order: 'date DESC', fields: [
    { api: 'date', col: 'date', type: 'date' }, named('task', 'task_id', 'cleaning_tasks', { required: true }), { api: 'area', col: 'area', required: true, max: 80 },
    { api: 'doneBy', col: 'done_by', max: 80 }, { api: 'time', col: 'time', type: 'time' }, { api: 'status', col: 'status', values: ['Done', 'Pending'] },
  ] },
  { key: 'hr_facility', table: 'repairs', read: 'admin', write: 'admin', order: 'due_date DESC NULLS LAST', fields: [
    named('title', 'facility_type_id', 'facility_types', { required: true }), { api: 'description', col: 'description', required: true, max: 300 },
    { api: 'vendor', col: 'vendor', max: 100 }, { api: 'cost', col: 'cost', type: 'money' }, { api: 'dueDate', col: 'due_date', type: 'date' },
    named('branch', 'branch_id', 'branches'), { api: 'status', col: 'status', values: ['Pending', 'Scheduled', 'Completed'] },
  ] },
  { key: 'hr_assets', table: 'assets', read: 'admin', write: 'admin', order: 'tag', fields: [
    { api: 'tag', col: 'tag', required: true, max: 30 }, { api: 'name', col: 'name', required: true, max: 100 }, named('category', 'category_id', 'asset_categories'),
    { api: 'assignedTo', col: 'assigned_to_id', ref: { table: 'employees', label: 'name', alt: ['code'], nullLabel: 'Unassigned' } },
    named('branch', 'branch_id', 'branches'), { api: 'purchaseDate', col: 'purchase_date', type: 'date' }, { api: 'value', col: 'value', type: 'money' },
    { api: 'status', col: 'status', values: ['In Use', 'In Stock', 'Repair', 'Disposed'] },
  ] },

  // ───────── Sales ─────────
  { key: 'crm_leads', table: 'leads', read: 'staff', write: 'staff', order: 'lead_date DESC, lead_no DESC', fields: [
    { api: 'leadNo', col: 'lead_no', required: true, max: 20 }, { api: 'company', col: 'company', required: true, max: 120 },
    { api: 'contact', col: 'contact', required: true, max: 100 }, { api: 'mobile', col: 'mobile', required: true, max: 20 }, { api: 'email', col: 'email', max: 120 },
    named('product', 'product_id', 'products'), named('source', 'source_id', 'lead_sources'), { api: 'dealValue', col: 'deal_value', type: 'money' },
    staffRef('assignedTo', 'assigned_to_id'), named('branch', 'branch_id', 'branches'), named('status', 'stage_id', 'lead_stages'),
    { api: 'priority', col: 'priority', values: PRIORITY }, { api: 'stage', col: 'team', values: ['Pre Sales', 'Sales'] },
    { api: 'leadDate', col: 'lead_date', type: 'date' }, { api: 'nextFollowUp', col: 'next_follow_up', type: 'date' },
    { api: 'lastCall', col: 'last_call', type: 'date' }, { api: 'remarks', col: 'remarks', max: 2000 },
  ] },
  { key: 'crm_lead_products', table: 'lead_products', read: 'staff', write: 'staff', order: 'created_at DESC', fields: [
    { api: 'leadNo', col: 'lead_id', ref: { table: 'leads', label: 'lead_no' }, required: true },
    { api: 'company', col: 'lead_id', ref: { table: 'leads', label: 'company' }, readOnly: true },
    named('product', 'product_id', 'products', { required: true }), named('insurer', 'insurer_id', 'insurers'),
    { api: 'sumInsured', col: 'sum_insured', type: 'money' }, { api: 'premium', col: 'premium', type: 'money', required: true },
    { api: 'qty', col: 'qty', type: 'int' }, { api: 'status', col: 'status', values: ['Proposed', 'Issued'] },
  ] },
  { key: 'crm_tasks', table: 'sales_tasks', read: 'staff', write: 'staff', order: 'due_date DESC', fields: [
    { api: 'title', col: 'title', required: true, max: 200 }, { api: 'type', col: 'type', values: ['Task', 'Follow-up'] },
    { api: 'relatedTo', col: 'lead_id', ref: { table: 'leads', label: 'company', alt: ['lead_no'] } },
    staffRef('assignedTo', 'assigned_to_id', { required: true }), { api: 'dueDate', col: 'due_date', type: 'date', required: true },
    { api: 'priority', col: 'priority', values: PRIORITY }, { api: 'status', col: 'status', values: ['Open', 'In Progress', 'Done'] },
  ] },
  { key: 'crm_call_updates', table: 'calls', read: 'staff', write: 'staff', order: 'date DESC, created_at DESC', fields: [
    { api: 'company', col: 'lead_id', ref: { table: 'leads', label: 'company', alt: ['lead_no'], orElse: { col: 'customer_id', table: 'customers', label: 'name' } }, required: true },
    { api: 'contact', col: 'contact', max: 100 }, { api: 'mobile', col: 'mobile', max: 20 }, { api: 'date', col: 'date', type: 'date' },
    named('outcome', 'outcome_id', 'call_outcomes', { required: true }), { api: 'notes', col: 'notes', max: 1000 }, staffRef('by', 'called_by_id'),
  ] },
  { key: 'crm_quotations', table: 'quotes', read: 'staff', write: 'staff', order: 'date DESC', fields: [
    { api: 'quoteNo', col: 'quote_no', required: true, max: 20 },
    { api: 'customer', col: 'lead_id', ref: { table: 'leads', label: 'company', alt: ['lead_no'] }, required: true },
    named('product', 'product_id', 'products', { required: true }), named('insurer', 'insurer_id', 'insurers'),
    { api: 'premium', col: 'premium', type: 'money', required: true }, { api: 'gst', col: 'gst', type: 'money', readOnly: true },
    { api: 'date', col: 'date', type: 'date' }, { api: 'validTill', col: 'valid_till', type: 'date' },
    { api: 'status', col: 'status', values: ['Draft', 'Sent', 'Accepted', 'Rejected'] },
  ] },
  { key: 'crm_price_requests', table: 'discount_requests', read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending' }, fields: [
    { api: 'leadNo', col: 'lead_id', ref: { table: 'leads', label: 'lead_no' }, required: true },
    { api: 'company', col: 'lead_id', ref: { table: 'leads', label: 'company' }, readOnly: true },
    named('product', 'product_id', 'products'), staffRef('requestedBy', 'requested_by_id'), { api: 'date', col: 'date', type: 'date' },
    { api: 'originalPrice', col: 'original_price', type: 'money', required: true }, { api: 'requestedPrice', col: 'requested_price', type: 'money', required: true },
    { api: 'remarks', col: 'remarks', max: 500 }, { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'crm_day_closing', table: 'daily_reports', fixed: { team: 'sales' }, read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending' }, upsertOn: ['team', 'employee_id', 'date'], fields: [
    { api: 'date', col: 'date', type: 'date', required: true }, staffRef('employee', 'employee_id', { required: true }),
    { api: 'calls', col: 'calls', type: 'int' }, { api: 'meetings', col: 'meetings', type: 'int' }, { api: 'newLeads', col: 'new_leads', type: 'int' },
    { api: 'converted', col: 'converted', type: 'int' }, { api: 'collection', col: 'collection', type: 'money' }, { api: 'summary', col: 'summary', max: 1000 },
    { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'crm_cst_day_closing', table: 'daily_reports', fixed: { team: 'care' }, read: 'staff', write: 'staff', order: 'date DESC', approval: { field: 'status', pending: 'Pending' }, upsertOn: ['team', 'employee_id', 'date'], fields: [
    { api: 'date', col: 'date', type: 'date', required: true }, staffRef('employee', 'employee_id', { required: true }),
    { api: 'renewalCalls', col: 'calls', type: 'int' }, { api: 'renewed', col: 'renewed', type: 'int' }, { api: 'claimsAssisted', col: 'claims_assisted', type: 'int' },
    { api: 'complaints', col: 'complaints', type: 'int' }, { api: 'collection', col: 'collection', type: 'money' }, { api: 'status', col: 'status', values: APPROVAL },
  ] },
  { key: 'crm_cst_allocation', table: 'care_assignments', read: 'staff', write: 'staff', order: 'allocated_on DESC', fields: [
    { api: 'customer', col: 'lead_id', ref: { table: 'leads', label: 'company', alt: ['lead_no'] }, required: true },
    named('policyProduct', 'product_id', 'products'), staffRef('salesOwner', 'sales_owner_id'), staffRef('cstOwner', 'care_owner_id', { required: true }),
    { api: 'allocatedOn', col: 'allocated_on', type: 'date' }, { api: 'renewalDue', col: 'renewal_due', type: 'date' },
    { api: 'status', col: 'status', values: ['Allocated', 'Accepted', 'Transferred'] },
  ] },

  // ───────── Customers ─────────
  { key: 'cst_customers', table: 'customers', read: 'staff', write: 'staff', order: 'name', fields: [
    { api: 'customerId', col: 'customer_code', required: true, max: 20 }, { api: 'name', col: 'name', required: true, max: 120 },
    { api: 'contact', col: 'contact', max: 100 }, { api: 'mobile', col: 'mobile', required: true, max: 20 }, { api: 'email', col: 'email', max: 120 },
    named('branch', 'branch_id', 'branches'), { api: 'policies', col: 'policies', type: 'int' }, staffRef('owner', 'owner_id'),
    { api: 'since', col: 'since', type: 'date' }, { api: 'health', col: 'health', values: ['Healthy', 'Needs Attention', 'At Risk'] },
  ] },
  { key: 'cst_renewals', table: 'renewals', read: 'staff', write: 'staff', order: 'expiry_date', fields: [
    { api: 'policyNo', col: 'policy_no', required: true, max: 40 }, named('customer', 'customer_id', 'customers', { required: true }, { alt: ['customer_code'] }),
    named('product', 'product_id', 'products'), named('insurer', 'insurer_id', 'insurers'), { api: 'expiryDate', col: 'expiry_date', type: 'date', required: true },
    { api: 'premium', col: 'premium', type: 'money' }, staffRef('owner', 'owner_id'),
    { api: 'status', col: 'status', values: ['Due', 'Contacted', 'Quote Sent', 'Renewed', 'Lost'] }, { api: 'lastContact', col: 'last_contact', type: 'date' },
  ] },
  { key: 'cst_feedback', table: 'feedback', read: 'staff', write: 'staff', order: 'date DESC', fields: [
    named('customer', 'customer_id', 'customers', { required: true }, { alt: ['customer_code'] }), { api: 'date', col: 'date', type: 'date' },
    { api: 'rating', col: 'rating', type: 'int', required: true }, { api: 'channel', col: 'channel', values: ['Call', 'WhatsApp', 'Email', 'Visit'] },
    { api: 'comments', col: 'comments', max: 1000 }, { api: 'followUp', col: 'follow_up', values: ['Required', 'Not required', 'Done'] },
  ] },
  { key: 'cst_escalations', table: 'complaints', read: 'staff', write: 'staff', order: 'raised_on DESC', fields: [
    { api: 'ticketNo', col: 'ref_no', required: true, max: 20 }, named('customer', 'customer_id', 'customers', { required: true }, { alt: ['customer_code'] }),
    { api: 'issue', col: 'issue', required: true, max: 500 }, { api: 'severity', col: 'severity', values: PRIORITY }, staffRef('owner', 'owner_id'),
    { api: 'raisedOn', col: 'raised_on', type: 'date' }, { api: 'tat', col: 'tat', max: 30 }, { api: 'status', col: 'status', values: ['Open', 'In Progress', 'Resolved'] },
  ] },

  // ───────── Policies ─────────
  { key: 'prod_projects', table: 'projects', read: 'staff', write: 'staff', order: 'due_date NULLS LAST', fields: [
    { api: 'name', col: 'name', required: true, max: 120 }, { api: 'client', col: 'client', max: 120 }, staffRef('owner', 'owner_id'),
    { api: 'startDate', col: 'start_date', type: 'date' }, { api: 'dueDate', col: 'due_date', type: 'date' }, { api: 'budgetHours', col: 'budget_hours', type: 'number' },
    { api: 'progress', col: 'progress', type: 'int' }, { api: 'status', col: 'status', values: ['Planned', 'In Progress', 'On Hold', 'Completed'] },
  ] },
  { key: 'prod_tasks', table: 'project_tasks', read: 'staff', write: 'staff', order: 'due_date NULLS LAST', fields: [
    { api: 'title', col: 'title', required: true, max: 200 }, named('project', 'project_id', 'projects', { required: true }), staffRef('assignee', 'assignee_id'),
    { api: 'priority', col: 'priority', values: PRIORITY }, { api: 'estimate', col: 'estimate_hours', type: 'number' }, { api: 'dueDate', col: 'due_date', type: 'date' },
    { api: 'status', col: 'status', values: ['To Do', 'In Progress', 'Review', 'Done'] },
  ] },
  { key: 'prod_timelogs', table: 'time_logs', read: 'staff', write: 'staff', order: 'date DESC', fields: [
    { api: 'date', col: 'date', type: 'date', required: true }, staffRef('employee', 'employee_id', { required: true }), named('project', 'project_id', 'projects', { required: true }),
    { api: 'task', col: 'task', max: 200 }, { api: 'hours', col: 'hours', type: 'number', required: true }, { api: 'billable', col: 'billable', type: 'yesno' },
  ] },
  { key: 'prod_issuance', table: 'proposals', read: 'staff', write: 'staff', order: 'date DESC', fields: [
    { api: 'proposalNo', col: 'proposal_no', required: true, max: 20 }, { api: 'customer', col: 'customer', required: true, max: 120 },
    named('product', 'product_id', 'products'), named('insurer', 'insurer_id', 'insurers'), { api: 'premium', col: 'premium', type: 'money' },
    staffRef('handledBy', 'handled_by_id'), { api: 'date', col: 'date', type: 'date' }, { api: 'policyNo', col: 'policy_no', max: 40 },
    { api: 'stage', col: 'stage', values: ['Proposal', 'Documents', 'Payment', 'Issued'] },
  ] },
  { key: 'prod_endorsements', table: 'policy_changes', read: 'staff', write: 'staff', order: 'requested_on DESC', fields: [
    { api: 'policyNo', col: 'policy_no', required: true, max: 40 }, { api: 'customer', col: 'customer', required: true, max: 120 },
    { api: 'type', col: 'type', values: ['Add family member', 'Nominee change', 'Address change', 'Vehicle change', 'Name correction', 'Other'], required: true },
    { api: 'requestedOn', col: 'requested_on', type: 'date' }, staffRef('handledBy', 'handled_by_id'), { api: 'status', col: 'status', values: ['Submitted', 'Pending Docs', 'Completed'] },
  ] },

  // ───────── Money ─────────
  { key: 'hr_petty_cash', table: 'cash_entries', read: 'payments', write: 'admin', order: 'date, created_at', fields: [
    { api: 'date', col: 'date', type: 'date', required: true }, { api: 'ledger', col: 'ledger', values: ['Office Cash', 'Office Upkeep'], required: true },
    { api: 'category', col: 'category', required: true, max: 60 }, { api: 'voucher', col: 'voucher', max: 30 }, { api: 'party', col: 'party', max: 120 },
    { api: 'narration', col: 'narration', max: 300 }, { api: 'debit', col: 'debit', type: 'money' }, { api: 'credit', col: 'credit', type: 'money' },
  ] },
  // Any staff member may record money received (e.g. a renewal payment); only Money users read the list.
  { key: 'acc_receipts', table: 'receipts', read: 'payments', write: 'staff', order: 'date DESC', fields: [
    { api: 'receiptNo', col: 'receipt_no', required: true, max: 20 }, { api: 'date', col: 'date', type: 'date' }, { api: 'customer', col: 'payer', required: true, max: 120 },
    { api: 'against', col: 'against', max: 200 }, { api: 'amount', col: 'amount', type: 'money', required: true },
    { api: 'mode', col: 'mode', values: ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card'], required: true }, { api: 'reference', col: 'reference', max: 60 },
    staffRef('collectedBy', 'collected_by_id'), named('branch', 'branch_id', 'branches'),
  ] },
  { key: 'acc_payments', table: 'payments', read: 'payments', write: 'payments', order: 'date DESC', fields: [
    { api: 'voucherNo', col: 'voucher_no', required: true, max: 20 }, { api: 'date', col: 'date', type: 'date' }, { api: 'payee', col: 'payee', required: true, max: 120 },
    { api: 'purpose', col: 'purpose', required: true, max: 200 }, { api: 'amount', col: 'amount', type: 'money', required: true },
    { api: 'mode', col: 'mode', values: ['Bank Transfer', 'UPI', 'Cheque', 'Cash'], required: true }, { api: 'reference', col: 'reference', max: 60 }, staffRef('approvedBy', 'approved_by_id'),
  ] },
  { key: 'acc_invoices', table: 'invoices', read: 'payments', write: 'payments', order: 'date DESC', fields: [
    { api: 'invoiceNo', col: 'invoice_no', required: true, max: 30 }, { api: 'date', col: 'date', type: 'date' }, { api: 'customer', col: 'customer', required: true, max: 120 },
    { api: 'description', col: 'description', max: 300 }, { api: 'amount', col: 'amount', type: 'money', required: true }, { api: 'gst', col: 'gst', type: 'money' },
    { api: 'paid', col: 'paid', type: 'money' }, { api: 'dueDate', col: 'due_date', type: 'date' },
    { api: 'status', col: 'status', values: ['Unpaid', 'Partially Paid', 'Overdue', 'Paid'] },
  ] },
  { key: 'acc_commissions', table: 'commissions', read: 'payments', write: 'payments', order: 'due_date NULLS LAST', fields: [
    named('insurer', 'insurer_id', 'insurers', { required: true }), { api: 'policyNo', col: 'policy_no', required: true, max: 40 },
    { api: 'customer', col: 'customer', max: 120 }, named('product', 'product_id', 'products'), { api: 'premium', col: 'premium', type: 'money', required: true },
    { api: 'rate', col: 'rate', type: 'number', required: true }, { api: 'amount', col: 'amount', type: 'money', readOnly: true },
    { api: 'dueDate', col: 'due_date', type: 'date' }, { api: 'status', col: 'status', values: ['Receivable', 'Received'] },
  ] },
  { key: 'acc_bank_accounts', table: 'bank_accounts', read: 'payments', write: 'admin', order: 'name', fields: [
    { api: 'name', col: 'name', required: true, max: 80 }, { api: 'bank', col: 'bank', required: true, max: 80 },
    { api: 'accountNo', col: 'account_last4', required: true, max: 20 }, { api: 'ifsc', col: 'ifsc', max: 11 },
    { api: 'type', col: 'type', values: ['Current', 'Savings', 'OD'] }, { api: 'openingBalance', col: 'opening_balance', type: 'money' },
  ] },
];

/** Rules documents (one row each in business.settings). */
export const SETTINGS: Record<string, { key: string; fields: Record<string, 'number' | 'text' | 'time'> }> = {
  hr_leave_settings: { key: 'leave_rules', fields: { monthlyPaidLeave: 'number', weekOff: 'text', countSaturdayHalf: 'text', sandwichRule: 'text' } },
  hr_permission_settings: { key: 'permission_rules', fields: { monthlyCount: 'number', maxHoursPerDay: 'number', excessToLop: 'text', hoursPerLopDay: 'number' } },
  hr_attendance_rules: { key: 'attendance_rules', fields: { shiftStart: 'time', shiftEnd: 'time', graceMinutes: 'number', halfDayHours: 'number', fullDayHours: 'number', lateMarksPerHalfDay: 'number' } },
};

export const RESOURCE_BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));
