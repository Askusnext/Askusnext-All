import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { store } from './store';
import AppLayout from './components/AppLayout';
import LoginPage from './views/LoginPage';
import LandingPage from './views/LandingPage';
import AboutPage from './views/AboutPage';
import ServicesPage from './views/ServicesPage';
import ContactPage from './views/ContactPage';
import CareersPage from './views/CareersPage';
import ProductsPage from './views/ProductsPage';
import O2TaxiPage from './views/O2TaxiPage';
import AlphaaInsurancePage from './views/AlphaaInsurancePage';
import AlphaaLoansPage from './views/AlphaaLoansPage';
import AIAgentsPage from './views/AIAgentsPage';
import HelpCenterPage from './views/HelpCenterPage';
import HelpArticlePage from './views/HelpArticlePage';
import CustomerLoginPage from './views/CustomerLoginPage';
import CustomerTicketsPage from './views/CustomerTicketsPage';
import CustomerTicketFormPage from './views/CustomerTicketFormPage';
import CustomerTicketDetailPage from './views/CustomerTicketDetailPage';
import DashboardPage from './views/DashboardPage';
import BoardPage from './views/BoardPage';
import TicketsPage from './views/TicketsPage';
import TicketDetailPage from './views/TicketDetailPage';
import TicketFormPage from './views/TicketFormPage';
import AnalyticsPage from './views/AnalyticsPage';
import RenewalsPage from './views/RenewalsPage';
import UnifiedCalendarPage from './views/UnifiedCalendarPage';
import TimesheetPage from './views/TimesheetPage';
import AttendancePage from './views/AttendancePage';
import WorkHoursPage from './views/WorkHoursPage';
import UserManagementPage from './views/UserManagementPage';
import LoansPage from './views/LoansPage';
import InsuranceRequestsPage from './views/InsuranceRequestsPage';
import ActivityPage from './views/ActivityPage';
import type { Permission } from './types';
import { hasPermission, homePath, isAdminRole } from './access';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('tms_token');
  return token ? <>{children}</> : <Navigate to="/home" replace />;
}

function storedUser() {
  const userRaw = localStorage.getItem('tms_user');
  return userRaw ? JSON.parse(userRaw) : null;
}

// Admin-only routes use adminOnly; everything else is gated by the permission an Admin granted.
function RoleRoute({ permission, adminOnly, children }: { permission?: Permission; adminOnly?: boolean; children: React.ReactNode }) {
  const user = storedUser();
  const allowed = adminOnly ? isAdminRole(user?.role) : hasPermission(user, permission);
  if (!allowed) {
    const home = homePath(user);
    return home ? <Navigate to={home} replace /> : <NoAccess />;
  }
  return <>{children}</>;
}

function NoAccess() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h2>No access yet</h2>
      <p>Your account has no permissions assigned. Please ask an Admin to grant you access.</p>
    </div>
  );
}

function RoleHome() {
  const home = homePath(storedUser());
  return home ? <Navigate to={home} replace /> : <NoAccess />;
}

function HomeGate() {
  const token = localStorage.getItem('tms_token');
  return token ? <RoleHome /> : <Navigate to="/home" replace />;
}

function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('askus_customer_token');
  return token ? <>{children}</> : <Navigate to="/customer/login" replace />;
}

export default function App() {
  return (
    <Provider store={store}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#C8102E',
            borderRadius: 8,
            fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
          },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<Navigate to="/login" replace />} />
            <Route path="/forgot-password" element={<Navigate to="/login" replace />} />

            <Route path="/home"                          element={<LandingPage />} />
            <Route path="/about"                         element={<AboutPage />} />
            <Route path="/services"                      element={<ServicesPage />} />
            <Route path="/contact"                       element={<ContactPage />} />
            <Route path="/careers"                       element={<CareersPage />} />
            <Route path="/products"                      element={<ProductsPage />} />
            <Route path="/products/ai-agents"             element={<AIAgentsPage />} />
            <Route path="/products/o2-taxi"               element={<O2TaxiPage />} />
            <Route path="/products/alphaa-insurance"       element={<AlphaaInsurancePage />} />
            <Route path="/products/alphaa-loans"           element={<AlphaaLoansPage />} />

            <Route path="/help"       element={<HelpCenterPage />} />
            <Route path="/help/:slug" element={<HelpArticlePage />} />

            <Route path="/customer/login"    element={<CustomerLoginPage />} />
            <Route path="/customer/register" element={<Navigate to="/customer/login" replace />} />
            <Route path="/customer/tickets" element={
              <CustomerProtectedRoute><CustomerTicketsPage /></CustomerProtectedRoute>
            } />
            <Route path="/customer/tickets/new" element={
              <CustomerProtectedRoute><CustomerTicketFormPage /></CustomerProtectedRoute>
            } />
            <Route path="/customer/tickets/:id" element={
              <CustomerProtectedRoute><CustomerTicketDetailPage /></CustomerProtectedRoute>
            } />

            <Route path="/" element={<AppLayout />}>
              <Route index element={<HomeGate />} />

              <Route path="dashboard" element={
                <ProtectedRoute><RoleRoute permission="reports">
                  <DashboardPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="board" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <BoardPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <TicketsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/new" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <TicketFormPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/:id/edit" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <TicketFormPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/:id" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <TicketDetailPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="analytics" element={
                <ProtectedRoute><RoleRoute permission="reports">
                  <AnalyticsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="calendar" element={
                <ProtectedRoute><UnifiedCalendarPage /></ProtectedRoute>
              } />
              <Route path="timesheet" element={
                <ProtectedRoute><RoleRoute permission="timesheet">
                  <TimesheetPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="attendance" element={
                <ProtectedRoute><RoleRoute permission="timesheet">
                  <AttendancePage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="work-hours" element={
                <ProtectedRoute><RoleRoute permission="timesheet">
                  <WorkHoursPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="insurance-requests" element={
                <ProtectedRoute><RoleRoute permission="insurance">
                  <InsuranceRequestsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="activity" element={
                <ProtectedRoute><RoleRoute>
                  <ActivityPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="loans" element={
                <ProtectedRoute><RoleRoute permission="loans">
                  <LoansPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="renewals" element={
                <ProtectedRoute><RoleRoute permission="tickets">
                  <RenewalsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute><RoleRoute adminOnly>
                  <UserManagementPage />
                </RoleRoute></ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </Provider>
  );
}