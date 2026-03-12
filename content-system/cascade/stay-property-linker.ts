/**
 * Back-patch stay block property IDs after property resolution.
 *
 * On cold start, the orchestrator Lambda cannot link properties because they
 * don't exist yet. The cascade creates them in Step 3, but the itinerary's
 * stay blocks still have property=null. This function patches them.
 *
 * Uses payload.update() with draft:true and overrideAccess:true to avoid
 * triggering validation or relationship rewrites.
 */

import type { Payload } from 'payload'
import type { ResolutionResult } from './types'
import { normalize } from './utils'

interface StayPatchResult {
  staysPatched: number
  staysAlreadyLinked: number
  staysUnmatched: string[]
}

interface DayBlock {
  id: string
  dayNumber?: number
  segments?: SegmentBlock[]
  [key: string]: unknown
}

interface SegmentBlock {
  id: string
  blockType: string
  accommodationName?: string
  accommodationNameItrvl?: string
  property?: number | { id: number } | null
  [key: string]: unknown
}

export async function linkStayProperties(
  payload: Payload,
  itineraryId: number,
  propResults: ResolutionResult[],
  dryRun: boolean,
): Promise<StayPatchResult> {
  // Build name → payloadId map from resolved properties
  const nameToId = new Map<string, number>()
  for (const r of propResults) {
    if (r.payloadId !== null && r.action !== 'skipped') {
      nameToId.set(normalize(r.entityName), r.payloadId)
    }
  }

  if (nameToId.size === 0) {
    return { staysPatched: 0, staysAlreadyLinked: 0, staysUnmatched: [] }
  }

  // Read itinerary with depth=0 (no relationship expansion)
  const itinerary = await payload.findByID({
    collection: 'itineraries',
    id: itineraryId,
    depth: 0,
  }) as unknown as { days?: DayBlock[] }

  const days = itinerary.days
  if (!days || days.length === 0) {
    return { staysPatched: 0, staysAlreadyLinked: 0, staysUnmatched: [] }
  }

  let patched = 0
  let alreadyLinked = 0
  const unmatched: string[] = []
  let needsUpdate = false

  for (const day of days) {
    if (!day.segments) continue
    for (const seg of day.segments) {
      if (seg.blockType !== 'stay') continue

      // Check if already linked
      if (seg.property !== null && seg.property !== undefined) {
        alreadyLinked++
        continue
      }

      const name = (seg.accommodationNameItrvl || seg.accommodationName || '').trim()
      if (!name) continue

      const propertyId = nameToId.get(normalize(name))
      if (propertyId) {
        seg.property = propertyId
        patched++
        needsUpdate = true
      } else {
        unmatched.push(name)
      }
    }
  }

  if (needsUpdate && !dryRun) {
    await payload.update({
      collection: 'itineraries',
      id: itineraryId,
      draft: true,
      data: { days } as Record<string, unknown>,
    })
    console.log(
      `[stay-linker] Patched ${patched} stay blocks with property IDs on itinerary ${itineraryId}`,
    )
  } else if (dryRun && patched > 0) {
    console.log(
      `[stay-linker] Would patch ${patched} stay blocks (dry run) on itinerary ${itineraryId}`,
    )
  }

  return { staysPatched: patched, staysAlreadyLinked: alreadyLinked, staysUnmatched: unmatched }
}
