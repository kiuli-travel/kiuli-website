import type { Metadata } from 'next'

import React from 'react'
import Script from 'next/script'
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

// Organization schema for brand authority and AI discoverability
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'TravelAgency',
  name: 'Kiuli',
  description:
    'Kiuli connects discerning travellers with transformative African safari experiences. Handpicked luxury itineraries across Kenya, Tanzania, Botswana, Rwanda, and beyond.',
  url: 'https://kiuli.com',
  logo: 'https://kiuli.com/kiuli-logo.png',
  sameAs: ['https://twitter.com/kiuli_travel', 'https://instagram.com/kiuli_travel'],
  areaServed: [
    { '@type': 'Country', name: 'Kenya' },
    { '@type': 'Country', name: 'Tanzania' },
    { '@type': 'Country', name: 'Botswana' },
    { '@type': 'Country', name: 'Rwanda' },
    { '@type': 'Country', name: 'Uganda' },
    { '@type': 'Country', name: 'South Africa' },
    { '@type': 'Country', name: 'Namibia' },
    { '@type': 'Country', name: 'Zimbabwe' },
  ],
  priceRange: '$$$$',
  serviceType: ['Safari Tours', 'Luxury Travel', 'Wildlife Experiences', 'Honeymoon Safaris'],
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={playfair.variable} suppressHydrationWarning>
      <head>
        {/* Organization Schema for SEO and AI discoverability */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
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
        {/* GA4 + Google Ads: dataLayer, gtag function, Consent Mode v2 defaults, config */}
        {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  'ad_storage': 'granted',
                  'ad_user_data': 'granted',
                  'ad_personalization': 'granted',
                  'analytics_storage': 'granted',
                  'wait_for_update': 500
                });
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}', { send_page_view: true });
                gtag('config', 'AW-17918105806');
              `,
            }}
          />
        )}
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

        {/* GA4 + Google Ads: async gtag.js loader */}
        {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  // TEMPORARY: Block indexing until site is ready for launch
  // Remove this line when ready to go live
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@kiuli_travel',
  },
  appleWebApp: {
    title: 'Kiuli',
  },
}
