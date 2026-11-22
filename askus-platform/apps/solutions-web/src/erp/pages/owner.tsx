import { Link, useNavigate } from 'react-router-dom';
import { Button, Table, Tag } from 'antd';
import {
  ApartmentOutlined, ArrowRightOutlined, BankOutlined, BranchesOutlined, CalendarOutlined, ClockCircleOutlined,
  ContactsOutlined, DollarOutlined, FlagOutlined, HomeOutlined, IdcardOutlined, LaptopOutlined, PhoneOutlined,
  SettingOutlined, ShopOutlined, TagsOutlined, TeamOutlined, ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fmtDate, inr, todayISO, useCollection, type Row } from '../store';
import { ERP_MODULES } from '../modules';
import { HubGrid, PageHeader, Panel, StatGrid, type HubCard } from '../ui';

const month = () => dayjs().format('YYYY-MM');
const sum = (rows: Row[], f: string) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
const inMonth = (d: unknown) => String(d ?? '').startsWith(month());
const daysTo = (d: string) => dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day');

/** Everything waiting on an approver, from every area. Shared by the snapshot and the inbox. */
function usePending() {
  const leave = useCollection('hr_leave_requests').rows.filter((r) => r.status === 'Pending');
  const perms = useCollection('hr_permission_requests').rows.filter((r) => r.status === 'Pending');
  const field = useCollection('hr_outside_requests').rows.filter((r) => r.status === 'Pending');
  const expenses = useCollection('hr_expenses').rows.filter((r) => r.status === 'Pending');
  const discounts = useCollection('crm_price_requests').rows.filter((r) => r.status === 'Pending');
  const salesReports = useCollection('crm_day_closing').rows.filter((r) => r.status === 'Pending');
  const careReports = useCollection('crm_cst_day_closing').rows.filter((r) => r.status === 'Pending');
  const items = [
    ...leave.map((r) => ({ id: `l-${r.id}`, area: 'HRMS', kind: 'Leave request', who: r.employee, detail: `${r.leaveType}: ${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}`, date: r.appliedOn ?? r.fromDate, amount: null, to: '/hrms/leave?status=Pending' })),
    ...perms.map((r) => ({ id: `p-${r.id}`, area: 'HRMS', kind: 'Short permission', who: r.employee, detail: `${r.hours} hour(s) – ${r.reason}`, date: r.date, amount: null, to: '/hrms/leave/permissions?status=Pending' })),
    ...field.map((r) => ({ id: `f-${r.id}`, area: 'HRMS', kind: 'Field check-in', who: r.employee, detail: `${r.type} at ${r.location}`, date: r.date, amount: null, to: '/hrms/outside-office?status=Pending' })),
    ...expenses.map((r) => ({ id: `e-${r.id}`, area: 'HRMS', kind: 'Expense claim', who: r.applicant, detail: `${r.category} – step ${r.stage} of 3`, date: r.date, amount: r.amount, to: '/hrms/expenses?status=Pending' })),
    ...discounts.map((r) => ({ id: `d-${r.id}`, area: 'CRM', kind: 'Discount', who: r.requestedBy, detail: `${r.company} – ${inr(r.originalPrice)} → ${inr(r.requestedPrice)}`, date: r.date, amount: Number(r.originalPrice) - Number(r.requestedPrice), to: '/crm/price-requests?status=Pending' })),
    ...salesReports.map((r) => ({ id: `s-${r.id}`, area: 'CRM', kind: 'Daily sales report', who: r.employee, detail: `${r.calls} calls, ${r.converted} closed`, date: r.date, amount: r.collection, to: '/crm/day-closing?status=Pending' })),
    ...careReports.map((r) => ({ id: `c-${r.id}`, area: 'CST', kind: 'Daily care report', who: r.employee, detail: `${r.renewed} renewed`, date: r.date, amount: r.collection, to: '/cst/day-closing?status=Pending' })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return items;
}

const AREA_TONE: Record<string, string> = { HRMS: 'purple', CRM: 'cyan', CST: 'magenta' };

export function BusinessSnapshot() {
  const leads = useCollection('crm_leads').rows;
  const renewals = useCollection('cst_renewals').rows;
  const complaints = useCollection('cst_escalations').rows;
  const emps = useCollection('hr_employees').rows;
  const att = useCollection('hr_attendance').rows;
  const receipts = useCollection('acc_receipts').rows;
  const payments = useCollection('acc_payments').rows;
  const invoices = useCollection('acc_invoices').rows;
  const issuance = useCollection('prod_issuance').rows;
  const pending = usePending();

  const active = emps.filter((e) => e.status === 'Active');
  const presentToday = att.filter((a) => a.date === todayISO() && ['Present', 'Half Day'].includes(a.status)).length;
  const monthLeads = leads.filter((l) => inMonth(l.leadDate));
  const won = leads.filter((l) => l.status === 'Won');
  const due30 = renewals.filter((r) => !['Renewed', 'Lost'].includes(r.status) && daysTo(r.expiryDate) <= 30);
  const moneyIn = sum(receipts.filter((r) => inMonth(r.date)), 'amount');
  const moneyOut = sum(payments.filter((r) => inMonth(r.date)), 'amount');
  const dues = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + Number(i.amount) + Number(i.gst) - Number(i.paid || 0), 0);

  const areas: { id: string; numbers: { label: string; value: React.ReactNode }[]; to: string }[] = [
    { id: 'crm', to: '/crm/dashboard', numbers: [
      { label: 'New enquiries this month', value: monthLeads.length },
      { label: 'Open pipeline', value: inr(sum(leads.filter((l) => !['Won', 'Lost'].includes(l.status)), 'dealValue')) },
      { label: 'Policies won', value: won.length },
    ] },
    { id: 'cst', to: '/cst/dashboard', numbers: [
      { label: 'Renewals due in 30 days', value: due30.length },
      { label: 'Premium at stake', value: inr(sum(due30, 'premium')) },
      { label: 'Open complaints', value: complaints.filter((c) => c.status !== 'Resolved').length },
    ] },
    { id: 'production', to: '/production/dashboard', numbers: [
      { label: 'Proposals in progress', value: issuance.filter((i) => i.stage !== 'Issued').length },
      { label: 'Policies issued', value: issuance.filter((i) => i.stage === 'Issued').length },
      { label: 'Waiting for payment', value: issuance.filter((i) => i.stage === 'Payment').length },
    ] },
    { id: 'hrms', to: '/hrms/dashboard', numbers: [
      { label: 'Active staff', value: active.length },
      { label: 'In office today', value: presentToday },
      { label: 'Monthly salary bill', value: inr(sum(active, 'salary')) },
    ] },
    { id: 'accounts', to: '/accounts/dashboard', numbers: [
      { label: 'Money in this month', value: inr(moneyIn) },
      { label: 'Money out this month', value: inr(moneyOut) },
      { label: 'Customer dues', value: inr(dues) },
    ] },
  ];

  return (
    <div className="erp-page">
      <PageHeader eyebrow="Owner" title={`Good ${dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}`} subtitle={`Here is how the agency is doing on ${dayjs().format('dddd, D MMMM YYYY')}. Click any card to open it.`}
        actions={<Link to="/owner/approvals"><Button type="primary">Approvals ({pending.length})</Button></Link>} />
      <StatGrid stats={[
        { label: 'Need your approval', value: pending.length, hint: 'Leave, discounts, expenses, reports', tone: 'red', icon: <FlagOutlined />, to: '/owner/approvals' },
        { label: 'Money in this month', value: inr(moneyIn), hint: `Out: ${inr(moneyOut)}`, tone: 'green', icon: <BankOutlined />, to: '/accounts/receipts' },
        { label: 'Renewals due (30 days)', value: due30.length, hint: inr(sum(due30, 'premium')), tone: 'pink', icon: <CalendarOutlined />, to: '/cst/renewals' },
        { label: 'Staff in today', value: `${presentToday} / ${active.length}`, hint: 'Marked present', tone: 'purple', icon: <TeamOutlined />, to: '/hrms/attendance' },
      ]} />
      <div className="owner-areas">
        {areas.map((a) => {
          const m = ERP_MODULES.find((x) => x.id === a.id)!;
          return (
            <Link key={a.id} to={a.to} className={`owner-area tone-${m.tone}`}>
              <div className="owner-area-head">
                <span className="owner-area-icon" aria-hidden>{m.icon}</span>
                <div><h3>{m.label}</h3><span>{m.audience}</span></div>
              </div>
              <p>{m.purpose}</p>
              <dl>{a.numbers.map((n) => <div key={n.label}><dt>{n.label}</dt><dd>{n.value}</dd></div>)}</dl>
              <span className="owner-area-cta">Open {m.label} <ArrowRightOutlined aria-hidden /></span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ApprovalsInbox() {
  const items = usePending();
  const navigate = useNavigate();
  const areas = [...new Set(items.map((i) => i.area))];
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Owner" title="Approvals" subtitle="Everything waiting for your yes or no. Click Review to approve or reject." />
      <StatGrid stats={areas.map((a) => ({ label: a, value: items.filter((i) => i.area === a).length, hint: 'waiting', tone: (a === 'HRMS' ? 'purple' : a === 'CRM' ? 'teal' : 'pink') as never }))} />
      <section className="erp-panel">
        <Table rowKey="id" dataSource={items} pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} locale={{ emptyText: 'Nothing is waiting for approval. 🎉' }}
          onRow={(r) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(r.to) })}
          columns={[
            { title: 'Area', dataIndex: 'area', render: (v) => <Tag color={AREA_TONE[v]}>{v}</Tag> },
            { title: 'Request', dataIndex: 'kind', render: (v) => <strong>{v}</strong> },
            { title: 'From', dataIndex: 'who' },
            { title: 'Details', dataIndex: 'detail' },
            { title: 'Date', dataIndex: 'date', render: fmtDate },
            { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v) => (v == null ? '—' : inr(v)) },
            { title: '', key: 'go', render: (_, r) => <Link to={r.to} onClick={(e) => e.stopPropagation()}><Button size="small" type="primary">Review</Button></Link> },
          ]} />
      </section>
    </div>
  );
}

export function SetupHome() {
  const group = (title: string, note: string, cards: HubCard[]) => (
    <section className="setup-group">
      <div className="setup-group-head"><h2>{title}</h2><p>{note}</p></div>
      <HubGrid cards={cards} />
    </section>
  );
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Settings" title="Settings" subtitle="Set these up once. All other apps use them." />
      {group('Company', 'Your offices and team structure.', [
        { title: 'Branches', description: 'Offices that enquiries, staff and reports are grouped by.', to: '/setup/branches', icon: <BranchesOutlined />, tone: 'blue', cta: 'Edit branches' },
        { title: 'Departments', description: 'Teams such as Sales, Operations and Accounts.', to: '/setup/departments', icon: <ApartmentOutlined />, tone: 'teal', cta: 'Edit departments' },
        { title: 'Job Titles', description: 'Titles shown on staff profiles and payslips.', to: '/setup/designations', icon: <IdcardOutlined />, tone: 'purple', cta: 'Edit job titles' },
      ])}
      {group('CRM', 'Choices your sales team picks from when recording an enquiry.', [
        { title: 'Products', description: 'What you sell, with starting premium and commission rate.', to: '/setup/products', icon: <TagsOutlined />, tone: 'teal', cta: 'Edit products' },
        { title: 'Sources', description: 'Where customers find you – referral, website, events.', to: '/setup/sources', icon: <ShopOutlined />, tone: 'amber', cta: 'Edit sources' },
        { title: 'Stages', description: 'The steps an enquiry moves through until it is won or lost.', to: '/setup/stages', icon: <FlagOutlined />, tone: 'red', cta: 'Edit stages' },
        { title: 'Call Results', description: 'Standard results to pick after every customer call.', to: '/setup/call-outcomes', icon: <PhoneOutlined />, tone: 'pink', cta: 'Edit outcomes' },
      ])}
      {group('HRMS', 'How time off, permissions and late arrivals affect salary.', [
        { title: 'Leave Types', description: 'Kinds of leave, days allowed per year and whether they are paid.', to: '/setup/leave-types', icon: <CalendarOutlined />, tone: 'green', cta: 'Edit leave types' },
        { title: 'Leave Rules', description: 'Paid leave allowed per month and the weekly off day.', to: '/setup/leave-rules', icon: <SettingOutlined />, tone: 'purple', cta: 'Edit leave rules' },
        { title: 'Permission Rules', description: 'Short permissions allowed per month before pay is cut.', to: '/setup/permission-rules', icon: <ClockCircleOutlined />, tone: 'blue', cta: 'Edit permission rules' },
        { title: 'Office Timing', description: 'Office timing, grace minutes and the late-arrival policy.', to: '/setup/attendance-rules', icon: <ClockCircleOutlined />, tone: 'red', cta: 'Edit attendance rules' },
      ])}
      {group('Office', 'Categories for claims, cash spending and office assets.', [
        { title: 'Expense Types', description: 'Petrol, travel, food and other claim types with monthly limits.', to: '/setup/expense-categories', icon: <DollarOutlined />, tone: 'amber', cta: 'Edit categories' },
        { title: 'Asset Types', description: 'Laptops, phones, furniture and vehicles you track.', to: '/setup/asset-categories', icon: <LaptopOutlined />, tone: 'purple', cta: 'Edit categories' },
        { title: 'Repair Types', description: 'Things that need servicing – AC, generator, internet.', to: '/setup/facility-titles', icon: <ToolOutlined />, tone: 'teal', cta: 'Edit facility types' },
        { title: 'Cleaning Jobs', description: 'Daily and weekly cleaning jobs for the office.', to: '/setup/cleaning-tasks', icon: <HomeOutlined />, tone: 'slate', cta: 'Edit cleaning tasks' },
      ])}
      <p className="erp-muted" style={{ fontSize: 13 }}><ContactsOutlined /> Staff, customers and enquiries are added in their own apps.</p>
    </div>
  );
}
