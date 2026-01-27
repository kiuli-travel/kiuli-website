import type { Itinerary, Media } from '@/payload-types'
import { StayCard } from './StayCard'
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

export function JourneyNarrative({ days }: JourneyNarrativeProps) {
  if (!days || days.length === 0) return null

  // Collect all stays with their day information
  const stays: Array<{
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
  }> = []

  for (const day of days) {
    if (!day.segments) continue

    for (const segment of day.segments) {
      if (segment.blockType === 'stay') {
        // Get description - prefer enhanced over iTrvl over original, also check legacy 'description' field
        const rawDescription =
          segment.descriptionEnhanced ||
          segment.descriptionItrvl ||
          segment.descriptionOriginal ||
          (segment as any).description

        // Extract plain text for Insider's Tip detection
        const descriptionText = extractTextFromRichText(rawDescription)
        const { insiderTip } = extractInsiderTip(descriptionText)

        // Get inclusions - prefer enhanced
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

        // Check if description has content
        const hasDesc = rawDescription && typeof rawDescription === 'object' && 'root' in rawDescription

        stays.push({
          dayStart: day.dayNumber,
          nights: segment.nights || 1,
          propertyName: segment.accommodationName,
          location: segment.location || '',
          country: segment.country || '',
          descriptionRichText: hasDesc ? (rawDescription as DefaultTypedEditorState) : null,
          insiderTip,
          images,
          roomType: segment.roomType || null,
          inclusions: inclusionsText || null,
          date: day.date || null,
        })
      }
    }
  }

  if (stays.length === 0) return null

  return (
    <section className="py-16 md:py-20">
      {/* Section Heading */}
      <div className="text-center mb-12 md:mb-16">
        <h2 className="font-heading text-3xl md:text-4xl text-kiuli-charcoal">
          Your Journey
        </h2>
      </div>

      {/* Stay Cards */}
      <div className="space-y-16 md:space-y-24">
        {stays.map((stay, index) => {
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
              key={`${stay.propertyName}-${index}`}
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
        })}
      </div>
    </section>
  )
}
