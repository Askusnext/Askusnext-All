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
import CalendarPage from './views/CalendarPage';
import TimesheetPage from './views/TimesheetPage';
import UserManagementPage from './views/UserManagementPage';
import type { UserRole } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('tms_token');
  return token ? <>{children}</> : <Navigate to="/home" replace />;
}

function RoleRoute({ allowed, children }: { allowed: UserRole[]; children: React.ReactNode }) {
  const userRaw = sessionStorage.getItem('tms_user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role: UserRole = user?.role ?? 'Agent';
  if (!allowed.includes(role)) {
    return <Navigate to={role === 'Agent' ? '/timesheet' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function RoleHome() {
  const userRaw = sessionStorage.getItem('tms_user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role: UserRole = user?.role ?? 'Agent';
  return <Navigate to={role === 'Agent' ? '/timesheet' : '/dashboard'} replace />;
}

function HomeGate() {
  const token = sessionStorage.getItem('tms_token');
  return token ? <RoleHome /> : <Navigate to="/home" replace />;
}

function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('askus_customer_token');
  return token ? <>{children}</> : <Navigate to="/customer/login" replace />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14 }}>Coming in the next sprint</div>
    </div>
  );
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
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <DashboardPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="board" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <BoardPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <TicketsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/new" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <TicketFormPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/:id/edit" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <TicketFormPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="tickets/:id" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <TicketDetailPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="analytics" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <AnalyticsPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="calendar" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee']}>
                  <CalendarPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="timesheet" element={
                <ProtectedRoute><RoleRoute allowed={['Admin', 'Employee', 'Agent']}>
                  <TimesheetPage />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="renewals" element={
                <ProtectedRoute><RoleRoute allowed={['Admin']}>
                  <Placeholder title="Renewals" />
                </RoleRoute></ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute><RoleRoute allowed={['Admin']}>
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