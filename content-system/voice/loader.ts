import { getPayload } from 'payload'
import configPromise from '@payload-config'

// ── Types ────────────────────────────────────────────────────────────────

export interface VoicePrinciple {
  principle: string
  explanation: string
  example?: string
}

export interface BannedPhrase {
  phrase: string
  reason: string
  alternative?: string
}

export interface AntiPattern {
  pattern: string
  explanation: string
}

export interface GoldStandardEntry {
  excerpt: string
  contentType: string
  context: string
  addedAt?: string
}

export interface CoreVoice {
  summary: string
  principles: VoicePrinciple[]
  audience: string
  positioning: string
  bannedPhrases: BannedPhrase[]
  antiPatterns: AntiPattern[]
  goldStandard: GoldStandardEntry[]
}

export interface ContentTypeGuidance {
  contentType: string
  label: string
  objective: string
  toneShift: string
  structuralNotes: string
  temperature: number
}

export interface SectionGuidanceEntry {
  contentType: string
  sectionKey: string
  sectionLabel: string
  objective: string
  toneNotes: string
  wordCountRange: string
  doList: string[]
  dontList: string[]
  examples: Array<{ before: string; after: string }>
  promptTemplate?: string
}

export interface VoiceContext {
  core: CoreVoice
  contentType?: ContentTypeGuidance
  sections?: SectionGuidanceEntry[]
}

// ── Raw data types (from Payload) ────────────────────────────────────────

interface RawArrayItem {
  [key: string]: unknown
}

// ── Internal cache ───────────────────────────────────────────────────────

let cachedGlobal: Record<string, unknown> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10_000 // 10 seconds — prevents repeated reads within a single request chain

async function loadGlobal(): Promise<Record<string, unknown>> {
  const now = Date.now()
  if (cachedGlobal && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedGlobal
  }

  const payload = await getPayload({ config: configPromise })
  const data = await payload.findGlobal({ slug: 'brand-voice' })
  cachedGlobal = data as unknown as Record<string, unknown>
  cacheTimestamp = now
  return cachedGlobal
}

/** Clear cache — call after writing to BrandVoice to ensure next read is fresh */
export function invalidateVoiceCache(): void {
  cachedGlobal = null
  cacheTimestamp = 0
}

// ── Parsers ──────────────────────────────────────────────────────────────

function parseCore(data: Record<string, unknown>): CoreVoice {
  const principles = (Array.isArray(data.principles) ? data.principles : []).map(
    (p: RawArrayItem) => ({
      principle: String(p.principle || ''),
      explanation: String(p.explanation || ''),
      example: p.example ? String(p.example) : undefined,
    }),
  )

  const bannedPhrases = (Array.isArray(data.bannedPhrases) ? data.bannedPhrases : []).map(
    (b: RawArrayItem) => ({
      phrase: String(b.phrase || ''),
      reason: String(b.reason || ''),
      alternative: b.alternative ? String(b.alternative) : undefined,
    }),
  )

  const antiPatterns = (Array.isArray(data.antiPatterns) ? data.antiPatterns : []).map(
    (a: RawArrayItem) => ({
      pattern: String(a.pattern || ''),
      explanation: String(a.explanation || ''),
    }),
  )

  const goldStandard = (Array.isArray(data.goldStandard) ? data.goldStandard : []).map(
    (g: RawArrayItem) => ({
      excerpt: String(g.excerpt || ''),
      contentType: String(g.contentType || 'general'),
      context: String(g.context || ''),
      addedAt: g.addedAt ? String(g.addedAt) : undefined,
    }),
  )

  return {
    summary: String(data.voiceSummary || ''),
    principles,
    audience: String(data.audience || ''),
    positioning: String(data.positioning || ''),
    bannedPhrases,
    antiPatterns,
    goldStandard,
  }
}

function findContentTypeGuidance(
  data: Record<string, unknown>,
  contentType: string,
): ContentTypeGuidance | undefined {
  const guidance = Array.isArray(data.contentTypeGuidance) ? data.contentTypeGuidance : []
  const match = guidance.find((g: RawArrayItem) => g.contentType === contentType)
  if (!match) return undefined

  return {
    contentType: String(match.contentType),
    label: String(match.label || ''),
    objective: String(match.objective || ''),
    toneShift: String(match.toneShift || ''),
    structuralNotes: String(match.structuralNotes || ''),
    temperature: typeof match.temperature === 'number' ? match.temperature : 0.6,
  }
}

function parseSectionGuidance(
  data: Record<string, unknown>,
  contentType: string,
  sectionKey?: string,
): SectionGuidanceEntry[] {
  const sections = Array.isArray(data.sectionGuidance) ? data.sectionGuidance : []

  return sections
    .filter((s: RawArrayItem) => {
      if (s.contentType !== contentType) return false
      if (sectionKey && s.sectionKey !== sectionKey) return false
      return true
    })
    .map((s: RawArrayItem) => ({
      contentType: String(s.contentType),
      sectionKey: String(s.sectionKey || ''),
      sectionLabel: String(s.sectionLabel || ''),
      objective: String(s.objective || ''),
      toneNotes: String(s.toneNotes || ''),
      wordCountRange: String(s.wordCountRange || ''),
      doList: (Array.isArray(s.doList) ? s.doList : []).map(
        (d: RawArrayItem) => String(d.item || ''),
      ),
      dontList: (Array.isArray(s.dontList) ? s.dontList : []).map(
        (d: RawArrayItem) => String(d.item || ''),
      ),
      examples: (Array.isArray(s.examples) ? s.examples : []).map(
        (e: RawArrayItem) => ({
          before: String(e.before || ''),
          after: String(e.after || ''),
        }),
      ),
      promptTemplate: s.promptTemplate ? String(s.promptTemplate) : undefined,
    }))
}

// ── Public API ───────────────────────────────────────────────────────────

/** Load core voice only (Layer 1). Used by simple operations. */
export async function loadCoreVoice(): Promise<CoreVoice> {
  const data = await loadGlobal()
  return parseCore(data)
}

/** Load core + content type guidance (Layers 1+2). Used by conversation handler and article drafter. */
export async function loadVoiceForContentType(contentType: string): Promise<VoiceContext> {
  const data = await loadGlobal()
  return {
    core: parseCore(data),
    contentType: findContentTypeGuidance(data, contentType),
  }
}

/** Load core + content type + all section guidance for that type (Layers 1+2+3). Used by compound drafters. */
export async function loadFullVoice(contentType: string): Promise<VoiceContext> {
  const data = await loadGlobal()
  return {
    core: parseCore(data),
    contentType: findContentTypeGuidance(data, contentType),
    sections: parseSectionGuidance(data, contentType),
  }
}

/** Load core + specific section guidance (Layers 1+3). Used by scraper enhance endpoint. */
export async function loadVoiceForSection(
  contentType: string,
  sectionKey: string,
): Promise<VoiceContext> {
  const data = await loadGlobal()
  return {
    core: parseCore(data),
    contentType: findContentTypeGuidance(data, contentType),
    sections: parseSectionGuidance(data, contentType, sectionKey),
  }
}
