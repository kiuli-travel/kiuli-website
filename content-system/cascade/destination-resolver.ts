import type { Payload } from 'payload'
import type { CountryEntity, LocationEntity, ResolutionResult } from './types'
import { slugify, normalize } from './utils'

interface MappingEntry {
  canonical: string
  aliases: string[] | string | null
  destination: unknown
}

interface MappingsGlobal {
  mappings?: MappingEntry[] | null
}

interface DestinationDoc {
  id: number
  name: string
  slug: string
  type: string
}

/**
 * Resolve countries and locations into Destination records.
 * Countries: look up existing (all 10 should exist). Warn if missing.
 * Locations: check aliases first, then query by name. Create if not found.
 */
export async function resolveDestinations(
  payload: Payload,
  countries: CountryEntity[],
  locations: LocationEntity[],
  dryRun: boolean,
): Promise<ResolutionResult[]> {
  const results: ResolutionResult[] = []

  // Load alias mappings once
  const mappings = (await payload.findGlobal({
    slug: 'destination-name-mappings',
  })) as unknown as MappingsGlobal
  const aliasMap = buildAliasMap(mappings)

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
    // Check alias mappings first
    const aliasMatch = aliasMap.get(normalize(location.name))
    if (aliasMatch) {
      results.push({
        entityName: location.name,
        entityType: 'destination',
        action: 'found',
        payloadId: aliasMatch,
        collection: 'destinations',
        note: 'Matched via alias',
      })
      continue
    }

    // Query by name + type=destination
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

    // Not found — create if not dry run
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

/** Build normalized-alias → destination ID map from the global config. */
function buildAliasMap(mappings: MappingsGlobal): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of mappings.mappings || []) {
    const destId = extractDestinationId(entry.destination)
    if (!destId) continue

    // Map the canonical name too
    map.set(normalize(entry.canonical), destId)

    // Map each alias
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : []
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) {
        map.set(normalize(alias), destId)
      }
    }
  }
  return map
}

function extractDestinationId(ref: unknown): number | null {
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
      draft: true, // Bypasses required heroImage
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
