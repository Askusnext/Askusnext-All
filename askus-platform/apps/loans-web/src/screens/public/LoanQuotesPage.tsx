import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChartNoAxesColumnDecreasing } from 'lucide-react'
import { ALL_LENDERS, findLender, type QuoteLender, type SortKey } from '../../constants/quotesData'
import { QUOTE_TYPES, QUOTE_TYPE_NAMES, resolveQuoteType } from '../../constants/quotesTypes'
import {
  adaptLender, affordabilityLevel, approvalFor, emiFor, formatAmountLabel, price, sortLenders,
  type IncomeProfile, type OngoingItem, type PricedLender,
} from '../../utils/quotes'
import { STATUS_INFO } from '../../constants/quoteStatus'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useCustomerDetails, useQuoteApplications } from '../../hooks/useQuoteApplications'
import { deleteQuoteApplication, quoteApplicationId } from '../../services/api/loansApi'
import { AuthModal } from '../../components/auth/AuthModal'
import { OfferCard } from '../../components/quotes/OfferCard'
import { CategoryTabs, ProfileChip, SortCard, ValueTile, type Category } from '../../components/quotes/QuotesControls'
import { CallModal, EditValueModal, KfsModal, SortSheet } from '../../components/quotes/QuotesModals'
import {
  Disclosures, OngoingCarousel, QuotesHeaderLogo, RateAlert, RequestCallFab, Testimonials, UnmatchedOffers, WhySection,
} from '../../components/quotes/QuotesSections'

type Modal = 'amount' | 'tenure' | 'sort' | 'call' | null

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const EMPLOYMENT_LABELS: Record<string, string> = {
  salaried: 'Salaried',
  self_employed: 'Self Employed',
  professional: 'Self Employed Professional',
  other: 'Other',
}

const incomeLakhs = (monthly: number) => +((monthly * 12) / 100000).toFixed(1)

/**
 * Loan quotes page, rebuilt from the captured reference layout and reused for
 * every loan type (?type=personal-loan | home-loan | business-loan | ...).
 *
 * Real data: the signed-in customer's name, employment and income come from
 * their profile, "On Going Applications" are their saved in-progress
 * applications (refreshed from the API), and approval chances / eligibility are
 * computed from their income. Lender names, rates and limits are sample data.
 */
