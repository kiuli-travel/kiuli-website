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
import { linkStayProperties } from './stay-property-linker'
import { searchLibrary } from '../images/library-search'
import { dispatchDraft } from '../drafting'
import { compileResearch } from '../research/research-compiler'

/**
 * Run the 6-step Itinerary Cascade pipeline.
 *
 * 1.   Entity Extraction
 * 2.   Destination Resolution
 * 3.   Property Resolution
 * 4.   Relationship Management
 * 4.5  Stay Property Linking (back-patches stay blocks with resolved property IDs)
 * 5.   ContentProject Generation
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

    // --- Step 4.5: Stay Block Property Linking ---
    // Back-patch stay blocks with resolved property IDs (cold-start fix)
    const step4b = await runStep(4.5, 'Stay Property Linking', async () => {
      const linkResult = await linkStayProperties(
        payload,
        itineraryId,
        propResults,
        dryRun,
      )
      return linkResult
    })
    result.steps.push(step4b)
    // Non-fatal: if linking fails, cascade can still continue
    if (step4b.status === 'failed') {
      console.warn('[cascade] Stay property linking failed, continuing with remaining steps')
    }

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

    // Fire-and-forget: trigger post-cascade processing (steps 6-8) + decompose
    if (!dryRun && !result.error) {
      // Fire off async work without blocking the response
      triggerPostCascadeProcessing(
        itineraryId,
        destResults.filter((r) => r.payloadId),
        propResults.filter((r) => r.payloadId),
        result.contentProjects,
      ).catch((err) =>
        console.error('[cascade] Post-cascade processing failed:', err.message),
      )

      // Also trigger ideation decompose
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

// ── Post-Cascade Processing (Steps 6–8) ──────────────────────────────────────

/**
 * Fire-and-forget: Run steps 6-8 asynchronously after cascade completes.
 * These steps run in the background and log errors without failing the cascade.
 */
