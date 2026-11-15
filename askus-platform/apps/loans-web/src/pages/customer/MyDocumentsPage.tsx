import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen,
  FileText,
  CheckCircle2,
  Eye,
  Plus
} from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUserApplications } from '../../services/api/loansApi'
import { formatFileSize } from '../../utils/formatters'
import { getApplicationDocumentUrl } from '../../services/api/storageService'
import { useToast } from '../../contexts/ToastContext'
import type { ApplicationDocument } from '../../types'

export const MyDocumentsPage: React.FC = () => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [documents, setDocuments] = useState<{ doc: ApplicationDocument; appRef: string; appId: string }[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadAllDocs() {
      if (!user) return
      const apps = await fetchUserApplications(user.uid)
      const list: { doc: ApplicationDocument; appRef: string; appId: string }[] = []
      apps.forEach((app) => {
        app.documents.forEach((d) => {
          if (d.storageKey || d.fileUrl) {
            list.push({ doc: d, appRef: app.referenceNumber, appId: app.id })
          }
        })
      })
      setDocuments(list)
    }
    loadAllDocs()
  }, [user])

  return (
    <DashboardLayout
      title="Uploaded Documents Vault"
      subtitle="View, preview, and manage all KYC, salary slips, and bank statements uploaded across your applications."
    >
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Stored Files ({documents.length})</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Files are stored privately; only you and the review team can open them.
              </p>
            </div>

            <Link
              to="/apply"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Plus size={14} />
              <span>Apply & Upload More</span>
            </Link>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-800">No documents uploaded yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Files uploaded during loan applications will appear in this private vault.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map(({ doc, appRef, appId }, index) => (
                <div
                  key={index}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{doc.title}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {doc.fileName || 'document.pdf'} {doc.fileSize ? `• ${formatFileSize(doc.fileSize)}` : ''}
                      </p>
                      <span className="text-[11px] text-blue-600 font-medium">
                        Linked Application: <Link to={`/customer/applications/${appId}`} className="underline">{appRef}</Link>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {doc.status === 'verified' ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>Verified</span>
                      </span>
                    ) : doc.status === 'reupload_required' ? (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                        Re-upload Needed
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                        In Review
                      </span>
                    )}

                    {(doc.storageKey || doc.fileUrl) && (
                      <button
                        type="button"
                        onClick={async () => {
                          try { setPreviewUrl(doc.storageKey ? await getApplicationDocumentUrl(appId, doc.id) : doc.fileUrl || null) }
                          catch (error) { showToast({ type: 'error', title: 'Could not open document', message: error instanceof Error ? error.message : 'Please try again.' }) }
                        }}
                        className="rounded-xl border border-slate-300 hover:bg-slate-100 p-2 text-slate-700 transition"
                        title="Preview Document"
                      >
                        <Eye size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal preview */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="max-w-3xl w-full rounded-3xl bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Document Preview</h3>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 p-2 flex items-center justify-center">
                {previewUrl.startsWith('data:image') || /\.(jpe?g|png)(?:[?#]|$)/i.test(previewUrl) || /[?&]format=(jpe?g|png)(?:&|$)/i.test(previewUrl) ? (
                  <img src={previewUrl} alt="Preview" className="max-h-[60vh] object-contain rounded-lg" />
                ) : (
                  <iframe src={previewUrl} title="Document PDF Preview" className="w-full h-[60vh] rounded-lg" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
