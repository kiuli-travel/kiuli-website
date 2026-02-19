import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { LibrarySearchOptions, LibraryMatch, LibrarySearchResult } from './types'

/**
 * Search the Media collection with multi-dimensional filtering.
 * Uses Payload where clauses for indexed fields and post-filters for jsonb/text matching.
 */
export async function searchLibrary(options: LibrarySearchOptions): Promise<LibrarySearchResult> {
  const payload = await getPayload({ config: configPromise })
  const limit = options.limit ?? 40

  // Build Payload where clause for indexed enum fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // Only include labeled images
  conditions.push({ labelingStatus: { equals: 'complete' } })

  // Only images, not videos
  conditions.push({ mediaType: { not_equals: 'video' } })

  if (options.country) {
    const countries = Array.isArray(options.country) ? options.country : [options.country]
    conditions.push({ country: { in: countries.join(',') } })
  }

  if (options.imageType) {
    const types = Array.isArray(options.imageType) ? options.imageType : [options.imageType]
    conditions.push({ imageType: { in: types.join(',') } })
  }

  if (options.composition) {
    const comps = Array.isArray(options.composition) ? options.composition : [options.composition]
    conditions.push({ composition: { in: comps.join(',') } })
  }

  if (options.quality) {
    conditions.push({ quality: { equals: options.quality } })
  }

  if (options.isHero !== undefined) {
    conditions.push({ isHero: { equals: options.isHero } })
  }

  if (options.timeOfDay) {
    const times = Array.isArray(options.timeOfDay) ? options.timeOfDay : [options.timeOfDay]
    conditions.push({ timeOfDay: { in: times.join(',') } })
  }

  if (options.excludeIds && options.excludeIds.length > 0) {
    conditions.push({ id: { not_in: options.excludeIds.join(',') } })
  }

  // Fetch a larger set for post-filtering (we'll trim to limit after)
  const fetchLimit = Math.min(500, limit * 5)

  const result = await payload.find({
    collection: 'media',
    where: conditions.length > 0 ? { and: conditions } : {},
    limit: fetchLimit,
    depth: 0,
    sort: '-createdAt',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let docs = result.docs as any[]

  // Post-filter: species (animals jsonb array)
  if (options.species && options.species.length > 0) {
    const searchSpecies = options.species.map((s) => normalizeSpecies(s))
    docs = docs.filter((doc) => {
      const animals = parseJsonArray(doc.animals)
      return animals.some((a) =>
        searchSpecies.some((s) => normalizeSpecies(a) === s),
      )
    })
  }

  // Post-filter: properties (sourceProperty text)
  if (options.properties && options.properties.length > 0) {
    const searchProps = options.properties.map((p) => p.toLowerCase())
    docs = docs.filter((doc) => {
      if (!doc.sourceProperty) return false
      const prop = doc.sourceProperty.toLowerCase()
      return searchProps.some((sp) => prop.includes(sp))
    })
  }

  // Post-filter: free text query (tags, scene, altText)
  if (options.query) {
    const words = options.query.toLowerCase().split(/\s+/).filter(Boolean)
    docs = docs.filter((doc) => {
      const tags = parseJsonArray(doc.tags).map((t: string) => t.toLowerCase())
      const scene = (doc.scene || '').toLowerCase()
      const alt = (doc.altText || '').toLowerCase()
      const allText = [...tags, scene, alt].join(' ')
      return words.every((w) => allText.includes(w))
    })
  }

  // Post-filter: mood (hasMany select — stored in junction table, but Payload API returns as array)
  if (options.mood) {
    const moods = Array.isArray(options.mood) ? options.mood : [options.mood]
    docs = docs.filter((doc) => {
      const docMoods = parseSelectMany(doc.mood)
      return moods.some((m) => docMoods.includes(m))
    })
  }

  // Post-filter: setting (hasMany select)
  if (options.setting) {
    const settings = Array.isArray(options.setting) ? options.setting : [options.setting]
    docs = docs.filter((doc) => {
      const docSettings = parseSelectMany(doc.setting)
      return settings.some((s) => docSettings.includes(s))
    })
  }

  // Post-filter: suitableFor (hasMany select)
  if (options.suitableFor) {
    const suitable = Array.isArray(options.suitableFor) ? options.suitableFor : [options.suitableFor]
    docs = docs.filter((doc) => {
      const docSuitable = parseSelectMany(doc.suitableFor)
      return suitable.some((s) => docSuitable.includes(s))
    })
  }

  // Post-filter: source (scraped vs generated)
  if (options.source && options.source !== 'all') {
    if (options.source === 'generated') {
      docs = docs.filter((doc) => doc.sourceS3Key?.startsWith('generated:'))
    } else {
      docs = docs.filter((doc) => !doc.sourceS3Key?.startsWith('generated:'))
    }
  }

  // Compute facets from ALL filtered results (before pagination)
  const facets = computeFacets(docs)

  // Score and sort
  const scored = docs.map((doc) => ({
    doc,
    score: computeScore(doc, options),
  }))
  scored.sort((a, b) => b.score - a.score)

  // Paginate
  const total = scored.length
  const page = scored.slice(0, limit)

  // Transform to LibraryMatch
  const matches: LibraryMatch[] = page.map(({ doc, score }) => ({
    mediaId: doc.id,
    url: doc.url || '',
    imgixUrl: doc.imgixUrl || null,
    thumbnailUrl: doc.sizes?.thumbnail?.url || null,
    alt: doc.alt || '',
    altText: doc.altText || null,
    country: doc.country || null,
    imageType: doc.imageType || null,
    composition: doc.composition || null,
    animals: parseJsonArray(doc.animals),
    tags: parseJsonArray(doc.tags),
    scene: doc.scene || null,
    sourceProperty: doc.sourceProperty || null,
    isHero: doc.isHero || false,
    quality: doc.quality || null,
    mood: parseSelectMany(doc.mood),
    timeOfDay: doc.timeOfDay || null,
    suitableFor: parseSelectMany(doc.suitableFor),
    setting: parseSelectMany(doc.setting),
    width: doc.width || null,
    height: doc.height || null,
    source: doc.sourceS3Key?.startsWith('generated:') ? 'generated' : 'scraped',
    score,
    generationPrompt: doc.generationPrompt || null,
    generationModel: doc.generationModel || null,
    generatedAt: doc.generatedAt || null,
  }))

  return { matches, total, facets }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch {
      // not JSON
    }
  }
  return []
}

function parseSelectMany(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') return [value]
  return []
}

/**
 * Normalize species names for matching: lowercase, strip trailing 's' for plural tolerance.
 */
function normalizeSpecies(name: string): string {
  const lower = name.toLowerCase().trim()
  // Strip trailing 's' for singular/plural matching
  return lower.endsWith('s') ? lower.slice(0, -1) : lower
}

function computeScore(doc: Record<string, unknown>, options: LibrarySearchOptions): number {
  let score = 0

  // Base score for labeled images
  if (doc.labelingStatus === 'complete') score += 1

  // Quality boost
  if (doc.quality === 'high') score += 2

  // Hero boost when searching for heroes
  if (options.isHero && doc.isHero) score += 3

  // Country match
  if (options.country) {
    const countries = Array.isArray(options.country) ? options.country : [options.country]
    if (countries.includes(doc.country as string)) score += 2
  }

  // Type match
  if (options.imageType) {
    const types = Array.isArray(options.imageType) ? options.imageType : [options.imageType]
    if (types.includes(doc.imageType as string)) score += 2
  }

  // Species match
  if (options.species && options.species.length > 0) {
    const animals = parseJsonArray(doc.animals)
    const matchCount = options.species.filter((s) =>
      animals.some((a) => normalizeSpecies(a) === normalizeSpecies(s)),
    ).length
    score += matchCount * 3
  }

  // Composition match
  if (options.composition) {
    const comps = Array.isArray(options.composition) ? options.composition : [options.composition]
    if (comps.includes(doc.composition as string)) score += 1
  }

  // Query relevance
  if (options.query) {
    const words = options.query.toLowerCase().split(/\s+/)
    const tags = parseJsonArray(doc.tags).map((t: string) => t.toLowerCase())
    const matchCount = words.filter((w) => tags.some((t) => t.includes(w))).length
    score += matchCount
  }

  return score
}

function computeFacets(docs: Record<string, unknown>[]): LibrarySearchResult['facets'] {
  const countryCounts = new Map<string, number>()
  const typeCounts = new Map<string, number>()
  const speciesCounts = new Map<string, number>()
  const propertyCounts = new Map<string, number>()

  for (const doc of docs) {
    const country = doc.country as string
    if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1)

    const type = doc.imageType as string
    if (type) typeCounts.set(type, (typeCounts.get(type) || 0) + 1)

    const animals = parseJsonArray(doc.animals)
    for (const a of animals) {
      speciesCounts.set(a, (speciesCounts.get(a) || 0) + 1)
    }

    const prop = doc.sourceProperty as string
    if (prop) propertyCounts.set(prop, (propertyCounts.get(prop) || 0) + 1)
  }

  const toArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)

  return {
    countries: toArray(countryCounts),
    imageTypes: toArray(typeCounts),
    species: toArray(speciesCounts),
    properties: toArray(propertyCounts),
  }
}
