import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult, OptimisticLockError } from './types'

const SECTION_TO_FIELD: Record<string, string> = {
  overview: 'description',
  when_to_visit: 'bestTimeToVisit',
  why_choose: 'whyChoose',
  key_experiences: 'keyExperiences',
  getting_there: 'gettingThere',
  health_safety: 'healthSafety',
  investment_expectation: 'investmentExpectation',
  top_lodges: 'topLodgesContent',
}

export async function publishDestinationPage(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'destination_page') {
    throw new Error(`Destination publisher received type: ${project.contentType}`)
  }

  const sections = project.sections as Record<string, string> | null
  if (!sections || Object.keys(sections).length === 0) {
    throw new Error('Cannot publish: sections is empty')
  }

  // Resolve destination
  const destinations = Array.isArray(project.destinations)
    ? (project.destinations as string[])
    : []
  if (destinations.length === 0) {
    throw new Error('Cannot publish: no destination name on content project')
  }

  const destResult = await payload.find({
    collection: 'destinations',
    where: { name: { equals: destinations[0] } },
    limit: 1,
    depth: 0,
  })

  if (destResult.docs.length === 0) {
    throw new Error(`Cannot publish: destination "${destinations[0]}" not found in destinations collection`)
  }

  const destination = destResult.docs[0] as unknown as Record<string, unknown>
  const destinationId = destination.id as number
  const baselineUpdatedAt = destination.updatedAt as string

  // Build update payload: convert each section text → Lexical
  const updateData: Record<string, unknown> = {}

  for (const [sectionKey, text] of Object.entries(sections)) {
    const field = SECTION_TO_FIELD[sectionKey]
    if (field && text && text.trim().length > 0) {
      updateData[field] = textToLexical(text)
    }
  }

  // Meta fields
  if (project.metaTitle) updateData.metaTitle = project.metaTitle
  if (project.metaDescription) updateData.metaDescription = project.metaDescription
  if (project.answerCapsule) updateData.answerCapsule = project.answerCapsule

  // FAQ items
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  if (rawFaq.length > 0) {
    updateData.faqItems = rawFaq
      .filter((f) => f.question && f.answer)
      .map((f) => ({
        question: String(f.question),
        answer: textToLexical(String(f.answer)),
      }))
  }

  // Optimistic lock: re-read before write
  const freshDest = await payload.findByID({
    collection: 'destinations',
    id: destinationId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshDest.updatedAt as string) !== baselineUpdatedAt) {
    // Conflict — retry once with fresh baseline
    console.warn(`[destination-publisher] Optimistic lock conflict on destination ${destinationId}, retrying`)
    const retryDest = await payload.findByID({
      collection: 'destinations',
      id: destinationId,
      depth: 0,
    }) as unknown as Record<string, unknown>
    const retryUpdatedAt = retryDest.updatedAt as string

    // Second attempt
    await payload.update({ collection: 'destinations', id: destinationId, data: updateData })

    const afterUpdate = await payload.findByID({
      collection: 'destinations',
      id: destinationId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((afterUpdate.updatedAt as string) === retryUpdatedAt) {
      const lockError: OptimisticLockError = {
        targetCollection: 'destinations',
        targetId: destinationId,
        expectedUpdatedAt: retryUpdatedAt,
        actualUpdatedAt: afterUpdate.updatedAt as string,
      }
      throw new Error(`Optimistic lock failed after retry: ${JSON.stringify(lockError)}`)
    }
  } else {
    // No conflict — write
    await payload.update({ collection: 'destinations', id: destinationId, data: updateData })
  }

  const now = new Date().toISOString()
  console.log(`[destination-publisher] Updated destination ${destinationId} for project ${projectId}`)

  return {
    success: true,
    targetCollection: 'destinations',
    targetId: destinationId,
    publishedAt: now,
  }
}
