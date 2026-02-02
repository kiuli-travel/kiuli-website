import { Metadata } from 'next'
import InquiryForm from '@/components/inquiry-form/InquiryForm'

export const metadata: Metadata = {
  title: 'Start Your Safari Journey | Kiuli',
  description: 'Tell us about your dream African safari. Our Safari Experts will craft a personalized itinerary within 24 hours.',
}

export default function ContactPage() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F3EB' }}>
      <InquiryForm />
    </main>
  )
}
