import type { Metadata } from 'next'
import Breadcrumb from '@/components/Breadcrumb'
import { ContactMethods, CONTACT_PHONE, CONTACT_EMAIL } from '@/components/contact/ContactMethods'
import InquiryForm from '@/components/inquiry-form/InquiryForm'
import { FAQSection } from '@/components/itinerary/FAQSection'

// Contact-specific FAQs
const contactFaqs = [
  {
    question: 'What happens after I submit an inquiry?',
    answer:
      'One of our safari specialists will review your preferences and respond within 24 hours with personalised recommendations.',
  },
  {
    question: 'How quickly will I hear back?',
    answer:
      'We typically respond within 24 hours during business days. For urgent requests, call us directly.',
  },
  {
    question: 'Can I call instead?',
    answer: `Absolutely. Call us at ${CONTACT_PHONE} and speak directly with a safari specialist.`,
  },
]

// JSON-LD: Organization with ContactPoint
function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kiuli',
    url: 'https://kiuli.com',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: CONTACT_PHONE.replace(/\s/g, ''),
      contactType: 'customer service',
      email: CONTACT_EMAIL,
      availableLanguage: 'English',
    },
  }
}

// JSON-LD: BreadcrumbList
function generateBreadcrumbSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://kiuli.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Contact',
        item: 'https://kiuli.com/contact',
      },
    ],
  }
}

export default function ContactPage() {
  const breadcrumbItems = [{ label: 'Home', href: '/' }, { label: 'Contact' }]

  const organizationSchema = generateOrganizationSchema()
  const breadcrumbSchema = generateBreadcrumbSchema()

  return (
    <main>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="mt-6 text-center text-3xl font-bold text-[#404040] md:text-4xl">
            Get in Touch
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[#404040]/70">
            Whether you&apos;re ready to start planning or simply have a question, we&apos;d love to
            hear from you.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <ContactMethods />

      {/* Divider */}
      <div className="mx-auto max-w-[720px] px-6">
        <div className="h-px bg-[#DADADA]" />
      </div>

      {/* Inquiry Form Section */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <h2 className="mb-8 text-center text-2xl font-semibold text-[#404040] md:text-3xl">
            Start Planning Your Safari
          </h2>
          <InquiryForm />
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection faqs={contactFaqs} />
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Contact Us | Kiuli',
    description:
      'Get in touch with our safari specialists. Call, email, or start planning your luxury African safari experience.',
    alternates: {
      canonical: 'https://kiuli.com/contact',
    },
  }
}
