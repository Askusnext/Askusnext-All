import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import {
  AlertOutlined, BranchesOutlined, CalendarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, DollarOutlined, EnvironmentOutlined, FieldTimeOutlined, GiftOutlined,
  HomeOutlined, IdcardOutlined, LaptopOutlined, LoginOutlined, LogoutOutlined, ScheduleOutlined, SettingOutlined,
  SolutionOutlined, TeamOutlined, ToolOutlined, UserDeleteOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import RecordPage, { statusTag, type FieldDef, type RecordPageConfig } from '../RecordPage';
import { collectionApi, downloadCsv, fmtDate, getCollection, inr, todayISO, useCollection, type Row } from '../store';
import { Empty, HubGrid, PageHeader, Panel, StatGrid } from '../ui';
import { computePayslip, leaveBalance, leaveDays, lopFor, validateLeave, workingDates, type LeaveType } from '../hr-logic';
import { LedgerView, type LedgerEntry } from './ledger';
import { useAppSelector } from '../../store';
import { isAdminRole } from '../../access';

const page = (cfg: RecordPageConfig) => function Page() { return <RecordPage {...cfg} />; };
const activeStaff = { from: 'hr_employees', filter: (r: Row) => r.status === 'Active' };
const one = (key: string) => getCollection(key)[0] ?? {};

/** Everything the LOP calculation needs, kept live. */
function useHrData() {
  const attendance = useCollection('hr_attendance').rows;
  const leaves = useCollection('hr_leave_requests').rows;
  const types = useCollection('hr_leave_types').rows as unknown as LeaveType[];
  const permissions = useCollection('hr_permission_requests').rows;
  const leaveSettings = useCollection('hr_leave_settings').rows[0] ?? { monthlyPaidLeave: 1.5, weekOff: 'Sunday' };
  const permissionSettings = useCollection('hr_permission_settings').rows[0] ?? { monthlyCount: 2, maxHoursPerDay: 2, hoursPerLopDay: 8 };
  const rules = useCollection('hr_attendance_rules').rows[0] ?? { lateMarksPerHalfDay: 3 };
  const holidays = useCollection('hr_holidays').rows.map((h) => h.date as string);
  return { attendance, leaves, types, permissions, leaveSettings, permissionSettings, rules, holidays } as any;
}

// ───────────────────────── Dashboard ─────────────────────────
export function HrmsDashboard() {
  const { rows: emps } = useCollection('hr_employees');
  const { rows: att } = useCollection('hr_attendance');
  const { rows: outside } = useCollection('hr_outside_requests');
  const { rows: leaves } = useCollection('hr_leave_requests');
  const { rows: interviews } = useCollection('hr_interviews');
  const { rows: notices } = useCollection('hr_announcements');
  const { rows: expenses } = useCollection('hr_expenses');
  const today = todayISO();
  const active = emps.filter((e) => e.status === 'Active');
  const staff = active.filter((e) => e.type === 'Employee');
  const interns = active.filter((e) => e.type === 'Intern');
  const todays = att.filter((a) => a.date === today);
  const onLeave = new Set(leaves.filter((l) => l.status === 'Approved' && l.fromDate <= today && l.toDate >= today).map((l) => l.employee));
  const present = todays.filter((a) => a.status !== 'Absent').length;
  const late = todays.filter((a) => Number(a.lateMinutes) > 0).length;
  const pendingOutside = outside.filter((o) => o.status === 'Pending').length;
  const mmdd = (d: string) => String(d ?? '').slice(5);
  const within = (d: string, days: number) => {
    const target = dayjs(`${dayjs().year()}-${mmdd(d)}`);
    const diff = target.diff(dayjs().startOf('day'), 'day');
    return diff >= 0 && diff <= days;
  };
  const birthdays = active.filter((e) => e.dob && within(e.dob, 30)).sort((a, b) => mmdd(a.dob).localeCompare(mmdd(b.dob)));
  const workAnniv = active.filter((e) => e.joinDate && dayjs(e.joinDate).year() < dayjs().year() && within(e.joinDate, 30));

  return (
    <div className="erp-page">
      <PageHeader eyebrow="HRMS" title="HRMS Dashboard" subtitle="Who is in today, what is waiting for approval, and birthdays and work anniversaries coming up." />
      {pendingOutside > 0 && (
        <div className="erp-banner">
          <div><strong><EnvironmentOutlined /> {pendingOutside} field check-in(s) to approve</strong><span>Staff working away from the office have asked you to confirm their attendance.</span></div>
          <Link to="/hrms/outside-office"><Button type="primary">Approve now</Button></Link>
        </div>
      )}
      <StatGrid solid stats={[
        { label: 'Team size', value: active.length, hint: `${staff.length} staff · ${interns.length} trainees`, tone: 'blue', icon: <TeamOutlined />, to: '/hrms/employees' },
        { label: 'In today', value: present, hint: 'Marked present', tone: 'green', icon: <CheckCircleOutlined />, to: '/hrms/attendance' },
        { label: 'Came in late', value: late, hint: 'After grace time', tone: 'amber', icon: <ClockCircleOutlined />, to: '/hrms/attendance' },
        { label: 'Not in today', value: Math.max(0, staff.length - present - onLeave.size), hint: `${onLeave.size} on approved leave`, tone: 'red', icon: <CloseCircleOutlined />, to: '/hrms/attendance' },
        { label: 'Trainees', value: interns.length, hint: 'On internship', tone: 'purple', icon: <SolutionOutlined />, to: '/hrms/interns' },
        { label: 'Left the company', value: emps.filter((e) => e.status === 'Resigned').length, hint: 'Former staff', tone: 'pink', icon: <UserDeleteOutlined />, to: '/hrms/employees?status=Resigned' },
      ]} />
      <div className="erp-grid-3">
        <Panel title={<><GiftOutlined /> Celebrations</>}>
          <p className="erp-eyebrow" style={{ marginBottom: 8 }}>Birthdays (next 30 days)</p>
          {birthdays.length ? <ul className="erp-list">{birthdays.map((e) => <li key={e.id}><span><strong>{e.name}</strong><small>{e.designation}</small></span><Tag color={mmdd(e.dob) === mmdd(today) ? 'magenta' : 'default'}>{mmdd(e.dob) === mmdd(today) ? 'Today 🎂' : dayjs(`${dayjs().year()}-${mmdd(e.dob)}`).format('DD MMM')}</Tag></li>)}</ul> : <Empty>No birthdays soon</Empty>}
          <p className="erp-eyebrow" style={{ margin: '14px 0 8px' }}>Work anniversaries</p>
          {workAnniv.length ? <ul className="erp-list">{workAnniv.map((e) => <li key={e.id}><strong>{e.name}</strong><small>{dayjs().year() - dayjs(e.joinDate).year()} yr · {dayjs(e.joinDate).format('DD MMM')}</small></li>)}</ul> : <Empty>No work anniversaries soon</Empty>}
        </Panel>
        <Panel title={<><ScheduleOutlined /> Upcoming interviews</>} extra={<Link to="/hrms/recruitment/interviews">All →</Link>}>
          {interviews.filter((i) => i.status === 'Scheduled').length
            ? <ul className="erp-list">{interviews.filter((i) => i.status === 'Scheduled').map((i) => <li key={i.id}><span><strong>{i.candidate}</strong><small>{i.position} · {i.interviewer}</small></span><small>{fmtDate(i.date)} {i.time}</small></li>)}</ul>
            : <Empty>No interviews scheduled.</Empty>}
        </Panel>
        <Panel title={<><AlertOutlined /> Needs your approval</>}>
          <ul className="erp-list">
            <li><Link to="/hrms/leave">Leave requests</Link><Tag color="gold">{leaves.filter((l) => l.status === 'Pending').length}</Tag></li>
            <li><Link to="/hrms/outside-office">Field check-ins</Link><Tag color="gold">{pendingOutside}</Tag></li>
            <li><Link to="/hrms/expenses">Expense claims</Link><Tag color="gold">{expenses.filter((e) => e.status === 'Pending').length}</Tag></li>
            <li><Link to="/hrms/leave/permissions">Short permissions</Link><Tag color="gold">{getCollection('hr_permission_requests').filter((p) => p.status === 'Pending').length}</Tag></li>
          </ul>
          <p className="erp-eyebrow" style={{ margin: '14px 0 8px' }}>Latest notice</p>
          {notices[0] ? <p><strong>{notices[0].title}</strong><br /><small className="erp-muted">{notices[0].message}</small></p> : <Empty>No notices yet.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── Setup lists (shown under Setup) ─────────────────────────
const master = (collection: string, title: string, fields: FieldDef[]) => page({ collection, title, crumbs: 'Settings', eyebrow: 'Settings', fields, addLabel: `Add ${title.replace(/s$/, '')}` });
export const Departments = master('hr_departments', 'Departments', [{ name: 'name', label: 'Department', required: true }, { name: 'head', label: 'Head', type: 'select', options: activeStaff }, { name: 'description', label: 'Description' }]);
export const Designations = master('hr_designations', 'Job Titles', [{ name: 'name', label: 'Job title', required: true }]);
export const LeaveTypes = master('hr_leave_types', 'Leave Types', [
  { name: 'name', label: 'Leave type', required: true }, { name: 'code', label: 'Code' },
  { name: 'annualQuota', label: 'Days per year', type: 'number', required: true, default: 12 },
  { name: 'paid', label: 'Paid / Unpaid', type: 'select', options: ['Paid', 'Unpaid'], default: 'Paid', render: (v) => <Tag color={v === 'Paid' ? 'green' : 'red'}>{v}</Tag> },
  { name: 'carryForward', label: 'Carry forward', type: 'select', options: ['Yes', 'No'], default: 'No' },
  { name: 'maxConsecutive', label: 'Max consecutive days', type: 'number' },
]);
export const FacilityTitles = master('hr_facility_titles', 'Repair Types', [{ name: 'name', label: 'Facility type', required: true }]);
export const AssetCategories = master('hr_asset_categories', 'Asset Types', [{ name: 'name', label: 'Category', required: true }]);
export const ExpenseCategories = master('hr_expense_categories', 'Expense Types', [{ name: 'name', label: 'Category', required: true }, { name: 'monthlyLimit', label: 'Monthly limit per employee', type: 'money' }]);
export const CleaningCategories = master('hr_cleaning_categories', 'Cleaning Jobs', [{ name: 'name', label: 'Task', required: true }, { name: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' }]);
export const Holidays = page({ collection: 'hr_holidays', title: 'Holidays', crumbs: 'HRMS › Leave', addLabel: 'Add Holiday', dateField: 'date', fields: [{ name: 'name', label: 'Holiday', required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Public', 'Optional', 'Branch'], default: 'Public' }], subtitle: 'Office holidays for the year. They are not counted as leave days or pay cuts.' });

function SettingsForm({ collection, title, subtitle, fields }: { collection: string; title: string; subtitle: string; fields: { name: string; label: string; help?: string; type?: 'number' | 'time' | 'select'; options?: string[]; step?: number }[] }) {
  const { rows, update, add } = useCollection(collection);
  const [form] = Form.useForm();
  const current = rows[0];
  useEffect(() => { form.setFieldsValue(current ?? {}); }, [current, form]);
  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    if (current) update(current.id, v); else add(v);
    message.success(`${title} updated`);
  };
  return (
    <div className="erp-page">
      <PageHeader eyebrow="Settings" title={title} subtitle={subtitle} crumbs="Settings › HRMS" actions={<Button type="primary" onClick={save}>Save changes</Button>} />
      <Panel title="Rules">
        <Form form={form} layout="vertical" className="erp-form-grid" style={{ maxWidth: 760 }}>
          {fields.map((f) => (
            <Form.Item key={f.name} name={f.name} label={f.label} extra={f.help} rules={[{ required: true }]}>
              {f.type === 'select' ? <Select options={f.options!.map((o) => ({ value: o, label: o }))} />
                : f.type === 'time' ? <Input type="time" /> : <InputNumber min={0} step={f.step ?? 1} style={{ width: '100%' }} />}
            </Form.Item>
          ))}
        </Form>
      </Panel>
    </div>
  );
}
export const LeaveSettings = () => <SettingsForm collection="hr_leave_settings" title="Leave Rules" subtitle="Paid leave beyond the monthly allowance is cut from salary automatically in Salary Cuts and Salary." fields={[
  { name: 'monthlyPaidLeave', label: 'Monthly paid leave allowance (days)', type: 'number', step: 0.5, help: 'Paid leave beyond this in a month is cut from salary.' },
  { name: 'weekOff', label: 'Weekly off', type: 'select', options: ['Sunday', 'Saturday', 'Monday', 'Friday'] },
  { name: 'sandwichRule', label: 'Sandwich rule (count week-off between leaves)', type: 'select', options: ['No', 'Yes'] },
  { name: 'countSaturdayHalf', label: 'Saturday is a half day', type: 'select', options: ['No', 'Yes'] },
]} />;
export const PermissionSettings = () => <SettingsForm collection="hr_permission_settings" title="Permission Rules" subtitle="Short permissions within these limits are free. Anything beyond them is counted as a pay cut." fields={[
  { name: 'monthlyCount', label: 'Permissions allowed per month', type: 'number' },
  { name: 'maxHoursPerDay', label: 'Max hours per permission', type: 'number', step: 0.5 },
  { name: 'excessToLop', label: 'Cut pay for extra permissions', type: 'select', options: ['Yes', 'No'] },
  { name: 'hoursPerLopDay', label: 'Hours that equal one day’s pay cut', type: 'number' },
]} />;
export const AttendanceRules = () => <SettingsForm collection="hr_attendance_rules" title="Office Timing" subtitle="Office timing and how late arrivals affect pay." fields={[
  { name: 'shiftStart', label: 'Shift start', type: 'time' }, { name: 'shiftEnd', label: 'Shift end', type: 'time' },
  { name: 'graceMinutes', label: 'Grace minutes', type: 'number' }, { name: 'halfDayHours', label: 'Minimum hours for half day', type: 'number' },
  { name: 'fullDayHours', label: 'Minimum hours for full day', type: 'number' }, { name: 'lateMarksPerHalfDay', label: 'Late arrivals that cost ½ day pay', type: 'number' },
]} />;

// ───────────────────────── People ─────────────────────────
const PERSON_FIELDS: FieldDef[] = [
  { name: 'code', label: 'Employee ID', required: true, width: 110 },
  { name: 'name', label: 'Name', required: true, render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.designation}</small></span> },
  { name: 'designation', label: 'Designation', type: 'select', options: { from: 'hr_designations' }, hideInTable: true },
  { name: 'department', label: 'Department', type: 'select', options: { from: 'hr_departments' }, required: true },
  { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' }, required: true },
  { name: 'mobile', label: 'Mobile', required: true },
  { name: 'email', label: 'Email', hideInTable: true },
  { name: 'joinDate', label: 'Date of joining', type: 'date', required: true, default: todayISO },
  { name: 'dob', label: 'Date of birth', type: 'date', hideInTable: true },
  { name: 'salary', label: 'Monthly gross', type: 'money', required: true },
  { name: 'reportingTo', label: 'Reports to', type: 'select', options: activeStaff, hideInTable: true },
  { name: 'type', label: 'Type', type: 'select', options: ['Employee', 'Intern'], default: 'Employee', hideInTable: true },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Resigned'], default: 'Active' },
];
export const Employees = page({
  collection: 'hr_employees', title: 'Staff List', crumbs: 'HRMS › Staff List', addLabel: 'Add Staff Member', statusField: 'status', statusTabs: ['Active', 'Resigned'],
  subtitle: 'Everyone on the payroll – their role, branch, salary and contact details.', fields: PERSON_FIELDS, rowFilter: (r) => r.type !== 'Intern',
  stats: (rows) => [
    { label: 'Current staff', value: rows.filter((r) => r.status === 'Active').length, tone: 'blue' },
    { label: 'Departments', value: new Set(rows.map((r) => r.department)).size, tone: 'teal' },
    { label: 'Monthly salary bill', value: inr(rows.filter((r) => r.status === 'Active').reduce((s, r) => s + Number(r.salary || 0), 0)), tone: 'purple' },
    { label: 'Former staff', value: rows.filter((r) => r.status === 'Resigned').length, tone: 'slate' },
  ],
  validate: (v, all, editing) => (all.some((r) => r.code === v.code && r.id !== editing?.id) ? 'This staff ID is already used.' : null),
});
export const Interns = page({
  collection: 'hr_employees', title: 'Interns', crumbs: 'HRMS › Interns', addLabel: 'Add Trainee', statusField: 'status', statusTabs: ['Active', 'Resigned'],
  subtitle: 'Interns and trainees – their college, monthly stipend and when the internship ends.', rowFilter: (r) => r.type === 'Intern',
  fields: [
    ...PERSON_FIELDS.filter((f) => !['salary', 'type'].includes(f.name)),
    { name: 'salary', label: 'Monthly stipend', type: 'money', required: true },
    { name: 'college', label: 'College' },
    { name: 'endDate', label: 'Internship ends', type: 'date' },
    { name: 'type', label: 'Type', hideInForm: true, hideInTable: true, default: 'Intern' },
  ],
});

export const Jobs = page({
  collection: 'hr_jobs', title: 'Jobs', crumbs: 'HRMS › Hiring', addLabel: 'Add Position', statusField: 'status', statusTabs: ['Open', 'On Hold', 'Closed'],
  fields: [
    { name: 'title', label: 'Position', required: true }, { name: 'department', label: 'Department', type: 'select', options: { from: 'hr_departments' } },
    { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' } }, { name: 'openings', label: 'Openings', type: 'number', default: 1 },
    { name: 'experience', label: 'Experience' }, { name: 'postedOn', label: 'Posted on', type: 'date', default: todayISO },
    { name: 'status', label: 'Status', type: 'select', options: ['Open', 'On Hold', 'Closed'], default: 'Open' },
  ],
});
export const Candidates = page({
  collection: 'hr_candidates', title: 'Applicants', crumbs: 'HRMS › Hiring', addLabel: 'Add Applicant', statusField: 'stage', statusTabs: ['Screening', 'Interview', 'Offered', 'Joined', 'Rejected'], dateField: 'appliedOn',
  statusColors: { Screening: 'blue', Interview: 'orange', Offered: 'purple', Joined: 'green', Rejected: 'red' },
  fields: [
    { name: 'name', label: 'Candidate', required: true }, { name: 'position', label: 'Position', type: 'select', options: { from: 'hr_jobs', field: 'title' }, required: true },
    { name: 'mobile', label: 'Mobile', required: true }, { name: 'source', label: 'Source', type: 'select', options: ['Naukri', 'LinkedIn', 'Referral', 'Walk-in', 'Website'] },
    { name: 'expectedCtc', label: 'Expected CTC (yearly)', type: 'money' }, { name: 'appliedOn', label: 'Applied on', type: 'date', default: todayISO },
    { name: 'stage', label: 'Stage', type: 'select', options: ['Screening', 'Interview', 'Offered', 'Joined', 'Rejected'], default: 'Screening' },
  ],
});
export const Interviews = page({
  collection: 'hr_interviews', title: 'Interviews', crumbs: 'HRMS › Hiring', addLabel: 'Schedule Interview', statusField: 'status', statusTabs: ['Scheduled', 'Selected', 'Rejected', 'No Show'], dateField: 'date',
  fields: [
    { name: 'candidate', label: 'Candidate', type: 'select', options: { from: 'hr_candidates' }, required: true }, { name: 'position', label: 'Position', type: 'select', options: { from: 'hr_jobs', field: 'title' } },
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true }, { name: 'time', label: 'Time', type: 'time' },
    { name: 'interviewer', label: 'Interviewer', type: 'select', options: activeStaff, required: true }, { name: 'round', label: 'Round', type: 'select', options: ['Round 1', 'Round 2', 'HR Round'], default: 'Round 1' },
    { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Selected', 'Rejected', 'No Show'], default: 'Scheduled' }, { name: 'feedback', label: 'Feedback', type: 'textarea', hideInTable: true },
  ],
});

// ───────────────────────── Attendance ─────────────────────────
export function HrAttendance() {
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [marking, setMarking] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const { rows: emps } = useCollection('hr_employees');
  const { rows: att, add, update } = useCollection('hr_attendance');
  const { rows: leaves } = useCollection('hr_leave_requests');
  const { rows: holidays } = useCollection('hr_holidays');
  const rules = useCollection('hr_attendance_rules').rows[0] ?? { shiftStart: '09:30', graceMinutes: 10 };
  const d = date.format('YYYY-MM-DD');
  const holiday = holidays.find((h) => h.date === d);
  const active = emps.filter((e) => e.status === 'Active');

  const rows = active.map((e) => {
    const rec = att.find((a) => a.employee === e.name && a.date === d);
    const leave = leaves.find((l) => l.employee === e.name && l.status === 'Approved' && l.fromDate <= d && l.toDate >= d);
    const status = rec?.status ?? (leave ? 'On Leave' : holiday ? 'Holiday' : 'Absent');
    return { id: e.id, employee: e.name, code: e.code, type: e.type, status, checkIn: rec?.checkIn ?? '', checkOut: rec?.checkOut ?? '', lateMinutes: rec?.lateMinutes ?? 0, location: rec?.location ?? '', source: rec?.source ?? '', recId: rec?.id, leaveType: leave?.leaveType };
  });

  const lateBy = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    const [sh, sm] = String(rules.shiftStart ?? '09:30').split(':').map(Number);
    const diff = h * 60 + m - (sh * 60 + sm);
    return diff > Number(rules.graceMinutes ?? 0) ? diff : 0;
  };

  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const rec = { employee: marking!.employee, date: d, status: v.status, checkIn: v.checkIn ?? '', checkOut: v.checkOut ?? '', lateMinutes: lateBy(v.checkIn), location: v.location ?? 'Office', source: 'Manual' };
    if (marking!.recId) update(marking!.recId, rec); else add(rec);
    message.success('Attendance saved');
    setMarking(null);
  };

  const markAllPresent = () => {
    const missing = rows.filter((r) => !r.recId && r.status === 'Absent');
    missing.forEach((r) => add({ employee: r.employee, date: d, status: 'Present', checkIn: rules.shiftStart ?? '09:30', checkOut: rules.shiftEnd ?? '18:30', lateMinutes: 0, location: 'Office', source: 'Bulk' }));
    message.success(`${missing.length} employee(s) marked present`);
  };

  const present = rows.filter((r) => ['Present', 'Half Day'].includes(r.status)).length;
  return (
    <div className="erp-page">
      <PageHeader eyebrow="HRMS" title="Attendance" crumbs="HRMS › Attendance" subtitle={holiday ? `${fmtDate(d)} is a holiday: ${holiday.name}` : 'Who came in on the chosen day. Anyone not marked and not on approved leave is shown as absent.'}
        actions={<><DatePicker value={date} onChange={(v) => v && setDate(v)} allowClear={false} format="DD MMM YYYY" aria-label="Attendance date" /><Button type="primary" icon={<LoginOutlined />} onClick={markAllPresent}>Mark everyone else present</Button><Link to="/hrms/leave"><Button className="erp-ghost">Time off</Button></Link></>} />
      <StatGrid stats={[
        { label: 'Team size', value: rows.length, hint: `${rows.filter((r) => r.type === 'Employee').length} staff · ${rows.filter((r) => r.type === 'Intern').length} trainees`, tone: 'blue', icon: <TeamOutlined /> },
        { label: 'In', value: present, hint: 'Marked present', tone: 'green', icon: <CheckCircleOutlined /> },
        { label: 'Not in', value: rows.filter((r) => r.status === 'Absent').length, hint: 'Call to check', tone: 'red', icon: <CloseCircleOutlined /> },
        { label: 'Late / on leave', value: `${rows.filter((r) => r.lateMinutes > 0).length} / ${rows.filter((r) => r.status === 'On Leave').length}`, hint: 'Late arrivals vs approved leave', tone: 'amber', icon: <ClockCircleOutlined /> },
      ]} />
      <section className="erp-panel">
        <div className="erp-panel-head"><h2>Register</h2><span className="erp-muted">{rows.length} record(s)</span></div>
        <Table rowKey="id" dataSource={rows} scroll={{ x: 'max-content' }} pagination={{ pageSize: 15 }} columns={[
          { title: 'Employee', dataIndex: 'employee', render: (v, r) => <span><strong>{v}</strong><br /><Tag>{r.type}</Tag></span> },
          { title: 'Staff ID', dataIndex: 'code' },
          { title: 'Status', dataIndex: 'status', render: (v, r) => <>{statusTag(v)}{r.leaveType && <small className="erp-muted">{r.leaveType}</small>}</> },
          { title: 'In time', dataIndex: 'checkIn', render: (v, r) => (v ? <span>{v}{r.lateMinutes > 0 && <Tag color="orange" style={{ marginLeft: 6 }}>{r.lateMinutes}m late</Tag>}</span> : <span className="erp-muted">—</span>) },
          { title: 'Out time', dataIndex: 'checkOut', render: (v) => v || <span className="erp-muted">—</span> },
          { title: 'Hours', render: (_, r) => {
            if (!r.checkIn || !r.checkOut) return 'N/A';
            const [a, b] = [r.checkIn, r.checkOut].map((t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
            return b > a ? `${Math.floor((b - a) / 60)}h ${(b - a) % 60}m` : 'N/A';
          } },
          { title: 'Location', dataIndex: 'location', render: (v) => v || 'N/A' },
          { title: 'Actions', render: (_, r) => <Button size="small" onClick={() => setMarking(r)}>Update</Button> },
        ]} />
      </section>
      <Modal open={Boolean(marking)} title={`Attendance · ${marking?.employee ?? ''} · ${fmtDate(d)}`} onOk={save} onCancel={() => setMarking(null)} okText="Save" destroyOnClose>
        <Form form={form} layout="vertical" className="erp-form-grid" preserve={false} initialValues={marking ? { status: marking.status === 'Absent' && !marking.recId ? 'Present' : marking.status, checkIn: marking.checkIn || rules.shiftStart, checkOut: marking.checkOut, location: marking.location || 'Office' } : undefined}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}><Select options={['Present', 'Half Day', 'Absent', 'On Leave', 'Holiday'].map((s) => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="location" label="Location"><Select options={['Office', 'Outside office', 'Work from home'].map((s) => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="checkIn" label="Check in"><Input type="time" /></Form.Item>
          <Form.Item name="checkOut" label="Check out"><Input type="time" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export const OutsideOffice = page({
  collection: 'hr_outside_requests', title: 'Field Visits', crumbs: 'HRMS › Field Visits', addLabel: 'Request Check-in', dateField: 'date',
  subtitle: 'Staff visiting customers or working away from the office ask you to confirm their start or finish time. Approving adds it to Attendance.',
  approval: {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    after: (row, decision) => {
      if (decision !== 'approved') return;
      const att = collectionApi('hr_attendance');
      const existing = getCollection('hr_attendance').find((a) => a.employee === row.employee && a.date === row.date);
      const patch = row.type === 'Check-in' ? { checkIn: row.time, status: 'Present' } : { checkOut: row.time };
      if (existing) att.update(existing.id, { ...patch, location: 'Outside office' });
      else att.add({ employee: row.employee, date: row.date, status: 'Present', checkIn: row.type === 'Check-in' ? row.time : '', checkOut: row.type === 'Check-out' ? row.time : '', lateMinutes: 0, location: 'Outside office', source: 'Outside request' });
    },
  },
  stats: (rows) => [
    { label: 'To approve', value: rows.filter((r) => r.status === 'Pending').length, hint: 'Start and finish times', tone: 'amber' },
    { label: 'Starting the day', value: rows.filter((r) => r.status === 'Pending' && r.type === 'Check-in').length, hint: 'Waiting', tone: 'teal' },
    { label: 'Ending the day', value: rows.filter((r) => r.status === 'Pending' && r.type === 'Check-out').length, hint: 'Waiting', tone: 'blue' },
    { label: 'Already decided', value: rows.filter((r) => r.status !== 'Pending').length, hint: `${rows.filter((r) => r.status === 'Approved').length} approved, ${rows.filter((r) => r.status === 'Rejected').length} rejected`, tone: 'green' },
  ],
  fields: [
    { name: 'employee', label: 'Employee', type: 'select', options: activeStaff, required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Check-in', 'Check-out'], required: true, render: (v) => <Tag color={v === 'Check-in' ? 'blue' : 'purple'}>{v === 'Check-in' ? '→ ' : '← '}{v}</Tag> },
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'time', label: 'Requested time', type: 'time', required: true },
    { name: 'reason', label: 'Reason', required: true },
    { name: 'location', label: 'Location', required: true },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
    { name: 'remarks', label: 'Decision / remarks', hideInTable: true },
  ],
});

// ───────────────────────── Timesheet LOP & Payroll ─────────────────────────
function MonthBar({ month, setMonth, extra }: { month: Dayjs; setMonth: (d: Dayjs) => void; extra?: React.ReactNode }) {
  return <Space wrap><DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} aria-label="Month" />{extra}</Space>;
}

export function TimesheetLop() {
  const data = useHrData();
  const { rows: emps } = useCollection('hr_employees');
  const [month, setMonth] = useState(dayjs());
  const m = month.format('YYYY-MM');
  const rows = useMemo(() => emps.filter((e) => e.status === 'Active').map((e) => ({ id: e.id, employee: e.name, code: e.code, ...lopFor(e.name, m, { ...data, until: todayISO() }) })), [emps, m, data]);
  return (
    <div className="erp-page">
      <PageHeader eyebrow="HRMS" title="Salary Cuts (LOP)" crumbs="HRMS › Salary Cuts" subtitle="Days of pay cut for each person this month: absences, half of each half-day, unpaid leave, paid leave above the monthly allowance, repeated late arrivals and extra permissions."
        actions={<MonthBar month={month} setMonth={setMonth} extra={<Button className="erp-ghost" onClick={() => downloadCsv(`lop-${m}.csv`, ['Employee', 'Working', 'Present', 'Half', 'Absent', 'Paid leave', 'Unpaid leave', 'Late marks', 'Excess perm. hrs', 'LOP days', 'Payable days'], rows.map((r) => [r.employee, r.workingDays, r.present, r.halfDays, r.absent, r.paidLeave, r.unpaidLeave, r.lateMarks, r.excessPermissionHours, r.lopDays, r.payableDays]))}>Export</Button>} />} />
      <StatGrid stats={[
        { label: 'Working days so far', value: rows[0]?.workingDays ?? 0, tone: 'blue' },
        { label: 'People with a pay cut', value: rows.filter((r) => r.lopDays > 0).length, tone: 'red' },
        { label: 'Total days cut', value: rows.reduce((s, r) => s + r.lopDays, 0), tone: 'amber' },
        { label: 'Paid leave allowed', value: `${data.leaveSettings.monthlyPaidLeave} day(s) / month`, hint: 'Change in Settings › Leave Rules', tone: 'purple', to: '/setup/leave-rules' },
      ]} />
      <section className="erp-panel">
        <Table rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} columns={[
          { title: 'Employee', dataIndex: 'employee', render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.code}</small></span> },
          { title: 'Working', dataIndex: 'workingDays', align: 'right' }, { title: 'Present', dataIndex: 'present', align: 'right' },
          { title: 'Half day', dataIndex: 'halfDays', align: 'right' }, { title: 'Absent', dataIndex: 'absent', align: 'right', render: (v) => (v ? <span style={{ color: '#dc2626' }}>{v}</span> : 0) },
          { title: 'Paid leave', dataIndex: 'paidLeave', align: 'right', render: (v, r) => <span>{v}{r.excessPaidLeave > 0 && <Tag color="orange" style={{ marginLeft: 4 }}>+{r.excessPaidLeave} over</Tag>}</span> },
          { title: 'Unpaid leave', dataIndex: 'unpaidLeave', align: 'right' }, { title: 'Late marks', dataIndex: 'lateMarks', align: 'right' },
          { title: 'Permission hrs (excess)', render: (_, r) => `${r.permissionHours} (${r.excessPermissionHours})`, align: 'right' },
          { title: 'Days cut', dataIndex: 'lopDays', align: 'right', render: (v) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag> },
          { title: 'Days paid', dataIndex: 'payableDays', align: 'right', render: (v) => <strong>{v}</strong> },
        ]} />
      </section>
    </div>
  );
}

export function Payroll() {
  const data = useHrData();
  const { rows: emps } = useCollection('hr_employees');
  const { rows: runs, add, update, remove } = useCollection('hr_payroll');
  const [month, setMonth] = useState(dayjs().subtract(dayjs().date() < 25 ? 1 : 0, 'month'));
  const [slip, setSlip] = useState<Row | null>(null);
  const m = month.format('YYYY-MM');
  const daysInMonth = month.daysInMonth();
  const saved = runs.filter((r) => r.month === m);

  const preview = useMemo(() => emps.filter((e) => e.status === 'Active').map((e) => {
    const lop = lopFor(e.name, m, { ...data, until: todayISO() });
    const p = computePayslip(Number(e.salary) || 0, lop.lopDays, daysInMonth, e.type === 'Intern');
    return { id: e.id, month: m, employee: e.name, code: e.code, designation: e.designation, department: e.department, type: e.type, lopDays: lop.lopDays, payableDays: lop.payableDays, ...p, status: 'Draft' };
  }), [emps, m, data, daysInMonth]);

  const list: Row[] = saved.length ? saved : preview;
  const generate = () => {
    saved.forEach((r) => remove(r.id));
    preview.forEach(({ id: _id, ...r }) => add({ ...r, status: 'Processed', processedOn: todayISO() }));
    message.success(`Salaries for ${month.format('MMMM YYYY')} calculated for ${preview.length} people`);
  };
  const markPaid = () => { saved.forEach((r) => update(r.id, { status: 'Paid', paidOn: todayISO() })); message.success('Marked as paid'); };
  const total = (f: string) => list.reduce((s, r) => s + (Number(r[f]) || 0), 0);

  return (
    <div className="erp-page">
      <PageHeader eyebrow="HRMS" title="Salary" crumbs="HRMS › Salary" subtitle={<>Take-home pay = monthly salary − pay cut (salary ÷ {daysInMonth} days × days cut) − PF − ESI − professional tax. The PF/ESI/PT rates are examples; confirm them with your accountant.</>}
        actions={<MonthBar month={month} setMonth={setMonth} extra={<>
          <Button type="primary" onClick={generate}>{saved.length ? 'Recalculate salaries' : 'Calculate salaries'}</Button>
          {saved.length > 0 && saved.some((r) => r.status !== 'Paid') && <Button onClick={markPaid}>Mark all as paid</Button>}
          <Button className="erp-ghost" onClick={() => downloadCsv(`payroll-${m}.csv`, ['Employee', 'Code', 'Gross', 'LOP days', 'LOP deduction', 'PF', 'ESI', 'PT', 'Net', 'Status'], list.map((r) => [r.employee, r.code, r.gross, r.lopDays, r.lopDeduction, r.pf, r.esi, r.pt, r.net, r.status]))}>Export</Button>
        </>} />} />
      <StatGrid stats={[
        { label: 'Total salaries', value: inr(total('gross')), hint: `${list.length} people`, tone: 'blue' },
        { label: 'Pay cuts', value: inr(total('lopDeduction')), hint: `${total('lopDays')} days cut`, tone: 'red' },
        { label: 'PF + ESI + tax', value: inr(total('pf') + total('esi') + total('pt')), tone: 'amber' },
        { label: 'Take-home pay', value: inr(total('net')), hint: saved.length ? `Status: ${saved[0].status}` : 'Preview – not calculated yet', tone: 'green' },
      ]} />
      <section className="erp-panel">
        <Table rowKey="id" dataSource={list} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20 }} columns={[
          { title: 'Employee', dataIndex: 'employee', render: (v, r) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.code} · {r.designation}</small></span> },
          { title: 'Gross', dataIndex: 'gross', align: 'right', render: inr },
          { title: 'LOP days', dataIndex: 'lopDays', align: 'right', render: (v) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag> },
          { title: 'LOP deduction', dataIndex: 'lopDeduction', align: 'right', render: inr },
          { title: 'PF', dataIndex: 'pf', align: 'right', render: inr }, { title: 'ESI', dataIndex: 'esi', align: 'right', render: inr }, { title: 'PT', dataIndex: 'pt', align: 'right', render: inr },
          { title: 'Net pay', dataIndex: 'net', align: 'right', render: (v) => <strong>{inr(v)}</strong> },
          { title: 'Status', dataIndex: 'status', render: (v) => statusTag(v, { Draft: 'default', Processed: 'blue', Paid: 'green' }) },
          { title: 'Payslip', render: (_, r) => <Button size="small" onClick={() => setSlip(r)}>View</Button> },
        ]} />
      </section>
      <Modal open={Boolean(slip)} onCancel={() => setSlip(null)} footer={<><Button onClick={() => window.print()}>Print</Button><Button type="primary" onClick={() => setSlip(null)}>Close</Button></>} title={`Payslip · ${month.format('MMMM YYYY')}`} width={620}>
        {slip && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Employee" span={2}>{slip.employee} ({slip.code})</Descriptions.Item>
            <Descriptions.Item label="Designation">{slip.designation}</Descriptions.Item>
            <Descriptions.Item label="Department">{slip.department}</Descriptions.Item>
            <Descriptions.Item label="Days in month">{daysInMonth}</Descriptions.Item>
            <Descriptions.Item label="LOP days">{slip.lopDays}</Descriptions.Item>
            <Descriptions.Item label="Monthly gross">{inr(slip.gross)}</Descriptions.Item>
            <Descriptions.Item label="LOP deduction">− {inr(slip.lopDeduction)}</Descriptions.Item>
            <Descriptions.Item label="Earned gross">{inr(slip.earned)}</Descriptions.Item>
            <Descriptions.Item label="Provident fund">− {inr(slip.pf)}</Descriptions.Item>
            <Descriptions.Item label="ESI">− {inr(slip.esi)}</Descriptions.Item>
            <Descriptions.Item label="Professional tax">− {inr(slip.pt)}</Descriptions.Item>
            <Descriptions.Item label="Net pay" span={2}><strong style={{ fontSize: 16 }}>{inr(slip.net)}</strong></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

// ───────────────────────── Leave & permissions ─────────────────────────
export function LeaveRequests() {
  const data = useHrData();
  const role = useAppSelector((s) => s.auth.user?.role);
  const holidays: string[] = data.holidays;
  const weekOff: string = data.leaveSettings.weekOff;
  return (
    <RecordPage
      collection="hr_leave_requests" title="Leave Requests" crumbs="HRMS › Leave" addLabel="Ask for Leave" dateField="fromDate"
      subtitle="Ask for and approve time off. Week-offs and holidays are not counted, paid leave cannot go beyond the yearly allowance, and approved days show as On Leave in attendance."
      approval={{
        pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
        after: (row, decision) => {
          if (decision !== 'approved') return;
          const att = collectionApi('hr_attendance');
          const existing = getCollection('hr_attendance');
          for (const iso of workingDates(row.fromDate, row.toDate, weekOff, holidays)) {
            const hit = existing.find((a) => a.employee === row.employee && a.date === iso);
            if (hit) att.update(hit.id, { status: 'On Leave' });
            else att.add({ employee: row.employee, date: iso, status: 'On Leave', checkIn: '', checkOut: '', lateMinutes: 0, location: '', source: 'Leave' });
          }
        },
      }}
      validate={(v, all, editing) => validateLeave({ ...(v as any), id: editing?.id }, data.types, all as any, weekOff, holidays)}
      stats={(rows) => [
        { label: 'Pending', value: rows.filter((r) => r.status === 'Pending').length, tone: 'amber' },
        { label: 'On leave today', value: rows.filter((r) => r.status === 'Approved' && r.fromDate <= todayISO() && r.toDate >= todayISO()).length, tone: 'blue' },
        { label: 'Approved this month', value: rows.filter((r) => r.status === 'Approved' && String(r.fromDate).startsWith(dayjs().format('YYYY-MM'))).reduce((s, r) => s + leaveDays(r as any, weekOff, holidays), 0) + ' days', tone: 'green' },
        { label: 'Leave types', value: data.types.length, hint: 'Change in Settings', tone: 'purple', to: '/setup/leave-types' },
      ]}
      fields={[
        { name: 'employee', label: 'Employee', type: 'select', options: activeStaff, required: true },
        { name: 'leaveType', label: 'Leave type', type: 'select', options: { from: 'hr_leave_types' }, required: true },
        { name: 'fromDate', label: 'From', type: 'date', required: true, default: todayISO },
        { name: 'toDate', label: 'To', type: 'date', required: true, default: todayISO },
        { name: 'days', label: 'Days', hideInForm: true, render: (_v, r) => leaveDays(r as any, weekOff, holidays) },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
        { name: 'appliedOn', label: 'Applied on', type: 'date', hideInForm: true, default: todayISO },
        { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
      ]}
      canEdit={isAdminRole(role)}
    />
  );
}

export function LeaveBalance() {
  const data = useHrData();
  const { rows: emps } = useCollection('hr_employees');
  const [year, setYear] = useState(dayjs());
  const types = (data.types as LeaveType[]).filter((t) => Number(t.annualQuota) > 0 && t.paid === 'Paid');
  const rows = emps.filter((e) => e.status === 'Active').map((e) => ({
    id: e.id, employee: e.name, code: e.code,
    ...Object.fromEntries(types.map((t) => [t.name, leaveBalance(e.name, t, data.leaves, year.year(), data.leaveSettings.weekOff, data.holidays)])),
  }));
  return (
    <div className="erp-page">
      <PageHeader eyebrow="HRMS" title="Leave Balance" crumbs="HRMS › Leave" subtitle="Paid leave left for each person this year (allowed − taken − waiting for approval)." actions={<DatePicker picker="year" value={year} onChange={(v) => v && setYear(v)} allowClear={false} aria-label="Year" />} />
      <section className="erp-panel">
        <Table rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} columns={[
          { title: 'Employee', dataIndex: 'employee', render: (v, r: any) => <span><strong>{v}</strong><br /><small className="erp-muted">{r.code}</small></span> },
          ...types.map((t) => ({
            title: `${t.name} (${t.annualQuota})`, dataIndex: t.name, align: 'center' as const,
            render: (b: ReturnType<typeof leaveBalance>) => <span><Tag color={b.available === 0 ? 'red' : 'green'}>{b.available} left</Tag><br /><small className="erp-muted">{b.used} used · {b.pending} pending</small></span>,
          })),
        ]} />
      </section>
    </div>
  );
}

export const PermissionRequests = page({
  collection: 'hr_permission_requests', title: 'Permission', crumbs: 'HRMS › Leave', addLabel: 'Ask for Permission', dateField: 'date',
  subtitle: 'A few hours off for coming in late or leaving early. Each person gets a free allowance per month (Settings › Permission Rules).',
  approval: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
  validate: (v) => {
    const s = one('hr_permission_settings');
    return Number(v.hours) > Number(s.maxHoursPerDay ?? 2) * 2 ? `A single permission cannot exceed ${Number(s.maxHoursPerDay ?? 2) * 2} hours; apply half-day leave instead.` : null;
  },
  fields: [
    { name: 'employee', label: 'Employee', type: 'select', options: activeStaff, required: true },
    { name: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { name: 'hours', label: 'Hours', type: 'number', required: true, default: 1 },
    { name: 'used', label: 'Used this month', hideInForm: true, render: (_v, r) => {
      const s = one('hr_permission_settings');
      const n = getCollection('hr_permission_requests').filter((p) => p.employee === r.employee && p.status === 'Approved' && String(p.date).slice(0, 7) === String(r.date).slice(0, 7)).length;
      return <Tag color={n > Number(s.monthlyCount ?? 2) ? 'red' : 'default'}>{n} / {s.monthlyCount ?? 2}</Tag>;
    } },
    { name: 'reason', label: 'Reason', required: true },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
  ],
});

// ───────────────────────── Expenses, petty cash, misc ─────────────────────────
const STAGES = ['', 'Team lead', 'Manager', 'Director'];
export const Expenses = page({
  collection: 'hr_expenses', title: 'Expenses', eyebrow: 'HRMS', crumbs: 'HRMS › Expenses', addLabel: 'Claim an Expense', dateField: 'date',
  subtitle: 'Staff claim back money they spent for work. Each claim is approved in three steps – team lead, manager, then director – and the final approval pays it from the Cash page.',
  approval: {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    approveLabel: (r) => (Number(r.stage) < 3 ? `Approve (step ${r.stage})` : 'Final approval'),
    onApprove: (r) => (Number(r.stage) < 3 ? { stage: Number(r.stage) + 1 } : { status: 'Approved' }),
    after: (r, decision) => {
      if (decision === 'approved' && r.status === 'Approved') {
        collectionApi('hr_petty_cash').add({ date: todayISO(), category: r.category, voucher: `EXP-${String(r.id).slice(0, 5)}`, party: r.applicant, narration: `Reimbursement: ${r.description ?? r.category}`, debit: Number(r.amount) || 0, credit: 0, ledger: 'Office Cash' });
      }
    },
  },
  stats: (rows) => [
    { label: 'All claims', value: rows.length, tone: 'amber', icon: <DollarOutlined /> },
    { label: 'Waiting', value: rows.filter((r) => r.status === 'Pending').length, tone: 'blue', icon: <ClockCircleOutlined /> },
    { label: 'Approved', value: rows.filter((r) => r.status === 'Approved').length, hint: inr(rows.filter((r) => r.status === 'Approved').reduce((s, r) => s + Number(r.amount || 0), 0)), tone: 'green', icon: <CheckCircleOutlined /> },
    { label: 'Rejected', value: rows.filter((r) => r.status === 'Rejected').length, tone: 'red', icon: <CloseCircleOutlined /> },
  ],
  fields: [
    { name: 'applicant', label: 'Applicant', type: 'select', options: activeStaff, required: true },
    { name: 'category', label: 'Category', type: 'select', options: { from: 'hr_expense_categories' }, required: true },
    { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'description', label: 'Details', type: 'textarea', required: true },
    { name: 'receipt', label: 'Receipt', type: 'select', options: ['Attached', 'Not available'], default: 'Attached' },
    { name: 'stage', label: 'Waiting on', hideInForm: true, default: 1, render: (v, r) => (r.status === 'Pending' ? <Tag color="gold">Step {v} of 3 · {STAGES[Number(v)] ?? ''}</Tag> : <span className="erp-muted">—</span>) },
    { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'status', label: 'Status', hideInForm: true, default: 'Pending' },
  ],
});

export function PettyCash() {
  const { rows } = useCollection('hr_petty_cash');
  const { rows: cats } = useCollection('hr_expense_categories');
  return (
    <LedgerView
      eyebrow="Accounts" title="Cash"
      subtitle="Cash kept at the office: what came in, what was spent, and the balance after every entry."
      collection="hr_petty_cash" entries={rows as unknown as LedgerEntry[]} ledgers={['Office Cash', 'Office Upkeep']}
      categories={[...cats.map((c) => c.name as string), 'Housekeeping', 'Top-up', 'Opening']}
    />
  );
}

export const Announcements = page({
  collection: 'hr_announcements', title: 'Notices', crumbs: 'HRMS › Notices', addLabel: 'Post a Notice', statusField: 'status', statusTabs: ['Published', 'Draft'], dateField: 'publishOn',
  subtitle: 'Post news and reminders for all staff or a single branch.',
  fields: [
    { name: 'title', label: 'Title', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true },
    { name: 'branch', label: 'Branch', type: 'select', options: ['All branches', ...getCollection('branches').map((b) => b.name as string)], default: 'All branches' },
    { name: 'publishOn', label: 'Publish on', type: 'date', default: todayISO }, { name: 'status', label: 'Status', type: 'select', options: ['Published', 'Draft'], default: 'Published' },
  ],
});

export const Visitors = page({
  collection: 'hr_visitors', title: 'Visitors', crumbs: 'HRMS › Visitors', addLabel: 'Sign In a Visitor', statusField: 'status', statusTabs: ['Checked In', 'Checked Out'], dateField: 'date',
  subtitle: 'Who visited the office, whom they met, and when they arrived and left.',
  rowActions: (r, api) => (r.status === 'Checked In' ? <Button size="small" icon={<LogoutOutlined />} onClick={() => api.update(r.id, { status: 'Checked Out', outTime: dayjs().format('HH:mm') })}>Sign out</Button> : null),
  fields: [
    { name: 'name', label: 'Visitor', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Candidate', 'Customer', 'Partner', 'Delivery', 'Others'], required: true },
    { name: 'mobile', label: 'Mobile', required: true }, { name: 'whomToMeet', label: 'Whom to meet', type: 'select', options: activeStaff },
    { name: 'purpose', label: 'Purpose' }, { name: 'date', label: 'Date', type: 'date', default: todayISO },
    { name: 'inTime', label: 'In time', type: 'time', default: () => dayjs().format('HH:mm') }, { name: 'outTime', label: 'Out time', type: 'time' },
    { name: 'status', label: 'Status', type: 'select', options: ['Checked In', 'Checked Out'], default: 'Checked In' },
  ],
});

export const CleaningSheet = page({
  collection: 'hr_cleaning_sheet', title: 'Cleaning', crumbs: 'HRMS › Office', addLabel: 'Add Cleaning Job', statusField: 'status', statusTabs: ['Done', 'Pending'], dateField: 'date',
  subtitle: 'Daily cleaning jobs by area, and whether each was done.',
  rowActions: (r, api) => (r.status !== 'Done' ? <Button size="small" onClick={() => api.update(r.id, { status: 'Done', time: dayjs().format('HH:mm') })}>Mark done</Button> : null),
  fields: [
    { name: 'date', label: 'Date', type: 'date', default: todayISO }, { name: 'task', label: 'Task', type: 'select', options: { from: 'hr_cleaning_categories' }, required: true },
    { name: 'area', label: 'Area', required: true }, { name: 'doneBy', label: 'Done by' }, { name: 'time', label: 'Time', type: 'time' },
    { name: 'status', label: 'Status', type: 'select', options: ['Done', 'Pending'], default: 'Pending' },
  ],
});
export const Facility = page({
  collection: 'hr_facility', title: 'Repairs', crumbs: 'HRMS › Office', addLabel: 'Log a Repair', subtitle: 'AC servicing, generator checks, internet issues and other office maintenance.', statusField: 'status', statusTabs: ['Pending', 'Scheduled', 'Completed'], dateField: 'dueDate',
  fields: [
    { name: 'title', label: 'Facility', type: 'select', options: { from: 'hr_facility_titles' }, required: true }, { name: 'description', label: 'Work', required: true },
    { name: 'vendor', label: 'Vendor' }, { name: 'cost', label: 'Cost', type: 'money' }, { name: 'dueDate', label: 'Due date', type: 'date' },
    { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' } }, { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Scheduled', 'Completed'], default: 'Pending' },
  ],
});
export const Assets = page({
  collection: 'hr_assets', title: 'Assets', crumbs: 'HRMS › Office', addLabel: 'Add Asset', subtitle: 'Laptops, phones, furniture and other company property – who has it and what condition it is in.', statusField: 'status', statusTabs: ['In Use', 'In Stock', 'Repair', 'Disposed'],
  statusColors: { 'In Use': 'green', 'In Stock': 'blue', Repair: 'orange', Disposed: 'default' },
  stats: (rows) => [{ label: 'Assets', value: rows.length, tone: 'blue' }, { label: 'Asset value', value: inr(rows.reduce((s, r) => s + Number(r.value || 0), 0)), tone: 'purple' }, { label: 'Under repair', value: rows.filter((r) => r.status === 'Repair').length, tone: 'amber' }],
  fields: [
    { name: 'tag', label: 'Asset tag', required: true }, { name: 'name', label: 'Asset', required: true }, { name: 'category', label: 'Category', type: 'select', options: { from: 'hr_asset_categories' } },
    { name: 'assignedTo', label: 'Assigned to', type: 'select', options: activeStaff }, { name: 'branch', label: 'Branch', type: 'select', options: { from: 'branches' } }, { name: 'purchaseDate', label: 'Purchased', type: 'date' },
    { name: 'value', label: 'Value', type: 'money' }, { name: 'status', label: 'Status', type: 'select', options: ['In Use', 'In Stock', 'Repair', 'Disposed'], default: 'In Stock' },
  ],
});

