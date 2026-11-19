import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  PlusCircle
} from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { fetchSupportTickets, createSupportTicket } from '../../services/api/loansApi'
import { formatDate } from '../../utils/formatters'
import { useToast } from '../../contexts/ToastContext'
import type { SupportTicket } from '../../types'

export const SupportTicketsPage: React.FC = () => {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Loan Application')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    if (user) {
      void fetchSupportTickets(user.uid).then((items) => setTickets(items as SupportTicket[])).catch(() => setTickets([]))
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      showToast({ type: 'error', title: 'Missing Info', message: 'Please provide subject and details.' })
      return
    }

    setIsSubmitting(true)
    try {
    const newTkt = await createSupportTicket({
      userId: user?.uid,
      userName: user?.displayName || '',
      userMobile: user?.mobileNumber || '',
      subject,
      category,
      message
    })

    setTickets((prev) => [newTkt as SupportTicket, ...prev])
    setSubject('')
    setMessage('')
    setShowNewModal(false)

    showToast({
      type: 'success',
      title: 'Ticket Submitted',
      message: 'Your support inquiry was saved.'
    })
    } catch (error) {
      showToast({ type: 'error', title: 'Ticket was not saved', message: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout
      title="Help & Advisory Desk"
      subtitle="Have questions about lender documentation, cash salary acceptance, or loan status? Request support below."
    >
      <div className="space-y-6 max-w-4xl">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900">Your Support Inquiries</h3>
            <p className="text-xs text-slate-500">Track responses from Askus Financial Services credit specialists.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 flex items-center gap-1.5 shadow-xs transition"
          >
            <PlusCircle size={14} />
            <span>New Ticket</span>
          </button>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-800">No support tickets</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Need guidance on bank documentation or status? Submit an inquiry and our operations team will assist you.
              </p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-3xl bg-white border border-slate-200 p-6 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{t.subject}</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {t.category}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      t.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {t.status === 'resolved' ? 'Resolved' : 'In Progress'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{t.message}</p>

                {t.reply && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed space-y-1">
                    <strong className="block font-bold text-blue-950">
                      Response from Askus Financial Services Advisor:
                    </strong>
                    <p>{t.reply}</p>
                  </div>
                )}

                <div className="pt-2 text-[10px] text-slate-400 font-mono">
                  Submitted on {formatDate(t.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal for new ticket */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="max-w-lg w-full rounded-3xl bg-white p-7 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-base">Create Support Inquiry</h3>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inquiry Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-medium text-slate-900"
                  >
                    <option value="Loan Application">Loan Application Status</option>
                    <option value="Documentation">Company-Wise Documents</option>
                    <option value="Cash Salary">Cash Salary Acceptance</option>
                    <option value="Credit Card">Credit Card Bill / Cash</option>
                    <option value="Other">Other Query</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your question"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message Details</label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about your query..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-900"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-blue-600 text-white px-5 py-2 font-bold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending...' : 'Submit Inquiry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
