import type { ChunkType, ContentChunk, ChunkMetadata } from './types'
import { extractTextFromLexical } from './lexical-text'

export interface BootstrapChunk {
  chunkType: ChunkType
  text: string
  itineraryId?: number
  destinationId?: number
  propertyId?: number
  destinations?: string[]
  properties?: string[]
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

export function chunkItineraryStays(rows: Array<{
  id: number
  itinerary_id: number
  accommodation_name: string | null
  description_itrvl: unknown
  location: string | null
  country: string | null
  property_id: number | null
}>): BootstrapChunk[] {
  const chunks: BootstrapChunk[] = []
  for (const row of rows) {
    const text = extractTextFromLexical(row.description_itrvl)
    if (wordCount(text) < 20) continue
    chunks.push({
      chunkType: 'itinerary_segment',
      text,
      itineraryId: row.itinerary_id,
      propertyId: row.property_id ?? undefined,
      destinations: row.country ? [row.country] : undefined,
      properties: row.accommodation_name ? [row.accommodation_name] : undefined,
    })
  }
  return chunks
}

export function chunkItineraryActivities(rows: Array<{
  id: number
  itinerary_id: number
  title: string | null
  description_itrvl: unknown
}>): BootstrapChunk[] {
  const chunks: BootstrapChunk[] = []
  for (const row of rows) {
    const text = extractTextFromLexical(row.description_itrvl)
    if (wordCount(text) < 20) continue
    chunks.push({
      chunkType: 'itinerary_segment',
      text,
      itineraryId: row.itinerary_id,
    })
  }
  return chunks
}

export function chunkFaqItems(rows: Array<{
  id: number
  itinerary_id: number
  question: string | null
  answer_itrvl: unknown
}>): BootstrapChunk[] {
  const chunks: BootstrapChunk[] = []
  for (const row of rows) {
    const answerText = extractTextFromLexical(row.answer_itrvl)
    if (wordCount(answerText) < 10) continue
    const text = `Q: ${row.question ?? ''}\nA: ${answerText}`
    chunks.push({
      chunkType: 'faq_answer',
      text,
      itineraryId: row.itinerary_id,
    })
  }
  return chunks
}

export function chunkProperties(rows: Array<{
  id: number
  name: string | null
  slug: string | null
  description_itrvl: unknown
  destination_id: number | null
}>): BootstrapChunk[] {
  const chunks: BootstrapChunk[] = []
  for (const row of rows) {
    // description_itrvl on properties is a textarea (plain text), not Lexical JSON
    const text = typeof row.description_itrvl === 'string'
      ? row.description_itrvl
      : extractTextFromLexical(row.description_itrvl)
    if (wordCount(text) < 20) continue
    chunks.push({
      chunkType: 'property_section',
      text,
      propertyId: row.id,
      destinationId: row.destination_id ?? undefined,
      properties: row.name ? [row.name] : undefined,
    })
  }
  return chunks
}

export function chunkDestinations(rows: Array<{
  id: number
  name: string | null
  slug: string | null
  description: unknown
  answer_capsule: string | null
  best_time_to_visit: unknown
}>): BootstrapChunk[] {
  const chunks: BootstrapChunk[] = []
  for (const row of rows) {
    let text = extractTextFromLexical(row.description)
    if (row.answer_capsule) {
      text = row.answer_capsule + '\n\n' + text
    }
    const bttv = extractTextFromLexical(row.best_time_to_visit)
    if (bttv) {
      text = text + '\n\n' + bttv
    }
    if (wordCount(text) < 20) continue
    chunks.push({
      chunkType: 'destination_section',
      text,
      destinationId: row.id,
      destinations: row.name ? [row.name] : undefined,
    })
  }
  return chunks
}

// Keep the original export for compatibility with the type system
export function chunkContent(options: import('./types').ChunkerOptions): import('./types').ContentChunk[] {
  // Not used by bootstrap — bootstrap uses the specific chunk functions above
  return []
}
