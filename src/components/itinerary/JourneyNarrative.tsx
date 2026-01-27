import type { Itinerary, Media } from '@/payload-types'
import { StayCard } from './StayCard'
import { ActivityBlock } from './ActivityBlock'
import { TransferRow } from './TransferRow'
import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

interface JourneyNarrativeProps {
  days: Itinerary['days']
}

// Extract plain text from Lexical richText format (for Insider's Tip extraction)
function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return ''

  const root = (richText as { root?: { children?: unknown[] } }).root
  if (!root?.children) return ''

  const extractText = (nodes: unknown[]): string => {
    return nodes
      .map((node) => {
        if (!node || typeof node !== 'object') return ''
        const n = node as { type?: string; text?: string; children?: unknown[] }

        if (n.type === 'text' && n.text) {
          return n.text
        }
        if (n.children && Array.isArray(n.children)) {
          return extractText(n.children)
        }
        return ''
      })
      .join('')
  }

  return extractText(root.children)
}

// Extract "Insider's Tip" from description text if present
function extractInsiderTip(description: string): { mainText: string; insiderTip: string | null } {
  const tipMatch = description.match(/Insider['']s Tip:\s*(.*?)$/is)
  if (tipMatch) {
    const mainText = description.slice(0, tipMatch.index).trim()
    const insiderTip = tipMatch[1].trim()
    return { mainText, insiderTip }
  }
  return { mainText: description, insiderTip: null }
}

// Get image data from Media relation
function getImageData(image: number | Media): { imgixUrl: string; alt: string } | null {
  if (typeof image === 'number') return null
  if (!image.imgixUrl) return null
  return {
    imgixUrl: image.imgixUrl,
    alt: image.alt || image.altText || '',
  }
}

// Get description rich text - handles V7 two-field pattern
function getDescription(segment: Record<string, unknown>): DefaultTypedEditorState | null {
  const rawDescription =
    segment.descriptionEnhanced ||
    segment.descriptionItrvl ||
    segment.descriptionOriginal ||
    segment.description

  if (rawDescription && typeof rawDescription === 'object' && 'root' in rawDescription) {
    return rawDescription as DefaultTypedEditorState
  }
  return null
}

// Get title - handles V7 two-field pattern
function getTitle(segment: Record<string, unknown>): string {
  return (
    (segment.titleEnhanced as string) ||
    (segment.titleItrvl as string) ||
    (segment.title as string) ||
    ''
  )
}

// Type definitions for processed segments
type ProcessedStay = {
  type: 'stay'
  dayStart: number
  nights: number
  propertyName: string
  location: string
  country: string
  descriptionRichText: DefaultTypedEditorState | null
  insiderTip: string | null
  images: Array<{ imgixUrl: string; alt: string }>
  roomType: string | null
  inclusions: string | null
  date: string | null
}

type ProcessedActivity = {
  type: 'activity'
  dayNumber: number
  title: string
  descriptionRichText: DefaultTypedEditorState | null
  images: Array<{ imgixUrl: string; alt: string }>
}

type ProcessedTransfer = {
  type: 'transfer'
  dayNumber: number
  transportType: 'flight' | 'road' | 'boat' | 'entry' | 'exit' | 'point'
  origin: string
  destination: string
  date: string | null
  descriptionRichText: DefaultTypedEditorState | null
  departureTime: string | null
  arrivalTime: string | null
}

type ProcessedSegment = ProcessedStay | ProcessedActivity | ProcessedTransfer

