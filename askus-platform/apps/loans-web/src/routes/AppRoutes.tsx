import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public Pages
import { HomePage } from '../screens/public/HomePage'
import { ServicesPage } from '../screens/public/ServicesPage'
import { DocumentGuidePage } from '../screens/public/DocumentGuidePage'
import { EmiCalculatorPage } from '../screens/public/EmiCalculatorPage'
import { PartnerBanksPage } from '../screens/public/PartnerBanksPage'
import { CibilCheckPage } from '../screens/public/CibilCheckPage'
import { ApplyPage } from '../screens/public/ApplyPage'
import { CreditCardCashPage } from '../screens/public/CreditCardCashPage'
import { CreditCardBillPage } from '../screens/public/CreditCardBillPage'

import { ApplicationReviewPage } from '../screens/public/ApplicationReviewPage'
import { DocumentUploadPage } from '../screens/public/DocumentUploadPage'
import { PersonalDetailsPage } from '../screens/public/PersonalDetailsPage'
import { KnowYouPage } from '../screens/public/KnowYouPage'
import { LoanQuotesPage } from '../screens/public/LoanQuotesPage'
import { LoansHubPage } from '../screens/public/LoansHubPage'
import { LoanProductPage } from '../screens/public/LoanProductPage'
import { CalculatorsHubPage, CalculatorPage } from '../screens/public/CalculatorsPage'
import { ExploreTopicPage } from '../screens/public/ExploreTopicPage'

// Customer Pages
import { CustomerDashboard } from '../screens/customer/CustomerDashboard'
import { ApplicationDetailPage } from '../screens/customer/ApplicationDetailPage'
import { MyDocumentsPage } from '../screens/customer/MyDocumentsPage'
import { CustomerProfilePage } from '../screens/customer/CustomerProfilePage'
import { SupportTicketsPage } from '../screens/customer/SupportTicketsPage'

// Admin Pages
import { AdminDashboard } from '../screens/admin/AdminDashboard'
import { AdminApplicationsPage } from '../screens/admin/AdminApplicationsPage'
import { AdminApplicationDetailPage } from '../screens/admin/AdminApplicationDetailPage'
import { AdminCustomersPage } from '../screens/admin/AdminCustomersPage'
import { AdminDocumentReviewPage } from '../screens/admin/AdminDocumentReviewPage'
import { AdminLendersPage } from '../screens/admin/AdminLendersPage'
import { AdminAuditLogsPage } from '../screens/admin/AdminAuditLogsPage'
import { AdminQuoteApplicationsPage } from '../screens/admin/AdminQuoteApplicationsPage'
import { AdminLoginPage } from '../screens/admin/AdminLoginPage'

// Route Guards
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/document-guide" element={<DocumentGuidePage />} />
      <Route path="/calculator" element={<EmiCalculatorPage />} />
      <Route path="/partner-banks" element={<PartnerBanksPage />} />
      <Route path="/cibil-check" element={<CibilCheckPage />} />
      <Route path="/loans" element={<LoansHubPage />} />
      <Route path="/loans/quotes" element={<LoanQuotesPage />} />
      <Route path="/loans/quotes/know-you" element={<KnowYouPage />} />
      <Route path="/loans/quotes/personal-details" element={<PersonalDetailsPage />} />
      <Route path="/loans/quotes/documents" element={<DocumentUploadPage />} />
      <Route path="/loans/quotes/review" element={<ApplicationReviewPage />} />
      <Route path="/loans/:slug" element={<LoanProductPage />} />
      <Route path="/calculators" element={<CalculatorsHubPage />} />
      <Route path="/calculators/:id" element={<CalculatorPage />} />
      <Route path="/explore/:slug" element={<ExploreTopicPage />} />
      <Route path="/services/credit-cards" element={<Navigate to="/explore/credit-card" replace />} />
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/services/credit-card-cash" element={<CreditCardCashPage />} />
      <Route path="/services/credit-card-bill" element={<CreditCardBillPage />} />

      {/* Customer Protected Routes */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/applications"
        element={
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/applications/:id"
        element={
          <ProtectedRoute>
            <ApplicationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/documents"
        element={
          <ProtectedRoute>
            <MyDocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/profile"
        element={
          <ProtectedRoute>
            <CustomerProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/support"
        element={
          <ProtectedRoute>
            <SupportTicketsPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Protected Routes */}
      <Route path="/admin/quote-applications" element={<Navigate to="/admin/applications" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/legacy-applications"
        element={
          <AdminRoute>
            <AdminApplicationsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/applications/:id"
        element={
          <AdminRoute>
            <AdminApplicationDetailPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <AdminRoute>
            <AdminQuoteApplicationsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <AdminRoute>
            <AdminCustomersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <AdminRoute>
            <AdminDocumentReviewPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/lenders"
        element={
          <AdminRoute>
            <AdminLendersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <AdminRoute>
            <AdminAuditLogsPage />
          </AdminRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
