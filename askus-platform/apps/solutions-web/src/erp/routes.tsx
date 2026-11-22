import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { useAppSelector } from '../store';
import { ERP_MODULES, canOpenNav, flatNav, moduleHome } from './modules';
import * as crm from './pages/crm';
import * as hr from './pages/hrms';
import * as o from './pages/others';
import * as owner from './pages/owner';

const ROUTES: Record<string, () => JSX.Element> = {
  // Owner's Desk
  '/owner/snapshot': owner.BusinessSnapshot,
  '/owner/approvals': owner.ApprovalsInbox,
  // Setup (all lists and rules in one place)
  '/setup': owner.SetupHome,
  '/setup/branches': crm.Branches,
  '/setup/products': crm.CrmProducts,
  '/setup/sources': crm.CrmSources,
  '/setup/stages': crm.CrmStatuses,
  '/setup/call-outcomes': crm.CrmCallOutcomes,
  '/setup/departments': hr.Departments,
  '/setup/designations': hr.Designations,
  '/setup/leave-types': hr.LeaveTypes,
  '/setup/leave-rules': hr.LeaveSettings,
  '/setup/permission-rules': hr.PermissionSettings,
  '/setup/attendance-rules': hr.AttendanceRules,
  '/setup/expense-categories': hr.ExpenseCategories,
  '/setup/asset-categories': hr.AssetCategories,
  '/setup/facility-titles': hr.FacilityTitles,
  '/setup/cleaning-tasks': hr.CleaningCategories,
  // Sales
  '/crm/dashboard': crm.CrmDashboard,
  '/crm/leads': crm.AllLeads,
  '/crm/leads/products': crm.LeadProducts,
  '/crm/leads/duplicates': crm.DuplicateLeads,
  '/crm/leads/new': crm.AddLead,
  '/crm/leads/pre-sales': crm.PreSales,
  '/crm/tasks': crm.Tasks,
  '/crm/tasks/follow-ups': crm.FollowUps,
  '/crm/tasks/calls': crm.CallUpdates,
  '/crm/quotations': crm.Quotations,
  '/crm/day-closing': crm.DayClosing,
  '/crm/reports': crm.CrmReports,
  '/crm/reports/:id': crm.CrmReportView,
  '/crm/price-requests': crm.PriceRequests,
  '/crm/cst-allocation': crm.CstAllocation,
  // HRMS
  '/hrms/dashboard': hr.HrmsDashboard,
  '/hrms/employees': hr.Employees,
  '/hrms/recruitment/jobs': hr.Jobs,
  '/hrms/recruitment/candidates': hr.Candidates,
  '/hrms/recruitment/interviews': hr.Interviews,
  '/hrms/interns': hr.Interns,
  '/hrms/attendance': hr.HrAttendance,
  '/hrms/outside-office': hr.OutsideOffice,
  '/hrms/timesheet-lop': hr.TimesheetLop,
  '/hrms/housekeeping/cleaning': hr.CleaningSheet,
  '/hrms/housekeeping/facility': hr.Facility,
  '/hrms/housekeeping/assets': hr.Assets,
  '/hrms/payroll': hr.Payroll,
  '/hrms/expenses': hr.Expenses,
  '/hrms/announcements': hr.Announcements,
  '/hrms/leave': hr.LeaveRequests,
  '/hrms/leave/balance': hr.LeaveBalance,
  '/hrms/leave/permissions': hr.PermissionRequests,
  '/hrms/leave/holidays': hr.Holidays,
  '/hrms/visitors': hr.Visitors,
  // Production
  '/production/dashboard': o.ProductionDashboard,
  '/production/projects': o.Projects,
  '/production/tasks': o.ProdTasks,
  '/production/time': o.TimeTracking,
  '/production/issuance': o.Issuance,
  '/production/endorsements': o.Endorsements,
  // CST
  '/cst/dashboard': o.CstDashboard,
  '/cst/customers': o.CstCustomers,
  '/cst/renewals': o.CstRenewals,
  '/cst/allocation': o.CstAllocation,
  '/cst/day-closing': o.CstDayClosing,
  '/cst/calls': o.CstCalls,
  '/cst/feedback': o.CstFeedback,
  '/cst/escalations': o.CstEscalations,
  // Accounts
  '/accounts/dashboard': o.AccountsDashboard,
  '/accounts/receipts': o.Receipts,
  '/accounts/payments': o.Payments,
  '/accounts/invoices': o.Invoices,
  '/accounts/commissions': o.Commissions,
  '/accounts/outstanding': o.Outstanding,
  '/accounts/ledger': o.DayBook,
  '/accounts/bank': o.BankAccounts,
  '/accounts/cash-book': hr.PettyCash,
};

/** A route is allowed when any module nav entry that owns it (exactly or as a parent) is open to the user. */
function allowed(user: Parameters<typeof canOpenNav>[0], path: string) {
  const base = path.replace('/:id', '');
  return ERP_MODULES.some((m) => {
    const items = flatNav(m.nav).filter((i) => base === i.path || base.startsWith(`${i.path}/`));
    const best = items.sort((a, b) => b.path.length - a.path.length)[0];
    return best ? canOpenNav(user, m, best) : false;
  });
}

function Guard({ path, children }: { path: string; children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!localStorage.getItem('tms_token')) return <Navigate to="/home" replace />;
  if (!allowed(user, path)) {
    const fallback = ERP_MODULES.map((m) => moduleHome(user, m)).find(Boolean);
    return fallback && fallback !== path ? <Navigate to={fallback} replace /> : <div style={{ padding: 48, textAlign: 'center' }}><h2>No access</h2><p>Ask an Admin to grant you access to this page.</p></div>;
  }
  return <>{children}</>;
}

/** Route elements for every module page; render inside the AppLayout route. */
export const erpRoutes = () => [
  ...Object.entries(ROUTES).map(([path, Page]) => (
    <Route key={path} path={path.slice(1)} element={<Guard path={path}><Page /></Guard>} />
  )),
  <Route key="crm" path="crm" element={<Navigate to="/crm/dashboard" replace />} />,
  <Route key="owner" path="owner" element={<Navigate to="/owner/snapshot" replace />} />,
  <Route key="old-crm-masters" path="crm/masters/*" element={<Navigate to="/setup" replace />} />,
  <Route key="old-hr-masters" path="hrms/masters/*" element={<Navigate to="/setup" replace />} />,
  <Route key="old-petty" path="hrms/petty-cash" element={<Navigate to="/accounts/cash-book" replace />} />,
  <Route key="old-cst-close" path="crm/cst-day-closing" element={<Navigate to="/cst/day-closing" replace />} />,
  <Route key="hrms" path="hrms" element={<Navigate to="/hrms/dashboard" replace />} />,
  <Route key="production" path="production" element={<Navigate to="/production/dashboard" replace />} />,
  <Route key="cst" path="cst" element={<Navigate to="/cst/dashboard" replace />} />,
  <Route key="accounts" path="accounts" element={<Navigate to="/accounts/dashboard" replace />} />,
  <Route key="hrms-recruitment" path="hrms/recruitment" element={<Navigate to="/hrms/recruitment/jobs" replace />} />,
  <Route key="hrms-housekeeping" path="hrms/housekeeping" element={<Navigate to="/hrms/housekeeping/cleaning" replace />} />,
];
