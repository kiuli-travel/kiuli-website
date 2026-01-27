import Link from 'next/link'
import Image from 'next/image'

const exploreLinks = [
  { label: 'Safaris', href: '#' },
  { label: 'Destinations', href: '#' },
  { label: 'About Us', href: '#' },
  { label: 'How It Works', href: '#' },
]

const supportLinks = [
  { label: 'Contact', href: '#' },
  { label: 'FAQs', href: '#' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-kiuli-charcoal text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-8">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logos/mark/kiuli-mark-white.svg"
                alt=""
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <Image
                src="/logos/wordmark/kiuli-wordmark-white.svg"
                alt="Kiuli"
                width={72}
                height={18}
                className="h-[18px] w-auto"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-gray-300">
              Luxury African Safaris
            </p>
          </div>

          {/* Explore Column */}
          <div>
            <h3 className="label-caps text-white">Explore</h3>
            <ul className="mt-6 space-y-4">
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="label-caps text-white">Support</h3>
            <ul className="mt-6 space-y-4">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect Column */}
          <div>
            <h3 className="label-caps text-white">Connect</h3>
            <div className="mt-6 space-y-4">
              <a
                href="mailto:hello@kiuli.com"
                className="block text-sm text-gray-400 transition-colors duration-200 hover:text-white"
              >
                hello@kiuli.com
              </a>
              <a
                href="tel:+254700000000"
                className="block text-sm text-gray-400 transition-colors duration-200 hover:text-white"
              >
                +254 700 000 000
              </a>
              <div className="pt-2">
                <a
                  href="https://linkedin.com/company/kiuli"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on LinkedIn"
                  className="text-gray-400 transition-colors duration-200 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-16 border-t border-gray-600" />

        {/* Bottom Bar */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            &copy; {currentYear} Kiuli. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
