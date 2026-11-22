import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Form, Input, InputNumber, DatePicker, Select, Table, Tag, message } from 'antd';
import {
  ApartmentOutlined, BarChartOutlined, BranchesOutlined, CheckOutlined, ContactsOutlined, DollarOutlined, FileTextOutlined,
  FlagOutlined, PhoneOutlined, PieChartOutlined, RiseOutlined, ShopOutlined, TagsOutlined, TeamOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import RecordPage, { statusTag, type FieldDef, type RecordPageConfig } from '../RecordPage';
import { collectionApi, fmtDate, getCollection, inr, todayISO, useCollection, type Row } from '../store';
import { BarList, Empty, HubGrid, PageHeader, Panel, StatGrid, type Tone } from '../ui';
import { LEAD_STATUSES } from '../seed';

const page = (cfg: RecordPageConfig) => function Page() { return <RecordPage {...cfg} />; };
const STATUS_TONE: Record<string, Tone> = { New: 'blue', Interested: 'red', Quoted: 'amber', 'On Hold': 'teal', Won: 'green', Lost: 'slate' };
const staffOptions = { from: 'hr_employees', filter: (r: Row) => r.status === 'Active' && r.type === 'Employee' };

// ───────────────────────── Leads ─────────────────────────
export const LEAD_FIELDS: FieldDef[] = [
  { name: 'leadNo', label: '#', hideInForm: true, width: 90, default: () => nextLeadNo() },
  { name: 'company', label: 'Customer', required: true, render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.contact}</small></span> },
  { name: 'contact', label: 'Contact person', required: true, hideInTable: true },
  { name: 'mobile', label: 'Mobile', required: true },
  { name: 'email', label: 'Email', hideInTable: true },
  { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' }, required: true },
  { name: 'source', label: 'Came from', type: 'select', options: { from: 'crm_sources' }, required: true },
  { name: 'dealValue', label: 'Expected premium', type: 'money', default: 0 },
  { name: 'assignedTo', label: 'Assigned to', type: 'select', options: staffOptions, required: true },
  { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' }, required: true },
  { name: 'status', label: 'Stage', type: 'select', options: { from: 'crm_statuses' }, default: 'New' },
  { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], default: 'Medium', hideInTable: true },
  { name: 'stage', label: 'Team', type: 'select', options: ['Pre Sales', 'Sales'], default: 'Sales', hideInTable: true },
  { name: 'leadDate', label: 'Enquiry date', type: 'date', default: todayISO, required: true },
  { name: 'nextFollowUp', label: 'Next follow-up', type: 'date', hideInTable: true },
  { name: 'remarks', label: 'Remarks', type: 'textarea', hideInTable: true },
];

// Time-based and checked against loaded enquiries, so numbers do not clash (the database also enforces uniqueness).
const nextLeadNo = () => {
  const taken = new Set(getCollection('crm_leads').map((l) => l.leadNo));
  let n = Number(Date.now().toString().slice(-6));
  while (taken.has(`LD-${n}`)) n += 1;
  return `LD-${n}`;
};
const leadStats = (rows: Row[]) => [
  { label: 'Enquiries', value: rows.length, hint: 'In this view', tone: 'amber' as Tone, icon: <ContactsOutlined /> },
  { label: 'Likely to buy', value: rows.filter((r) => r.status === 'Interested').length, hint: 'Marked Interested', tone: 'red' as Tone, icon: <FlagOutlined /> },
  { label: 'Premium in play', value: inr(rows.filter((r) => !['Won', 'Lost'].includes(r.status)).reduce((s, r) => s + (Number(r.dealValue) || 0), 0)), hint: 'Not yet won or lost', tone: 'purple' as Tone, icon: <DollarOutlined /> },
  { label: 'Not called yet', value: rows.filter((r) => !r.lastCall && !['Won', 'Lost'].includes(r.status)).length, hint: 'Needs a first call', tone: 'green' as Tone, icon: <PhoneOutlined />, to: '/crm/tasks/calls' },
];

const leadBase: Omit<RecordPageConfig, 'title'> = {
  collection: 'crm_leads', fields: LEAD_FIELDS, statusField: 'status', statusTabs: LEAD_STATUSES, dateField: 'leadDate',
  stats: leadStats, addLabel: 'New Enquiry',
  validate: (v, all, editing) => (all.some((r) => r.mobile === v.mobile && r.id !== editing?.id && r.product === v.product)
    ? 'This customer already has an enquiry for this product (see Duplicates).' : null),
  onSaved: (row, isNew) => { if (isNew && !row.leadNo) collectionApi('crm_leads').update(row.id, { leadNo: nextLeadNo() }); },
};

export const AllLeads = page({ ...leadBase, title: 'Enquiries', crumbs: 'Sales › Enquiries', subtitle: 'Every person or business who asked about a policy – who owns it, what they want and how close it is to closing.' });
export const PreSales = page({
  ...leadBase, title: 'Checking', crumbs: 'Sales › Enquiries', subtitle: 'New enquiries still being checked – is the customer genuine and ready? Move them to the sales team when they are.',
  rowFilter: (r) => r.stage === 'Pre Sales',
  rowActions: (r, api) => <Button size="small" onClick={() => { api.update(r.id, { stage: 'Sales' }); message.success('Sent to the sales team'); }}>Ready for sales</Button>,
});
export const DuplicateLeads = page({
  ...leadBase, title: 'Duplicates', crumbs: 'Sales › Enquiries', canAdd: false, stats: undefined,
  subtitle: 'The same customer phone number entered more than once. Keep the best record and remove the rest.',
  rowFilter: (r, all) => all.filter((x) => x.mobile === r.mobile).length > 1,
  emptyText: 'No repeat enquiries – every phone number is unique.',
});

export const LeadProducts = page({
  collection: 'crm_lead_products', title: 'Products', crumbs: 'Sales › Enquiries', addLabel: 'Quote a Product',
  subtitle: 'Which policy, insurer and premium has been offered to each customer.',
  statusField: 'status', statusTabs: ['Proposed', 'Issued'],
  fields: [
    { name: 'leadNo', label: 'Lead', type: 'select', options: { from: 'crm_leads', field: 'leadNo' }, required: true },
    { name: 'company', label: 'Customer', hideInForm: true },
    { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' }, required: true },
    { name: 'insurer', label: 'Insurer', type: 'select', options: { from: 'insurers' } },
    { name: 'sumInsured', label: 'Sum insured', type: 'money' },
    { name: 'premium', label: 'Premium', type: 'money', required: true },
    { name: 'qty', label: 'Qty', type: 'number', default: 1 },
    { name: 'status', label: 'Status', type: 'select', options: ['Proposed', 'Issued'], default: 'Proposed' },
  ],
  stats: (rows) => [
    { label: 'Products linked', value: rows.length, tone: 'blue' },
    { label: 'Issued', value: rows.filter((r) => r.status === 'Issued').length, tone: 'green' },
    { label: 'Premium proposed', value: inr(rows.reduce((s, r) => s + (Number(r.premium) || 0) * (Number(r.qty) || 1), 0)), tone: 'purple' },
  ],
});

/** Full-page lead form, mirroring the "New Lead" screen. */
export function AddLead() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [priority, setPriority] = useState('Medium');
  const { rows: leads, add } = useCollection('crm_leads');
  const { rows: products } = useCollection('crm_products');
  const { rows: sources } = useCollection('crm_sources');
  const { rows: branches } = useCollection('branches');
  const { rows: staff } = useCollection('hr_employees');
  const opt = (list: Row[]) => list.map((r) => ({ value: r.name, label: r.name }));

  const submit = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const dup = leads.find((l) => l.mobile === v.mobile);
    add({
      ...v, priority, leadNo: nextLeadNo(), status: 'New', stage: v.stage ?? 'Sales', dealValue: v.dealValue ?? 0,
      leadDate: v.leadDate.format('YYYY-MM-DD'), nextFollowUp: v.nextFollowUp ? v.nextFollowUp.format('YYYY-MM-DD') : '', lastCall: '',
    });
    message.success(dup ? 'Enquiry saved – this phone number already exists (see Duplicates)' : 'Enquiry saved');
    navigate('/crm/leads');
  };

  return (
    <div className="erp-page">
      <PageHeader eyebrow="Sales" title="New Enquiry" crumbs="Sales › Enquiries" subtitle="Record a customer who asked about insurance. Required fields are marked." actions={<><Button type="primary" icon={<CheckOutlined />} onClick={submit}>Save Enquiry</Button><Button className="erp-ghost" onClick={() => navigate(-1)}>Back</Button></>} />
      <Form form={form} layout="vertical" initialValues={{ leadDate: dayjs(), stage: 'Sales' }}>
        <div className="erp-grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Who is the customer?">
              <div className="erp-form-grid">
                <Form.Item name="company" label="Customer / business name" rules={[{ required: true }]}><Input placeholder="Acme Corporation" /></Form.Item>
                <Form.Item name="contact" label="Contact person" rules={[{ required: true }]}><Input placeholder="Raj Kumar" /></Form.Item>
                <Form.Item name="mobile" label="Mobile number" rules={[{ required: true }, { pattern: /^[6-9]\d{9}$/, message: 'Enter a 10-digit mobile number' }]}><Input placeholder="98765 43210" inputMode="numeric" maxLength={10} /></Form.Item>
                <Form.Item name="email" label="Email address" rules={[{ type: 'email' }]}><Input placeholder="raj@company.com" /></Form.Item>
                <Form.Item name="leadDate" label="Enquiry date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item>
                <Form.Item name="nextFollowUp" label="Next follow-up"><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item>
              </div>
            </Panel>
            <Panel title="What do they need, and who will follow up?">
              <div className="erp-form-grid">
                <Form.Item name="source" label="How did they find us?" rules={[{ required: true }]}><Select showSearch placeholder="Choose a source" options={opt(sources)} /></Form.Item>
                <Form.Item name="assignedTo" label="Assigned to" rules={[{ required: true }]}><Select showSearch placeholder="Choose a salesperson" options={opt(staff.filter((s) => s.status === 'Active' && s.type === 'Employee'))} /></Form.Item>
                <Form.Item name="product" label="Product" rules={[{ required: true }]}><Select placeholder="Choose a product" options={opt(products)} /></Form.Item>
                <Form.Item name="dealValue" label="Expected premium"><InputNumber style={{ width: '100%' }} min={0} prefix="₹" /></Form.Item>
                <Form.Item name="branch" label="Branch" rules={[{ required: true }]}><Select placeholder="Choose a branch" options={opt(branches)} /></Form.Item>
                <Form.Item name="stage" label="Stage"><Select options={[{ value: 'Pre Sales', label: 'Pre Sales' }, { value: 'Sales', label: 'Sales' }]} /></Form.Item>
              </div>
            </Panel>
            <Panel title="Notes">
              <Form.Item name="remarks" label="Remarks / notes" style={{ marginBottom: 0 }}><Input.TextArea rows={4} placeholder="Enter any additional details, context, or follow-up notes…" /></Form.Item>
            </Panel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="How urgent?">
              <div className="erp-tabs" role="radiogroup" aria-label="Lead priority">
                {['Low', 'Medium', 'High'].map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={priority === p} className={priority === p ? 'is-active' : ''} onClick={() => setPriority(p)}>{p}</button>
                ))}
              </div>
            </Panel>
            <Panel title="Already in the system?">
              <Form.Item noStyle shouldUpdate>
                {() => {
                  const m = form.getFieldValue('mobile');
                  const hits = m ? leads.filter((l) => l.mobile === m) : [];
                  return hits.length
                    ? <p style={{ color: '#b45309' }}><WarningOutlined /> {hits.length} existing enquiry(ies) use this number: {hits.map((h) => `${h.leadNo} (${h.product})`).join(', ')}</p>
                    : <p className="erp-muted">Type a mobile number to check if this customer is already in the system.</p>;
                }}
              </Form.Item>
            </Panel>
          </div>
        </div>
      </Form>
    </div>
  );
}

