import { Link } from 'react-router-dom';
import { Button, Progress, Table, Tag } from 'antd';
import {
  BankOutlined, CheckCircleOutlined, ClockCircleOutlined, CustomerServiceOutlined, DollarOutlined, FileProtectOutlined,
  ProjectOutlined, RiseOutlined, SmileOutlined, SyncOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import RecordPage, { statusTag, type RecordPageConfig } from '../RecordPage';
import { collectionApi, fmtDate, inr, todayISO, useCollection, type Row } from '../store';
import { BarList, Empty, PageHeader, Panel, StatGrid } from '../ui';
import { LedgerView, type LedgerEntry } from './ledger';
import { cstClosingConfig, CstAllocation as CrmCstAllocation } from './crm';

const page = (cfg: RecordPageConfig) => function Page() { return <RecordPage {...cfg} />; };
const cstStaff = { from: 'hr_employees', filter: (r: Row) => r.department === 'Customer Success' && r.status === 'Active' };
const activeStaff = { from: 'hr_employees', filter: (r: Row) => r.status === 'Active' };
const daysTo = (d: string) => dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day');

// ═════════════════════════ CST ═════════════════════════
export function CstDashboard() {
  const { rows: renewals } = useCollection('cst_renewals');
  const { rows: customers } = useCollection('cst_customers');
  const { rows: feedback } = useCollection('cst_feedback');
  const { rows: esc } = useCollection('cst_escalations');
  const due30 = renewals.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) <= 30);
  const expired = renewals.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) < 0);
  const renewed = renewals.filter((r) => r.status === 'Renewed');
  const avg = feedback.length ? (feedback.reduce((s, f) => s + Number(f.rating || 0), 0) / feedback.length).toFixed(1) : '—';
  const closed = renewals.filter((r) => ['Renewed', 'Lost'].includes(r.status)).length;
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Customers" title="Customers Dashboard" subtitle="Policies coming up for renewal, how many customers you keep each year, and complaints still open." />
      <StatGrid stats={[
        { label: 'Policyholders', value: customers.length, hint: `${customers.filter((c) => c.health !== 'Healthy').length} need attention`, tone: 'pink', icon: <CustomerServiceOutlined />, to: '/cst/customers' },
        { label: 'Renewals due (30 days)', value: due30.length, hint: inr(due30.reduce((s, r) => s + Number(r.premium || 0), 0)), tone: 'amber', icon: <SyncOutlined />, to: '/cst/renewals' },
        { label: 'Customers kept', value: closed ? `${Math.round((renewed.length / closed) * 100)}%` : '—', hint: `${renewed.length} renewed · ${expired.length} expired unpaid`, tone: 'green', icon: <RiseOutlined />, to: '/cst/renewals?status=Renewed' },
        { label: 'Average rating', value: avg, hint: `${feedback.length} feedback`, tone: 'purple', icon: <SmileOutlined />, to: '/cst/feedback' },
      ]} />
      <div className="erp-grid-2">
        <Panel title={<><SyncOutlined /> Renewing soon</>} extra={<Link to="/cst/renewals">All →</Link>}>
          {due30.length ? (
            <ul className="erp-list">
              {[...due30].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).slice(0, 6).map((r) => {
                const d = daysTo(r.expiryDate);
                return <li key={r.id}><span><strong>{r.customer}</strong><small>{r.product} · {r.policyNo} · {r.owner}</small></span><Tag color={d < 0 ? 'red' : d <= 10 ? 'orange' : 'blue'}>{d < 0 ? `Expired ${-d}d ago` : `${d}d left`}</Tag></li>;
              })}
            </ul>
          ) : <Empty>No renewals due in the next 30 days.</Empty>}
        </Panel>
        <Panel title={<><WarningOutlined /> Open complaints</>} extra={<Link to="/cst/escalations">All →</Link>}>
          {esc.filter((e) => e.status !== 'Resolved').length
            ? <ul className="erp-list">{esc.filter((e) => e.status !== 'Resolved').map((e) => <li key={e.id}><span><strong>{e.customer}</strong><small>{e.issue}</small></span>{statusTag(e.severity, { High: 'red', Medium: 'orange', Low: 'blue' })}</li>)}</ul>
            : <Empty>No open complaints.</Empty>}
          <p className="erp-eyebrow" style={{ margin: '14px 0 8px' }}>Renewal progress</p>
          <BarList items={['Due', 'Contacted', 'Quote Sent', 'Renewed', 'Lost'].map((s) => ({ label: s, value: renewals.filter((r) => r.status === s).length, tone: s === 'Renewed' ? 'green' : s === 'Lost' ? 'slate' : 'pink', to: `/cst/renewals?status=${encodeURIComponent(s)}` }))} total={renewals.length} />
        </Panel>
      </div>
    </div>
  );
}

