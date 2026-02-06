'use client'

import { useInquiryModal } from '@/components/inquiry-modal/InquiryModalProvider'

export function InquiryCTA() {
  const { openModal } = useInquiryModal()

  return (
    <section className="bg-kiuli-ivory py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-heading text-2xl font-semibold text-kiuli-charcoal md:text-3xl">
          Ready to Begin Your Safari Journey?
        </h2>
        <p className="mt-4 text-base text-kiuli-charcoal/70 md:text-lg">
          Our Safari Experts will craft a personalized itinerary tailored to your dreams.
          Start a conversation today.
        </p>
        <button
          type="button"
          onClick={openModal}
          className="mt-8 inline-flex px-8 py-3 bg-kiuli-clay text-white text-base font-medium rounded transition-colors hover:bg-kiuli-clay-hover"
        >
          Begin a Conversation
        </button>
      </div>
    </section>
  )
}