// ───────────────────────── Tasks & calls ─────────────────────────
const TASK_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Task', required: true },
  { name: 'type', label: 'Type', type: 'select', options: ['Task', 'Follow-up'], default: 'Task' },
  { name: 'relatedTo', label: 'Related lead', type: 'select', options: { from: 'crm_leads', field: 'company' } },
  { name: 'assignedTo', label: 'Assigned to', type: 'select', options: staffOptions, required: true },
  { name: 'dueDate', label: 'Due date', type: 'date', required: true, default: todayISO,
    render: (v, r) => <span style={{ color: r.status !== 'Done' && v < todayISO() ? '#dc2626' : undefined }}>{fmtDate(v)}{r.status !== 'Done' && v < todayISO() ? ' · overdue' : ''}</span> },
  { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], default: 'Medium' },
  { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Done'], default: 'Open' },
];
const taskBase: RecordPageConfig = {
  collection: 'crm_tasks', title: 'To-do', crumbs: 'Sales › Follow-ups', fields: TASK_FIELDS, statusField: 'status', statusTabs: ['Open', 'In Progress', 'Done'], dateField: 'dueDate', addLabel: 'Add To-do',
  stats: (rows) => [
    { label: 'Open', value: rows.filter((r) => r.status !== 'Done').length, tone: 'blue' },
    { label: 'Due today', value: rows.filter((r) => r.status !== 'Done' && r.dueDate === todayISO()).length, tone: 'amber' },
    { label: 'Overdue', value: rows.filter((r) => r.status !== 'Done' && r.dueDate < todayISO()).length, tone: 'red' },
    { label: 'Completed', value: rows.filter((r) => r.status === 'Done').length, tone: 'green' },
  ],
  rowActions: (r, api) => r.status !== 'Done' ? <Button size="small" onClick={() => api.update(r.id, { status: 'Done' })}>Mark done</Button> : null,
};
export const Tasks = page({ ...taskBase, subtitle: 'Everything the sales team has promised to do, with due dates. Overdue items are shown in red.' });
export const FollowUps = page({ ...taskBase, title: 'Call Back', crumbs: 'Sales › Follow-ups', subtitle: 'Customers you promised to call back, and when.', rowFilter: (r) => r.type === 'Follow-up', addLabel: 'Schedule Call-back', fields: TASK_FIELDS.map((f) => (f.name === 'type' ? { ...f, default: 'Follow-up' } : f)) });

