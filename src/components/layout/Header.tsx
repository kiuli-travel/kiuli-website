'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '#', label: 'Safaris' },
  { href: '#', label: 'Destinations' },
  { href: '#', label: 'About' },
  { href: '#', label: 'Contact' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-white border-b border-kiuli-gray">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Logo: Mark + Wordmark */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logos/mark/kiuli-mark-black.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-auto"
            priority
          />
          <Image
            src="/logos/wordmark/kiuli-wordmark-black.svg"
            alt="Kiuli"
            width={72}
            height={18}
            className="h-[18px] w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-kiuli-charcoal transition-colors hover:text-kiuli-teal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <Link
          href="#"
          className="hidden md:inline-flex px-6 py-2.5 bg-kiuli-clay text-white text-sm font-medium rounded transition-colors hover:bg-kiuli-clay-hover"
        >
          Begin a Conversation
        </Link>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 text-kiuli-charcoal md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-20 border-b border-kiuli-gray bg-white md:hidden">
          <nav className="flex flex-col px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="py-3 text-base font-medium text-kiuli-charcoal transition-colors hover:text-kiuli-teal"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="#"
              className="mt-4 px-6 py-2.5 bg-kiuli-clay text-white text-sm font-medium rounded text-center transition-colors hover:bg-kiuli-clay-hover"
              onClick={() => setMobileMenuOpen(false)}
            >
              Begin a Conversation
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
