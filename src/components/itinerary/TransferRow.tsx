'use client'

import { useState, useRef, useEffect } from 'react'
import { Plane, Car, Ship, Plus, Minus, ChevronDown } from 'lucide-react'

type TransportType = 'flight' | 'road' | 'boat' | 'entry' | 'exit' | 'point'

interface TransferRowProps {
  transportType: TransportType
  origin: string
  destination: string
  date?: string
  details?: React.ReactNode
  departureTime?: string
  arrivalTime?: string
}

const transportIcons: Record<TransportType, React.ElementType> = {
  flight: Plane,
  road: Car,
  boat: Ship,
  entry: Plane,
  exit: Plane,
  point: Car,
}

// Format ISO date string to human-readable format
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    // Check if date is valid
    if (isNaN(date.getTime())) return dateString
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateString
  }
}

export function TransferRow({
  transportType,
  origin,
  destination,
  date,
  details,
  departureTime,
  arrivalTime,
}: TransferRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  const Icon = transportIcons[transportType] || Car

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0)
    }
  }, [isExpanded])

  const hasExpandableContent = details || departureTime || arrivalTime

  // Build route display with arrow
  const route = origin && destination
    ? `${origin} → ${destination}`
    : origin || destination || 'Transfer'

  return (
    <div className="border-b border-kiuli-gray transition-colors hover:bg-kiuli-ivory/30">
      <button
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left md:gap-4 ${
          hasExpandableContent ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={hasExpandableContent ? isExpanded : undefined}
        disabled={!hasExpandableContent}
      >
        {/* Expand/Collapse Button */}
        {hasExpandableContent ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kiuli-clay text-white"
            aria-hidden="true"
          >
            {isExpanded ? (
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </span>
        ) : (
          <span className="w-6" />
        )}

        {/* Transport Icon */}
        <Icon
          className="h-5 w-5 shrink-0 text-kiuli-teal"
          aria-label={transportType}
          strokeWidth={1.5}
        />

        {/* Route Text */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-kiuli-charcoal md:text-base">
          {route}
        </span>

        {/* Date - Desktop */}
        {date && (
          <span className="hidden shrink-0 text-sm text-kiuli-charcoal/60 md:block">
            {formatDate(date)}
          </span>
        )}

        {/* Chevron Indicator */}
        {hasExpandableContent && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-kiuli-charcoal/40 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Expanded Details */}
      {hasExpandableContent && (
        <div
          style={{ height }}
          className="overflow-hidden transition-[height] duration-300 ease-out"
        >
          <div ref={contentRef} className="px-4 pb-4 pl-[3.25rem] md:pl-[4rem]">
            {/* Mobile Date */}
            {date && (
              <p className="mb-2 text-sm text-kiuli-charcoal/60 md:hidden">{formatDate(date)}</p>
            )}

            {/* Times */}
            {(departureTime || arrivalTime) && (
              <p className="text-sm text-kiuli-charcoal mb-2">
                {departureTime && <span>Departs: {departureTime}</span>}
                {departureTime && arrivalTime && <span className="mx-2">·</span>}
                {arrivalTime && <span>Arrives: {arrivalTime}</span>}
              </p>
            )}

            {/* Details */}
            {details && (
              <div className="text-sm leading-relaxed text-kiuli-charcoal/80">
                {details}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
