'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Calendar, Home, Bed, Check, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface StayCardProps {
  dayRange: string
  dateRange?: string
  nights: number
  propertyName: string
  propertySlug?: string
  location: string
  descriptionContent?: React.ReactNode
  insiderTip?: string
  images: Array<{
    imgixUrl: string
    alt: string
  }>
  roomType?: string
  inclusions?: string
}

// Animated Accordion Item Component
function AccordionItem({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0)
    }
  }, [isOpen])

  return (
    <div className="border border-kiuli-gray rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full gap-3 p-4 cursor-pointer hover:bg-kiuli-ivory/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-kiuli-teal" />
          <span className="font-medium text-kiuli-charcoal">{title}</span>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-kiuli-charcoal/60 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        style={{ height }}
        className="transition-[height] duration-300 ease-out overflow-hidden"
      >
        <div ref={contentRef} className="px-4 pb-4 pl-12">
          {children}
        </div>
      </div>
    </div>
  )
}

export function StayCard({
  dayRange,
  dateRange,
  nights,
  propertyName,
  propertySlug,
  location,
  descriptionContent,
  insiderTip,
  images,
  roomType,
  inclusions,
}: StayCardProps) {
  const heroImage = images[0]

  return (
    <article className="w-full">
      {/* Hero Image Section */}
      <div className="relative h-[50vh] md:h-[60vh] w-full">
        {heroImage ? (
          <Image
            src={heroImage.imgixUrl}
            alt={heroImage.alt || `${propertyName} - ${location}`}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="h-full w-full bg-kiuli-gray" />
        )}

        {/* Floating Info Card - Desktop */}
        <div className="hidden md:block absolute bottom-8 left-8 bg-white p-6 shadow-lg min-w-[280px] rounded">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-kiuli-clay" />
            <span className="text-kiuli-clay font-semibold text-sm tracking-wide">
              {dayRange}
            </span>
          </div>
          <p className="text-kiuli-charcoal/60 text-sm mb-4">
            {dateRange && <>{dateRange} &middot; </>}
            {nights} {nights === 1 ? 'night' : 'nights'}
          </p>
          <div className="border-t border-kiuli-gray pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-4 w-4 text-kiuli-charcoal/60" />
              <span className="text-kiuli-charcoal/60 text-xs uppercase tracking-wider">
                Accommodation
              </span>
            </div>
            {propertySlug ? (
              <Link
                href={`/properties/${propertySlug}`}
                className="font-semibold text-kiuli-charcoal text-lg hover:text-kiuli-teal transition-colors"
              >
                {propertyName}
              </Link>
            ) : (
              <h3 className="font-semibold text-kiuli-charcoal text-lg">
                {propertyName}
              </h3>
            )}
            <p className="text-kiuli-charcoal/60 text-sm">{location}</p>
          </div>
        </div>
      </div>

      {/* Mobile Info Card */}
      <div className="md:hidden bg-white p-5 mx-4 -mt-12 relative z-10 shadow-lg rounded">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-kiuli-clay" />
          <span className="text-kiuli-clay font-semibold text-sm tracking-wide">
            {dayRange}
          </span>
        </div>
        <p className="text-kiuli-charcoal/60 text-sm mb-3">
          {dateRange && <>{dateRange} &middot; </>}
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
        <div className="border-t border-kiuli-gray pt-3">
          <div className="flex items-center gap-2 mb-1">
            <Home className="h-4 w-4 text-kiuli-charcoal/60" />
            <span className="text-kiuli-charcoal/60 text-xs uppercase tracking-wider">
              Accommodation
            </span>
          </div>
          {propertySlug ? (
            <Link
              href={`/properties/${propertySlug}`}
              className="font-semibold text-kiuli-charcoal hover:text-kiuli-teal transition-colors"
            >
              {propertyName}
            </Link>
          ) : (
            <h3 className="font-semibold text-kiuli-charcoal">{propertyName}</h3>
          )}
          <p className="text-kiuli-charcoal/60 text-sm">{location}</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16">
        {propertySlug ? (
          <Link
            href={`/properties/${propertySlug}`}
            className="block font-serif text-3xl md:text-4xl lg:text-[42px] text-kiuli-charcoal mb-8 leading-tight hover:text-kiuli-teal transition-colors"
          >
            {propertyName}
          </Link>
        ) : (
          <h2 className="font-serif text-3xl md:text-4xl lg:text-[42px] text-kiuli-charcoal mb-8 leading-tight">
            {propertyName}
          </h2>
        )}

        {descriptionContent && (
          <div className="prose prose-lg max-w-none text-kiuli-charcoal leading-relaxed">
            {descriptionContent}
          </div>
        )}

        {/* Insider's Tip */}
        {insiderTip && (
          <div className="mt-10 p-6 bg-kiuli-teal-light border-l-4 border-kiuli-clay rounded-r">
            <p className="text-sm uppercase tracking-wider text-kiuli-clay font-semibold mb-2">
              Insider&apos;s Tip
            </p>
            <p className="text-kiuli-charcoal leading-relaxed">{insiderTip}</p>
          </div>
        )}

        {/* Expandable Sections */}
        <div className="mt-12 space-y-4">
          {roomType && (
            <AccordionItem icon={Bed} title="Room Details">
              <p className="text-kiuli-charcoal/80">{roomType}</p>
            </AccordionItem>
          )}

          {inclusions && (
            <AccordionItem icon={Check} title="Inclusions">
              <p className="text-kiuli-charcoal/80">{inclusions}</p>
            </AccordionItem>
          )}
        </div>
      </div>
    </article>
  )
}