const QuotesInner: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { type, tabIndex } = resolveQuoteType(params.get('type'))
  const { user, isAuthenticated, isLoading, openAuthModal } = useAuth()
  const { showToast } = useToast()

  const uid = user?.uid
  const { details, loaded: detailsLoaded } = useCustomerDetails(uid)
  const { apps, error: appsError, loaded: appsLoaded } = useQuoteApplications(uid)

  const income: IncomeProfile = useMemo(
    () => ({ monthlyIncome: details?.monthlyIncome ?? null, employmentType: details?.employmentType ?? '' }),
    [details],
  )

  const initialAmount = Number(params.get('amount'))
  const [category, setCategory] = useState<Category>(tabIndex === 0 ? 'small' : 'large')
  const tab = type.tabs[category === 'small' ? 0 : 1]

  const [amount, setAmount] = useState(() => {
    if (Number.isFinite(initialAmount) && initialAmount > 0) return clamp(initialAmount, type.tabs[0].min, type.tabs[1].max)
    return tab.defaultAmount
  })
  const [months, setMonths] = useState(type.tenure.defaultMonths)
  const [sort, setSort] = useState<SortKey>('approval')
  const [modal, setModal] = useState<Modal>(null)
  const [kfs, setKfs] = useState<{ lender: PricedLender; amount: number; months: number } | null>(null)

  // Keep the active tab consistent with an amount that came from the URL.
  const [synced, setSynced] = useState(false)
  if (!synced) {
    setSynced(true)
    if (amount >= type.tabs[1].min && category !== 'large') setCategory('large')
    else if (amount < type.tabs[1].min && category !== 'small') setCategory('small')
  }

  const changeCategory = (c: Category) => {
    setCategory(c)
    setAmount(type.tabs[c === 'small' ? 0 : 1].defaultAmount)
  }

  // Offers: priced for the chosen amount/tenure, with approval from the customer's income.
  const { matched, unmatched } = useMemo(() => {
    const ok: PricedLender[] = []
    const no: QuoteLender[] = []
    for (const raw of ALL_LENDERS) {
      const l = adaptLender(raw, type)
      const fitsAmount = l.maxAmount >= amount && (!tab.requireInstant || l.instant)
      const priced = price([l], amount, months)[0]
      const affordable = affordabilityLevel(priced.emi, income) !== 1
      if (fitsAmount && affordable) ok.push({ ...priced, approval: approvalFor(l, priced.emi, income) })
      else no.push(l)
    }
    return { matched: sortLenders(ok, sort), unmatched: no }
  }, [amount, months, tab, sort, type, income])

  // On Going Applications: the customer's saved, unfinished applications.
  const ongoing: OngoingItem[] = useMemo(() => {
    const items: OngoingItem[] = []
    for (const app of apps) {
      if (app.status !== 'in_progress') continue
      const base = findLender(app.lenderId)
      const appType = QUOTE_TYPES[app.loanType]
      if (!base || !appType) continue
      const l = adaptLender(base, appType)
      const emi = emiFor(app.amount, app.roi, app.tenureMonths)
      items.push({
        ...l,
        roi: app.roi,
        emi,
        approval: approvalFor(l, emi, income),
        docId: app.id,
        tag: QUOTE_TYPE_NAMES[app.loanType] ?? app.loanType,
        appAmount: app.amount,
        appMonths: app.tenureMonths,
        appType: app.loanType,
        appPurpose: app.purpose,
        appStep: app.step,
      })
    }
    return items
  }, [apps, income])

  // Apply Now continues to the "Let's Get to Know You" step.
  const handleApply = (l: PricedLender) => {
    const already = apps.find((a) => a.id === quoteApplicationId(type.id, l.id) && a.status !== 'in_progress')
    if (already) {
      if (already.status === 'documents_required') {
        // The reviewer asked for changes: take the customer straight to the documents.
        const q = new URLSearchParams({ type: already.loanType, lender: already.lenderId, amount: String(already.amount), tenure: String(already.tenureMonths) })
        navigate(`/loans/quotes/documents?${q.toString()}`)
        return
      }
      showToast({ type: 'info', title: STATUS_INFO[already.status].customerLabel, message: `Your ${QUOTE_TYPE_NAMES[type.id] ?? 'loan'} application to ${l.name} is already with us (${already.referenceNumber ?? 'reference pending'}). See it under Loan applications on your dashboard.` })
      return
    }
    const q = new URLSearchParams({ type: type.id, lender: l.id, amount: String(Math.min(amount, l.maxAmount)), tenure: String(months) })
    navigate(`/loans/quotes/know-you?${q.toString()}`)
  }

  const handleResume = (l: OngoingItem) => {
    const q = new URLSearchParams({ type: l.appType, lender: l.id, amount: String(l.appAmount), tenure: String(l.appMonths) })
    if (l.appPurpose) q.set('purpose', l.appPurpose)
    const page = l.appStep === 'know_you' ? 'know-you' : l.appStep === 'details_confirmed' ? 'personal-details' : l.appStep === 'documents_uploaded' ? 'review' : 'documents'
    navigate(`/loans/quotes/${page}?${q.toString()}`)
  }

  const handleDiscard = async (l: OngoingItem) => {
    if (!uid) return
    try {
      await deleteQuoteApplication(uid, l.docId)
      showToast({ type: 'info', title: 'Application removed', message: `${l.name} ${l.tag} application removed.` })
    } catch {
      showToast({ type: 'error', title: 'Could not remove', message: 'Please try again.' })
    }
  }

  const openKfs = (l: PricedLender) => {
    const o = l as Partial<OngoingItem>
    setKfs({ lender: l, amount: o.appAmount ?? amount, months: o.appMonths ?? months })
  }

  const amountLabel = formatAmountLabel(amount)
  const tenureLabel = `${months} Months`

  const chipName = details?.fullName || user?.displayName || 'Customer'
  const chipSubtitle = details?.monthlyIncome
    ? `${EMPLOYMENT_LABELS[details.employmentType] ?? 'Income'} | Income ${incomeLakhs(details.monthlyIncome)} Lakhs a year`
    : 'Add your income to personalise offers'
  const chip = (
    <ProfileChip
      authed={isAuthenticated}
      loading={isLoading || (isAuthenticated && !detailsLoaded)}
      name={chipName}
      subtitle={chipSubtitle}
      onEdit={() => navigate('/customer/profile')}
      onLogin={() => openAuthModal('phone')}
    />
  )

  return (
    <main className="quotes-bg-page min-h-[100dvh] w-full font-poppins">
      <div className="relative flex h-[100dvh] flex-col overflow-hidden">
        {/* Header */}
        <div className="z-10 flex min-h-[56px] w-full shrink-0 items-center justify-between bg-white shadow-[0_0_8px_0_rgba(0,0,0,0.16)] sm:min-h-[60px] md:min-h-[64px]">
          <div className="mx-auto flex w-full max-w-[1367px] shrink-0 items-center justify-between px-5 py-2 md:px-20">
            <QuotesHeaderLogo />
            <div className="hidden md:flex">{chip}</div>
          </div>
        </div>

        <div className="quotes-scroll-none flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
          {/* Mobile profile + value strip */}
          <div className="flex shrink-0 md:hidden">{chip}</div>
          <div className="flex shrink-0 md:hidden">
            <div className="flex w-full min-w-0 bg-white">
              <div className="flex min-w-0 flex-1"><ValueTile variant="flat" label="Loan Amount" value={amountLabel} onClick={() => setModal('amount')} /></div>
              <div aria-hidden className="w-px shrink-0 self-stretch bg-[#e8eaed]" />
              <div className="flex min-w-0 flex-1"><ValueTile variant="flat" label="Tenure" value={tenureLabel} onClick={() => setModal('tenure')} /></div>
            </div>
          </div>

          <CategoryTabs tabs={type.tabs} value={category} onChange={changeCategory} />

          <div className="relative flex w-full flex-col md:min-h-0 md:flex-1">
            <div className="mx-auto flex w-full max-w-[1367px] gap-4 px-[5px] pt-[12px] sm:px-6 md:min-h-0 md:flex-1 md:px-10 md:pt-[30px] lg:gap-[30px] lg:px-[70px]">
              {/* Sidebar (desktop) */}
              <div className="relative hidden min-h-0 w-[263px] shrink-0 md:block">
                <div className="quotes-scroll-none absolute -inset-x-4 bottom-0 -top-2 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pt-2">
                  <div className="flex w-[263px] flex-col gap-[14px] pb-6">
                    <ValueTile variant="card" label="Loan Amount" value={amountLabel} onClick={() => setModal('amount')} />
                    <ValueTile variant="card" label="Tenure" value={tenureLabel} onClick={() => setModal('tenure')} />
                    <SortCard value={sort} onChange={setSort} />
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="quotes-scroll-none min-w-0 flex-1 overflow-x-hidden md:min-h-0 md:overflow-y-auto">
                <div className="flex w-full min-w-0 max-w-full flex-col gap-4 pb-[84px] md:pb-[100px]">
                  <div className="flex min-w-0 max-w-full flex-col gap-2 md:mt-[14px]">
                    <p role="note" className="mx-[13px] rounded-lg bg-[#FFF7F2] px-3 py-2 font-poppins text-[11px] leading-4 text-[#995C00] md:mx-0">
                      Lender rates and limits are sample data, not real offers.
                      {income.monthlyIncome
                        ? ' Approval chances are estimated from the income in your profile.'
                        : isAuthenticated
                          ? ' Add your income in My Profile to get approval chances based on you.'
                          : ' Sign in to see approval chances based on your profile.'}
                    </p>

                    <OngoingCarousel
                      items={ongoing}
                      authed={isAuthenticated}
                      loaded={appsLoaded}
                      error={appsError}
                      onLogin={() => openAuthModal('phone')}
                      onResume={handleResume}
                      onDiscard={handleDiscard}
                      onKfs={openKfs}
                    />

                    <div className="flex min-w-0 max-w-full flex-col gap-[4px]">
                      <div className="flex items-center justify-between">
                        <div className="pl-[13px] font-poppins text-[14px] font-semibold capitalize leading-[20px] text-[#052F5F] sm:text-[18px] sm:leading-[28px] md:pl-0 md:text-lg md:leading-7" aria-live="polite">
                          {matched.length} Personalised {type.label} offers For You
                        </div>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setModal('sort')}
                          className="flex cursor-pointer items-center gap-[3px] font-poppins text-[14px] leading-[20px] text-[#1C1D1F] md:hidden"
                        >
                          <ChartNoAxesColumnDecreasing className="h-5 w-5 -rotate-90 scale-x-[-1]" />
                          <span>Sort</span>
                        </button>
                      </div>

                      <div className="flex min-w-0 max-w-full flex-col gap-[24px] pt-4 md:gap-[32px] md:pt-3 min-[321px]:max-md:px-[16px] max-[320px]:px-[8px]">
                        {matched.length === 0 && (
                          <p className="rounded-xl border border-[#E4E4E3] bg-white p-6 text-center font-poppins text-[13px] text-[#6A6D71]">
                            No offers match this amount for your income. Try a lower amount, a longer tenure or the other category.
                          </p>
                        )}
                        {matched.length > 0 && (
                          <div className="flex flex-col gap-[24px] md:gap-[32px]">
                            <OfferCard lender={matched[0]} cta="Apply Now" onCta={handleApply} onKfs={openKfs} />
                            <RateAlert note={type.rateNote} />
                          </div>
                        )}
                        {matched.length > 1 && (
                          <div className="flex flex-col gap-[24px] md:gap-[32px]">
                            {matched.slice(1).map((l) => (
                              <OfferCard key={l.id} lender={l} cta="Apply Now" onCta={handleApply} onKfs={openKfs} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <WhySection title={type.whyTitle} />
                  <div className="min-[321px]:max-md:px-[16px] max-[320px]:px-[8px]">
                    <UnmatchedOffers extra={unmatched} />
                  </div>
                  <Testimonials />
                  <Disclosures />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthModal />
      <RequestCallFab onClick={() => setModal('call')} />

      {modal === 'amount' && (
        <EditValueModal kind="amount" value={amount} min={tab.min} max={tab.max} step={tab.step} presets={tab.presets} onApply={setAmount} onClose={() => setModal(null)} />
      )}
      {modal === 'tenure' && (
        <EditValueModal kind="tenure" value={months} min={type.tenure.min} max={type.tenure.max} step={type.tenure.step} presets={type.tenure.presets} onApply={setMonths} onClose={() => setModal(null)} />
      )}
      {modal === 'sort' && <SortSheet value={sort} onChange={setSort} onClose={() => setModal(null)} />}
      {modal === 'call' && <CallModal onClose={() => setModal(null)} />}
      {kfs && <KfsModal lender={kfs.lender} amount={kfs.amount} months={kfs.months} onClose={() => setKfs(null)} />}
    </main>
  )
}

/** Remounts when the loan type or requested amount changes so state starts from the right defaults. */
export const LoanQuotesPage: React.FC = () => {
  const [params] = useSearchParams()
  return <QuotesInner key={`${params.get('type')}|${params.get('amount')}`} />
}
