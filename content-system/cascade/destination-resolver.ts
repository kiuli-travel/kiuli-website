import type { Payload } from 'payload'
import type { CountryEntity, LocationEntity, ResolutionResult } from './types'
import { slugify, normalize } from './utils'

// ---------------------------------------------------------------------------
// LocationMappings global structure — matches src/globals/LocationMappings.ts
// ---------------------------------------------------------------------------
interface MappingEntry {
  externalString: string
  sourceSystem: 'itrvl' | 'wetu' | 'expert_africa' | 'any' | 'manual'
  resolvedAs: 'destination' | 'property' | 'airport' | 'ignore'
  destination?: unknown // Payload relationship — populated object or ID when resolvedAs=destination
  property?: unknown    // Payload relationship — populated object or ID when resolvedAs=property
  airport?: unknown     // Payload relationship — populated object or ID when resolvedAs=airport
  notes?: string
}

interface MappingsGlobal {
  mappings?: MappingEntry[] | null
}

// Internal index built from LocationMappings
interface MappingResolution {
  resolvedAs: 'destination' | 'property' | 'airport' | 'ignore'
  destinationId: number | null // Only set when resolvedAs=destination
}

interface DestinationDoc {
  id: number
  name: string
  slug: string
  type: string
}

/**
 * Resolve countries and locations into Destination records.
 *
 * Resolution order for locations:
 *   1. LocationMappings index (externalString match)
 *      - resolvedAs=destination → use the mapped destination ID
 *      - resolvedAs=ignore      → skip, do not create
 *      - resolvedAs=property/airport → skip destination resolution (not a destination)
 *   2. Direct name query (type=destination)
 *   3. Auto-create as draft destination (unless dryRun)
 */
export async function resolveDestinations(
  payload: Payload,
  countries: CountryEntity[],
  locations: LocationEntity[],
  dryRun: boolean,
): Promise<ResolutionResult[]> {
  const results: ResolutionResult[] = []

  // Load LocationMappings global and build index once
  const mappingsGlobal = (await payload.findGlobal({
    slug: 'location-mappings',
  })) as unknown as MappingsGlobal
  const mappingIndex = buildMappingIndex(mappingsGlobal)

  // Build country name → ID map as we resolve them
  const countryIdMap = new Map<string, number>()

  // --- Resolve countries ---
  for (const country of countries) {
    const found = await queryDestination(payload, country.name, 'country')
    if (found) {
      countryIdMap.set(country.normalized, found.id)
      results.push({
        entityName: country.name,
        entityType: 'country',
        action: 'found',
        payloadId: found.id,
        collection: 'destinations',
      })
    } else {
      results.push({
        entityName: country.name,
        entityType: 'country',
        action: 'skipped',
        payloadId: null,
        collection: 'destinations',
        note: 'Country not found in destinations — expected to exist',
      })
    }
  }

  // --- Resolve locations ---
  for (const location of locations) {
    const normalizedName = normalize(location.name)
    const mapping = mappingIndex.get(normalizedName)

    // Step 1: LocationMappings index
    if (mapping) {
      if (mapping.resolvedAs === 'destination' && mapping.destinationId !== null) {
        results.push({
          entityName: location.name,
          entityType: 'destination',
          action: 'found',
          payloadId: mapping.destinationId,
          collection: 'destinations',
          note: 'Matched via LocationMappings',
        })
        continue
      }

      if (mapping.resolvedAs === 'ignore') {
        results.push({
          entityName: location.name,
          entityType: 'destination',
          action: 'skipped',
          payloadId: null,
          collection: 'destinations',
          note: 'Mapped as ignore in LocationMappings — not a destination',
        })
        continue
      }

      // resolvedAs=property or resolvedAs=airport — not a destination, skip creation
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'skipped',
        payloadId: null,
        collection: 'destinations',
        note: `Mapped as ${mapping.resolvedAs} in LocationMappings — not resolving as destination`,
      })
      continue
    }

    // Step 2: Direct name query
    const found = await queryDestination(payload, location.name, 'destination')
    if (found) {
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'found',
        payloadId: found.id,
        collection: 'destinations',
      })
      continue
    }

    // Step 3: Auto-create
    if (dryRun) {
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'skipped',
        payloadId: null,
        collection: 'destinations',
        note: 'Would create (dry run)',
      })
      continue
    }

    const parentCountryId = countryIdMap.get(normalize(location.country)) ?? null
    const created = await createDestination(payload, location.name, parentCountryId)
    if (created) {
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'created',
        payloadId: created.id,
        collection: 'destinations',
      })
    } else {
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'skipped',
        payloadId: null,
        collection: 'destinations',
        note: 'Failed to create',
      })
    }
  }

  return results
}

/**
 * Build a normalized-externalString → MappingResolution index from LocationMappings.
 *
 * Only indexes entries where resolvedAs=destination (with a valid destination ID),
 * resolvedAs=ignore, resolvedAs=property, and resolvedAs=airport. All four are
 * meaningful signals — ignore and non-destination types prevent incorrect auto-creation.
 */
function buildMappingIndex(mappingsGlobal: MappingsGlobal): Map<string, MappingResolution> {
  const index = new Map<string, MappingResolution>()

  for (const entry of mappingsGlobal.mappings || []) {
    if (!entry.externalString?.trim()) continue

    const key = normalize(entry.externalString)

    if (entry.resolvedAs === 'destination') {
      const destinationId = extractId(entry.destination)
      if (destinationId === null) {
        // Misconfigured entry — destination relationship not set. Skip silently.
        // This will fall through to direct name lookup, which is the correct fallback.
        continue
      }
      index.set(key, { resolvedAs: 'destination', destinationId })
    } else {
      // ignore | property | airport — record the signal, destinationId is not applicable
      index.set(key, { resolvedAs: entry.resolvedAs, destinationId: null })
    }
  }

  return index
}

function extractId(ref: unknown): number | null {
  if (typeof ref === 'number') return ref
  if (ref && typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    const id = (ref as Record<string, unknown>).id
    return typeof id === 'number' ? id : null
  }
  return null
}

async function queryDestination(
  payload: Payload,
  name: string,
  type: 'country' | 'destination',
): Promise<DestinationDoc | null> {
  const result = await payload.find({
    collection: 'destinations',
    where: {
      and: [
        { name: { equals: name } },
        { type: { equals: type } },
      ],
    },
    limit: 1,
    depth: 0,
    draft: true,
  })
  return (result.docs[0] as unknown as DestinationDoc) ?? null
}

async function createDestination(
  payload: Payload,
  name: string,
  parentCountryId: number | null,
): Promise<DestinationDoc | null> {
  const slug = slugify(name)

  try {
    const created = await payload.create({
      collection: 'destinations',
      draft: true,
      data: {
        name,
        slug,
        type: 'destination',
        ...(parentCountryId ? { country: parentCountryId } : {}),
      },
    })
    return created as unknown as DestinationDoc
  } catch (err: unknown) {
    // Slug uniqueness conflict — query by slug and treat as found
    if (err instanceof Error && err.message?.includes('unique')) {
      const existing = await payload.find({
        collection: 'destinations',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs[0]) {
        return existing.docs[0] as unknown as DestinationDoc
      }
    }
    console.error(`[cascade] Failed to create destination "${name}":`, err)
    return null
  }
}
