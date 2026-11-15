import React from 'react'
import { PageShell } from '../../components/layout/PageShell'
import { FestiveHero } from '../../components/home/FestiveHero'
import { ProductSections } from '../../components/home/ProductSections'
import { assetUrl } from '../../constants/navigation'

export const HomePage: React.FC = () => (
  <PageShell>
    <FestiveHero />
    <ProductSections />
    <div
      aria-hidden
      className="mx-auto mb-10 h-16 max-w-4xl bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${assetUrl('diwali-assets.png')})` }}
    />
  </PageShell>
)
