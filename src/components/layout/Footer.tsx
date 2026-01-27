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
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logos/mark/kiuli-mark-white.svg"
                alt=""
                width={40}
                height={40}
                className="h-10 w-auto"
              />
              <Image
                src="/logos/wordmark/kiuli-wordmark-white.svg"
                alt="Kiuli"
                width={80}
                height={24}
                className="h-6 w-auto"
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
              <div className="flex items-center gap-4 pt-2">
                <a
                  href="https://instagram.com/kiuli"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Instagram"
                  className="text-gray-400 transition-colors duration-200 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
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