export function JourneyNarrative({ days }: JourneyNarrativeProps) {
  if (!days || days.length === 0) return null

  // Collect all segments with their day information
  const allSegments: ProcessedSegment[] = []
  let stayCount = 0
  let activityCount = 0
  let transferCount = 0

  for (const day of days) {
    if (!day.segments) continue

    for (const segment of day.segments) {
      if (segment.blockType === 'stay') {
        stayCount++
        const descriptionRichText = getDescription(segment as Record<string, unknown>)
        const descriptionText = extractTextFromRichText(descriptionRichText)
        const { insiderTip } = extractInsiderTip(descriptionText)

        // Get inclusions
        const rawInclusions =
          segment.inclusionsEnhanced || segment.inclusionsItrvl || segment.inclusions
        const inclusionsText = extractTextFromRichText(rawInclusions)

        // Get images
        const images: Array<{ imgixUrl: string; alt: string }> = []
        if (segment.images) {
          for (const img of segment.images) {
            const imageData = getImageData(img)
            if (imageData) images.push(imageData)
          }
        }

        allSegments.push({
          type: 'stay',
          dayStart: day.dayNumber,
          nights: segment.nights || 1,
          propertyName: segment.accommodationName,
          location: segment.location || '',
          country: segment.country || '',
          descriptionRichText,
          insiderTip,
          images,
          roomType: segment.roomType || null,
          inclusions: inclusionsText || null,
          date: day.date || null,
        })
      } else if (segment.blockType === 'activity') {
        activityCount++
        const descriptionRichText = getDescription(segment as Record<string, unknown>)
        const title = getTitle(segment as Record<string, unknown>)

        // Get images
        const images: Array<{ imgixUrl: string; alt: string }> = []
        if (segment.images) {
          for (const img of segment.images) {
            const imageData = getImageData(img)
            if (imageData) images.push(imageData)
          }
        }

        allSegments.push({
          type: 'activity',
          dayNumber: day.dayNumber,
          title,
          descriptionRichText,
          images,
        })
      } else if (segment.blockType === 'transfer') {
        transferCount++
        const descriptionRichText = getDescription(segment as Record<string, unknown>)

        allSegments.push({
          type: 'transfer',
          dayNumber: day.dayNumber,
          transportType: (segment.type as ProcessedTransfer['transportType']) || 'road',
          origin: segment.from || '',
          destination: segment.to || '',
          date: day.date || null,
          descriptionRichText,
          departureTime: segment.departureTime || null,
          arrivalTime: segment.arrivalTime || null,
        })
      }
    }
  }

  if (allSegments.length === 0) return null

  // Group consecutive transfers together
  const groupedElements: Array<ProcessedSegment | ProcessedSegment[]> = []
  let currentTransferGroup: ProcessedTransfer[] = []

  for (const segment of allSegments) {
    if (segment.type === 'transfer') {
      currentTransferGroup.push(segment)
    } else {
      // Push any accumulated transfers as a group
      if (currentTransferGroup.length > 0) {
        groupedElements.push([...currentTransferGroup])
        currentTransferGroup = []
      }
      groupedElements.push(segment)
    }
  }
  // Don't forget trailing transfers
  if (currentTransferGroup.length > 0) {
    groupedElements.push([...currentTransferGroup])
  }

  return (
    <section className="py-16 md:py-20">
      {/* Section Heading */}
      <div className="text-center mb-12 md:mb-16">
        <h2 className="font-serif text-4xl md:text-[42px] text-kiuli-charcoal">
          Your Journey
        </h2>
      </div>

      {/* Segments */}
      <div className="space-y-8 md:space-y-12">
        {groupedElements.map((element, index) => {
          // Handle grouped transfers
          if (Array.isArray(element)) {
            const transfers = element as ProcessedTransfer[]
            return (
              <div key={`transfer-group-${index}`} className="max-w-3xl mx-auto px-6 md:px-8">
                <div className="border-t border-kiuli-gray">
                  {transfers.map((transfer, tIndex) => (
                    <TransferRow
                      key={`transfer-${index}-${tIndex}`}
                      transportType={transfer.transportType}
                      origin={transfer.origin}
                      destination={transfer.destination}
                      date={transfer.date || undefined}
                      departureTime={transfer.departureTime || undefined}
                      arrivalTime={transfer.arrivalTime || undefined}
                      details={
                        transfer.descriptionRichText ? (
                          <RichText
                            data={transfer.descriptionRichText}
                            enableGutter={false}
                            enableProse={false}
                          />
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )
          }

          // Handle stay
          if (element.type === 'stay') {
            const stay = element
            const dayEnd = stay.dayStart + stay.nights
            const dayRange =
              stay.nights === 1
                ? `Day ${stay.dayStart}`
                : `Days ${stay.dayStart} - ${dayEnd}`

            const locationText = stay.country
              ? `${stay.location}, ${stay.country}`
              : stay.location

            return (
              <StayCard
                key={`stay-${index}`}
                dayRange={dayRange}
                nights={stay.nights}
                propertyName={stay.propertyName}
                location={locationText}
                descriptionContent={
                  stay.descriptionRichText ? (
                    <RichText
                      data={stay.descriptionRichText}
                      enableGutter={false}
                      enableProse={false}
                    />
                  ) : undefined
                }
                insiderTip={stay.insiderTip || undefined}
                images={stay.images}
                roomType={stay.roomType || undefined}
                inclusions={stay.inclusions || undefined}
              />
            )
          }

          // Handle activity
          if (element.type === 'activity') {
            const activity = element
            return (
              <ActivityBlock
                key={`activity-${index}`}
                title={activity.title}
                dayNumber={activity.dayNumber}
                images={activity.images}
                description={
                  activity.descriptionRichText ? (
                    <RichText
                      data={activity.descriptionRichText}
                      enableGutter={false}
                      enableProse={false}
                    />
                  ) : (
                    <p className="text-kiuli-charcoal/60">No description available.</p>
                  )
                }
              />
            )
          }

          return null
        })}
      </div>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-3xl mx-auto px-6 mt-8 text-xs text-kiuli-charcoal/40">
          Segments: {stayCount} stays, {activityCount} activities, {transferCount} transfers
        </div>
      )}
    </section>
  )
}
