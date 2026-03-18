'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '/safaris', label: 'Safaris' },
  { href: '/destinations', label: 'Where We Go' },
  { href: '/properties', label: 'Properties' },
  { href: '/articles', label: 'Articles' },
]

export function HomepageHero() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className="relative h-screen w-full">
      {/* Hero Background Image */}
      <Image
        src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1920&q=80"
        alt="A lone giraffe silhouetted against a golden African sunset with acacia trees"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Fixed Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={scrolled ? '/logos/mark/kiuli-mark-black.svg' : '/logos/mark/kiuli-mark-white.svg'}
              alt=""
              width={32}
              height={32}
              className="h-8 w-auto"
              priority
            />
            <Image
              src={scrolled ? '/logos/wordmark/kiuli-wordmark-black.svg' : '/logos/wordmark/kiuli-wordmark-white.svg'}
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
                className={`font-heading text-sm font-light tracking-wide transition-colors ${
                  scrolled
                    ? 'text-kiuli-charcoal hover:text-kiuli-teal'
                    : 'text-white hover:text-white/80'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <Link
            href="/contact"
            className="hidden md:inline-flex px-6 py-2.5 bg-kiuli-clay text-white text-sm font-medium rounded-sm transition-colors hover:bg-[#C66A4A]"
          >
            Begin a Conversation
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className={`inline-flex items-center justify-center p-2 md:hidden ${
              scrolled ? 'text-kiuli-charcoal' : 'text-white'
            }`}
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
                  className="py-3 font-heading text-base font-light text-kiuli-charcoal transition-colors hover:text-kiuli-teal"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/contact"
                className="mt-4 px-6 py-2.5 bg-kiuli-clay text-white text-sm font-medium rounded-sm text-center transition-colors hover:bg-[#C66A4A]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Begin a Conversation
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Content - Bottom Left */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full max-w-7xl mx-auto px-6 pb-16 md:pb-24">
          {/* Small Caps Label */}
          <span className="block font-body text-xs uppercase tracking-[0.2em] text-white/70 mb-4">
            Luxury African Safaris
          </span>

          {/* Headline */}
          <h1 className="mb-4">
            <span className="block font-heading text-4xl md:text-[56px] font-light tracking-[0.11em] text-white leading-tight">
              Experience Travel
            </span>
            <span className="block font-accent text-5xl md:text-7xl text-white leading-none mt-1">
              Redefined.
            </span>
          </h1>

          {/* Subtext */}
          <p className="font-body text-base md:text-lg font-light text-white/80 mb-8 max-w-md">
            Handcrafted journeys through Africa's wild heart
          </p>

          {/* CTA Button */}
          <Link
            href="/safaris"
            className="inline-flex px-8 py-3.5 bg-kiuli-clay text-white text-sm font-medium rounded-sm transition-colors hover:bg-[#C66A4A]"
          >
            Explore Safaris
          </Link>
        </div>
      </div>
    </section>
  )
}
