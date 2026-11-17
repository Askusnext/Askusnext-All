import React from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_SECTIONS, type ProductTile } from '../../constants/productTiles'
import { LottieIcon } from './LottieIcon'

const Tile: React.FC<{ tile: ProductTile }> = ({ tile }) => (
  <Link to={tile.to} className="tile group block text-center focus-visible:outline-none">
    <div className="relative mx-auto h-[68px] w-[68px] sm:h-[92px] sm:w-[92px]">
      <span className="tile-ring absolute inset-0 rounded-full border border-[#e4e4e3] bg-white transition group-hover:border-[#0066ff] group-hover:shadow-[0_6px_16px_rgba(0,102,255,0.18)] group-focus-visible:border-[#0066ff]" />
      <span className="absolute inset-[6px] rounded-full bg-[#f6f6f6] sm:inset-[5px]" />
      <span className="tile-icon relative z-10 flex h-full w-full items-center justify-center">
        {tile.lottie ? (
          <LottieIcon src={tile.lottie} fallback={tile.icon} size={46} />
        ) : (
          <img src={`/assets/pb/${tile.icon}`} alt="" width={46} height={46} className="h-[34px] w-[34px] object-contain sm:h-[46px] sm:w-[46px]" />
        )}
      </span>
      {(tile.badge || tile.soon) && (
        <span className="absolute -bottom-1.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#c8ecd2] px-2 py-0.5 text-[9px] font-semibold leading-[14px] text-[#0e471e] ring-2 ring-white sm:text-[10px]">
          {tile.soon ? 'Coming soon' : tile.badge}
        </span>
      )}
    </div>
    <p className="mt-3 whitespace-pre-line text-[10px] font-medium leading-snug text-[#1c1d1f] transition-colors group-hover:text-[#0066ff] sm:mt-4 sm:text-sm">{tile.label}</p>
  </Link>
)

export const ProductSections: React.FC = () => (
  <section className="bg-[#f7f8fa] py-6 font-[Poppins,sans-serif] sm:py-10" aria-label="Products">
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:gap-8 sm:px-6">
      {PRODUCT_SECTIONS.map((section) => (
        <div
          key={section.title}
          className="relative rounded-2xl bg-gradient-to-br from-[#fff8ea] to-white px-3 pb-5 pt-5 shadow-[0_1px_3px_rgba(28,29,31,0.06)] ring-1 ring-[#ffe5bf]/70 sm:px-8 sm:pb-8 sm:pt-7"
        >
          <h2 className="mb-5 text-base font-semibold text-[#1c1d1f] sm:mb-7 sm:text-lg">{section.title}</h2>
          <div className="grid grid-cols-4 gap-x-1 gap-y-6 sm:gap-x-10 sm:gap-y-9 lg:grid-cols-8">
            {section.tiles.map((t) => (
              <Tile key={t.label} tile={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
)
