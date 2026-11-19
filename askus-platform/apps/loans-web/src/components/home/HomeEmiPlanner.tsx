import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Calculator, Info } from 'lucide-react'
import { SliderField } from '../loans/SliderField'
import { calculateEMI } from '../../utils/emiCalculator'
import { formatINR } from '../../utils/formatters'
import { formatTenure } from '../../utils/loanFormat'

export const HomeEmiPlanner = () => {
  const [amount, setAmount] = useState(500000)
  const [rate, setRate] = useState(10.5)
  const [months, setMonths] = useState(36)
  const emi = useMemo(() => calculateEMI(amount, rate, months / 12), [amount, rate, months])
  const principalPercent = (emi.principal / emi.totalRepayment) * 100

  return (
    <section className="finance-planner" id="home-emi" aria-labelledby="home-emi-title">
      <div className="finance-planner-heading">
        <span className="finance-planner-icon"><Calculator size={20} aria-hidden="true" /></span>
        <div><h2 id="home-emi-title">A little planning. A clearer picture.</h2><p>Your personal loan EMI, estimated in seconds.</p></div>
      </div>
      <div className="finance-planner-result" aria-live="polite" aria-atomic="true">
        <div className="finance-result-top">
          <div>
            <p>ESTIMATED MONTHLY EMI</p>
            <output aria-label="Estimated monthly EMI">{formatINR(emi.monthlyEmi)}</output>
            <span className="finance-per-month"> / month</span>
          </div>
          <span className="finance-estimate-badge">Planning estimate</span>
        </div>
        <div className="finance-repayment-bar" aria-hidden="true"><span style={{ width: `${principalPercent}%` }} /></div>
        <dl className="finance-repayment">
          <div><dt><span className="finance-principal-dot" />Loan amount</dt><dd>{formatINR(emi.principal)}</dd></div>
          <div><dt><span className="finance-interest-dot" />Total interest</dt><dd><output aria-label="Estimated total interest">{formatINR(emi.totalInterest)}</output></dd></div>
          <div><dt>Total repayment</dt><dd><output aria-label="Estimated total repayment">{formatINR(emi.totalRepayment)}</output></dd></div>
        </dl>
      </div>
      <div className="finance-planner-fields">
        <SliderField label="Loan amount" value={amount} min={50000} max={5000000} step={10000} onChange={setAmount} format={formatINR} />
        <SliderField label="Assumed annual interest rate" value={rate} min={0} max={24} step={0.1} onChange={setRate} format={(value) => `${value.toFixed(1)}% p.a.`} />
        <SliderField label="Loan tenure" value={months} min={12} max={84} step={1} onChange={setMonths} format={formatTenure} />
      </div>
      <div className="finance-planner-footer">
        <Link to="/calculator">Open full EMI calculator <ArrowUpRight size={15} aria-hidden="true" /></Link>
        <p><Info size={13} aria-hidden="true" /><span>Illustrative only. Fees excluded. Lenders set actual rates, terms, and approval. No credit check is made.</span></p>
      </div>
    </section>
  )
}
