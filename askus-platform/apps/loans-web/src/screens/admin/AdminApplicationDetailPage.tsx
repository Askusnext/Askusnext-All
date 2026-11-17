import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Save
} from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { ConfirmDialog } from '../../components/admin/AdminUi'
import {
  fetchApplicationById,
  updateApplicationStatus,
  updateDocumentVerification
} from '../../services/api/loansApi'
import { formatINR, formatDateTime } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getApplicationDocumentUrl } from '../../services/api/storageService'
import type { LoanApplication, ApplicationStatus } from '../../types'

export const AdminApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [application, setApplication] = useState<LoanApplication | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Status update state
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>('under_review')
  const [adminNote, setAdminNote] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  // Rejection modal for document
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!id) return
      try {
        const app = await fetchApplicationById(id)
        if (app) {
          setApplication(app)
          setSelectedStatus(app.status)
        }
      } catch (err) {
        console.error('Error fetching application:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  if (loading) {
    return (
      <AdminLayout title="Loading Application...">
        <div className="p-12 text-center text-xs text-slate-400">Loading details...</div>
      </AdminLayout>
    )
  }

  if (!application) {
    return (
      <AdminLayout title="Application Not Found">
        <div className="p-12 text-center space-y-4">
          <p className="text-sm text-slate-400">The requested application could not be found.</p>
          <Link
            to="/admin"
            className="rounded-xl bg-blue-600 text-white font-bold text-xs px-4 py-2 inline-block"
          >
            Return to Admin Dashboard
          </Link>
        </div>
      </AdminLayout>
    )
  }

  // Update Status handler
  // Validate, then ask for confirmation before anything is written.
  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!application) return
    if (selectedStatus === application.status) {
      setStatusError('This application already has that status.')
      return
    }
    if ((selectedStatus === 'rejected' || selectedStatus === 'documents_required') && adminNote.trim().length < 5) {
      setStatusError('Add a short reason or instruction. The customer needs it to know what happens next.')
      return
    }
    setStatusError('')
    setConfirmStatus(true)
  }

  const runStatusUpdate = async () => {
    setIsUpdatingStatus(true)
    try {
      await updateApplicationStatus(
        application.id,
        selectedStatus,
        user?.uid || '',
        adminNote
      )
      const refreshed = await fetchApplicationById(application.id)
      if (refreshed) setApplication(refreshed)
      setAdminNote('')
      setConfirmStatus(false)
      showToast({
        type: 'success',
        title: 'Status Updated',
        message: `Application marked as ${selectedStatus.replace('_', ' ')}.`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      setConfirmStatus(false)
      showToast({ type: 'error', title: 'Error', message: msg })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Verify Document handler
  const handleVerifyDocument = async (docId: string) => {
    try {
      await updateDocumentVerification(
        application.id,
        docId,
        'verified',
        user?.uid || ''
      )
      const refreshed = await fetchApplicationById(application.id)
      if (refreshed) setApplication(refreshed)
      showToast({ type: 'success', title: 'Document Verified', message: 'Document marked as verified.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify'
      showToast({ type: 'error', title: 'Error', message: msg })
    }
  }

  // Reject Document & Request Re-upload handler
  const handleRejectDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingDocId || !rejectionReason.trim()) return

    try {
      await updateDocumentVerification(
        application.id,
        rejectingDocId,
        'reupload_required',
        user?.uid || '',
        rejectionReason
      )
      const refreshed = await fetchApplicationById(application.id)
      if (refreshed) setApplication(refreshed)
      setRejectingDocId(null)
      setRejectionReason('')
      showToast({
        type: 'info',
        title: 'Re-upload Requested',
        message: 'Customer has been notified to re-upload the document.'
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request reupload'
      showToast({ type: 'error', title: 'Error', message: msg })
    }
  }

  return (
    <AdminLayout
      title={`Review Application: ${application.referenceNumber}`}
      subtitle={`Applicant: ${application.fullName} • ${application.serviceName}`}
    >
      <div className="space-y-8 max-w-6xl">
        {/* Back Link */}
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Underwriting Queue</span>
        </Link>

        {/* 2-COLUMN MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: DOCUMENTS VERIFICATION QUEUE (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Document Verification Checklist</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {application.documents.filter((d) => d.status === 'verified').length} / {application.documents.length} verified
                </span>
              </div>

              {/* Cash Salary Warning Notice if applicable */}
              {application.salaryPaymentMode === 'cash' && (
                <div className="rounded-2xl bg-amber-950/60 border border-amber-800/80 p-4 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-amber-300">
                      Cash Salary Underwriting Rules:
                    </strong>
                    Verify employer-issued salary certificate, signature, and stamped wage receipts. Review 6-month bank statement for operational turnover before approving.
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {application.documents.map((doc) => {
                  const isVerified = doc.status === 'verified'
                  const isReupload = doc.status === 'reupload_required'
                  const hasFile = Boolean(doc.storageKey || doc.fileUrl)

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isVerified
                          ? 'border-emerald-800/60 bg-emerald-950/30'
                          : isReupload
                          ? 'border-rose-800/60 bg-rose-950/30'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{doc.title}</span>
                            {isVerified ? (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                                Verified
                              </span>
                            ) : isReupload ? (
                              <span className="text-[10px] font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800">
                                Re-upload Requested
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-300 bg-blue-950 px-2 py-0.5 rounded-full border border-blue-800">
                                Awaiting Review
                              </span>
                            )}
                          </div>

                          {doc.fileName && (
                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <FileText size={12} />
                              <span>{doc.fileName}</span>
                            </p>
                          )}

                          {doc.rejectionReason && (
                            <p className="text-[11px] text-rose-300 mt-1 italic">
                              Rejection note: {doc.rejectionReason}
                            </p>
                          )}
                        </div>

                        {/* Admin Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {hasFile && (
                            <button
                              type="button"
                              onClick={async () => {
                                try { setPreviewUrl(doc.storageKey ? await getApplicationDocumentUrl(application.id, doc.id) : doc.fileUrl || null) }
                                catch (error) { showToast({ type: 'error', title: 'Could not open document', message: error instanceof Error ? error.message : 'Please try again.' }) }
                              }}
                              className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="Preview Document"
                            >
                              <Eye size={14} />
                            </button>
                          )}

                          {hasFile && !isVerified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyDocument(doc.id)}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition"
                            >
                              <CheckCircle2 size={12} />
                              <span>Approve</span>
                            </button>
                          )}

                          {hasFile && !isReupload && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingDocId(doc.id)
                                setRejectionReason('')
                              }}
                              className="rounded-xl border border-rose-800 hover:bg-rose-950/60 text-rose-300 px-3 py-1.5 text-xs font-bold transition"
                            >
                              Reject / Re-upload
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Application Status History Trail */}
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Status History Trail
              </h3>
              <div className="space-y-3 text-xs">
                {application.statusHistory.map((h, i) => (
                  <div key={i} className="border-l-2 border-blue-500 pl-3 space-y-0.5">
                    <span className="font-bold text-white capitalize">{h.status.replace('_', ' ')}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {formatDateTime(h.timestamp)} {h.updatedBy ? `• by ${h.updatedBy}` : ''}
                    </span>
                    {h.note && <p className="text-slate-400">{h.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: UNDERWRITER DECISION & APPLICANT DATA (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* UNDERWRITER STATUS UPDATE PANEL */}
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-7 space-y-5">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                Underwriter Status Action
              </h3>

              <form onSubmit={handleStatusUpdate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Update Application Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => { setSelectedStatus(e.target.value as ApplicationStatus); setStatusError('') }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-base sm:p-2.5 sm:text-xs text-white font-bold"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="documents_required">Documents Required</option>
                    <option value="verification_pending">Verification Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="disbursed">Disbursed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Internal Notes / Customer Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={adminNote}
                    onChange={(e) => { setAdminNote(e.target.value); setStatusError('') }}
                    placeholder="Enter reason or instructions..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-base sm:p-2.5 sm:text-xs text-white placeholder:text-slate-600"
                  />
                </div>

                {statusError && <p role="alert" className="rounded-lg bg-rose-950/50 p-2.5 text-rose-300">{statusError}</p>}

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-md"
                >
                  <Save size={14} />
                  <span>{isUpdatingStatus ? 'Saving Status...' : 'Apply Status Change'}</span>
                </button>
              </form>
            </div>

            {/* APPLICANT PROFILE SUMMARY */}
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-3 text-xs text-slate-300">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Applicant & Employment Profile
              </h3>
              <p><strong className="text-white">Legal Name:</strong> {application.fullName}</p>
              <p><strong className="text-white">Mobile:</strong> {application.userMobile}</p>
              <p><strong className="text-white">PAN Number:</strong> <span className="font-mono text-emerald-400 font-bold">{application.panNumber}</span></p>
              <p><strong className="text-white">Employer:</strong> {application.employerName}</p>
              <p><strong className="text-white">Designation:</strong> {application.designation}</p>
              <p><strong className="text-white">Net Monthly Salary:</strong> {formatINR(application.monthlyIncome)}</p>
              <p>
                <strong className="text-white">Disbursement Mode:</strong>{' '}
                <span className="font-bold text-blue-400 capitalize">
                  {application.salaryPaymentMode.replace('_', ' ')}
                </span>
              </p>
              <p><strong className="text-white">Loan Amount:</strong> {formatINR(application.loanAmount)} ({application.tenureMonths} Mo)</p>
              <p><strong className="text-white">Selected Lender:</strong> {application.lenderName}</p>
              <p><strong className="text-white">Address:</strong> {application.currentAddress}, {application.city}, {application.state} - {application.pincode}</p>
            </div>
          </div>
        </div>

        {/* MODAL: REJECT DOCUMENT REASON */}
        {rejectingDocId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-700 p-6 text-white space-y-4">
              <h3 className="font-bold text-sm text-rose-400">Request Document Re-upload</h3>
              <p className="text-xs text-slate-400">
                Specify why this document is incomplete, illegible, or unstamped. The applicant will see this exact message.
              </p>

              <form onSubmit={handleRejectDocument} className="space-y-4">
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Salary voucher for September is missing company seal. Please re-upload stamped copy."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                />

                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRejectingDocId(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2 font-bold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 font-bold text-white"
                  >
                    Send Re-upload Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DOCUMENT PREVIEW */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="max-w-3xl w-full rounded-3xl bg-slate-900 border border-slate-700 p-6 text-white space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm">Document Underwriter Preview</h3>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-800 p-2 flex items-center justify-center bg-slate-950">
                {previewUrl.startsWith('data:image') || /\.(jpe?g|png)(?:[?#]|$)/i.test(previewUrl) || /[?&]format=(jpe?g|png)(?:&|$)/i.test(previewUrl) ? (
                  <img src={previewUrl} alt="Document" className="max-h-[60vh] object-contain rounded-lg" />
                ) : (
                  <iframe src={previewUrl} title="Document PDF Preview" className="w-full h-[60vh] rounded-lg" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {confirmStatus && application && (
        <ConfirmDialog
          title="Change application status?"
          message={<>Mark <strong className="text-white">{application.referenceNumber}</strong> as <strong className="text-white">{selectedStatus.replace('_', ' ')}</strong>. This is recorded in the audit trail{adminNote.trim() ? ' with your note' : ''}.</>}
          confirmLabel="Yes, change status"
          tone={selectedStatus === 'rejected' ? 'danger' : 'primary'}
          busy={isUpdatingStatus}
          onConfirm={() => void runStatusUpdate()}
          onCancel={() => setConfirmStatus(false)}
        />
      )}
    </AdminLayout>
  )
}
