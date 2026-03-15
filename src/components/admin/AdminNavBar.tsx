'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  matchPrefix?: string
}

// Primary workflow tools — what designers use daily
const PRIMARY_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', matchPrefix: '/admin$' },
  { label: 'Itinerary Editor', href: '/admin/itinerary-editor', matchPrefix: '/admin/itinerary-editor' },
  { label: 'Content Engine', href: '/admin/content-engine', matchPrefix: '/admin/content-engine' },
  { label: 'Image Library', href: '/admin/image-library', matchPrefix: '/admin/image-library' },
]

// Content management — secondary nav
const CONTENT_ITEMS: NavItem[] = [
  { label: 'Itineraries', href: '/admin/collections/itineraries', matchPrefix: '/admin/collections/itineraries' },
  { label: 'Articles', href: '/admin/collections/posts', matchPrefix: '/admin/collections/posts' },
  { label: 'Destinations', href: '/admin/collections/destinations', matchPrefix: '/admin/collections/destinations' },
  { label: 'Properties', href: '/admin/collections/properties', matchPrefix: '/admin/collections/properties' },
  { label: 'Pages', href: '/admin/collections/pages', matchPrefix: '/admin/collections/pages' },
  { label: 'Inquiries', href: '/admin/collections/inquiries', matchPrefix: '/admin/collections/inquiries' },
]

export function AdminNavBar() {
  const pathname = usePathname()

  function isActive(item: NavItem) {
    if (item.matchPrefix === '/admin$') return pathname === '/admin'
    return item.matchPrefix ? pathname.startsWith(item.matchPrefix) : false
  }

  return (
    <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-kiuli-gray/60 bg-white px-3 py-0">
      {/* Logo / Home */}
      <Link
        href="/admin"
        className="mr-2 flex shrink-0 items-center gap-1.5 py-2 text-kiuli-teal no-underline"
        title="Back to Admin"
      >
        <img
          src="/logos/mark/kiuli-mark-clay.svg"
          alt="Kiuli"
          className="h-5 w-auto dark:hidden"
        />
        <img
          src="/logos/mark/kiuli-mark-white.svg"
          alt="Kiuli"
          className="hidden h-5 w-auto dark:block"
        />
      </Link>

      <div className="mx-1 h-5 w-px shrink-0 bg-kiuli-gray/40" />

      {PRIMARY_ITEMS.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 px-2.5 py-2.5 text-[11px] font-semibold no-underline transition-colors ${
              active
                ? 'text-kiuli-teal'
                : 'text-kiuli-charcoal/60 hover:text-kiuli-charcoal'
            }`}
          >
            {item.label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kiuli-teal" />
            )}
          </Link>
        )
      })}

      <div className="mx-1.5 h-4 w-px shrink-0 bg-kiuli-gray/40" />

      {CONTENT_ITEMS.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 px-2 py-2.5 text-[10px] font-medium no-underline transition-colors ${
              active
                ? 'text-kiuli-teal'
                : 'text-kiuli-charcoal/40 hover:text-kiuli-charcoal/70'
            }`}
          >
            {item.label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kiuli-teal" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
