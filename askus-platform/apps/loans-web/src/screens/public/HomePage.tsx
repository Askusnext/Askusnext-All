import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Calculator, Check, ChevronRight, FileCheck2, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import { PageShell } from '../../components/layout/PageShell'
import { HomeEmiPlanner } from '../../components/home/HomeEmiPlanner'
import { ProductSections } from '../../components/home/ProductSections'
import { PRODUCT_SECTIONS } from '../../constants/productTiles'
import './homePage.css'

const featuredProducts = PRODUCT_SECTIONS.flatMap((section) => section.tiles).filter((tile) => tile.featured)

const steps = [
  { title: 'Explore your options', text: 'Find the type of loan that fits your plans. Understand the terms before you take the next step.', icon: Sparkles },
  { title: 'Get your documents ready', text: 'Use our company-wise checklist to prepare your income, identity, and employment documents.', icon: FileCheck2 },
  { title: 'Apply with clarity', text: 'Complete your application and follow its progress. The lender makes the final credit decision.', icon: ArrowUpRight },
]

export const HomePage = () => (
  <PageShell>
    <div className="finance-home">
      <section className="finance-loans finance-container" id="home-loans" aria-labelledby="finance-loans-title">
        <div className="finance-section-heading">
          <div><p className="finance-kicker">MADE FOR YOUR NEXT MOVE</p><h1 id="finance-loans-title">Different goals. <span>More possibilities.</span></h1></div>
          <Link className="finance-text-link" to="/loans">View all loans <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
        <p className="finance-section-description">Start with what matters to you. Compare information and prepare for your application.</p>
        <div className="finance-loan-grid">
          {featuredProducts.map((product, index) => (
            <Link key={product.to} to={product.to} className={`finance-loan-card finance-loan-card-${index}`} aria-label={`Explore ${product.label.replace(/\n/g, ' ')}`}>
              <div className="finance-loan-card-top">
                <span className="finance-product-icon"><img src={`/assets/pb/${product.icon}`} alt="" width={38} height={38} /></span>
                {product.badge ? <span className="finance-product-badge">{product.badge}</span> : <ArrowUpRight size={18} aria-hidden="true" />}
              </div>
              <h2>{product.label.replace(/\n/g, ' ')}</h2>
              <p>{product.description}</p>
              <span className="finance-card-cta">Explore options <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
        <p className="finance-lender-note">Loan availability, eligibility, rates, and approvals are determined by the lender. Exploring a product is not a loan offer.</p>
      </section>

      <ProductSections />

      <section className="finance-hero" aria-labelledby="finance-home-title">
        <div className="finance-container finance-hero-grid">
          <div className="finance-hero-copy">
            <span className="finance-eyebrow"><span /> YOUR NEXT CHAPTER, WELL PLANNED</span>
            <h2 id="finance-home-title" className="finance-hero-title">Big plans.<br />Smarter <span>beginnings.</span></h2>
            <p className="finance-hero-description">A new home. A growing business. A personal milestone. Explore your options, understand the numbers, and take your next step with Askus Financial Services.</p>
            <div className="finance-actions">
              <a href="#home-loans" className="finance-button finance-button-primary">Find your loan <ArrowRight size={17} aria-hidden="true" /></a>
              <a href="#home-emi" className="finance-button finance-button-secondary"><Calculator size={17} aria-hidden="true" /> Plan your EMI</a>
            </div>
            <div className="finance-hero-checks">
              <span><Check size={14} aria-hidden="true" /> Explore without a credit check</span>
              <span><Check size={14} aria-hidden="true" /> Understand before you apply</span>
            </div>
            <Link className="finance-guide-link" to="/document-guide">
              <span className="finance-guide-icon"><FileText size={21} aria-hidden="true" /></span>
              <span><strong>A little preparation goes a long way.</strong><span>Start with your document checklist</span></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <HomeEmiPlanner />
        </div>
      </section>

      <div className="finance-principles">
        <div className="finance-container finance-principles-grid">
          <div><ShieldCheck size={23} aria-hidden="true" /><span><strong>Clarity, not promises</strong><span>Lender terms and decisions always apply.</span></span></div>
          <div><Calculator size={23} aria-hidden="true" /><span><strong>Plan before you commit</strong><span>See estimated costs, not just a monthly EMI.</span></span></div>
          <div><FileCheck2 size={23} aria-hidden="true" /><span><strong>Your next step, simplified</strong><span>Explore, prepare, apply, and track.</span></span></div>
        </div>
      </div>

      <section className="finance-steps" aria-labelledby="finance-steps-title">
        <div className="finance-container">
          <div className="finance-section-heading">
            <div><p className="finance-kicker">LESS GUESSWORK. MORE CLARITY.</p><h2 id="finance-steps-title">A simpler path <span>from plan to application.</span></h2></div>
            <Link to="/document-guide" className="finance-text-link">Get application-ready <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
          <ol className="finance-step-grid">
            {steps.map((step, index) => (
              <li key={step.title}>
                <div className="finance-step-top"><span>0{index + 1}</span><step.icon size={22} aria-hidden="true" /></div>
                <h3>{step.title}</h3><p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="finance-tools finance-container" aria-labelledby="finance-tools-title">
        <div><p className="finance-kicker">GOOD DECISIONS START WITH GOOD INFORMATION</p><h2 id="finance-tools-title">Take a moment.<br /><span>Know your next move.</span></h2><p>Simple tools and clear guides, wherever you are in your financial journey.</p></div>
        <div className="finance-tool-links">
          <Link to="/calculators"><span className="finance-tool-icon"><Calculator size={22} aria-hidden="true" /></span><span><strong>Do the numbers</strong><span>Explore our financial calculators</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link to="/cibil-check"><span className="finance-tool-icon"><ShieldCheck size={22} aria-hidden="true" /></span><span><strong>Understand your credit</strong><span>Read the credit score guide</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link to="/partner-banks"><span className="finance-tool-icon"><FileText size={22} aria-hidden="true" /></span><span><strong>Look beyond the headline</strong><span>Review lender information and requirements</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  </PageShell>
)
