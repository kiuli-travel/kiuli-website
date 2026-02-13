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

// --- ContentProject chunking (Phase 4) ---

function toStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
  return undefined
}

function extractTextFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  if (typeof n.text === 'string') return n.text
  if (Array.isArray(n.children)) {
    const parts: string[] = []
    for (const child of n.children) {
      const t = extractTextFromNode(child)
      if (t) parts.push(t)
    }
    const isBlock = n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem'
    return isBlock ? parts.join('') : parts.join('\n')
  }
  return ''
}

interface LexicalSection {
  title: string
  nodes: unknown[]
}

function splitByH2(lexicalBody: unknown): LexicalSection[] {
  if (!lexicalBody || typeof lexicalBody !== 'object') return []
  const root = (lexicalBody as Record<string, unknown>).root
  if (!root || typeof root !== 'object') return []
  const children = (root as Record<string, unknown>).children
  if (!Array.isArray(children)) return []

  const sections: LexicalSection[] = []
  let current: LexicalSection = { title: '', nodes: [] }

  for (const child of children) {
    const c = child as Record<string, unknown>
    if (c.type === 'heading' && c.tag === 'h2') {
      if (current.nodes.length > 0) {
        sections.push(current)
      }
      const headingText = extractTextFromNode(child)
      current = { title: headingText, nodes: [] }
    } else {
      current.nodes.push(child)
    }
  }
  if (current.nodes.length > 0) {
    sections.push(current)
  }

  return sections
}

function sectionNodesToText(nodes: unknown[]): string {
  return nodes.map(n => extractTextFromNode(n)).filter(Boolean).join('\n').trim()
}

function splitLongText(text: string, title: string, maxWords: number): Array<{ text: string; title: string }> {
  if (wordCount(text) <= maxWords) return [{ text, title }]

  const paragraphs = text.split('\n')
  const result: Array<{ text: string; title: string }> = []
  let current = ''
  let partNum = 1

  for (const para of paragraphs) {
    if (current && wordCount(current + '\n' + para) > maxWords) {
      result.push({ text: current.trim(), title: `${title} (part ${partNum})` })
      partNum++
      current = para
    } else {
      current = current ? current + '\n' + para : para
    }
  }
  if (current.trim()) {
    result.push({ text: current.trim(), title: partNum > 1 ? `${title} (part ${partNum})` : title })
  }
  return result
}

function makeChunk(
  id: string,
  sourceId: string,
  chunkType: ChunkType,
  text: string,
  metadata: ChunkMetadata,
): ContentChunk {
  return {
    id,
    sourceCollection: 'content-projects',
    sourceId,
    sourceField: 'body',
    chunkType,
    text,
    metadata,
  }
}

function buildMetadata(
  content: Record<string, unknown>,
  sectionName?: string,
  wc?: number,
): ChunkMetadata {
  return {
    title: content.title as string | undefined,
    slug: content.slug as string | undefined,
    destinations: toStringArray(content.destinations),
    properties: toStringArray(content.properties),
    species: toStringArray(content.species),
    contentType: content.contentType as string | undefined,
    freshnessCategory: content.freshnessCategory as string | undefined,
    sectionName,
    wordCount: wc ?? 0,
  }
}

function chunkFaqSection(
  content: Record<string, unknown>,
  sourceId: string,
  existingCount: number,
): ContentChunk[] {
  const faqSection = content.faqSection
  if (!Array.isArray(faqSection)) return []
  const chunks: ContentChunk[] = []
  for (let i = 0; i < faqSection.length; i++) {
    const faq = faqSection[i] as { question?: string; answer?: string }
    if (!faq.question || !faq.answer) continue
    const text = `Q: ${faq.question}\nA: ${faq.answer}`
    if (wordCount(text) < 10) continue
    chunks.push(makeChunk(
      `${sourceId}-faq-${i}`,
      sourceId,
      'faq_answer',
      text,
      { ...buildMetadata(content, `faq-${i}`, wordCount(text)), sectionName: `faq-${i}` },
    ))
  }
  return chunks
}

function chunkBodyByH2(
  content: Record<string, unknown>,
  sourceId: string,
  chunkType: ChunkType,
  maxWords: number,
): ContentChunk[] {
  const body = content.body
  const sections = splitByH2(body)
  const chunks: ContentChunk[] = []

  if (sections.length === 0) {
    const text = extractTextFromLexical(body)
    if (wordCount(text) >= 20) {
      chunks.push(makeChunk(
        `${sourceId}-body-0`,
        sourceId,
        chunkType,
        text,
        buildMetadata(content, 'body', wordCount(text)),
      ))
    }
    return chunks
  }

  let idx = 0
  for (const section of sections) {
    const sectionText = sectionNodesToText(section.nodes)
    if (wordCount(sectionText) < 20) continue

    const parts = splitLongText(sectionText, section.title, maxWords)
    for (const part of parts) {
      const wc = wordCount(part.text)
      if (wc < 20) continue
      chunks.push(makeChunk(
        `${sourceId}-body-${idx}`,
        sourceId,
        chunkType,
        section.title ? `${section.title}\n\n${part.text}` : part.text,
        buildMetadata(content, part.title || `section-${idx}`, wc),
      ))
      idx++
    }
  }

  return chunks
}

function chunkSections(
  content: Record<string, unknown>,
  sourceId: string,
  chunkType: ChunkType,
): ContentChunk[] {
  const sections = content.sections
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return []
  const chunks: ContentChunk[] = []
  const sectionObj = sections as Record<string, unknown>
  let idx = 0

  for (const [sectionName, sectionValue] of Object.entries(sectionObj)) {
    let text: string
    if (typeof sectionValue === 'string') {
      text = sectionValue
    } else {
      text = extractTextFromLexical(sectionValue)
    }
    if (wordCount(text) < 20) continue
    chunks.push(makeChunk(
      `${sourceId}-section-${idx}`,
      sourceId,
      chunkType,
      `${sectionName}\n\n${text}`,
      buildMetadata(content, sectionName, wordCount(text)),
    ))
    idx++
  }

  return chunks
}

export function chunkContent(options: import('./types').ChunkerOptions): ContentChunk[] {
  const { sourceId, content } = options
  const maxWords = options.maxChunkWords ?? 500
  const contentType = content.contentType as string

  const chunks: ContentChunk[] = []

  switch (contentType) {
    case 'authority': {
      chunks.push(...chunkBodyByH2(content, sourceId, 'article_section', maxWords))
      chunks.push(...chunkFaqSection(content, sourceId, chunks.length))
      break
    }
    case 'destination_page': {
      chunks.push(...chunkSections(content, sourceId, 'destination_section'))
      chunks.push(...chunkFaqSection(content, sourceId, chunks.length))
      break
    }
    case 'property_page': {
      chunks.push(...chunkSections(content, sourceId, 'property_section'))
      chunks.push(...chunkFaqSection(content, sourceId, chunks.length))
      break
    }
    case 'itinerary_enhancement': {
      chunks.push(...chunkBodyByH2(content, sourceId, 'itinerary_segment', maxWords))
      break
    }
    case 'page_update': {
      const text = extractTextFromLexical(content.body)
      if (wordCount(text) >= 20) {
        chunks.push(makeChunk(
          `${sourceId}-body-0`,
          sourceId,
          'page_section',
          text,
          buildMetadata(content, 'body', wordCount(text)),
        ))
      }
      break
    }
    default: {
      // For other types (itinerary_cluster, designer_insight), chunk body if present
      chunks.push(...chunkBodyByH2(content, sourceId, 'article_section', maxWords))
      break
    }
  }

  return chunks
}
