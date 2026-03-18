import { SessionProvider } from '@/components/SessionProvider'
import { InquiryModalProvider } from '@/components/inquiry-modal/InquiryModalProvider'
import { InquiryModal } from '@/components/inquiry-modal/InquiryModal'
import { Footer } from '@/components/layout/Footer'

export default function HeroDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <InquiryModalProvider>
      {/* Skip link for keyboard navigation - WCAG accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-kiuli-teal focus:text-white focus:rounded"
      >
        Skip to content
      </a>

      {/* No default header - the HomepageHero has its own transparent header */}

      <SessionProvider>
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </SessionProvider>

      <Footer />

      {/* Inquiry Form Modal - rendered at root level */}
      <InquiryModal />
    </InquiryModalProvider>
  )
}
