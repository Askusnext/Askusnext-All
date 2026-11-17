import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowRight, Info, Calculator, Table } from 'lucide-react'
import { calculateEMI } from '../../utils/emiCalculator'
import { formatINR } from '../../utils/formatters'
import { Link } from 'react-router-dom'

interface EmiCalculatorProps {
  initialAmount?: number
  initialRate?: number
  initialTenure?: number
  showApplyButton?: boolean
}

export const EmiCalculator: React.FC<EmiCalculatorProps> = ({
  initialAmount = 0,
  initialRate = 10.5,
  initialTenure = 3,
  showApplyButton = true
}) => {
  const [amount, setAmount] = useState<number>(initialAmount)
  const [rate, setRate] = useState<number>(initialRate)
  const [tenure, setTenure] = useState<number>(initialTenure)
  const [showAmortization, setShowAmortization] = useState<boolean>(false)

  // Recalculate EMI in real time
  const emiResult = useMemo(() => {
    return calculateEMI(amount, rate, tenure)
  }, [amount, rate, tenure])

  // Data for doughnut chart
  const chartData = useMemo(() => {
    return [
      { name: 'Principal Amount', value: emiResult.principal, color: '#2563eb' },
      { name: 'Total Interest', value: emiResult.totalInterest, color: '#f59e0b' }
    ]
  }, [emiResult])

  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden">
      <div className="p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* SLIDERS & INPUTS (Left 7 Cols) */}
          <div className="lg:col-span-7 space-y-7">
            {/* 1. Loan Amount */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calculator size={16} className="text-blue-600" />
                  Loan Amount
                </label>
                <div className="flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200/80 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="text-xs font-bold text-blue-700">₹</span>
                  <input
                    type="number"
                    min="10000"
                    max="5000000"
                    step="5000"
                    value={amount || ''}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-28 bg-transparent text-right font-bold text-slate-900 focus:outline-none text-base"
                  />
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="5000000"
                step="10000"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              <div className="flex justify-between text-[11px] font-medium text-slate-400">
                <span>₹0</span>
                <span>₹25 Lakh</span>
                <span>₹50 Lakh</span>
              </div>
            </div>

            {/* 2. Interest Rate */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">
                  Annual Interest Rate (% p.a.)
                </label>
                <div className="flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500">
                  <input
                    type="number"
                    min="7"
                    max="24"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent text-right font-bold text-emerald-700 focus:outline-none text-base"
                  />
                  <span className="text-xs font-bold text-emerald-700">%</span>
                </div>
              </div>

              <input
                type="range"
                min="7"
                max="24"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />

              <div className="flex justify-between text-[11px] font-medium text-slate-400">
                <span>7.0% (Home Loan)</span>
                <span>10.5% (Personal Loan)</span>
                <span>24.0%</span>
              </div>
            </div>

            {/* 3. Loan Tenure */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">
                  Loan Tenure (Years / Months)
                </label>
                <div className="flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200/80 px-3 py-1.5 focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={tenure}
                    onChange={(e) => setTenure(Number(e.target.value) || 1)}
                    className="w-12 bg-transparent text-right font-bold text-purple-700 focus:outline-none text-base"
                  />
                  <span className="text-xs font-bold text-purple-700">Years</span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />

              <div className="flex justify-between text-[11px] font-medium text-slate-400">
                <span>1 Year (12 Mo)</span>
                <span>5 Years (60 Mo)</span>
                <span>30 Years (360 Mo)</span>
              </div>
            </div>

            {/* Preset shortcuts */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 mr-1 self-center">Popular:</span>
              <button
                type="button"
                onClick={() => {
                  setAmount(300000)
                  setRate(10.5)
                  setTenure(3)
                }}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200 font-medium transition"
              >
                ₹3 Lakh / 3 Yrs
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmount(500000)
                  setRate(10.99)
                  setTenure(5)
                }}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200 font-medium transition"
              >
                ₹5 Lakh / 5 Yrs
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmount(2500000)
                  setRate(8.5)
                  setTenure(20)
                }}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200 font-medium transition"
              >
                ₹25 Lakh / 20 Yrs (Home)
              </button>
            </div>
          </div>

          {/* DOUGHNUT CHART & SUMMARY CARD (Right 5 Cols) */}
          <div className="lg:col-span-5 rounded-3xl bg-slate-900 text-white p-7 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Background accent glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Monthly Reducing-Balance EMI
              </span>
              <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatINR(emiResult.monthlyEmi)}
                <span className="text-sm font-normal text-slate-400"> / month</span>
              </div>
            </div>

            {/* Doughnut Chart */}
            <div className="h-48 w-full my-4 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [
                      formatINR(typeof val === 'number' ? val : Number(val) || 0),
                      ''
                    ]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center stat inside doughnut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Tenure</span>
                <span className="text-sm font-bold text-white">{tenure * 12} Mo</span>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="space-y-3 border-t border-slate-800 pt-5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="text-slate-300">Principal Amount</span>
                </div>
                <span className="font-bold text-white">{formatINR(emiResult.principal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-300">Total Interest Payable</span>
                </div>
                <span className="font-bold text-amber-400">{formatINR(emiResult.totalInterest)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-semibold">
                <span className="text-slate-200">Total Amount Payable</span>
                <span className="text-sm font-bold text-blue-400">{formatINR(emiResult.totalRepayment)}</span>
              </div>
            </div>

            {/* CTA button */}
            {showApplyButton && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={`/apply?amount=${amount}&tenure=${tenure * 12}`}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 text-center shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
                >
                  <span>Apply with this EMI</span>
                  <ArrowRight size={14} />
                </Link>

                <button
                  type="button"
                  onClick={() => setShowAmortization(!showAmortization)}
                  className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-3 px-3.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Table size={14} />
                  <span>{showAmortization ? 'Hide Table' : 'Yearly Table'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Amortization schedule drawer / expansion */}
        {showAmortization && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Table size={16} className="text-blue-600" />
                Year-by-Year Repayment Schedule
              </h4>
              <span className="text-xs text-slate-500">
                Formula: Standard Reducing Balance Amortization
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Year</th>
                    <th className="py-2.5 px-4">Principal Paid (A)</th>
                    <th className="py-2.5 px-4">Interest Paid (B)</th>
                    <th className="py-2.5 px-4">Total Yearly Payment (A + B)</th>
                    <th className="py-2.5 px-4">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emiResult.amortizationPreview.map((row) => (
                    <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-800">Year {row.year}</td>
                      <td className="py-2.5 px-4 text-blue-700 font-medium">
                        {formatINR(row.principalPaid)}
                      </td>
                      <td className="py-2.5 px-4 text-amber-700 font-medium">
                        {formatINR(row.interestPaid)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {formatINR(row.principalPaid + row.interestPaid)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {formatINR(row.remainingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Informational callout */}
        <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p>
            This calculator provides indicative estimates based on reducing balance interest. Exact monthly EMI, processing fees, and loan conditions are confirmed by the selected lending partner at the time of sanction.
          </p>
        </div>
      </div>
    </div>
  )
}
