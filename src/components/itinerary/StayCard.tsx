'use client'

import Image from 'next/image'
import { Calendar, Home, Bed, Check } from 'lucide-react'
import { useState } from 'react'

interface StayCardProps {
  dayRange: string
  dateRange?: string
  nights: number
  propertyName: string
  location: string
  description?: string
  insiderTip?: string
  images: Array<{
    imgixUrl: string
    alt: string
  }>
  roomType?: string
  inclusions?: string
}

export function StayCard({
  dayRange,
  dateRange,
  nights,
  propertyName,
  location,
  description,
  insiderTip,
  images,
  roomType,
  inclusions,
}: StayCardProps) {
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false)
  const [inclusionsOpen, setInclusionsOpen] = useState(false)

  const heroImage = images[0]

  // Split description into paragraphs
  const paragraphs = description?.split('\n\n').filter(Boolean) || []

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
            <h3 className="font-semibold text-kiuli-charcoal text-lg">
              {propertyName}
            </h3>
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
          <h3 className="font-semibold text-kiuli-charcoal">{propertyName}</h3>
          <p className="text-kiuli-charcoal/60 text-sm">{location}</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <h2 className="font-heading text-3xl md:text-4xl lg:text-[42px] text-kiuli-charcoal mb-8 leading-tight">
          {propertyName}
        </h2>

        {paragraphs.length > 0 && (
          <div className="space-y-5 text-kiuli-charcoal leading-relaxed">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
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
          {/* Room Details */}
          {roomType && (
            <details
              className="border border-kiuli-gray rounded"
              open={roomDetailsOpen}
              onToggle={(e) => setRoomDetailsOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-kiuli-ivory/50">
                <Bed className="h-5 w-5 text-kiuli-teal" />
                <span className="font-medium text-kiuli-charcoal">Room Details</span>
              </summary>
              <div className="px-4 pb-4 pl-12">
                <p className="text-kiuli-charcoal/80">{roomType}</p>
              </div>
            </details>
          )}

          {/* Inclusions */}
          {inclusions && (
            <details
              className="border border-kiuli-gray rounded"
              open={inclusionsOpen}
              onToggle={(e) => setInclusionsOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-kiuli-ivory/50">
                <Check className="h-5 w-5 text-kiuli-teal" />
                <span className="font-medium text-kiuli-charcoal">Inclusions</span>
              </summary>
              <div className="px-4 pb-4 pl-12">
                <p className="text-kiuli-charcoal/80">{inclusions}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </article>
  )
}
