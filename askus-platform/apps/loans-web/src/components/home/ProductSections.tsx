import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { PRODUCT_SECTIONS } from '../../constants/productTiles'

export const ProductSections = () => (
  <section className="finance-directory finance-container" aria-labelledby="finance-directory-title">
    <div className="finance-section-heading">
      <div><p className="finance-kicker">BEYOND YOUR NEXT LOAN</p><h2 id="finance-directory-title">More ways to <span>plan ahead.</span></h2></div>
      <p>Explore our full directory of products, guides, and tools. Unavailable services are marked as coming soon.</p>
    </div>
    <div className="finance-directory-groups">
      {PRODUCT_SECTIONS.map((section, index) => (
        <details key={section.title} className="finance-directory-group" open={index === 0}>
          <summary><span className="finance-directory-number">0{index + 1}</span><h3>{section.title}</h3><ChevronDown size={20} aria-hidden="true" /></summary>
          <div className="finance-directory-grid">
            {section.tiles.filter((tile) => !tile.featured).map((tile) => (
              <Link key={tile.to} to={tile.to} className="finance-directory-link">
                <img src={`/assets/pb/${tile.icon}`} alt="" width={32} height={32} loading="lazy" />
                <span><strong>{tile.label.replace(/\n/g, ' ')}</strong>{(tile.badge || tile.soon) && <span className={`finance-directory-badge${tile.soon ? ' finance-directory-soon' : ''}`}>{tile.soon ? 'Coming soon' : tile.badge}</span>}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </details>
      ))}
    </div>
  </section>
)
