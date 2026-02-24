SCHEMA V3.0 VERIFICATION REPORT
Date: 2026-02-23T18:30:00Z

QUERY 1 — New tables:
         table_name
----------------------------
 airports
 location_mappings
 location_mappings_mappings
 service_items
(4 rows)

QUERY 2 — Activities booking_behaviour columns:
                column_name
--------------------------------------------
 booking_behaviour_availability
 booking_behaviour_is_included_in_tariff
 booking_behaviour_maximum_group_size
 booking_behaviour_minimum_lead_days
 booking_behaviour_requires_advance_booking
 booking_behaviour_typical_additional_cost
(6 rows)

QUERY 3 — TransferRoutes airport columns:
   column_name
-----------------
 from_airport_id
 to_airport_id
(2 rows)

QUERY 4 — Activities data integrity:
 id |                           name                            |      type
----+-----------------------------------------------------------+----------------
  8 | Meet and Assist - Kilimanjaro Int Airport Arrival         | other
  9 | VIP Lounge -  Kilimanjaro International Airport Arrival   | other
 10 | Serengeti Camping Fee                                     | other
 11 |  Serengeti National Park Fee                              | other
 12 | Serengeti Balloon Safari                                  | balloon_flight
 13 | Meet and Assist - Kilimanjaro Int Airport Departure       | other
 14 | VIP Lounge -  Kilimanjaro International Airport Departure | other
(7 rows)

NOTE: 7 rows returned, not 1. The 6 type='other' activity records (ids 8-11, 13-14) were NOT
deleted — this is expected because data fixes (Section 19, Steps D-E) are a separate future task.

QUERY 5 — Migration history:
(Original query used `executed_at` which does not exist; corrected to `created_at`)
      name       | batch
-----------------+-------
 20260223_181943 |    38
 20260223_074555 |    37
 20260222_190422 |    36
 20260222_190335 |    35
 20260222_143340 |    34
(5 rows)

Migration 20260223_181943 is the schema v3.0 migration, batch 38.

QUERY 6 — Properties seasonalityData columns:
(No columns directly on properties table — seasonalityData is an array field stored as a separate table)
 column_name
-------------
(0 rows)

Separate table check:
                       table_name
---------------------------------------------------------
 _properties_v_version_accumulated_data_seasonality_data
 properties_accumulated_data_seasonality_data
(2 rows)

Both the main table and version table exist.

QUERY 7 — ItineraryPatterns relation tables:
              table_name
--------------------------------------
 itinerary_patterns
 itinerary_patterns_property_sequence
 itinerary_patterns_rels
 itinerary_patterns_transfer_sequence
(4 rows)

itinerary_patterns_rels exists. The service_items_id column was added to it (confirmed in migration SQL line 111).

DESTINATION-RESOLVER.TS CURRENT CONTENT:
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
    slug: 'location-mappings',
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
    draft: true, // Include draft destinations (created without heroImage)
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

MIGRATION FILE:
Filename: src/migrations/20260223_181943.ts
Content: [see above — full 239-line migration with UP creating all new tables/columns/constraints/indexes and DOWN reversing them]

BLOCKERS
- Query 5 originally failed: column "executed_at" does not exist. Re-ran with "created_at" — succeeded.
- Query 6 returned 0 rows because seasonalityData is an array field stored as a separate table, not as columns on properties. Confirmed via separate table existence check (2 tables found).
- Query 4 returned 7 rows instead of expected 1. The 6 type='other' records exist because data migration (Section 19, Steps D-E) has not been run yet. This is expected — data fixes are a separate future task.
