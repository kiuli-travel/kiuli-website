import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Payload } from 'payload'
import type { DecomposeOptions, DecompositionResult } from './types'
import { generateCandidates } from '../ideation/candidate-generator'
import { filterCandidates } from '../ideation/candidate-filter'
import { shapeBriefs } from '../ideation/brief-shaper'

export async function decomposeItinerary(
  options: DecomposeOptions,
): Promise<DecompositionResult> {
  const { itineraryId, jobId } = options
  const payload = await getPayload({ config: configPromise })

  const result: DecompositionResult = {
    itineraryId,
    totalCandidates: 0,
    passed: 0,
    filtered: 0,
    projectsCreated: [],
    filteredProjectIds: [],
  }

  try {
    // Fetch itinerary with depth 2 for full data
    const itinerary = await payload.findByID({
      collection: 'itineraries',
      id: itineraryId,
      depth: 2,
    })

    if (!itinerary) {
      throw new Error(`Itinerary ${itineraryId} not found`)
    }

    // Step 1: Generate candidates
    await updateJobProgress(payload, jobId, {
      currentStep: 1,
      totalSteps: 3,
      stepName: 'Generating candidates',
    })

    const rawCandidates = await generateCandidates({
      itinerary: itinerary as unknown as Record<string, unknown>,
      payload,
    })

    result.totalCandidates = rawCandidates.length

    await updateJobProgress(payload, jobId, {
      currentStep: 1,
      totalSteps: 3,
      stepName: 'Generating candidates',
      step_1_complete: true,
      candidates_generated: rawCandidates.length,
    })

    // Step 2: Filter candidates
    await updateJobProgress(payload, jobId, {
      currentStep: 2,
      totalSteps: 3,
      stepName: 'Filtering candidates',
      step_1_complete: true,
      candidates_generated: rawCandidates.length,
    })

    const filteredCandidates = await filterCandidates({
      candidates: rawCandidates,
      payload,
    })

    const passedCount = filteredCandidates.filter((c) => c.passed).length
    const filteredCount = filteredCandidates.filter((c) => !c.passed).length

    await updateJobProgress(payload, jobId, {
      currentStep: 2,
      totalSteps: 3,
      stepName: 'Filtering candidates',
      step_1_complete: true,
      candidates_generated: rawCandidates.length,
      step_2_complete: true,
      candidates_passed: passedCount,
      candidates_filtered: filteredCount,
    })

    // Step 3: Shape briefs
    await updateJobProgress(payload, jobId, {
      currentStep: 3,
      totalSteps: 3,
      stepName: 'Creating content projects',
      step_1_complete: true,
      candidates_generated: rawCandidates.length,
      step_2_complete: true,
      candidates_passed: passedCount,
      candidates_filtered: filteredCount,
    })

    const { passedIds, filteredIds } = await shapeBriefs({
      candidates: filteredCandidates,
      itineraryId,
      payload,
    })

    result.passed = passedIds.length
    result.filtered = filteredIds.length
    result.projectsCreated = passedIds
    result.filteredProjectIds = filteredIds

    await updateJobProgress(payload, jobId, {
      currentStep: 3,
      totalSteps: 3,
      stepName: 'Creating content projects',
      step_1_complete: true,
      candidates_generated: rawCandidates.length,
      step_2_complete: true,
      candidates_passed: passedCount,
      candidates_filtered: filteredCount,
      step_3_complete: true,
      projects_created: passedIds.length,
      filtered_projects_created: filteredIds.length,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[decompose] Failed for itinerary ${itineraryId}:`, errorMessage)

    if (jobId) {
      try {
        await payload.update({
          collection: 'content-jobs',
          id: jobId,
          data: {
            status: 'failed',
            error: errorMessage,
            completedAt: new Date().toISOString(),
          },
        })
      } catch {
        // ignore
      }
    }

    throw err
  }

  return result
}

async function updateJobProgress(
  payload: Payload,
  jobId: number | undefined,
  progress: Record<string, unknown>,
): Promise<void> {
  if (!jobId) return
  try {
    await payload.update({
      collection: 'content-jobs',
      id: jobId,
      data: { progress },
    })
  } catch {
    // Non-critical — don't fail the pipeline
  }
}
