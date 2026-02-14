import type { Payload } from 'payload'
import type { RelationshipAction } from './types'
import { extractId } from './utils'

interface ContentSystemSettings {
  autoPopulateRelationships?: boolean
}

/**
 * Manage bidirectional relationships between itinerary, destinations, and properties.
 * Always reads before writing; merges arrays, never replaces.
 *
 * propToDestMap: propertyId → destinationId (for featuredProperties grouping)
 */
export async function manageRelationships(
  payload: Payload,
  itineraryId: number,
  destIds: number[],
  propIds: number[],
  propToDestMap: Map<number, number>,
  dryRun: boolean,
): Promise<RelationshipAction[]> {
  // Check feature flag
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

  // 1. Itinerary → destinations (additive merge)
  actions.push(
    await mergeRelationship(
      payload, 'itineraries', itineraryId, 'destinations', destIds, dryRun,
    ),
  )

  // 2. Each destination → relatedItineraries (bidirectional)
  for (const destId of destIds) {
    actions.push(
      await mergeRelationship(
        payload, 'destinations', destId, 'relatedItineraries', [itineraryId], dryRun,
      ),
    )
  }

  // 3. Each property → relatedItineraries (bidirectional)
  for (const propId of propIds) {
    actions.push(
      await mergeRelationship(
        payload, 'properties', propId, 'relatedItineraries', [itineraryId], dryRun,
      ),
    )
  }

  // 4. Destination → featuredProperties (group by destination, additive merge)
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
 * Read current relationship array, merge new IDs, write if changed.
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

  // Read current value
  const doc = await payload.findByID({
    collection: collection as 'itineraries',
    id: recordId,
    depth: 0,
  })

  const currentRaw = (doc as unknown as Record<string, unknown>)[field]
  const currentIds = extractIds(currentRaw)
  const currentSet = new Set(currentIds)

  // Determine which IDs to add
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

  // Merge and write
  const merged = [...currentIds, ...toAdd]
  await payload.update({
    collection: collection as 'itineraries',
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

/** Extract numeric IDs from a Payload hasMany relationship value. */
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
