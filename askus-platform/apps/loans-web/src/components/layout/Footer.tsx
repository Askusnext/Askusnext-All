import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, ShieldCheck } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      {/* Top Footer Banner */}
      <div className="border-b border-slate-900 bg-slate-900/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-slate-300">
            <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
            <p className="text-xs">
              <strong className="text-white">Lender information:</strong> Confirm lender authorization, product terms, and application requirements directly with the lender.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
            <Link to="/document-guide" className="hover:text-blue-400 transition-colors">
              Document Guide
            </Link>
            <span>•</span>
            <Link to="/calculator" className="hover:text-blue-400 transition-colors">
              EMI Calculator
            </Link>
            <span>•</span>
            <Link to="/cibil-check" className="hover:text-emerald-400 transition-colors">
              Credit Bureau Info
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Col 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Zap size={18} />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Askus <span className="text-blue-500">Fin</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Askus Fin provides lender reference links and an application workflow. Current rates, fees, requirements, and decisions come from the lender.
            </p>
            <p className="text-xs text-slate-500 pt-2">For support, sign in and submit an inquiry from your dashboard.</p>
          </div>

          {/* Col 2: Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Loan Services</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/loans/personal-loan?variant=instant" className="hover:text-white transition">
                  Instant Personal Loan
                </Link>
              </li>
              <li>
                <Link to="/loans/personal-loan" className="hover:text-white transition">
                  Personal Loan
                </Link>
              </li>
              <li>
                <Link to="/loans/home-loan" className="hover:text-white transition">
                  Home Loan
                </Link>
              </li>
              <li>
                <Link to="/loans/loan-against-property" className="hover:text-white transition">
                  Loan Against Property
                </Link>
              </li>
              <li>
                <Link to="/loans/car-loan" className="hover:text-white transition">
                  Vehicle Loan
                </Link>
              </li>
              <li>
                <Link to="/loans/business-loan" className="hover:text-white transition">
                  Business Loan (MSME)
                </Link>
              </li>
              <li>
                <Link to="/explore/credit-card" className="hover:text-white transition">
                  Apply Credit Cards
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Lending Partners */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Lenders Covered</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/partner-banks#hdfc-bank" className="hover:text-white transition">
                  HDFC Bank Loan Guide
                </Link>
              </li>
              <li>
                <Link to="/partner-banks#icici-bank" className="hover:text-white transition">
                  ICICI Bank Documentation
                </Link>
              </li>
              <li>
                <Link to="/partner-banks#axis-bank" className="hover:text-white transition">
                  Axis Bank Salaried Loan
                </Link>
              </li>
              <li>
                <Link to="/partner-banks#kotak-mahindra-bank" className="hover:text-white transition">
                  Kotak Mahindra Bank
                </Link>
              </li>
              <li>
                <Link to="/partner-banks#bajaj-finance" className="hover:text-white transition">
                  Bajaj Finance Salaried & Cash
                </Link>
              </li>
              <li>
                <Link to="/partner-banks#bank-of-baroda" className="hover:text-white transition">
                  Bank of Baroda & PNB
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Tools & Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Tools & Policies</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/calculator" className="hover:text-white transition">
                  Reducing Balance Calculator
                </Link>
              </li>
              <li>
                <Link to="/document-guide" className="hover:text-white transition">
                  Company-Wise Checklist
                </Link>
              </li>
              <li>
                <Link to="/document-guide#cash-salary" className="hover:text-white transition">
                  Cash Salary Guidelines
                </Link>
              </li>
              <li>
                <Link to="/cibil-check" className="hover:text-white transition">
                  Credit Bureau Info
                </Link>
              </li>
              <li>
                <Link to="/services/credit-card-cash" className="hover:text-white transition">
                  Card Cash Liquidity Assistance
                </Link>
              </li>
              <li>
                <Link to="/services/credit-card-bill" className="hover:text-white transition">
                  Credit Card Bill Settlement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Regulatory & Compliance Disclaimers (Crucial for fintech) */}
        <div className="mt-12 pt-8 border-t border-slate-900 space-y-3 text-[11px] text-slate-500 leading-relaxed">
          <p>
            <strong className="text-slate-400">Service Notice:</strong> Askus Fin does not lend money or accept deposits. Product terms and every credit decision are determined by the lender.
          </p>
          <p>
            <strong className="text-slate-400">Cash Salary Notice:</strong> Cash salary acceptance and evidence requirements vary by lender and product. Confirm current requirements directly with the lender.
          </p>
          <p>
            <strong className="text-slate-400">Payments:</strong> This site is not currently collecting payments. Confirm any lender charges directly with the lender.
          </p>
        </div>

        {/* Copyright & Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Askus Fin. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#privacy" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-300">Terms of Service</a>
            <a href="#security" className="hover:text-slate-300">Security & Encryption</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
