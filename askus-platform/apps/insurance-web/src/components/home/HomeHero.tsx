import { ArrowRight, BadgeIndianRupee, Bike, CarFront, CarTaxiFront, FilePlus2, FileCheck2, HeartPulse, MapPinned, Phone, RefreshCw, Search, ShieldCheck, Sparkles, Truck, UserRoundCheck, type LucideIcon } from 'lucide-react'
import { OFFLINE_CASHBACK } from '../../lib/offline'
import { HELPLINE, PRODUCTS, inr } from '../../lib/products'
import { HERO_PHOTO, productPhoto } from '../../lib/photos'

const ACCENT: Record<string, string> = { car: '#2f6bff', bike: '#13b38a', auto: '#e8a400', commercial: '#5b6fe0', health: '#ff5d7a', term: '#7c4dff' }

/**
 * Home page sections. Clicks on [data-product] / [data-service] / [data-action] are handled by App,
 * so sign-in, the online/offline choice and partner journeys keep working.
 */

const ICON: Record<string, LucideIcon> = { car: CarFront, bike: Bike, auto: CarTaxiFront, commercial: Truck, health: HeartPulse, term: ShieldCheck }
const SHORT: Record<string, string> = { car: 'Car', bike: 'Bike', auto: 'Auto', commercial: 'Commercial', health: 'Health', term: 'Term life' }
const car = PRODUCTS.find((p) => p.id === 'car')
const bike = PRODUCTS.find((p) => p.id === 'bike')

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true"><span /><span /><span /></div>
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="hero-pill"><Sparkles size={14} aria-hidden="true" /> Car · Bike · Health · Term · Commercial</span>
          <h1 id="hero-title">Cover what matters, <span className="hero-gradient">simply.</span></h1>
          <p className="hero-lead">Compare insurance plans online in minutes, or hand the paperwork to our team. One place for your vehicle, your health and your family’s future.</p>

          <div className="hero-picker" role="group" aria-label="What would you like to insure?">
            <span className="hero-picker-label">What would you like to insure?</span>
            <div className="hero-chips">
              {PRODUCTS.map((p) => {
                const I = ICON[p.id] ?? ShieldCheck
                return (
                  <button key={p.id} type="button" data-product={p.id} className="hero-chip" style={{ ['--chip' as string]: ACCENT[p.id] ?? '#2f6bff' }}>
                    <span className="hero-chip-icon" aria-hidden="true"><I size={18} /></span>{SHORT[p.id] ?? p.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hero-actions">
            <a className="hero-cta" href="#products"><Search size={18} aria-hidden="true" /> Compare plans</a>
            <a className="hero-call" href={`tel:+91${HELPLINE}`}><Phone size={17} aria-hidden="true" /> Talk to an expert <b>{HELPLINE}</b></a>
          </div>

          <ul className="hero-trust">
            <li><UserRoundCheck size={18} aria-hidden="true" /> Online or with our team – your choice</li>
            <li><BadgeIndianRupee size={18} aria-hidden="true" /> Up to {inr(OFFLINE_CASHBACK.car)} cashback on car cover*</li>
            <li><FileCheck2 size={18} aria-hidden="true" /> Help with claims and renewals</li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="hero-photo"><img src={HERO_PHOTO.src} alt={HERO_PHOTO.alt} loading="lazy" decoding="async" /></div>
          {car?.startingAt && <div className="hero-float hero-float-a"><CarFront size={18} aria-hidden="true" /><span><small>Car insurance from</small><b>{inr(car.startingAt)}*</b></span></div>}
          {bike?.startingAt && <div className="hero-float hero-float-b"><Bike size={18} aria-hidden="true" /><span><small>Bike insurance from</small><b>{inr(bike.startingAt)}*</b></span></div>}
          <div className="hero-float hero-float-c"><ShieldCheck size={18} aria-hidden="true" /><span><small>Claim time?</small><b>We guide you</b></span></div>
        </div>
      </div>
    </section>
  )
}

export function ProductTiles() {
  return (
    <section id="products" className="home-section products" aria-labelledby="tiles-title">
      <div className="home-wrap">
        <div className="home-head">
          <span className="home-eyebrow">Insurance for every part of life</span>
          <h2 id="tiles-title">Choose the cover you need</h2>
          <p>Pick a product to compare plans online, or let our team handle everything for you.</p>
        </div>
        <div className="product-cards">
          {PRODUCTS.filter((p) => productPhoto(p.id)).map((p) => {
            const photo = productPhoto(p.id)!
            const accent = ACCENT[p.id] ?? '#2f6bff'
            const cashback = p.id === 'car' || p.id === 'bike'
            return (
              <button key={p.id} type="button" data-product={p.id} className="product-card" style={{ ['--accent' as string]: accent }}>
                <span className="product-art">
                  {cashback && <span className="product-badge">Up to {inr(OFFLINE_CASHBACK[p.id as 'car' | 'bike'])} cashback</span>}
                  <img src={photo.src} srcSet={photo.srcSet} alt={photo.alt} loading="lazy" decoding="async" style={{ objectPosition: photo.position }} />
                </span>
                <span className="product-body">
                  <span className="product-name">{p.name}</span>
                  <span className="product-tag">{p.tag}</span>
                  <span className="product-foot">
                    <span>{p.startingAt ? <>From <b>{inr(p.startingAt)}*</b></> : 'Compare plans'}</span>
                    <span className="product-go" aria-hidden="true"><ArrowRight size={16} /></span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="home-note">*Starting third-party premium before 18% GST. Motor cards show the lowest figure for the category; your premium depends on the vehicle, engine size and insurer. Cashback applies to policies arranged by our team and is credited once the policy is confirmed.</p>
      </div>
    </section>
  )
}

export function HowItWorks() {
  const steps = [
    { n: '01', title: 'Choose your cover', text: 'Car, bike, health, term or a business vehicle – start with what you want to protect.' },
    { n: '02', title: 'Compare or hand it over', text: 'Compare plans online yourself, or share your details and our team does the work.' },
    { n: '03', title: 'Stay covered', text: 'Get reminders before renewal and step-by-step help if you ever need to claim.' },
  ]
  return (
    <section className="home-section how" aria-labelledby="how-title">
      <div className="home-wrap">
        <div className="home-head center">
          <span className="home-eyebrow">How it works</span>
          <h2 id="how-title">Insured in three easy steps</h2>
        </div>
        <ol className="how-steps">
          {steps.map((s) => (
            <li key={s.n}><span className="how-num">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function ClaimsBand() {
  const cards = [
    { service: 'claim', title: 'File a new claim', text: 'Start a claim and our team will walk you through every document.', Icon: FilePlus2, tone: 'blue' },
    { service: 'track', title: 'Track an existing claim', text: 'See where your claim stands and what happens next.', Icon: MapPinned, tone: 'amber' },
  ]
  return (
    <section className="home-section claims" aria-labelledby="claims-title">
      <div className="home-wrap">
        <div className="home-head">
          <span className="home-eyebrow">Claims, made simple</span>
          <h2 id="claims-title">We’re with you when it counts</h2>
        </div>
        <div className="claim-cards">
          {cards.map(({ service, title, text, Icon, tone }) => (
            <button key={service} type="button" data-service={service} className={`claim-card tone-${tone}`}>
              <span className="claim-copy">
                <span className="claim-title">{title}</span>
                <span className="claim-text">{text}</span>
                <span className="claim-cta">Get started <ArrowRight size={15} aria-hidden="true" /></span>
              </span>
              <span className="claim-icon" aria-hidden="true"><Icon size={30} /></span>
            </button>
          ))}
          <button type="button" data-service="renew" className="claim-card tone-green renew-card">
            <span className="claim-copy">
              <span className="claim-title">Renew your policy</span>
              <span className="claim-text">Don’t let your cover lapse – renew in a few steps.</span>
              <span className="claim-cta">Renew now <ArrowRight size={15} aria-hidden="true" /></span>
            </span>
            <span className="renew-icon" aria-hidden="true"><RefreshCw size={34} /></span>
          </button>
        </div>
      </div>
    </section>
  )
}
