import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileText,
  Check
} from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { fetchApplicationById } from '../../services/api/loansApi'
import { formatINR, formatDate, formatDateTime } from '../../utils/formatters'
import type { LoanApplication, ApplicationStatus } from '../../types'

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const [application, setApplication] = useState<LoanApplication | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      try {
        const app = await fetchApplicationById(id)
        setApplication(app)
      } catch (err) {
        console.error('Error fetching app:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  if (loading) {
    return (
      <DashboardLayout title="Loading Application...">
        <div className="p-12 text-center text-xs text-slate-400">Loading details...</div>
      </DashboardLayout>
    )
  }

  if (!application) {
    return (
      <DashboardLayout title="Application Not Found">
        <div className="p-12 text-center space-y-4">
          <p className="text-sm text-slate-600">The requested application could not be found.</p>
          <Link
            to="/customer"
            className="rounded-xl bg-blue-600 text-white font-bold text-xs px-4 py-2 inline-block"
          >
            Return to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  // Status timeline steps
  const timelineStages: { key: ApplicationStatus; label: string }[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'verification_pending', label: 'Verification' },
    { key: 'approved', label: 'Approved' },
    { key: 'disbursed', label: 'Disbursed' }
  ]

  const getStageIndex = (status: ApplicationStatus): number => {
    switch (status) {
      case 'submitted':
        return 0
      case 'under_review':
      case 'documents_required':
        return 1
      case 'verification_pending':
        return 2
      case 'approved':
        return 3
      case 'disbursed':
      case 'closed':
        return 4
      case 'rejected':
        return 1
      default:
        return 0
    }
  }

  const currentStageIndex = getStageIndex(application.status)

  return (
    <DashboardLayout
      title={`Application: ${application.referenceNumber}`}
      subtitle={`Submitted on ${formatDate(application.createdAt)} • ${application.serviceName}`}
    >
      <div className="space-y-8 max-w-5xl">
        {/* Back Link */}
        <Link
          to="/customer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft size={14} />
          <span>Back to All Applications</span>
        </Link>

        {/* STATUS PROGRESS BAR */}
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Current Application Status
              </span>
              <div className="text-xl font-extrabold text-slate-900 capitalize mt-0.5">
                {application.status.replace('_', ' ')}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                {application.lenderName}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                {formatINR(application.loanAmount)}
              </span>
            </div>
          </div>

          {/* Visual Step Progress */}
          <div className="relative pt-4 pb-2">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2" />
            <div
              className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(currentStageIndex / (timelineStages.length - 1)) * 100}%` }}
            />

            <div className="relative flex justify-between">
              {timelineStages.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex
                const isCurrent = idx === currentStageIndex
                return (
                  <div key={stage.key} className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPassed
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check size={14} /> : idx + 1}
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-semibold hidden sm:block ${
                        isCurrent ? 'text-blue-700 font-bold' : isPassed ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Underwriter Notes / Rejection banner */}
          {application.adminNotes && (
            <div className="rounded-2xl bg-blue-50/70 border border-blue-200 p-4 text-xs text-blue-900 leading-relaxed">
              <strong className="block font-bold text-blue-950 mb-0.5">
                Underwriter Notes / Advisory Update:
              </strong>
              {application.adminNotes}
            </div>
          )}
        </div>

        {(application.status === 'approved' || application.status === 'disbursed') && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <h2 className="font-bold">Loan repayment</h2>
            {application.status === 'approved' ? (
              <p className="mt-1">Approval is not disbursement. Once the lender disburses the loan, follow the final interest rate, repayment dates, and schedule in your lender’s loan agreement.</p>
            ) : (
              <p className="mt-1">Repayments are due under your lender’s final loan agreement. Pay through the lender’s official app, website, bank mandate, or other channel the lender provides. Askus Fin does not collect loan repayments here.</p>
            )}
            <p className="mt-2 text-xs">The interest and EMI shown during application are estimates. The lender’s signed sanction and repayment schedule control the actual amount due.</p>
          </section>
        )}

        {/* 2-COLUMN DETAILS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: DOCUMENTS UPLOAD & REVIEW (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Submitted Documents</h3>
                <span className="text-xs text-slate-500">
                  {application.documents.filter((d) => d.storageKey || d.fileUrl).length} of {application.documents.length} attached
                </span>
              </div>

              <div className="space-y-4">
                {application.documents.map((doc) => {
                  const isVerified = doc.status === 'verified'
                  const isReupload = doc.status === 'reupload_required'

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isVerified
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : isReupload
                          ? 'border-rose-300 bg-rose-50/50'
                          : 'border-slate-200 bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                            {isVerified ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Verified
                              </span>
                            ) : isReupload ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                Re-upload Required
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                Pending Verification
                              </span>
                            )}
                          </div>

                          {doc.fileName && (
                            <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                              <FileText size={12} />
                              <span>{doc.fileName}</span>
                            </p>
                          )}

                          {isReupload && doc.rejectionReason && (
                            <div className="mt-2 p-2.5 rounded-xl bg-white border border-rose-200 text-xs text-rose-800">
                              <strong className="block font-bold">Feedback from Underwriter:</strong>
                              {doc.rejectionReason}
                            </div>
                          )}
                        </div>

                        {/* Action: Re-upload button if requested */}
                        {isReupload && (
                          <label className="shrink-0 cursor-not-allowed rounded-xl bg-slate-400 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                            <Upload size={12} />
                            <span>Upload unavailable</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Application Status History Trail */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Status History Trail
              </h3>
              <div className="space-y-3 text-xs">
                {application.statusHistory.map((hist, i) => (
                  <div key={i} className="flex items-start gap-3 border-l-2 border-blue-500 pl-3">
                    <div>
                      <span className="font-bold text-slate-900 capitalize">
                        {hist.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {formatDateTime(hist.timestamp)}
                      </span>
                      {hist.note && <p className="text-slate-600 mt-0.5">{hist.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: APPLICANT & LOAN SUMMARY (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Financial Parameters */}
            <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-7 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                Sanction Parameters
              </h3>

              <div className="space-y-3 text-xs border-b border-slate-800 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Loan Amount:</span>
                  <span className="font-extrabold text-sm text-white">
                    {formatINR(application.loanAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tenure:</span>
                  <span className="font-bold text-white">
                    {application.tenureMonths} Months ({application.tenureMonths / 12} Yrs)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Illustrative rate (not an offer):</span>
                  <span className="font-bold text-emerald-400">
                    {application.interestRate}% p.a.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monthly EMI:</span>
                  <span className="font-extrabold text-blue-400">
                    {formatINR(application.calculatedEmi)} / mo
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400">
                <p><strong className="text-slate-300">Selected Lender:</strong> {application.lenderName}</p>
                <p><strong className="text-slate-300">Purpose:</strong> {application.purpose}</p>
              </div>
            </div>

            {/* Applicant Profile */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs space-y-3 text-xs text-slate-600">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Applicant & Employment Profile
              </h3>
              <p><strong className="text-slate-800">Legal Name:</strong> {application.fullName}</p>
              <p><strong className="text-slate-800">PAN Number:</strong> {application.panNumber}</p>
              <p><strong className="text-slate-800">Mobile:</strong> {application.userMobile}</p>
              <p><strong className="text-slate-800">Employer:</strong> {application.employerName}</p>
              <p><strong className="text-slate-800">Designation:</strong> {application.designation}</p>
              <p><strong className="text-slate-800">Net Monthly Salary:</strong> {formatINR(application.monthlyIncome)}</p>
              <p>
                <strong className="text-slate-800">Disbursement Mode:</strong>{' '}
                <span className="font-semibold text-blue-700 capitalize">
                  {application.salaryPaymentMode.replace('_', ' ')}
                </span>
              </p>
              <p><strong className="text-slate-800">Address:</strong> {application.currentAddress}, {application.city}, {application.state} - {application.pincode}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
