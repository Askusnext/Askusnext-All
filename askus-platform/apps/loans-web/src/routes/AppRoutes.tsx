import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public Pages
import { HomePage } from '../pages/public/HomePage'
import { ServicesPage } from '../pages/public/ServicesPage'
import { DocumentGuidePage } from '../pages/public/DocumentGuidePage'
import { EmiCalculatorPage } from '../pages/public/EmiCalculatorPage'
import { PartnerBanksPage } from '../pages/public/PartnerBanksPage'
import { CibilCheckPage } from '../pages/public/CibilCheckPage'
import { ApplyPage } from '../pages/public/ApplyPage'
import { CreditCardCashPage } from '../pages/public/CreditCardCashPage'
import { CreditCardBillPage } from '../pages/public/CreditCardBillPage'

import { ApplicationReviewPage } from '../pages/public/ApplicationReviewPage'
import { DocumentUploadPage } from '../pages/public/DocumentUploadPage'
import { PersonalDetailsPage } from '../pages/public/PersonalDetailsPage'
import { KnowYouPage } from '../pages/public/KnowYouPage'
import { LoanQuotesPage } from '../pages/public/LoanQuotesPage'
import { LoansHubPage } from '../pages/public/LoansHubPage'
import { LoanProductPage } from '../pages/public/LoanProductPage'
import { CalculatorsHubPage, CalculatorPage } from '../pages/public/CalculatorsPage'
import { ExploreTopicPage } from '../pages/public/ExploreTopicPage'

// Customer Pages
import { CustomerDashboard } from '../pages/customer/CustomerDashboard'
import { ApplicationDetailPage } from '../pages/customer/ApplicationDetailPage'
import { MyDocumentsPage } from '../pages/customer/MyDocumentsPage'
import { CustomerProfilePage } from '../pages/customer/CustomerProfilePage'
import { SupportTicketsPage } from '../pages/customer/SupportTicketsPage'

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard'
import { AdminApplicationsPage } from '../pages/admin/AdminApplicationsPage'
import { AdminApplicationDetailPage } from '../pages/admin/AdminApplicationDetailPage'
import { AdminCustomersPage } from '../pages/admin/AdminCustomersPage'
import { AdminDocumentReviewPage } from '../pages/admin/AdminDocumentReviewPage'
import { AdminLendersPage } from '../pages/admin/AdminLendersPage'
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage'
import { AdminQuoteApplicationsPage } from '../pages/admin/AdminQuoteApplicationsPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'

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
