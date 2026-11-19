import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/index.css'
import '../src/App.css'

export const metadata: Metadata = {
  publisher: 'Askus Next Global Solutions Private Limited',
  title: "Askus Financial Services — India's Premier Credit & Personal Loan Hub",
  description:
    'Compare personal loans across leading Indian banks and NBFCs, explore company-wise documentation requirements, calculate reducing-balance EMIs, and submit applications.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Serif:ital,wght@0,600;0,700;1,600;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/fonts/poppins.css" />
        <link rel="stylesheet" href="/assets/fonts/open-sans.css" />
        <link rel="stylesheet" href="/assets/backgrounds/quotes-gradients.css" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">{children}</body>
    </html>
  )
}