export const CallUpdates = page({
  collection: 'crm_call_updates', title: 'Calls', crumbs: 'Sales › Follow-ups', addLabel: 'Log a Call', dateField: 'date',
  subtitle: 'A record of every sales call and what happened. Logging a call removes the enquiry from Not called yet.',
  fields: [
    { name: 'company', label: 'Lead', type: 'select', options: { from: 'crm_leads', field: 'company' }, required: true },
    { name: 'mobile', label: 'Mobile' },
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'outcome', label: 'Outcome', type: 'select', options: { from: 'crm_call_outcomes' }, required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'by', label: 'Called by', type: 'select', options: staffOptions },
  ],
  onSaved: (row) => {
    const lead = getCollection('crm_leads').find((l) => l.company === row.company);
    if (lead) collectionApi('crm_leads').update(lead.id, { lastCall: row.date });
  },
});

// ───────────────────────── Quotations, closing, price requests ─────────────────────────
export const Quotations = page({
  collection: 'crm_quotations', title: 'Quotes', crumbs: 'Sales › Quotes', addLabel: 'New Quote', statusField: 'status', statusTabs: ['Draft', 'Sent', 'Accepted', 'Rejected'], dateField: 'date',
  subtitle: 'Premium quotes sent to customers, including GST and how long each quote is valid.',
  fields: [
    { name: 'quoteNo', label: 'Quote #', required: true, default: () => `QT-${2400 + getCollection('crm_quotations').length}` },
    { name: 'customer', label: 'Customer', type: 'select', options: { from: 'crm_leads', field: 'company' }, required: true },
    { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' }, required: true },
    { name: 'insurer', label: 'Insurer', type: 'select', options: { from: 'insurers' } },
    { name: 'premium', label: 'Premium', type: 'money', required: true },
    { name: 'gst', label: 'GST (18%)', type: 'money', hideInForm: true, render: (_v, r) => inr(Math.round((Number(r.premium) || 0) * 0.18)) },
    { name: 'total', label: 'Total', type: 'money', hideInForm: true, render: (_v, r) => <strong>{inr(Math.round((Number(r.premium) || 0) * 1.18))}</strong> },
    { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'validTill', label: 'Valid till', type: 'date', default: () => dayjs().add(15, 'day').format('YYYY-MM-DD') },
    { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Accepted', 'Rejected'], default: 'Draft' },
  ],
  stats: (rows) => [
    { label: 'Quotes sent', value: rows.length, tone: 'blue' },
    { label: 'Accepted', value: rows.filter((r) => r.status === 'Accepted').length, tone: 'green' },
    { label: 'Accepted value', value: inr(rows.filter((r) => r.status === 'Accepted').reduce((s, r) => s + Number(r.premium || 0) * 1.18, 0)), tone: 'purple' },
  ],
});

export const DayClosing = page({
  collection: 'crm_day_closing', title: 'Daily Report', crumbs: 'Sales › Daily Report', addLabel: 'Submit Today’s Report', dateField: 'date',
  subtitle: 'Each salesperson’s end-of-day numbers – calls, meetings, closures and money collected. Managers sign them off.',
  approval: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
  fields: [
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'employee', label: 'Employee', type: 'select', options: staffOptions, required: true },
    { name: 'calls', label: 'Calls', type: 'number' },
    { name: 'meetings', label: 'Meetings', type: 'number' },
    { name: 'newLeads', label: 'New leads', type: 'number' },
    { name: 'converted', label: 'Won', type: 'number' },
    { name: 'collection', label: 'Collection', type: 'money' },
    { name: 'summary', label: 'Summary', type: 'textarea', hideInTable: true },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
  ],
  stats: (rows) => {
    const today = rows.filter((r) => r.date === dayjs().subtract(1, 'day').format('YYYY-MM-DD') || r.date === todayISO());
    return [
      { label: 'Reports (last 2 days)', value: today.length, tone: 'blue' },
      { label: 'Calls', value: today.reduce((s, r) => s + Number(r.calls || 0), 0), tone: 'teal' },
      { label: 'Collection', value: inr(today.reduce((s, r) => s + Number(r.collection || 0), 0)), tone: 'green' },
      { label: 'Pending approval', value: rows.filter((r) => r.status === 'Pending').length, tone: 'amber' },
    ];
  },
});

export const PriceRequests = page({
  collection: 'crm_price_requests', title: 'Discounts', crumbs: 'Sales › Discounts', addLabel: 'Ask for a Discount', dateField: 'date',
  subtitle: 'Sales staff ask before offering a lower price. Approving one updates the enquiry’s premium automatically.',
  approval: {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    after: (row, decision) => {
      if (decision !== 'approved') return;
      const lead = getCollection('crm_leads').find((l) => l.leadNo === row.leadNo);
      if (lead) collectionApi('crm_leads').update(lead.id, { dealValue: row.requestedPrice });
    },
  },
  fields: [
    { name: 'leadNo', label: 'Lead', type: 'select', options: { from: 'crm_leads', field: 'leadNo' }, required: true, render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.company}</small></span> },
    { name: 'company', label: 'Customer', hideInTable: true, hideInForm: true },
    { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' } },
    { name: 'requestedBy', label: 'Requested by', type: 'select', options: staffOptions },
    { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'originalPrice', label: 'Original price', type: 'money', required: true },
    { name: 'requestedPrice', label: 'Requested price', type: 'money', required: true,
      render: (v, r) => { const diff = Number(v) - Number(r.originalPrice); return <span><strong>{inr(v)}</strong><br /><small style={{ color: diff < 0 ? '#dc2626' : '#16a34a' }}>{diff >= 0 ? '+' : ''}{inr(diff)}</small></span>; } },
    { name: 'remarks', label: 'Remarks', type: 'textarea', hideInTable: true },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
  ],
});

const allocationFields: FieldDef[] = [
  { name: 'customer', label: 'Customer', type: 'select', options: { from: 'crm_leads', field: 'company' }, required: true },
  { name: 'policyProduct', label: 'Product', type: 'select', options: { from: 'crm_products' } },
  { name: 'salesOwner', label: 'Sales owner', type: 'select', options: staffOptions },
  { name: 'cstOwner', label: 'CST owner', type: 'select', options: { from: 'hr_employees', filter: (r) => r.department === 'Customer Success' }, required: true },
  { name: 'allocatedOn', label: 'Allocated on', type: 'date', default: todayISO },
  { name: 'renewalDue', label: 'Renewal due', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: ['Allocated', 'Accepted', 'Transferred'], default: 'Allocated' },
];
export const CstAllocation = page({
  collection: 'crm_cst_allocation', title: 'Send to Service', crumbs: 'Sales › Send to Service', addLabel: 'Hand over a Customer', dateField: 'allocatedOn',
  subtitle: 'Once a policy is sold, assign the customer to a Customer Care owner who will look after renewals and service.', fields: allocationFields,
});

export const cstClosingConfig: RecordPageConfig = {
  collection: 'crm_cst_day_closing', title: 'Daily Report', crumbs: 'Customers › Daily Report', addLabel: 'Submit Today’s Report', dateField: 'date',
  subtitle: 'Each service person’s day – renewal calls made, policies renewed, claims helped and complaints handled.',
  approval: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
  fields: [
    { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'employee', label: 'Employee', type: 'select', options: { from: 'hr_employees', filter: (r) => r.department === 'Customer Success' }, required: true },
    { name: 'renewalCalls', label: 'Renewal calls', type: 'number' },
    { name: 'renewed', label: 'Renewed', type: 'number' },
    { name: 'claimsAssisted', label: 'Claims assisted', type: 'number' },
    { name: 'complaints', label: 'Complaints', type: 'number' },
    { name: 'collection', label: 'Collection', type: 'money' },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
  ],
};
export const CstDayClosing = page(cstClosingConfig);

// ───────────────────────── Setup lists (shown under Setup) ─────────────────────────
const master = (collection: string, title: string, fields: FieldDef[]) => page({ collection, title, crumbs: 'Settings', eyebrow: 'Settings', fields, addLabel: `Add ${title.replace(/s$/, '')}` });
export const CrmSources = master('crm_sources', 'Sources', [{ name: 'name', label: 'Source', required: true }, { name: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], default: 'Yes' }]);
export const CrmStatuses = master('crm_statuses', 'Stages', [{ name: 'name', label: 'Stage', required: true }, { name: 'order', label: 'Order', type: 'number' }, { name: 'color', label: 'Colour', type: 'select', options: ['blue', 'red', 'orange', 'cyan', 'green', 'default'], render: (v) => <Tag color={v}>{v}</Tag> }]);
export const CrmProducts = master('crm_products', 'Products', [
  { name: 'name', label: 'Product', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['Motor', 'Health', 'Life', 'Commercial', 'Other'] },
  { name: 'basePremium', label: 'Starting premium', type: 'money' }, { name: 'commissionPct', label: 'Commission', type: 'percent' }, { name: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], default: 'Yes' },
]);
export const CrmCallOutcomes = master('crm_call_outcomes', 'Call Results', [{ name: 'name', label: 'Outcome', required: true }]);
export const Branches = master('branches', 'Branches', [
  { name: 'name', label: 'Branch', required: true }, { name: 'code', label: 'Code' }, { name: 'city', label: 'City' },
  { name: 'manager', label: 'Manager', type: 'select', options: staffOptions }, { name: 'phone', label: 'Phone' },
]);