export const CstCustomers = page({
  collection: 'cst_customers', title: 'Customers', crumbs: 'Customers › Customers', addLabel: 'Add Policyholder', statusField: 'health', statusTabs: ['Healthy', 'Needs Attention', 'At Risk'],
  statusColors: { Healthy: 'green', 'Needs Attention': 'orange', 'At Risk': 'red' },
  subtitle: 'Customers who hold policies with you, who looks after each one, and whether they are happy.',
  fields: [
    { name: 'customerId', label: 'Customer ID', required: true, default: () => `CU-${1100 + Math.floor(Math.random() * 900)}` },
    { name: 'name', label: 'Customer', required: true }, { name: 'contact', label: 'Contact person' }, { name: 'mobile', label: 'Mobile', required: true },
    { name: 'email', label: 'Email', hideInTable: true }, { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' } },
    { name: 'policies', label: 'Policies', type: 'number', default: 1 }, { name: 'owner', label: 'CST owner', type: 'select', options: cstStaff },
    { name: 'since', label: 'Customer since', type: 'date', default: todayISO }, { name: 'health', label: 'Health', type: 'select', options: ['Healthy', 'Needs Attention', 'At Risk'], default: 'Healthy' },
  ],
});

export const CstRenewals = page({
  collection: 'cst_renewals', title: 'Renewals', crumbs: 'Customers › Renewals', addLabel: 'Add Policy to Renew', statusField: 'status', statusTabs: ['Due', 'Contacted', 'Quote Sent', 'Renewed', 'Lost'], dateField: 'expiryDate',
  subtitle: 'Policies about to expire, closest first. Click Renewed when the customer pays – the premium is added to Money › Money In.',
  sortBy: 'expiryDate',
  stats: (rows) => [
    { label: 'Already expired', value: rows.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) < 0).length, tone: 'red' },
    { label: 'Expiring this week', value: rows.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) >= 0 && daysTo(r.expiryDate) <= 7).length, tone: 'amber' },
    { label: 'Expiring this month', value: rows.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) >= 0 && daysTo(r.expiryDate) <= 30).length, tone: 'blue' },
    { label: 'Premium renewed', value: inr(rows.filter((r) => r.status === 'Renewed').reduce((s, r) => s + Number(r.premium || 0), 0)), tone: 'green' },
  ],
  rowActions: (r, api) => (['Renewed', 'Lost'].includes(r.status) ? null : (
    <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => {
      api.update(r.id, { status: 'Renewed', lastContact: todayISO() });
      collectionApi('acc_receipts').add({ receiptNo: `RC-${Date.now().toString().slice(-5)}`, date: todayISO(), customer: r.customer, against: `${r.product} renewal ${r.policyNo}`, amount: Number(r.premium) || 0, mode: 'UPI', reference: '', collectedBy: r.owner, branch: '' });
    }}>Renewed</Button>
  )),
  fields: [
    { name: 'policyNo', label: 'Policy #', required: true }, { name: 'customer', label: 'Customer', type: 'select', options: { from: 'cst_customers' }, required: true },
    { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' } }, { name: 'insurer', label: 'Insurer', type: 'select', options: { from: 'insurers' } },
    { name: 'expiryDate', label: 'Expiry', type: 'date', required: true, render: (v) => { const d = daysTo(v); return <span>{fmtDate(v)} <Tag color={d < 0 ? 'red' : d <= 10 ? 'orange' : d <= 30 ? 'blue' : 'green'}>{d < 0 ? `${-d}d ago` : `${d}d left`}</Tag></span>; } },
    { name: 'premium', label: 'Premium', type: 'money' }, { name: 'owner', label: 'Owner', type: 'select', options: cstStaff },
    { name: 'lastContact', label: 'Last contact', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: ['Due', 'Contacted', 'Quote Sent', 'Renewed', 'Lost'], default: 'Due' },
  ],
});

