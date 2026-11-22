import type { ReactNode } from 'react';
import {
  AccountBookOutlined, AimOutlined, AppstoreOutlined, AuditOutlined, BankOutlined, BarChartOutlined, BellOutlined,
  CalendarOutlined, CarryOutOutlined, CheckSquareOutlined, ClockCircleOutlined, CoffeeOutlined, ContactsOutlined,
  ControlOutlined, CrownOutlined, CustomerServiceOutlined, DashboardOutlined, DollarOutlined, EnvironmentOutlined,
  FieldTimeOutlined, FileDoneOutlined, FileProtectOutlined, FileTextOutlined, FundOutlined, HomeOutlined, IdcardOutlined,
  InboxOutlined, InteractionOutlined, LayoutOutlined, PhoneOutlined, ProjectOutlined, ReconciliationOutlined,
  RocketOutlined, SafetyOutlined, ScheduleOutlined, SettingOutlined, SmileOutlined, SolutionOutlined, SwapOutlined,
  SyncOutlined, TagsOutlined, TeamOutlined, ToolOutlined, UserAddOutlined, UsergroupAddOutlined, WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { Permission } from '../types';
import { hasPermission, isAdminRole } from '../access';

export interface ModuleNavItem {
  path: string;
  label: string;
  icon?: ReactNode;
  permission?: Permission;
  adminOnly?: boolean;
  children?: ModuleNavItem[];
  /** True for pages that already exist in the workspace (live API data). */
  live?: boolean;
}

export interface ErpModule {
  id: 'workspace' | 'owner' | 'crm' | 'hrms' | 'production' | 'cst' | 'accounts' | 'setup';
  label: string;
  /** One line shown in the app launcher. */
  description: string;
  /** Plain-English explanation for business owners: what this area is for. */
  purpose: string;
  /** Who normally works in it. */
  audience: string;
  tone: 'blue' | 'teal' | 'purple' | 'amber' | 'pink' | 'green' | 'slate' | 'red';
  icon: ReactNode;
  permission?: Permission;
  adminOnly?: boolean;
  nav: ModuleNavItem[];
}

export const ERP_MODULES: ErpModule[] = [
  {
    id: 'owner', label: 'Owner', description: 'Business summary and all approvals.', tone: 'red', icon: <CrownOutlined />, adminOnly: true,
    purpose: 'See how the business is doing on one page, and approve everything from one place.',
    audience: 'Owner',
    nav: [
      { path: '/owner/snapshot', label: 'Summary', icon: <DashboardOutlined /> },
      { path: '/owner/approvals', label: 'Approvals', icon: <InboxOutlined /> },
    ],
  },
  {
    id: 'crm', label: 'Sales', description: 'Enquiries, quotes and follow-ups.', tone: 'teal', icon: <RocketOutlined />,
    purpose: 'Add customer enquiries, follow up, send quotes and see who is selling.',
    audience: 'Sales team',
    nav: [
      { path: '/crm/dashboard', label: 'Dashboard', icon: <AppstoreOutlined /> },
      {
        path: '/crm/leads', label: 'Enquiries', icon: <ContactsOutlined />, children: [
          { path: '/crm/leads', label: 'All' },
          { path: '/crm/leads/new', label: 'Add New' },
          { path: '/crm/leads/pre-sales', label: 'Checking' },
          { path: '/crm/leads/products', label: 'Products' },
          { path: '/crm/leads/duplicates', label: 'Duplicates' },
        ],
      },
      {
        path: '/crm/tasks', label: 'Follow-ups', icon: <CheckSquareOutlined />, children: [
          { path: '/crm/tasks', label: 'To-do' },
          { path: '/crm/tasks/follow-ups', label: 'Call Back' },
          { path: '/crm/tasks/calls', label: 'Calls' },
        ],
      },
      { path: '/crm/quotations', label: 'Quotes', icon: <FileTextOutlined /> },
      { path: '/crm/price-requests', label: 'Discounts', icon: <DollarOutlined /> },
      { path: '/crm/day-closing', label: 'Daily Report', icon: <CalendarOutlined /> },
      { path: '/crm/cst-allocation', label: 'Send to Service', icon: <UsergroupAddOutlined /> },
      { path: '/crm/reports', label: 'Reports', icon: <BarChartOutlined /> },
      { path: '/leads', label: 'Website Enquiries', icon: <InteractionOutlined />, live: true },
      { path: '/insurance-requests', label: 'Online Requests', icon: <SafetyOutlined />, permission: 'insurance', live: true },
    ],
  },
  {
    id: 'cst', label: 'Customers', description: 'Customers, renewals and complaints.', tone: 'pink', icon: <CustomerServiceOutlined />,
    purpose: 'Look after customers after the sale – renewals, calls and complaints.',
    audience: 'Service team',
    nav: [
      { path: '/cst/dashboard', label: 'Dashboard', icon: <AppstoreOutlined /> },
      { path: '/cst/customers', label: 'Customers', icon: <TeamOutlined /> },
      { path: '/cst/renewals', label: 'Renewals', icon: <SyncOutlined /> },
      { path: '/cst/allocation', label: 'Assigned Staff', icon: <UsergroupAddOutlined /> },
      { path: '/cst/calls', label: 'Calls', icon: <PhoneOutlined /> },
      { path: '/cst/escalations', label: 'Complaints', icon: <WarningOutlined /> },
      { path: '/cst/feedback', label: 'Feedback', icon: <SmileOutlined /> },
      { path: '/cst/day-closing', label: 'Daily Report', icon: <ScheduleOutlined /> },
      { path: '/tickets', label: 'Tickets', icon: <ToolOutlined />, permission: 'tickets', live: true },
      { path: '/renewals', label: 'Policy Expiry', icon: <AimOutlined />, permission: 'tickets', live: true },
    ],
  },
  {
    id: 'production', label: 'Policies', description: 'New policies, changes and tasks.', tone: 'amber', icon: <ProjectOutlined />,
    purpose: 'Get sold policies issued, handle policy changes and track work.',
    audience: 'Office team',
    nav: [
      { path: '/production/dashboard', label: 'Dashboard', icon: <AppstoreOutlined /> },
      { path: '/production/issuance', label: 'New Policies', icon: <FileProtectOutlined /> },
      { path: '/production/endorsements', label: 'Changes', icon: <SwapOutlined /> },
      { path: '/production/projects', label: 'Projects', icon: <ProjectOutlined /> },
      { path: '/production/tasks', label: 'Tasks', icon: <CheckSquareOutlined /> },
      { path: '/production/time', label: 'Work Hours', icon: <FieldTimeOutlined /> },
      { path: '/board', label: 'Ticket Board', icon: <LayoutOutlined />, permission: 'tickets', live: true },
    ],
  },
  {
    id: 'hrms', label: 'Staff', description: 'Attendance, leave and salary.', tone: 'purple', icon: <TeamOutlined />,
    purpose: 'Staff details, attendance, leave, expenses and monthly salary.',
    audience: 'HR and all staff',
    nav: [
      { path: '/hrms/dashboard', label: 'Dashboard', icon: <AppstoreOutlined />, adminOnly: true },
      { path: '/hrms/employees', label: 'Staff List', icon: <IdcardOutlined />, adminOnly: true },
      { path: '/hrms/interns', label: 'Interns', icon: <SolutionOutlined />, adminOnly: true },
      { path: '/hrms/attendance', label: 'Attendance', icon: <CarryOutOutlined />, adminOnly: true },
      { path: '/hrms/outside-office', label: 'Field Visits', icon: <EnvironmentOutlined /> },
      {
        path: '/hrms/leave', label: 'Leave', icon: <CalendarOutlined />, children: [
          { path: '/hrms/leave', label: 'Leave Requests' },
          { path: '/hrms/leave/balance', label: 'Leave Balance' },
          { path: '/hrms/leave/permissions', label: 'Permission' },
          { path: '/hrms/leave/holidays', label: 'Holidays' },
        ],
      },
      { path: '/hrms/expenses', label: 'Expenses', icon: <DollarOutlined /> },
      { path: '/hrms/timesheet-lop', label: 'Salary Cuts (LOP)', icon: <FieldTimeOutlined />, adminOnly: true },
      { path: '/hrms/payroll', label: 'Salary', icon: <WalletOutlined />, adminOnly: true },
      {
        path: '/hrms/recruitment', label: 'Hiring', icon: <UserAddOutlined />, adminOnly: true, children: [
          { path: '/hrms/recruitment/jobs', label: 'Jobs' },
          { path: '/hrms/recruitment/candidates', label: 'Applicants' },
          { path: '/hrms/recruitment/interviews', label: 'Interviews' },
        ],
      },
      {
        path: '/hrms/housekeeping', label: 'Office', icon: <HomeOutlined />, adminOnly: true, children: [
          { path: '/hrms/housekeeping/cleaning', label: 'Cleaning' },
          { path: '/hrms/housekeeping/facility', label: 'Repairs' },
          { path: '/hrms/housekeeping/assets', label: 'Assets' },
        ],
      },
      { path: '/hrms/visitors', label: 'Visitors', icon: <CoffeeOutlined />, adminOnly: true },
      { path: '/hrms/announcements', label: 'Notices', icon: <BellOutlined /> },
      { path: '/attendance', label: 'My Attendance', icon: <ClockCircleOutlined />, permission: 'timesheet', live: true },
    ],
  },
  {
    id: 'accounts', label: 'Money', description: 'Money in, money out and bills.', tone: 'green', icon: <BankOutlined />, permission: 'payments',
    purpose: 'All money received, paid and still pending.',
    audience: 'Accounts team',
    nav: [
      { path: '/accounts/dashboard', label: 'Dashboard', icon: <FundOutlined /> },
      { path: '/accounts/receipts', label: 'Money In', icon: <FileDoneOutlined /> },
      { path: '/accounts/payments', label: 'Money Out', icon: <DollarOutlined /> },
      { path: '/accounts/invoices', label: 'Bills', icon: <FileTextOutlined /> },
      { path: '/accounts/outstanding', label: 'Pending', icon: <AuditOutlined /> },
      { path: '/accounts/commissions', label: 'Commission', icon: <TagsOutlined /> },
      { path: '/accounts/cash-book', label: 'Cash', icon: <AccountBookOutlined />, adminOnly: true },
      { path: '/accounts/ledger', label: 'All Entries', icon: <ReconciliationOutlined /> },
      { path: '/accounts/bank', label: 'Bank', icon: <BankOutlined /> },
      { path: '/loans', label: 'Loans', icon: <BankOutlined />, permission: 'loans', live: true },
    ],
  },
  {
    id: 'setup', label: 'Settings', description: 'Branches, products and rules.', tone: 'slate', icon: <SettingOutlined />, adminOnly: true,
    purpose: 'Set up branches, products, leave rules and other lists once.',
    audience: 'Owner and admin',
    nav: [
      { path: '/setup', label: 'All Settings', icon: <ControlOutlined /> },
      {
        path: '/setup/company', label: 'Company', icon: <HomeOutlined />, children: [
          { path: '/setup/branches', label: 'Branches' },
          { path: '/setup/departments', label: 'Departments' },
          { path: '/setup/designations', label: 'Job Titles' },
        ],
      },
      {
        path: '/setup/sales', label: 'Sales', icon: <RocketOutlined />, children: [
          { path: '/setup/products', label: 'Products' },
          { path: '/setup/sources', label: 'Sources' },
          { path: '/setup/stages', label: 'Stages' },
          { path: '/setup/call-outcomes', label: 'Call Results' },
        ],
      },
      {
        path: '/setup/people', label: 'Staff', icon: <TeamOutlined />, children: [
          { path: '/setup/leave-types', label: 'Leave Types' },
          { path: '/setup/leave-rules', label: 'Leave Rules' },
          { path: '/setup/permission-rules', label: 'Permission Rules' },
          { path: '/setup/attendance-rules', label: 'Office Timing' },
        ],
      },
      {
        path: '/setup/office', label: 'Office', icon: <WalletOutlined />, children: [
          { path: '/setup/expense-categories', label: 'Expense Types' },
          { path: '/setup/asset-categories', label: 'Asset Types' },
          { path: '/setup/facility-titles', label: 'Repair Types' },
          { path: '/setup/cleaning-tasks', label: 'Cleaning Jobs' },
        ],
      },
    ],
  },
];

export const flatNav = (items: ModuleNavItem[]): ModuleNavItem[] =>
  items.flatMap((i) => (i.children ? [i, ...i.children.map((c) => ({ ...c, permission: c.permission ?? i.permission, adminOnly: c.adminOnly ?? i.adminOnly }))] : [i]));

/** Which module a path belongs to, preferring the one the user picked last. */
export function moduleForPath(pathname: string, preferred?: string | null): ErpModule | null {
  const owns = (m: ErpModule) => flatNav(m.nav).some((i) => pathname === i.path || pathname.startsWith(`${i.path}/`))
    || pathname.startsWith(`/${m.id}/`);
  const pref = ERP_MODULES.find((m) => m.id === preferred);
  if (pref && owns(pref)) return pref;
  return ERP_MODULES.find((m) => pathname.startsWith(`/${m.id}/`) || pathname === `/${m.id}`) ?? ERP_MODULES.find(owns) ?? null;
}

type Session = Parameters<typeof hasPermission>[0];

/** Item visibility: module-level and item-level admin/permission rules both apply. */
export const canOpenNav = (user: Session, mod: ErpModule, item: ModuleNavItem) =>
  (mod.adminOnly ? isAdminRole(user?.role) : hasPermission(user, mod.permission))
  && (item.adminOnly ? isAdminRole(user?.role) : hasPermission(user, item.permission));

export const visibleNav = (user: Session, mod: ErpModule): ModuleNavItem[] =>
  mod.nav
    .filter((i) => canOpenNav(user, mod, i))
    .map((i) => (i.children ? { ...i, children: i.children.filter((c) => canOpenNav(user, mod, { ...c, adminOnly: c.adminOnly ?? i.adminOnly, permission: c.permission ?? i.permission })) } : i));

/** First page of a module the user may open, or null when the module is entirely hidden. */
export const moduleHome = (user: Session, mod: ErpModule) => {
  const first = visibleNav(user, mod)[0];
  return first ? (first.children?.[0]?.path ?? first.path) : null;
};
