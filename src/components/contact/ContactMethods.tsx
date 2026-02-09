import { Phone, Mail, Clock } from 'lucide-react'

// Contact details - easy to update
export const CONTACT_PHONE = '+44 1234 567890'
export const CONTACT_EMAIL = 'hello@kiuli.com'

interface ContactMethodsProps {
  phone?: string
  email?: string
  responseTime?: string
}

export function ContactMethods({
  phone = CONTACT_PHONE,
  email = CONTACT_EMAIL,
  responseTime = 'Within 24 Hours',
}: ContactMethodsProps) {
  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-[800px] px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Phone Card */}
          <div className="rounded-sm bg-[#F5F3EB] p-6 text-center">
            <div className="mb-4 flex justify-center">
              <Phone className="h-6 w-6 text-[#486A6A]" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#486A6A]">
              Call Us
            </p>
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="mt-2 block text-lg font-semibold text-[#404040] transition-colors hover:text-[#486A6A]"
            >
              {phone}
            </a>
            <p className="mt-2 text-sm text-[#404040]/70">
              Speak directly with a safari specialist
            </p>
          </div>

          {/* Email Card */}
          <div className="rounded-sm bg-[#F5F3EB] p-6 text-center">
            <div className="mb-4 flex justify-center">
              <Mail className="h-6 w-6 text-[#486A6A]" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#486A6A]">
              Email Us
            </p>
            <a
              href={`mailto:${email}`}
              className="mt-2 block text-lg font-semibold text-[#404040] transition-colors hover:text-[#486A6A]"
            >
              {email}
            </a>
            <p className="mt-2 text-sm text-[#404040]/70">
              We respond within 24 hours
            </p>
          </div>

          {/* Response Time Card */}
          <div className="rounded-sm bg-[#F5F3EB] p-6 text-center">
            <div className="mb-4 flex justify-center">
              <Clock className="h-6 w-6 text-[#486A6A]" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#486A6A]">
              Response Time
            </p>
            <p className="mt-2 text-lg font-semibold text-[#404040]">
              {responseTime}
            </p>
            <p className="mt-2 text-sm text-[#404040]/70">
              Monday to Friday, GMT
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