export const CstAllocation = CrmCstAllocation;
export const CstDayClosing = page({ ...cstClosingConfig, crumbs: 'Customers › Daily Report' });
export const CstCalls = page({
  collection: 'crm_call_updates', title: 'Calls', crumbs: 'Customers › Calls', addLabel: 'Log a Call', dateField: 'date',
  subtitle: 'Renewal reminders and service calls made to policyholders, and what happened on each call.',
  fields: [
    { name: 'company', label: 'Customer', type: 'select', options: { from: 'cst_customers' }, required: true }, { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'outcome', label: 'Outcome', type: 'select', options: { from: 'crm_call_outcomes' }, required: true }, { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'by', label: 'Called by', type: 'select', options: activeStaff },
  ],
});
export const CstFeedback = page({
  collection: 'cst_feedback', title: 'Feedback', crumbs: 'Customers › Feedback', addLabel: 'Add Feedback', dateField: 'date',
  subtitle: 'What customers said about your service. Anyone rating 3 stars or less should get a call back.',
  stats: (rows) => [
    { label: 'Responses', value: rows.length, tone: 'blue' },
    { label: 'Average rating', value: rows.length ? (rows.reduce((s, r) => s + Number(r.rating || 0), 0) / rows.length).toFixed(1) : '—', tone: 'purple' },
    { label: 'Needs follow-up', value: rows.filter((r) => Number(r.rating) <= 3).length, tone: 'red' },
  ],
  fields: [
    { name: 'customer', label: 'Customer', type: 'select', options: { from: 'cst_customers' }, required: true }, { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true, render: (v) => <span aria-label={`${v} out of 5`}>{'★'.repeat(Number(v) || 0)}{'☆'.repeat(5 - (Number(v) || 0))}</span> },
    { name: 'channel', label: 'Channel', type: 'select', options: ['Call', 'WhatsApp', 'Email', 'Visit'] }, { name: 'comments', label: 'Comments', type: 'textarea' },
    { name: 'followUp', label: 'Follow-up', type: 'select', options: ['Required', 'Not required', 'Done'], default: 'Not required' },
  ],
  validate: (v) => (Number(v.rating) < 1 || Number(v.rating) > 5 ? 'Rating must be between 1 and 5.' : null),
});
export const CstEscalations = page({
  collection: 'cst_escalations', title: 'Complaints', crumbs: 'Customers › Complaints', addLabel: 'Log a Complaint', subtitle: 'Customer problems that need fixing – claim delays, wrong details, missing documents – and who owns each one.', statusField: 'status', statusTabs: ['Open', 'In Progress', 'Resolved'], dateField: 'raisedOn',
  fields: [
    { name: 'ticketNo', label: 'Ref #', required: true, default: () => `ESC-${300 + Math.floor(Math.random() * 700)}` }, { name: 'customer', label: 'Customer', type: 'select', options: { from: 'cst_customers' }, required: true },
    { name: 'issue', label: 'Issue', required: true }, { name: 'severity', label: 'Severity', type: 'select', options: ['High', 'Medium', 'Low'], default: 'Medium', render: (v) => statusTag(v, { High: 'red', Medium: 'orange', Low: 'blue' }) },
    { name: 'owner', label: 'Owner', type: 'select', options: cstStaff }, { name: 'raisedOn', label: 'Raised on', type: 'date', default: todayISO },
    { name: 'tat', label: 'TAT' }, { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  ],
});

// ═════════════════════════ Production ═════════════════════════
export function ProductionDashboard() {
  const { rows: projects } = useCollection('prod_projects');
  const { rows: tasks } = useCollection('prod_tasks');
  const { rows: logs } = useCollection('prod_timelogs');
  const { rows: issuance } = useCollection('prod_issuance');
  const week = logs.filter((l) => daysTo(l.date) >= -7);
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Policies" title="Policies Dashboard" subtitle="Policies being issued, changes customers asked for, and how busy the team is." />
      <StatGrid stats={[
        { label: 'Active projects', value: projects.filter((p) => p.status !== 'Completed').length, hint: `${projects.length} total`, tone: 'amber', icon: <ProjectOutlined />, to: '/production/projects' },
        { label: 'Open tasks', value: tasks.filter((t) => t.status !== 'Done').length, hint: `${tasks.filter((t) => t.status !== 'Done' && t.dueDate < todayISO()).length} overdue`, tone: 'red', icon: <ClockCircleOutlined />, to: '/production/tasks' },
        { label: 'Hours this week', value: week.reduce((s, l) => s + Number(l.hours || 0), 0), hint: `${week.filter((l) => l.billable === 'Yes').reduce((s, l) => s + Number(l.hours || 0), 0)} billable`, tone: 'blue', icon: <ClockCircleOutlined />, to: '/production/time' },
        { label: 'Policies in issuance', value: issuance.filter((i) => i.stage !== 'Issued').length, hint: `${issuance.filter((i) => i.stage === 'Issued').length} issued`, tone: 'green', icon: <FileProtectOutlined />, to: '/production/issuance' },
      ]} />
      <div className="erp-grid-2">
        <Panel title="Project progress">
          <Table size="small" rowKey="id" pagination={false} dataSource={projects} columns={[
            { title: 'Project', dataIndex: 'name', render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.client} · {r.owner}</small></span> },
            { title: 'Due', dataIndex: 'dueDate', render: fmtDate },
            { title: 'Progress', dataIndex: 'progress', render: (v) => <Progress percent={Number(v) || 0} size="small" style={{ minWidth: 120 }} /> },
          ]} />
        </Panel>
        <Panel title="Policies being issued">
          <BarList items={['Proposal', 'Documents', 'Payment', 'Issued'].map((s) => ({ label: s, value: issuance.filter((i) => i.stage === s).length, tone: s === 'Issued' ? 'green' : 'amber', to: `/production/issuance?status=${s}` }))} total={issuance.length || 1} />
        </Panel>
      </div>
    </div>
  );
}
export const Projects = page({
  collection: 'prod_projects', title: 'Projects', crumbs: 'Policies › Projects', addLabel: 'Start a Project', subtitle: 'Bigger pieces of work such as a group health scheme or fleet renewal, with owner, deadline and progress.', statusField: 'status', statusTabs: ['Planned', 'In Progress', 'On Hold', 'Completed'], dateField: 'dueDate',
  statusColors: { Planned: 'default', 'On Hold': 'gold' },
  fields: [
    { name: 'name', label: 'Project', required: true }, { name: 'client', label: 'Client' }, { name: 'owner', label: 'Owner', type: 'select', options: activeStaff },
    { name: 'startDate', label: 'Start', type: 'date', default: todayISO }, { name: 'dueDate', label: 'Due', type: 'date' }, { name: 'budgetHours', label: 'Budget hours', type: 'number' },
    { name: 'progress', label: 'Progress', type: 'percent', default: 0, render: (v) => <Progress percent={Number(v) || 0} size="small" style={{ minWidth: 120 }} /> },
    { name: 'status', label: 'Status', type: 'select', options: ['Planned', 'In Progress', 'On Hold', 'Completed'], default: 'Planned' },
  ],
});
export const ProdTasks = page({
  collection: 'prod_tasks', title: 'Tasks', crumbs: 'Policies › Tasks', addLabel: 'Add Task', subtitle: 'Each job moves To Do → In Progress → Review → Done. Use the arrow button to move it along.', statusField: 'status', statusTabs: ['To Do', 'In Progress', 'Review', 'Done'], dateField: 'dueDate',
  statusColors: { Review: 'purple' },
  rowActions: (r, api) => {
    const next: Record<string, string> = { 'To Do': 'In Progress', 'In Progress': 'Review', Review: 'Done' };
    return next[r.status] ? <Button size="small" onClick={() => api.update(r.id, { status: next[r.status] })}>→ {next[r.status]}</Button> : null;
  },
  fields: [
    { name: 'title', label: 'Task', required: true }, { name: 'project', label: 'Project', type: 'select', options: { from: 'prod_projects' }, required: true },
    { name: 'assignee', label: 'Assignee', type: 'select', options: activeStaff }, { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], default: 'Medium' },
    { name: 'estimate', label: 'Estimate (h)', type: 'number' }, { name: 'dueDate', label: 'Due', type: 'date', default: todayISO },
    { name: 'status', label: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Review', 'Done'], default: 'To Do' },
  ],
});
export const TimeTracking = page({
  collection: 'prod_timelogs', title: 'Work Hours', crumbs: 'Policies › Work Hours', addLabel: 'Log Hours', subtitle: 'Hours each person spent on each project, and whether the time can be billed.', dateField: 'date',
  stats: (rows) => [
    { label: 'Hours logged', value: rows.reduce((s, r) => s + Number(r.hours || 0), 0), tone: 'blue' },
    { label: 'Billable hours', value: rows.filter((r) => r.billable === 'Yes').reduce((s, r) => s + Number(r.hours || 0), 0), tone: 'green' },
    { label: 'People', value: new Set(rows.map((r) => r.employee)).size, tone: 'purple' },
  ],
  validate: (v) => (Number(v.hours) <= 0 || Number(v.hours) > 16 ? 'Hours must be between 0 and 16.' : null),
  fields: [
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true }, { name: 'employee', label: 'Employee', type: 'select', options: activeStaff, required: true },
    { name: 'project', label: 'Project', type: 'select', options: { from: 'prod_projects' }, required: true }, { name: 'task', label: 'Task / activity' },
    { name: 'hours', label: 'Hours', type: 'number', required: true }, { name: 'billable', label: 'Billable', type: 'select', options: ['Yes', 'No'], default: 'No' },
  ],
});
export const Issuance = page({
  collection: 'prod_issuance', title: 'New Policies', crumbs: 'Policies › New Policies', addLabel: 'Add Proposal', statusField: 'stage', statusTabs: ['Proposal', 'Documents', 'Payment', 'Issued'], dateField: 'date',
  statusColors: { Proposal: 'blue', Documents: 'orange', Payment: 'purple', Issued: 'green' },
  subtitle: 'Every sold proposal moves from documents to payment to an issued policy. Add the policy number once the insurer issues it.',
  rowActions: (r, api) => {
    const next: Record<string, string> = { Proposal: 'Documents', Documents: 'Payment', Payment: 'Issued' };
    return next[r.stage] ? <Button size="small" onClick={() => api.update(r.id, { stage: next[r.stage] })}>→ {next[r.stage]}</Button> : null;
  },
  fields: [
    { name: 'proposalNo', label: 'Proposal #', required: true, default: () => `PR-${5500 + Math.floor(Math.random() * 400)}` }, { name: 'customer', label: 'Customer', required: true },
    { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' } }, { name: 'insurer', label: 'Insurer', type: 'select', options: { from: 'insurers' } },
    { name: 'premium', label: 'Premium', type: 'money' }, { name: 'handledBy', label: 'Handled by', type: 'select', options: activeStaff },
    { name: 'date', label: 'Date', type: 'date', default: todayISO }, { name: 'policyNo', label: 'Policy #' },
    { name: 'stage', label: 'Stage', type: 'select', options: ['Proposal', 'Documents', 'Payment', 'Issued'], default: 'Proposal' },
  ],
});
export const Endorsements = page({
  collection: 'prod_endorsements', title: 'Changes', crumbs: 'Policies › Changes', addLabel: 'Request a Change', subtitle: 'Changes to an existing policy – new family member, nominee, address or vehicle.', statusField: 'status', statusTabs: ['Submitted', 'Pending Docs', 'Completed'], dateField: 'requestedOn',
  statusColors: { Submitted: 'blue', 'Pending Docs': 'orange' },
  fields: [
    { name: 'policyNo', label: 'Policy #', required: true }, { name: 'customer', label: 'Customer', required: true },
    { name: 'type', label: 'Change', type: 'select', options: ['Add family member', 'Nominee change', 'Address change', 'Vehicle change', 'Name correction', 'Other'], required: true },
    { name: 'requestedOn', label: 'Requested on', type: 'date', default: todayISO }, { name: 'handledBy', label: 'Handled by', type: 'select', options: activeStaff },
    { name: 'status', label: 'Status', type: 'select', options: ['Submitted', 'Pending Docs', 'Completed'], default: 'Submitted' },
  ],
});

// ═════════════════════════ Accounts ═════════════════════════
export function AccountsDashboard() {
  const { rows: receipts } = useCollection('acc_receipts');
  const { rows: payments } = useCollection('acc_payments');
  const { rows: invoices } = useCollection('acc_invoices');
  const { rows: comm } = useCollection('acc_commissions');
  const month = dayjs().format('YYYY-MM');
  const sum = (list: Row[], f = 'amount') => list.reduce((s, r) => s + (Number(r[f]) || 0), 0);
  const mr = receipts.filter((r) => String(r.date).startsWith(month));
  const mp = payments.filter((r) => String(r.date).startsWith(month));
  const outstanding = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + Number(i.amount) + Number(i.gst) - Number(i.paid || 0), 0);
  const modes = [...new Set(receipts.map((r) => r.mode as string))];
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Money" title="Money Dashboard" subtitle={`Money in, money out and what is still owed – ${dayjs().format('MMMM YYYY')}.`} />
      <StatGrid stats={[
        { label: 'Money in this month', value: inr(sum(mr)), hint: `${mr.length} receipts`, tone: 'green', icon: <DollarOutlined />, to: '/accounts/receipts' },
        { label: 'Money out this month', value: inr(sum(mp)), hint: `${mp.length} vouchers`, tone: 'red', icon: <BankOutlined />, to: '/accounts/payments' },
        { label: 'Customers still owe', value: inr(outstanding), hint: `${invoices.filter((i) => i.status === 'Overdue').length} overdue`, tone: 'amber', icon: <WarningOutlined />, to: '/accounts/outstanding' },
        { label: 'Commission to collect', value: inr(sum(comm.filter((c) => c.status === 'Receivable'))), hint: 'From insurers', tone: 'purple', icon: <RiseOutlined />, to: '/accounts/commissions' },
      ]} />
      <div className="erp-grid-2">
        <Panel title="How customers paid">
          <BarList items={modes.map((m) => ({ label: m, value: sum(receipts.filter((r) => r.mode === m)), suffix: inr(sum(receipts.filter((r) => r.mode === m))), tone: 'green', to: '/accounts/receipts' }))} total={sum(receipts)} />
        </Panel>
        <Panel title="Latest money in" extra={<Link to="/accounts/receipts">All →</Link>}>
          <ul className="erp-list">{[...receipts].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6).map((r) => <li key={r.id}><span><strong>{r.customer}</strong><small>{r.receiptNo} · {r.mode} · {fmtDate(r.date)}</small></span><strong>{inr(r.amount)}</strong></li>)}</ul>
        </Panel>
      </div>
    </div>
  );
}
export const Receipts = page({
  collection: 'acc_receipts', title: 'Money In', crumbs: 'Money › Money In', addLabel: 'Record Payment Received', dateField: 'date',
  subtitle: 'Every payment received – premiums, fees and commission – with how it was paid.',
  stats: (rows) => [{ label: 'Payments received', value: rows.length, tone: 'blue' }, { label: 'Total received', value: inr(rows.reduce((s, r) => s + Number(r.amount || 0), 0)), tone: 'green' }],
  fields: [
    { name: 'receiptNo', label: 'Receipt #', required: true, default: () => `RC-${9100 + Math.floor(Math.random() * 900)}` }, { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'customer', label: 'Customer', required: true }, { name: 'against', label: 'Against' }, { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'mode', label: 'Mode', type: 'select', options: ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card'], required: true }, { name: 'reference', label: 'Reference / UTR' },
    { name: 'collectedBy', label: 'Collected by', type: 'select', options: activeStaff }, { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' }, hideInTable: true },
  ],
});
export const Payments = page({
  collection: 'acc_payments', title: 'Money Out', crumbs: 'Money › Money Out', addLabel: 'Record a Payment', dateField: 'date',
  subtitle: 'Premiums passed on to insurers, rent, bills and other payments from the bank.',
  stats: (rows) => [{ label: 'Payments made', value: rows.length, tone: 'blue' }, { label: 'Total paid', value: inr(rows.reduce((s, r) => s + Number(r.amount || 0), 0)), tone: 'red' }],
  fields: [
    { name: 'voucherNo', label: 'Voucher #', required: true, default: () => `PV-${7100 + Math.floor(Math.random() * 900)}` }, { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'payee', label: 'Payee', required: true }, { name: 'purpose', label: 'Purpose', required: true }, { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'mode', label: 'Mode', type: 'select', options: ['Bank Transfer', 'UPI', 'Cheque', 'Cash'], required: true }, { name: 'reference', label: 'Reference / UTR' },
    { name: 'approvedBy', label: 'Approved by', type: 'select', options: activeStaff },
  ],
});
const invoiceDue = (r: Row) => Number(r.amount || 0) + Number(r.gst || 0) - Number(r.paid || 0);
const invoiceConfig: RecordPageConfig = {
  collection: 'acc_invoices', title: 'Bills', crumbs: 'Money › Bills', addLabel: 'Raise an Invoice', statusField: 'status', statusTabs: ['Unpaid', 'Partially Paid', 'Overdue', 'Paid'], dateField: 'date',
  subtitle: 'Bills for your service fees. Premiums themselves are paid straight to the insurer.',
  rowActions: (r, api) => (r.status !== 'Paid' ? <Button size="small" onClick={() => {
    api.update(r.id, { status: 'Paid', paid: Number(r.amount) + Number(r.gst) });
    collectionApi('acc_receipts').add({ receiptNo: `RC-${Date.now().toString().slice(-5)}`, date: todayISO(), customer: r.customer, against: r.invoiceNo, amount: invoiceDue(r), mode: 'Bank Transfer', reference: '', collectedBy: '', branch: '' });
  }}>Mark paid</Button> : null),
  fields: [
    { name: 'invoiceNo', label: 'Invoice #', required: true, default: () => `INV-${dayjs().year()}-${300 + Math.floor(Math.random() * 600)}` }, { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'customer', label: 'Customer', required: true }, { name: 'description', label: 'Description', hideInTable: true },
    { name: 'amount', label: 'Amount', type: 'money', required: true }, { name: 'gst', label: 'GST', type: 'money', default: 0 },
    { name: 'paid', label: 'Paid', type: 'money', default: 0 }, { name: 'balance', label: 'Balance', hideInForm: true, render: (_v, r) => <strong>{inr(invoiceDue(r))}</strong> },
    { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['Unpaid', 'Partially Paid', 'Overdue', 'Paid'], default: 'Unpaid' },
  ],
};
export const Invoices = page(invoiceConfig);
export const Outstanding = page({
  ...invoiceConfig, title: 'Pending', crumbs: 'Money › Pending', canAdd: false, statusTabs: ['Unpaid', 'Partially Paid', 'Overdue'],
  subtitle: 'Invoices customers have not fully paid, oldest first.', rowFilter: (r) => r.status !== 'Paid', sortBy: 'dueDate',
  stats: (rows) => [
    { label: 'Still to collect', value: inr(rows.reduce((s, r) => s + invoiceDue(r), 0)), tone: 'amber' },
    { label: 'Past due date', value: rows.filter((r) => r.dueDate && r.dueDate < todayISO()).length, tone: 'red' },
    { label: 'Invoices', value: rows.length, tone: 'blue' },
  ],
});
export const Commissions = page({
  collection: 'acc_commissions', title: 'Commission', crumbs: 'Money › Commission', addLabel: 'Add Commission', statusField: 'status', statusTabs: ['Receivable', 'Received'], dateField: 'dueDate',
  subtitle: 'Commission you earned on policies sold, and whether the insurer has paid it yet.',
  rowActions: (r, api) => (r.status === 'Receivable' ? <Button size="small" onClick={() => {
    api.update(r.id, { status: 'Received' });
    collectionApi('acc_receipts').add({ receiptNo: `RC-${Date.now().toString().slice(-5)}`, date: todayISO(), customer: r.insurer, against: `Commission ${r.policyNo}`, amount: Number(r.amount) || 0, mode: 'Bank Transfer', reference: '', collectedBy: '', branch: '' });
  }}>Mark received</Button> : null),
  stats: (rows) => [
    { label: 'To collect', value: inr(rows.filter((r) => r.status === 'Receivable').reduce((s, r) => s + Number(r.amount || 0), 0)), tone: 'amber' },
    { label: 'Received', value: inr(rows.filter((r) => r.status === 'Received').reduce((s, r) => s + Number(r.amount || 0), 0)), tone: 'green' },
  ],
  fields: [
    { name: 'insurer', label: 'Insurer', type: 'select', options: { from: 'insurers' }, required: true }, { name: 'policyNo', label: 'Policy #', required: true },
    { name: 'customer', label: 'Customer' }, { name: 'product', label: 'Product', type: 'select', options: { from: 'crm_products' } },
    { name: 'premium', label: 'Premium', type: 'money', required: true }, { name: 'rate', label: 'Rate', type: 'percent', required: true },
    { name: 'amount', label: 'Commission', type: 'money', hideInForm: true, render: (_v, r) => inr(Math.round((Number(r.premium) * Number(r.rate)) / 100)) },
    { name: 'dueDate', label: 'Due', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['Receivable', 'Received'], default: 'Receivable' },
  ],
  onSaved: (row) => collectionApi('acc_commissions').update(row.id, { amount: Math.round((Number(row.premium) * Number(row.rate)) / 100) }),
});
export const BankAccounts = page({
  collection: 'acc_bank_accounts', title: 'Bank', crumbs: 'Money › Bank', addLabel: 'Add Bank Account',
  subtitle: 'Company bank accounts. For safety, store only the last four digits of each account number.',
  fields: [
    { name: 'name', label: 'Account name', required: true }, { name: 'bank', label: 'Bank', required: true }, { name: 'accountNo', label: 'Account (last 4)', required: true },
    { name: 'ifsc', label: 'IFSC' }, { name: 'type', label: 'Type', type: 'select', options: ['Current', 'Savings', 'OD'], default: 'Current' }, { name: 'openingBalance', label: 'Opening balance', type: 'money' },
  ],
  validate: (v) => (/\d{6,}/.test(String(v.accountNo)) ? 'Enter only a masked number such as XXXX1234.' : null),
});

/** Day book combining receipts, payments and petty cash into one running-balance ledger. */
export function DayBook() {
  const { rows: receipts } = useCollection('acc_receipts');
  const { rows: payments } = useCollection('acc_payments');
  const { rows: petty } = useCollection('hr_petty_cash');
  const entries: LedgerEntry[] = [
    ...receipts.map((r) => ({ id: `r-${r.id}`, date: r.date, category: 'Receipt', voucher: r.receiptNo, party: r.customer, narration: r.against, debit: 0, credit: Number(r.amount) || 0, ledger: 'Bank', editable: false })),
    ...payments.map((p) => ({ id: `p-${p.id}`, date: p.date, category: 'Payment', voucher: p.voucherNo, party: p.payee, narration: p.purpose, debit: Number(p.amount) || 0, credit: 0, ledger: 'Bank', editable: false })),
    ...(petty as unknown as LedgerEntry[]).map((e) => ({ ...e, id: `c-${e.id}`, editable: false })),
  ];
  return <LedgerView eyebrow="Money" title="All Entries" subtitle="Every rupee in and out – bank and office cash – in date order with a running balance. Add entries from Money In, Money Out or the Cash page." entries={entries} ledgers={['Bank', 'Office Cash', 'Office Upkeep']} />;
}