async function triggerPostCascadeProcessing(
  itineraryId: number,
  destResults: ResolutionResult[],
  propResults: ResolutionResult[],
  contentProjects: ContentProjectAction[],
): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // --- Step 6: Hero Image Assignment ---
  try {
    await assignHeroImages(payload, destResults, propResults)
  } catch (err) {
    console.error(
      '[cascade-step-6] Hero image assignment failed:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // --- Step 7: Auto-trigger Research + Drafting ---
  const projectPromises: Promise<void>[] = []
  for (const project of contentProjects) {
    if (project.action === 'created') {
      projectPromises.push(
        triggerResearchAndDrafting(payload, project, itineraryId).catch((err) =>
          console.error(
            `[cascade-step-7] Research/drafting for project ${project.contentProjectId} failed:`,
            err instanceof Error ? err.message : String(err),
          ),
        ),
      )
    }
  }

  // Wait for all research/drafting calls to complete (with timeout)
  if (projectPromises.length > 0) {
    try {
      await Promise.race([
        Promise.all(projectPromises),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Research/drafting timeout')),
            90000, // 90 second timeout (step 7 can take 30-60s per project)
          ),
        ),
      ])
    } catch (err) {
      console.error(
        '[cascade-step-7] Research/drafting timed out or errored:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // --- Step 8: Auto-publish destination_page and property_page ---
  try {
    await autoPublishPages(payload, destResults, propResults)
  } catch (err) {
    console.error(
      '[cascade-step-8] Auto-publish failed:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Step 6: Hero Image Assignment
 * For each destination/property that has no heroImage, search the media library
 * and assign the best match.
 */
async function assignHeroImages(
  payload: Payload,
  destResults: ResolutionResult[],
  propResults: ResolutionResult[],
): Promise<void> {
  // Process destinations
  for (const r of destResults) {
    if (!r.payloadId || r.entityType === 'country') continue

    try {
      const dest = (await payload.findByID({
        collection: 'destinations',
        id: r.payloadId,
        depth: 0,
      })) as unknown as Record<string, unknown>

      // Skip if already has a hero image
      if (dest.heroImage) {
        console.log(`[cascade-step-6] Destination ${r.entityName} already has heroImage`)
        continue
      }

      // Search for hero image
      const searchResult = await searchLibrary({
        query: r.entityName,
        country: extractCountry(r.entityName),
        composition: 'landscape',
        isHero: true,
        limit: 5,
      })

      if (searchResult.matches.length > 0) {
        const best = searchResult.matches[0]
        await payload.update({
          collection: 'destinations',
          id: r.payloadId,
          data: { heroImage: best.mediaId },
        })
        console.log(
          `[cascade-step-6] Assigned heroImage ${best.mediaId} to destination ${r.entityName}`,
        )
      } else {
        console.warn(
          `[cascade-step-6] No hero image found for destination ${r.entityName}`,
        )
      }
    } catch (err) {
      console.error(
        `[cascade-step-6] Failed to assign hero image for destination ${r.entityName}:`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // Process properties
  for (const r of propResults) {
    if (!r.payloadId) continue

    try {
      const prop = (await payload.findByID({
        collection: 'properties',
        id: r.payloadId,
        depth: 0,
      })) as unknown as Record<string, unknown>

      // Skip if already has a hero image
      if (prop.heroImage) {
        console.log(`[cascade-step-6] Property ${r.entityName} already has heroImage`)
        continue
      }

      // Search for hero image (property-specific images preferred)
      const searchResult = await searchLibrary({
        query: r.entityName,
        imageType: 'accommodation',
        composition: 'landscape',
        isHero: true,
        limit: 5,
      })

      let bestMatch = searchResult.matches[0]

      // Fallback: if no accommodation images, search for any landscape
      if (!bestMatch) {
        const fallback = await searchLibrary({
          query: r.entityName,
          composition: 'landscape',
          isHero: true,
          limit: 5,
        })
        bestMatch = fallback.matches[0]
      }

      if (bestMatch) {
        await payload.update({
          collection: 'properties',
          id: r.payloadId,
          data: { heroImage: bestMatch.mediaId },
        })
        console.log(
          `[cascade-step-6] Assigned heroImage ${bestMatch.mediaId} to property ${r.entityName}`,
        )
      } else {
        console.warn(
          `[cascade-step-6] No hero image found for property ${r.entityName}`,
        )
      }
    } catch (err) {
      console.error(
        `[cascade-step-6] Failed to assign hero image for property ${r.entityName}:`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

/**
 * Step 7: Auto-trigger Research + Drafting
 * For destination_page and property_page projects:
 *   - Advance from 'idea' → 'draft' (destination/property pages skip research)
 *   - Call the drafting pipeline
 * For article projects created by decompose:
 *   - Advance from 'idea' → 'research'
 *   - Call research, then advance to 'draft', then call drafting
 */
async function triggerResearchAndDrafting(
  payload: Payload,
  project: ContentProjectAction,
  itineraryId: number,
): Promise<void> {
  if (!project.contentProjectId) return

  try {
    const contentProj = (await payload.findByID({
      collection: 'content-projects',
      id: project.contentProjectId,
      depth: 0,
    })) as unknown as Record<string, unknown>

    const contentType = contentProj.contentType as string
    const stage = contentProj.stage as string

    // Skip if not in 'idea' stage (may have been processed already)
    if (stage !== 'idea') {
      console.log(`[cascade-step-7] Project ${project.contentProjectId} already in stage ${stage}`)
      return
    }

    if (contentType === 'destination_page' || contentType === 'property_page') {
      // These pages skip research and go straight to draft
      await payload.update({
        collection: 'content-projects',
        id: project.contentProjectId,
        data: { stage: 'draft' },
      })

      // Call the drafting pipeline
      await dispatchDraft(project.contentProjectId)

      console.log(
        `[cascade-step-7] Drafted ${contentType} project ${project.contentProjectId}`,
      )
    } else if (['itinerary_cluster', 'authority', 'designer_insight'].includes(contentType)) {
      // Articles go through research first
      await payload.update({
        collection: 'content-projects',
        id: project.contentProjectId,
        data: { stage: 'research' },
      })

      // Call research pipeline
      const topic = (contentProj.title as string) || 'safari'
      const destinations = Array.isArray(contentProj.destinations)
        ? contentProj.destinations.join(', ')
        : ''

      try {
        const research = await compileResearch({
          projectId: String(project.contentProjectId),
          query: {
            topic,
            angle: (contentProj.targetAngle as string) || 'luxury safari',
            destinations: destinations ? destinations.split(',').map((d: string) => d.trim()) : [],
            contentType: contentType as 'itinerary_cluster' | 'authority' | 'designer_insight',
          },
          includeExistingContent: true,
        })

        // Update project with research results
        await payload.update({
          collection: 'content-projects',
          id: project.contentProjectId,
          data: {
            synthesis: research.synthesis
              ? { root: { type: 'root', children: [{ type: 'text', text: research.synthesis }] } }
              : null,
            sources: research.sources,
            uncertaintyMap: research.uncertaintyMap,
            stage: 'draft',
          },
        })

        // Call drafting pipeline
        await dispatchDraft(project.contentProjectId)

        console.log(
          `[cascade-step-7] Researched and drafted ${contentType} project ${project.contentProjectId}`,
        )
      } catch (err) {
        console.error(
          `[cascade-step-7] Research failed for project ${project.contentProjectId}:`,
          err instanceof Error ? err.message : String(err),
        )
        // Still attempt drafting even if research failed
        try {
          await payload.update({
            collection: 'content-projects',
            id: project.contentProjectId,
            data: { stage: 'draft' },
          })
          await dispatchDraft(project.contentProjectId)
        } catch {
          // ignore fallback error
        }
      }
    } else {
      console.warn(
        `[cascade-step-7] No auto-pipeline for contentType: ${contentType}`,
      )
    }
  } catch (err) {
    console.error(
      `[cascade-step-7] Failed to process project ${project.contentProjectId}:`,
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Step 8: Auto-publish destination_page and property_page
 * After drafting completes, change _status from draft to published.
 */
async function autoPublishPages(
  payload: Payload,
  destResults: ResolutionResult[],
  propResults: ResolutionResult[],
): Promise<void> {
  // Publish destinations
  for (const r of destResults) {
    if (!r.payloadId || r.entityType === 'country' || r.action !== 'created') continue

    try {
      await payload.update({
        collection: 'destinations',
        id: r.payloadId,
        data: { _status: 'published' },
      })
      console.log(`[cascade-step-8] Published destination ${r.entityName}`)
    } catch (err) {
      console.error(
        `[cascade-step-8] Failed to publish destination ${r.entityName}:`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // Publish properties
  for (const r of propResults) {
    if (!r.payloadId || r.action !== 'created') continue

    try {
      await payload.update({
        collection: 'properties',
        id: r.payloadId,
        data: { _status: 'published' },
      })
      console.log(`[cascade-step-8] Published property ${r.entityName}`)
    } catch (err) {
      console.error(
        `[cascade-step-8] Failed to publish property ${r.entityName}:`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

/**
 * Extract country name from entity name (simple heuristic).
 * Used for media library search filtering.
 */
function extractCountry(entityName: string): string | undefined {
  // Common African countries in safari context
  const countries = [
    'Kenya',
    'Tanzania',
    'Uganda',
    'Rwanda',
    'Botswana',
    'Namibia',
    'South Africa',
    'Zimbabwe',
    'Zambia',
    'Malawi',
    'Ethiopia',
    'Somalia',
  ]
  for (const country of countries) {
    if (entityName.toLowerCase().includes(country.toLowerCase())) {
      return country
    }
  }
  return undefined
}