// ───────────────────────── Dashboard ─────────────────────────
export function CrmDashboard() {
  const { rows: leads } = useCollection('crm_leads');
  const { rows: calls } = useCollection('crm_call_updates');
  const { rows: tasks } = useCollection('crm_tasks');
  const { rows: sources } = useCollection('crm_sources');
  const open = leads.filter((l) => !['Won', 'Lost'].includes(l.status));
  const converted = leads.filter((l) => l.status === 'Won');
  const byStatus = LEAD_STATUSES.map((s) => ({ label: s, value: leads.filter((l) => l.status === s).length, tone: STATUS_TONE[s], to: `/crm/leads?status=${encodeURIComponent(s)}` }));
  const bySource = sources.map((s) => ({ label: s.name, value: leads.filter((l) => l.source === s.name).length, tone: 'pink' as Tone, to: '/crm/leads' }));
  const branchRows = [...new Set(leads.map((l) => l.branch))].map((b) => {
    const list = leads.filter((l) => l.branch === b);
    const conv = list.filter((l) => l.status === 'Won');
    return { branch: b, leads: list.length, converted: conv.length, value: conv.reduce((s, l) => s + Number(l.dealValue || 0), 0), pct: list.length ? Math.round((conv.length / list.length) * 100) : 0 };
  }).sort((a, b) => b.value - a.value);
  const teamRows = [...new Set(leads.map((l) => l.assignedTo))].map((m) => {
    const list = leads.filter((l) => l.assignedTo === m);
    const conv = list.filter((l) => l.status === 'Won');
    return { member: m, leads: list.length, converted: conv.length, lost: list.filter((l) => l.status === 'Lost').length, value: conv.reduce((s, l) => s + Number(l.dealValue || 0), 0) };
  }).sort((a, b) => b.value - a.value);
  const dueToday = tasks.filter((t) => t.status !== 'Done' && t.dueDate === todayISO());
  const overdue = tasks.filter((t) => t.status !== 'Done' && t.dueDate < todayISO());

  return (
    <div className="erp-page">
      <PageHeader eyebrow="Sales" title="Sales Dashboard" subtitle="How many enquiries came in, where they came from, and which branches and people are closing them." actions={<Link to="/crm/leads/new"><Button type="primary">New Enquiry</Button></Link>} />
      <StatGrid stats={[
        { label: 'All enquiries', value: leads.length, hint: 'Since you started', tone: 'amber', icon: <ContactsOutlined />, to: '/crm/leads' },
        { label: 'Premium in play', value: inr(open.reduce((s, l) => s + Number(l.dealValue || 0), 0)), hint: `${open.length} still open`, tone: 'purple', icon: <RiseOutlined />, to: '/crm/leads?status=Interested' },
        { label: 'Policies won', value: converted.length, hint: inr(converted.reduce((s, l) => s + Number(l.dealValue || 0), 0)), tone: 'green', icon: <CheckOutlined />, to: '/crm/leads?status=Won' },
        { label: 'Not called yet', value: open.filter((l) => !l.lastCall).length, hint: 'Need a first call', tone: 'red', icon: <PhoneOutlined />, to: '/crm/tasks/calls' },
      ]} />
      <div className="erp-grid-2">
        <Panel title={<><BarChartOutlined /> Where enquiries stand</>} extra={<Tag>{leads.length} total</Tag>}>
          <BarList items={byStatus} total={leads.length} />
          <div className="erp-funnel" aria-hidden>
            {byStatus.filter((s) => s.label !== 'Lost').map((s, i) => (
              <div key={s.label} className={`tone-${s.tone}`} style={{ width: `${92 - i * 14}%` }}><span>{s.label}</span><span>{s.value}</span></div>
            ))}
          </div>
        </Panel>
        <Panel title={<><PieChartOutlined /> Where enquiries come from</>} extra={<Tag>{leads.length} leads</Tag>}>
          <BarList items={bySource} total={leads.length} />
        </Panel>
      </div>
      <div className="erp-grid-2-even">
        <Panel title={<><ApartmentOutlined /> Branches</>} extra={<span className="erp-muted">Best first</span>}>
          <Table size="small" rowKey="branch" pagination={false} dataSource={branchRows} columns={[
            { title: 'Branch', dataIndex: 'branch' }, { title: 'Enquiries', dataIndex: 'leads', align: 'right' },
            { title: 'Won', dataIndex: 'converted', align: 'right' }, { title: 'Premium won', dataIndex: 'value', align: 'right', render: inr },
            { title: 'Win rate', dataIndex: 'pct', align: 'right', render: (v) => `${v}%` },
          ]} />
        </Panel>
        <Panel title={<><TeamOutlined /> Salespeople</>} extra={<span className="erp-muted">By premium won</span>}>
          <Table size="small" rowKey="member" pagination={false} dataSource={teamRows} columns={[
            { title: 'Salesperson', dataIndex: 'member' }, { title: 'Enquiries', dataIndex: 'leads', align: 'right' },
            { title: 'Won / lost', render: (_, r) => `${r.converted} won · ${r.lost} lost` }, { title: 'Premium won', dataIndex: 'value', align: 'right', render: inr },
          ]} />
        </Panel>
      </div>
      <div className="erp-grid-2">
        <Panel title={<><PhoneOutlined /> Latest calls</>} extra={<Link to="/crm/tasks/calls">Show all →</Link>}>
          {calls.length ? (
            <ul className="erp-list">
              {[...calls].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5).map((c) => (
                <li key={c.id}>
                  <div><strong>{c.company}</strong><small>{c.contact ?? ''} {c.mobile ? `· ${c.mobile}` : ''}</small><small><Tag>{c.outcome}</Tag>{c.notes}</small></div>
                  <small style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.date)}<br />{c.by}</small>
                </li>
              ))}
            </ul>
          ) : <Empty>No calls logged yet.</Empty>}
        </Panel>
        <Panel title={<><FileTextOutlined /> Due today</>} extra={<span><Tag color="blue">Today ({dueToday.length})</Tag><Tag color="red">Overdue ({overdue.length})</Tag></span>}>
          {dueToday.length + overdue.length ? (
            <ul className="erp-list">
              {[...overdue, ...dueToday].slice(0, 6).map((t) => (
                <li key={t.id}><div><strong>{t.title}</strong><small>{t.relatedTo} · {t.assignedTo}</small></div>{statusTag(t.dueDate < todayISO() ? 'Overdue' : 'Due', { Overdue: 'red', Due: 'blue' })}</li>
              ))}
            </ul>
          ) : <Empty>Nothing due today.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── Reports ─────────────────────────
const REPORTS = [
  { id: 'leads-summary', title: 'Monthly Enquiries', description: 'How many enquiries came in each month and where each one stands.', icon: <ContactsOutlined />, tone: 'amber' as Tone },
  { id: 'product-wise', title: 'Sales by Product', description: 'Which policies people ask about most, and which ones actually sell.', icon: <TagsOutlined />, tone: 'blue' as Tone },
  { id: 'revenue-comparison', title: 'This Month vs Last', description: 'Money collected this month compared with last month.', icon: <RiseOutlined />, tone: 'purple' as Tone },
  { id: 'payment-collection', title: 'How Customers Pay', description: 'Collections split by UPI, bank, cheque, cash and card, and who collected them.', icon: <DollarOutlined />, tone: 'green' as Tone },
  { id: 'branch-wise', title: 'Branch League Table', description: 'Enquiries, wins and premium for each branch side by side.', icon: <BranchesOutlined />, tone: 'teal' as Tone },
  { id: 'sales-comparison', title: 'Salesperson Targets', description: 'Premium won by each salesperson against their monthly target.', icon: <BarChartOutlined />, tone: 'pink' as Tone },
  { id: 'outstanding', title: 'Money Still Due', description: 'Unpaid customer invoices and commission insurers still owe you.', icon: <WarningOutlined />, tone: 'red' as Tone },
];

export function CrmReports() {
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Sales" title="Reports" subtitle="Ready-made reports worked out from your latest sales and finance numbers. Open one to see the detail." />
      <HubGrid cards={REPORTS.map((r) => ({ ...r, to: `/crm/reports/${r.id}`, badge: 'Live', cta: 'View report' }))} />
    </div>
  );
}

