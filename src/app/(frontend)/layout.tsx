import type { Metadata } from 'next'

import React from 'react'
import { Playfair_Display } from 'next/font/google'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { Providers } from '@/providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
})

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={playfair.variable} suppressHydrationWarning>
      <head>
        {/* Preload critical Kiuli brand fonts */}
        <link
          rel="preload"
          href="/fonts/GeneralSans-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Satoshi-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers>
          {/* Skip link for keyboard navigation - WCAG accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-kiuli-teal focus:text-white focus:rounded"
          >
            Skip to content
          </a>

          <Header />

          <main id="main-content" className="pt-20 flex-1">
            {children}
          </main>

          <Footer />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@kiuli_travel',
  },
  appleWebApp: {
    title: 'Kiuli',
  },
}
