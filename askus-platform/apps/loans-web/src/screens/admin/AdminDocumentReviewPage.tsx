import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { ConfirmDialog, ErrorBlock, LoadingBlock } from '../../components/admin/AdminUi'
import type { LoadState } from '../../components/admin/paging'
import {
  fetchAllApplications,
  updateDocumentVerification
} from '../../services/api/loansApi'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getApplicationDocumentUrl } from '../../services/api/storageService'
import type { ApplicationDocument } from '../../types'

interface QueueItem {
  doc: ApplicationDocument
  appId: string
  referenceNumber: string
  applicantName: string
  lenderName: string
  salaryMode: string
}

export const AdminDocumentReviewPage: React.FC = () => {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [filter, setFilter] = useState<'pending' | 'reupload_required' | 'verified' | 'all'>('pending')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [approving, setApproving] = useState<QueueItem | null>(null)
  const [approveBusy, setApproveBusy] = useState(false)
  const [state, setState] = useState<LoadState>('loading')

  const toQueue = (apps: Awaited<ReturnType<typeof fetchAllApplications>>) => {
    const items: QueueItem[] = []
    apps.forEach((a) => {
      a.documents.forEach((d) => {
        if (d.storageKey || d.fileUrl) {
          items.push({
            doc: d,
            appId: a.id,
            referenceNumber: a.referenceNumber,
            applicantName: a.fullName,
            lenderName: a.lenderName,
            salaryMode: a.salaryPaymentMode
          })
        }
      })
    })
    return items
  }

  const loadQueue = async () => {
    setQueue(toQueue(await fetchAllApplications()))
    setState('ready')
  }

  useEffect(() => {
    let active = true
    void fetchAllApplications()
      .then((apps) => {
        if (!active) return
        setQueue(toQueue(apps))
        setState('ready')
      })
      .catch(() => active && setState('error'))
    return () => {
      active = false
    }
  }, [])

  const reload = () => {
    setState('loading')
    void loadQueue().catch(() => setState('error'))
  }

  const filtered = queue.filter((item) => {
    if (filter === 'all') return true
    return item.doc.status === filter
  })

  const handleApprove = async (item: QueueItem) => {
    setApproveBusy(true)
    try {
      await updateDocumentVerification(item.appId, item.doc.id, 'verified', user?.uid || 'admin-001')
      await loadQueue()
      showToast({ type: 'success', title: 'Document Verified', message: `${item.doc.title} approved.` })
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to update document' })
    } finally {
      setApproveBusy(false)
      setApproving(null)
    }
  }

  return (
    <AdminLayout
      title="Document Verification Queue"
      subtitle="Cross-application inspection queue for applicant KYC, salary slips, and wage records."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Filter:</span>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900'
            }`}
          >
            Awaiting Review ({queue.filter((q) => q.doc.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('reupload_required')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filter === 'reupload_required'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900'
            }`}
          >
            Re-upload Requested ({queue.filter((q) => q.doc.status === 'reupload_required').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filter === 'verified'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900'
            }`}
          >
            Verified ({queue.filter((q) => q.doc.status === 'verified').length})
          </button>
        </div>

        <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-800/80">
            {state === 'loading' ? (
              <LoadingBlock label="Loading documents..." />
            ) : state === 'error' ? (
              <ErrorBlock message="Could not load documents. Check your connection and permissions." onRetry={reload} />
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No documents match the selected filter.
              </div>
            ) : (
              filtered.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/60 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.doc.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.doc.status === 'verified'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : item.doc.status === 'reupload_required'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {item.doc.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Applicant: <strong className="text-slate-200">{item.applicantName}</strong> • Target: {item.lenderName}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>App: <Link to={`/admin/applications/${item.appId}`} className="text-blue-400 hover:underline">{item.referenceNumber}</Link></span>
                      <span>•</span>
                      <span className="capitalize">{item.salaryMode.replace('_', ' ')}</span>
                      {item.doc.fileName && <span>• File: {item.doc.fileName}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {(item.doc.storageKey || item.doc.fileUrl) && (
                      <button
                        type="button"
                        onClick={async () => {
                          try { setPreviewUrl(item.doc.storageKey ? await getApplicationDocumentUrl(item.appId, item.doc.id) : item.doc.fileUrl || null) }
                          catch (error) { showToast({ type: 'error', title: 'Could not open document', message: error instanceof Error ? error.message : 'Please try again.' }) }
                        }}
                        className="p-2 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300"
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                    )}

                    {item.doc.status !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => setApproving(item)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold"
                      >
                        Approve
                      </button>
                    )}

                    <Link
                      to={`/admin/applications/${item.appId}`}
                      className="rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      Open Application
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal: Document Preview */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="max-w-3xl w-full rounded-3xl bg-slate-900 border border-slate-700 p-6 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm">Underwriting Preview</h3>
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
                  <iframe src={previewUrl} title="Document Preview" className="w-full h-[60vh] rounded-lg" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {approving && (
        <ConfirmDialog
          title="Approve this document?"
          message={<>Mark <strong className="text-white">{approving.doc.title}</strong> from {approving.applicantName} ({approving.referenceNumber}) as verified.</>}
          confirmLabel="Approve"
          busy={approveBusy}
          onConfirm={() => void handleApprove(approving)}
          onCancel={() => setApproving(null)}
        />
      )}
    </AdminLayout>
  )
}