const monthKey = (d: string) => String(d ?? '').slice(0, 7);

export function CrmReportView() {
  const { id } = useParams();
  const report = REPORTS.find((r) => r.id === id);
  const { rows: leads } = useCollection('crm_leads');
  const { rows: receipts } = useCollection('acc_receipts');
  const { rows: invoices } = useCollection('acc_invoices');
  const { rows: commissions } = useCollection('acc_commissions');

  const { columns, data } = useMemo(() => {
    const group = <K extends string>(list: Row[], key: (r: Row) => K) => {
      const m = new Map<K, Row[]>();
      list.forEach((r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]));
      return [...m.entries()];
    };
    const sum = (list: Row[], f: string) => list.reduce((s, r) => s + (Number(r[f]) || 0), 0);
    const money = (v: number) => inr(v);
    switch (id) {
      case 'leads-summary':
        return {
          columns: [{ title: 'Month', dataIndex: 'k' }, { title: 'Enquiries', dataIndex: 'n', align: 'right' as const }, ...LEAD_STATUSES.map((s) => ({ title: s, dataIndex: s, align: 'right' as const })), { title: 'Handled by', dataIndex: 'owners' }],
          data: group(leads, (r) => monthKey(r.leadDate)).sort((a, b) => b[0].localeCompare(a[0])).map(([k, list]) => ({
            k: dayjs(`${k}-01`).format('MMM YYYY'), n: list.length, owners: [...new Set(list.map((l) => l.assignedTo))].join(', '),
            ...Object.fromEntries(LEAD_STATUSES.map((s) => [s, list.filter((l) => l.status === s).length])),
          })),
        };
      case 'product-wise':
        return {
          columns: [{ title: 'Product', dataIndex: 'k' }, { title: 'Enquiries', dataIndex: 'n', align: 'right' as const }, { title: 'Won', dataIndex: 'c', align: 'right' as const }, { title: 'Premium in play', dataIndex: 'open', align: 'right' as const, render: money }, { title: 'Premium won', dataIndex: 'v', align: 'right' as const, render: money }, { title: 'Win rate', dataIndex: 'pct', align: 'right' as const, render: (v: number) => `${v}%` }],
          data: group(leads, (r) => r.product).map(([k, list]) => {
            const c = list.filter((l) => l.status === 'Won');
            return { k, n: list.length, c: c.length, v: sum(c, 'dealValue'), open: sum(list.filter((l) => !['Won', 'Lost'].includes(l.status)), 'dealValue'), pct: Math.round((c.length / list.length) * 100) };
          }),
        };
      case 'revenue-comparison': {
        const cur = dayjs().format('YYYY-MM');
        const prev = dayjs().subtract(1, 'month').format('YYYY-MM');
        const a = receipts.filter((r) => monthKey(r.date) === cur);
        const b = receipts.filter((r) => monthKey(r.date) === prev);
        const growth = sum(b, 'amount') ? Math.round(((sum(a, 'amount') - sum(b, 'amount')) / sum(b, 'amount')) * 100) : null;
        return {
          columns: [{ title: 'Period', dataIndex: 'k' }, { title: 'Receipts', dataIndex: 'n', align: 'right' as const }, { title: 'Amount', dataIndex: 'v', align: 'right' as const, render: money }],
          data: [
            { k: `This month (${dayjs().format('MMM YYYY')})`, n: a.length, v: sum(a, 'amount') },
            { k: `Last month (${dayjs().subtract(1, 'month').format('MMM YYYY')})`, n: b.length, v: sum(b, 'amount') },
            { k: `Growth ${growth == null ? '—' : `${growth}%`}`, n: a.length - b.length, v: sum(a, 'amount') - sum(b, 'amount') },
          ],
        };
      }
      case 'payment-collection':
        return {
          columns: [{ title: 'Payment mode', dataIndex: 'k' }, { title: 'Receipts', dataIndex: 'n', align: 'right' as const }, { title: 'Amount', dataIndex: 'v', align: 'right' as const, render: money }, { title: 'Collectors', dataIndex: 'who' }],
          data: group(receipts, (r) => r.mode).map(([k, list]) => ({ k, n: list.length, v: sum(list, 'amount'), who: [...new Set(list.map((l) => l.collectedBy))].join(', ') })),
        };
      case 'branch-wise':
        return {
          columns: [{ title: 'Branch', dataIndex: 'k' }, { title: 'Enquiries', dataIndex: 'n', align: 'right' as const }, { title: 'Won', dataIndex: 'c', align: 'right' as const }, { title: 'Value', dataIndex: 'v', align: 'right' as const, render: money }, { title: 'Sources', dataIndex: 'src' }],
          data: group(leads, (r) => r.branch).map(([k, list]) => {
            const c = list.filter((l) => l.status === 'Won');
            return { k, n: list.length, c: c.length, v: sum(c, 'dealValue'), src: [...new Set(list.map((l) => l.source))].join(', ') };
          }),
        };
      case 'sales-comparison': {
        const target = 100000;
        return {
          columns: [{ title: 'Salesperson', dataIndex: 'k' }, { title: 'Enquiries', dataIndex: 'n', align: 'right' as const }, { title: 'Premium won', dataIndex: 'v', align: 'right' as const, render: money }, { title: 'Monthly target', dataIndex: 't', align: 'right' as const, render: money }, { title: 'Achieved', dataIndex: 'pct', align: 'right' as const, render: (v: number) => <Tag color={v >= 100 ? 'green' : v >= 50 ? 'orange' : 'red'}>{v}%</Tag> }],
          data: group(leads, (r) => r.assignedTo).map(([k, list]) => {
            const v = sum(list.filter((l) => l.status === 'Won'), 'dealValue');
            return { k, n: list.length, v, t: target, pct: Math.round((v / target) * 100) };
          }),
        };
      }
      case 'outstanding':
        return {
          columns: [{ title: 'Type', dataIndex: 'type' }, { title: 'Reference', dataIndex: 'k' }, { title: 'Party', dataIndex: 'party' }, { title: 'Due date', dataIndex: 'due', render: fmtDate }, { title: 'Outstanding', dataIndex: 'v', align: 'right' as const, render: money }],
          data: [
            ...invoices.filter((i) => i.status !== 'Paid').map((i) => ({ type: 'Customer invoice', k: i.invoiceNo, party: i.customer, due: i.dueDate, v: Number(i.amount) + Number(i.gst) - Number(i.paid || 0) })),
            ...commissions.filter((c) => c.status === 'Receivable').map((c) => ({ type: 'Insurer commission', k: c.policyNo, party: c.insurer, due: c.dueDate, v: Number(c.amount) })),
          ],
        };
      default:
        return { columns: [], data: [] };
    }
  }, [id, leads, receipts, invoices, commissions]);

  if (!report) return <Empty>Report not found. <Link to="/crm/reports">Back to reports</Link></Empty>;
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Report" title={report.title} subtitle={report.description} crumbs="Sales › Reports" actions={<Link to="/crm/reports"><Button className="erp-ghost">All reports</Button></Link>} />
      <section className="erp-panel">
        <Table rowKey={(r: any) => `${r.k}-${r.type ?? ''}`} columns={columns as any} dataSource={data} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: 'No data for this report yet.' }} />
      </section>
    </div>
  );
}
