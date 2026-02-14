import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Payload } from 'payload'
import type {
  CascadeOptions,
  CascadeResult,
  CascadeStepResult,
  EntityMap,
  ResolutionResult,
  RelationshipAction,
  ContentProjectAction,
} from './types'
import { normalize } from './utils'
import { extractEntities } from './entity-extractor'
import { resolveDestinations } from './destination-resolver'
import { resolveProperties } from './property-resolver'
import { manageRelationships } from './relationship-manager'

/**
 * Run the 5-step Itinerary Cascade pipeline.
 *
 * 1. Entity Extraction
 * 2. Destination Resolution
 * 3. Property Resolution
 * 4. Relationship Management
 * 5. ContentProject Generation
 */
export async function runCascade(options: CascadeOptions): Promise<CascadeResult> {
  const { itineraryId, dryRun = false, jobId } = options
  const payload = await getPayload({ config: configPromise })

  const result: CascadeResult = {
    itineraryId,
    dryRun,
    steps: [],
    entities: null,
    resolutions: [],
    relationships: [],
    contentProjects: [],
  }

  let entities: EntityMap | null = null
  let destResults: ResolutionResult[] = []
  let propResults: ResolutionResult[] = []
  let relActions: RelationshipAction[] = []

  try {
    // --- Step 1: Entity Extraction ---
    const step1 = await runStep(1, 'Entity Extraction', async () => {
      entities = await extractEntities(payload, itineraryId)
      return entities
    })
    result.steps.push(step1)
    result.entities = entities
    await updateJobProgress(payload, jobId, 1, step1)
    if (step1.status === 'failed') throw new Error('Entity extraction failed')

    // --- Step 2: Destination Resolution ---
    const step2 = await runStep(2, 'Destination Resolution', async () => {
      destResults = await resolveDestinations(
        payload,
        entities!.countries,
        entities!.locations,
        dryRun,
      )
      return destResults
    })
    result.steps.push(step2)
    result.resolutions.push(...destResults)
    await updateJobProgress(payload, jobId, 2, step2)
    if (step2.status === 'failed') throw new Error('Destination resolution failed')

    // --- Step 3: Property Resolution ---
    const step3 = await runStep(3, 'Property Resolution', async () => {
      propResults = await resolveProperties(
        payload,
        entities!.properties,
        destResults,
        entities!.countries,
        dryRun,
      )
      return propResults
    })
    result.steps.push(step3)
    result.resolutions.push(...propResults)
    await updateJobProgress(payload, jobId, 3, step3)
    if (step3.status === 'failed') throw new Error('Property resolution failed')

    // --- Step 4: Relationship Management ---
    const step4 = await runStep(4, 'Relationship Management', async () => {
      const allDestIds = destResults
        .filter((r) => r.payloadId !== null)
        .map((r) => r.payloadId!)
      const allPropIds = propResults
        .filter((r) => r.payloadId !== null)
        .map((r) => r.payloadId!)

      // Build property → destination map for featuredProperties
      const propToDestMap = buildPropToDestMap(
        entities!,
        propResults,
        destResults,
      )

      relActions = await manageRelationships(
        payload,
        itineraryId,
        allDestIds,
        allPropIds,
        propToDestMap,
        dryRun,
      )
      return relActions
    })
    result.steps.push(step4)
    result.relationships = relActions
    await updateJobProgress(payload, jobId, 4, step4)
    if (step4.status === 'failed') throw new Error('Relationship management failed')

    // --- Step 5: ContentProject Generation ---
    const step5 = await runStep(5, 'ContentProject Generation', async () => {
      const cpActions = await generateContentProjects(
        payload,
        destResults,
        propResults,
        dryRun,
      )
      return cpActions
    })
    result.steps.push(step5)
    result.contentProjects = (step5.detail as ContentProjectAction[]) || []
    await updateJobProgress(payload, jobId, 5, step5)

    // Fire-and-forget: trigger ideation decompose after successful cascade
    if (!dryRun && !result.error) {
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
      const secret = process.env.CONTENT_SYSTEM_SECRET
      if (secret) {
        fetch(`${baseUrl}/api/content/decompose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({ itineraryId }),
        }).catch((err) =>
          console.error('[cascade] Failed to trigger decompose:', err.message),
        )
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    // Update job to failed
    if (jobId) {
      try {
        await payload.update({
          collection: 'content-jobs',
          id: jobId,
          data: {
            status: 'failed',
            error: result.error,
            completedAt: new Date().toISOString(),
          },
        })
      } catch {
        // ignore
      }
    }
  }

  return result
}

/** Run a single step with timing and error capture. */
async function runStep(
  step: number,
  name: string,
  fn: () => Promise<unknown>,
): Promise<CascadeStepResult> {
  const start = Date.now()
  try {
    const detail = await fn()
    return { step, name, status: 'completed', duration: Date.now() - start, detail }
  } catch (err) {
    return {
      step,
      name,
      status: 'failed',
      duration: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Update ContentJob progress JSON after each step. */
async function updateJobProgress(
  payload: Payload,
  jobId: number | undefined,
  step: number,
  stepResult: CascadeStepResult,
): Promise<void> {
  if (!jobId) return
  try {
    const job = await payload.findByID({
      collection: 'content-jobs',
      id: jobId,
      depth: 0,
    })
    const progress = ((job as unknown as Record<string, unknown>).progress as Record<string, unknown>) || {}
    progress[`step${step}`] = {
      name: stepResult.name,
      status: stepResult.status,
      duration: stepResult.duration,
    }
    progress.currentStep = step
    progress.totalSteps = 5

    await payload.update({
      collection: 'content-jobs',
      id: jobId,
      data: { progress },
    })
  } catch {
    // Non-critical — don't fail the cascade
  }
}

/**
 * Build a map of propertyId → destinationId by matching property entities
 * to resolved destinations via location name, falling back to country.
 */
function buildPropToDestMap(
  entities: EntityMap,
  propResults: ResolutionResult[],
  destResults: ResolutionResult[],
): Map<number, number> {
  const map = new Map<number, number>()

  // Build lookup: normalized location name → dest ID
  const destIdByName = new Map<string, number>()
  for (const r of destResults) {
    if (r.payloadId) {
      destIdByName.set(normalize(r.entityName), r.payloadId)
    }
  }

  for (let i = 0; i < entities.properties.length; i++) {
    const propEntity = entities.properties[i]
    const propResult = propResults[i]
    if (!propResult?.payloadId) continue

    const destId =
      destIdByName.get(normalize(propEntity.location)) ??
      destIdByName.get(normalize(propEntity.country)) ??
      null

    if (destId) {
      map.set(propResult.payloadId, destId)
    }
  }

  return map
}

/**
 * Step 5: For each resolved destination/property, check if a ContentProject
 * already exists. If not, create one at stage='idea', originPathway='cascade'.
 */
async function generateContentProjects(
  payload: Payload,
  destResults: ResolutionResult[],
  propResults: ResolutionResult[],
  dryRun: boolean,
): Promise<ContentProjectAction[]> {
  const actions: ContentProjectAction[] = []

  // Destinations → destination_page ContentProjects
  for (const r of destResults) {
    if (!r.payloadId || r.entityType === 'country') continue
    const action = await ensureContentProject(
      payload,
      'destinations',
      r.payloadId,
      r.entityName,
      'destination_page',
      dryRun,
    )
    actions.push(action)
  }

  // Properties → property_page ContentProjects
  for (const r of propResults) {
    if (!r.payloadId) continue
    const action = await ensureContentProject(
      payload,
      'properties',
      r.payloadId,
      r.entityName,
      'property_page',
      dryRun,
    )
    actions.push(action)
  }

  return actions
}

async function ensureContentProject(
  payload: Payload,
  targetCollection: string,
  targetRecordId: number,
  entityName: string,
  contentType: string,
  dryRun: boolean,
): Promise<ContentProjectAction> {
  // Check if one already exists
  const existing = await payload.find({
    collection: 'content-projects',
    where: {
      and: [
        { targetCollection: { equals: targetCollection } },
        { targetRecordId: { equals: String(targetRecordId) } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    return {
      targetCollection,
      targetRecordId,
      action: 'already_exists',
      contentProjectId: (existing.docs[0] as unknown as { id: number }).id,
    }
  }

  if (dryRun) {
    return {
      targetCollection,
      targetRecordId,
      action: 'already_exists', // Treat as no-op in dry run reporting
    }
  }

  const created = await payload.create({
    collection: 'content-projects',
    data: {
      title: entityName,
      slug: entityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      stage: 'idea',
      contentType: contentType as 'destination_page' | 'property_page',
      originPathway: 'cascade' as const,
      targetCollection: targetCollection as 'destinations' | 'properties',
      targetRecordId: String(targetRecordId),
    },
  })

  return {
    targetCollection,
    targetRecordId,
    action: 'created',
    contentProjectId: (created as unknown as { id: number }).id,
  }
}
