import type { Payload } from 'payload'
import type { PropertyEntity, ResolutionResult } from './types'
import { slugify, normalize } from './utils'

interface MappingEntry {
  canonical: string
  aliases: string[] | string | null
  property: unknown
}

interface MappingsGlobal {
  mappings?: MappingEntry[] | null
}

interface PropertyDoc {
  id: number
  name: string
  slug: string
}

/**
 * Resolve properties into Property records.
 * Checks: existing link → alias mappings → query by name → create.
 */
export async function resolveProperties(
  payload: Payload,
  properties: PropertyEntity[],
  resolvedDestinations: ResolutionResult[],
  countries: { name: string; normalized: string }[],
  dryRun: boolean,
): Promise<ResolutionResult[]> {
  const results: ResolutionResult[] = []

  // Load alias mappings once
  const mappings = (await payload.findGlobal({
    slug: 'property-name-mappings',
  })) as unknown as MappingsGlobal
  const aliasMap = buildAliasMap(mappings)

  // Build location name → destination ID map from resolved destinations
  const destIdByName = new Map<string, number>()
  for (const r of resolvedDestinations) {
    if (r.payloadId && r.entityType === 'destination') {
      destIdByName.set(normalize(r.entityName), r.payloadId)
    }
  }
  // Also map country names to their IDs
  for (const r of resolvedDestinations) {
    if (r.payloadId && r.entityType === 'country') {
      destIdByName.set(normalize(r.entityName), r.payloadId)
    }
  }

  for (const prop of properties) {
    // 1. If already linked to a Property record, verify it exists
    if (prop.existingPropertyId) {
      try {
        await payload.findByID({
          collection: 'properties',
          id: prop.existingPropertyId,
          depth: 0,
        })
        results.push({
          entityName: prop.name,
          entityType: 'property',
          action: 'found',
          payloadId: prop.existingPropertyId,
          collection: 'properties',
          note: 'Already linked in stay',
        })
        continue
      } catch {
        // ID doesn't exist — fall through to lookup
      }
    }

    // 2. Check alias mappings
    const aliasMatch = aliasMap.get(normalize(prop.name))
    if (aliasMatch) {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'found',
        payloadId: aliasMatch,
        collection: 'properties',
        note: 'Matched via alias',
      })
      continue
    }

    // 3. Query by name
    const found = await queryProperty(payload, prop.name)
    if (found) {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'found',
        payloadId: found.id,
        collection: 'properties',
      })
      continue
    }

    // 4. Not found — create if not dry run
    if (dryRun) {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'skipped',
        payloadId: null,
        collection: 'properties',
        note: 'Would create (dry run)',
      })
      continue
    }

    // Resolve destination: match by location name, fall back to country
    const destId =
      destIdByName.get(normalize(prop.location)) ??
      destIdByName.get(normalize(prop.country)) ??
      null

    if (!destId) {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'skipped',
        payloadId: null,
        collection: 'properties',
        note: 'No resolved destination to link — skipping creation',
      })
      continue
    }

    const created = await createProperty(payload, prop.name, destId)
    if (created) {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'created',
        payloadId: created.id,
        collection: 'properties',
      })
    } else {
      results.push({
        entityName: prop.name,
        entityType: 'property',
        action: 'skipped',
        payloadId: null,
        collection: 'properties',
        note: 'Failed to create',
      })
    }
  }

  return results
}

function buildAliasMap(mappings: MappingsGlobal): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of mappings.mappings || []) {
    const propId = extractPropertyId(entry.property)
    if (!propId) continue

    map.set(normalize(entry.canonical), propId)

    const aliases = Array.isArray(entry.aliases) ? entry.aliases : []
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) {
        map.set(normalize(alias), propId)
      }
    }
  }
  return map
}

function extractPropertyId(ref: unknown): number | null {
  if (typeof ref === 'number') return ref
  if (ref && typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    const id = (ref as Record<string, unknown>).id
    return typeof id === 'number' ? id : null
  }
  return null
}

async function queryProperty(
  payload: Payload,
  name: string,
): Promise<PropertyDoc | null> {
  const result = await payload.find({
    collection: 'properties',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as unknown as PropertyDoc) ?? null
}

async function createProperty(
  payload: Payload,
  name: string,
  destinationId: number,
): Promise<PropertyDoc | null> {
  const slug = slugify(name)

  try {
    const created = await payload.create({
      collection: 'properties',
      draft: true,
      data: {
        name,
        slug,
        destination: destinationId,
      },
    })
    return created as unknown as PropertyDoc
  } catch (err: unknown) {
    // Slug uniqueness conflict — query by slug and treat as found
    if (err instanceof Error && err.message?.includes('unique')) {
      const existing = await payload.find({
        collection: 'properties',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs[0]) {
        return existing.docs[0] as unknown as PropertyDoc
      }
    }
    console.error(`[cascade] Failed to create property "${name}":`, err)
    return null
  }
}
