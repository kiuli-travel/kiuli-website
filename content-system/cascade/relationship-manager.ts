import type { Payload } from 'payload'
import type { RelationshipAction } from './types'
import { extractId } from './utils'
import { query } from '../db'

interface ContentSystemSettings {
  autoPopulateRelationships?: boolean
}

/**
 * Manage bidirectional relationships between itinerary, destinations, and properties.
 * Always reads before writing; merges arrays, never replaces.
 *
 * For itineraries: uses direct SQL to avoid Payload's full rels rewrite (159+ rows).
 * For destinations/properties: uses Payload API (simple schemas, few rels).
 */
export async function manageRelationships(
  payload: Payload,
  itineraryId: number,
  destIds: number[],
  propIds: number[],
  propToDestMap: Map<number, number>,
  dryRun: boolean,
): Promise<RelationshipAction[]> {
  const settings = (await payload.findGlobal({
    slug: 'content-system-settings',
  })) as unknown as ContentSystemSettings

  if (settings.autoPopulateRelationships === false) {
    return [{
      sourceCollection: 'system',
      sourceId: 0,
      field: 'autoPopulateRelationships',
      targetCollection: 'system',
      addedIds: [],
      action: 'skipped',
    }]
  }

  const actions: RelationshipAction[] = []

  // 1. Itinerary → destinations (direct SQL — avoids full rels rewrite)
  actions.push(
    await mergeItineraryRels(itineraryId, 'destinations', 'destinations_id', destIds, dryRun),
  )

  // 2. Each destination → relatedItineraries (Payload API — simple schema)
  for (const destId of destIds) {
    actions.push(
      await mergeRelationship(
        payload, 'destinations', destId, 'relatedItineraries', [itineraryId], dryRun,
      ),
    )
  }

  // 3. Each property → relatedItineraries (Payload API — simple schema)
  for (const propId of propIds) {
    actions.push(
      await mergeRelationship(
        payload, 'properties', propId, 'relatedItineraries', [itineraryId], dryRun,
      ),
    )
  }

  // 4. Destination → featuredProperties (Payload API — simple schema)
  const destToProps = new Map<number, number[]>()
  for (const [propId, destId] of propToDestMap) {
    const existing = destToProps.get(destId) || []
    existing.push(propId)
    destToProps.set(destId, existing)
  }
  for (const [destId, propIdsForDest] of destToProps) {
    actions.push(
      await mergeRelationship(
        payload, 'destinations', destId, 'featuredProperties', propIdsForDest, dryRun,
      ),
    )
  }

  return actions
}

/**
 * Add relationship rows directly to itineraries_rels via SQL.
 * Avoids payload.update() which triggers a full delete+reinsert of all 159+ rels.
 */
async function mergeItineraryRels(
  itineraryId: number,
  path: string,
  targetColumn: string,
  newIds: number[],
  dryRun: boolean,
): Promise<RelationshipAction> {
  if (newIds.length === 0) {
    return {
      sourceCollection: 'itineraries',
      sourceId: itineraryId,
      field: path,
      targetCollection: inferTarget('itineraries', path),
      addedIds: [],
      action: 'already_current',
    }
  }

  // Read existing IDs for this path
  const existing = await query(
    `SELECT ${targetColumn} FROM itineraries_rels WHERE parent_id = $1 AND path = $2`,
    [itineraryId, path],
  )
  const existingIds = new Set(existing.rows.map((r: Record<string, unknown>) => r[targetColumn] as number))

  const toAdd = newIds.filter((id) => !existingIds.has(id))

  if (toAdd.length === 0) {
    return {
      sourceCollection: 'itineraries',
      sourceId: itineraryId,
      field: path,
      targetCollection: inferTarget('itineraries', path),
      addedIds: [],
      action: 'already_current',
    }
  }

  if (dryRun) {
    return {
      sourceCollection: 'itineraries',
      sourceId: itineraryId,
      field: path,
      targetCollection: inferTarget('itineraries', path),
      addedIds: toAdd,
      action: 'skipped',
    }
  }

  // Get current max order for this path
  const orderResult = await query(
    `SELECT COALESCE(MAX("order"), 0) as max_order FROM itineraries_rels WHERE parent_id = $1 AND path = $2`,
    [itineraryId, path],
  )
  let nextOrder = (orderResult.rows[0]?.max_order as number) + 1

  // Insert new rows one at a time to keep it simple and reliable
  for (const targetId of toAdd) {
    await query(
      `INSERT INTO itineraries_rels ("order", parent_id, path, ${targetColumn}) VALUES ($1, $2, $3, $4)`,
      [nextOrder, itineraryId, path, targetId],
    )
    nextOrder++
  }

  return {
    sourceCollection: 'itineraries',
    sourceId: itineraryId,
    field: path,
    targetCollection: inferTarget('itineraries', path),
    addedIds: toAdd,
    action: 'updated',
  }
}

/**
 * Read current relationship array, merge new IDs, write if changed.
 * Used for destinations and properties (simple schemas with few rels).
 */
async function mergeRelationship(
  payload: Payload,
  collection: string,
  recordId: number,
  field: string,
  newIds: number[],
  dryRun: boolean,
): Promise<RelationshipAction> {
  if (newIds.length === 0) {
    return {
      sourceCollection: collection,
      sourceId: recordId,
      field,
      targetCollection: inferTarget(collection, field),
      addedIds: [],
      action: 'already_current',
    }
  }

  const doc = await payload.findByID({
    collection: collection as 'destinations',
    id: recordId,
    depth: 0,
  })

  const currentRaw = (doc as unknown as Record<string, unknown>)[field]
  const currentIds = extractIds(currentRaw)
  const currentSet = new Set(currentIds)

  const toAdd = newIds.filter((id) => !currentSet.has(id))

  if (toAdd.length === 0) {
    return {
      sourceCollection: collection,
      sourceId: recordId,
      field,
      targetCollection: inferTarget(collection, field),
      addedIds: [],
      action: 'already_current',
    }
  }

  if (dryRun) {
    return {
      sourceCollection: collection,
      sourceId: recordId,
      field,
      targetCollection: inferTarget(collection, field),
      addedIds: toAdd,
      action: 'skipped',
    }
  }

  const merged = [...currentIds, ...toAdd]
  await payload.update({
    collection: collection as 'destinations',
    id: recordId,
    data: { [field]: merged } as Record<string, unknown>,
  })

  return {
    sourceCollection: collection,
    sourceId: recordId,
    field,
    targetCollection: inferTarget(collection, field),
    addedIds: toAdd,
    action: 'updated',
  }
}

function extractIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => extractId(item))
    .filter((id): id is number => id !== null)
}

function inferTarget(collection: string, field: string): string {
  if (field === 'destinations' || field === 'featuredProperties') return 'destinations'
  if (field === 'relatedItineraries') return 'itineraries'
  return collection
}
