import type { Payload } from 'payload'
import type { FilteredCandidate } from './types'
import type { ContentChunk } from '../embeddings/types'
import { embedChunks } from '../embeddings/embedder'
import { slugify } from '../cascade/utils'

interface ShapeBriefsOptions {
  candidates: FilteredCandidate[]
  itineraryId: number
  payload: Payload
}

interface ShapeBriefsResult {
  passedIds: number[]
  filteredIds: number[]
}

export async function shapeBriefs(options: ShapeBriefsOptions): Promise<ShapeBriefsResult> {
  const { candidates, itineraryId, payload } = options
  const passedIds: number[] = []
  const filteredIds: number[] = []

  for (const candidate of candidates) {
    // Idempotency: check if ContentProject with same title AND originItinerary already exists
    try {
      const existing = await payload.find({
        collection: 'content-projects',
        where: {
          and: [
            { title: { equals: candidate.title } },
            { originItinerary: { equals: itineraryId } },
          ],
        },
        limit: 1,
        depth: 0,
      })

      if (existing.docs.length > 0) {
        const existingId = (existing.docs[0] as unknown as { id: number }).id
        if (candidate.passed) {
          passedIds.push(existingId)
        } else {
          filteredIds.push(existingId)
        }
        continue
      }
    } catch (err) {
      console.warn('[brief-shaper] Idempotency check failed:', err)
    }

    const slug = slugify(candidate.title)

    if (candidate.passed) {
      const id = await createPassedProject(payload, candidate, itineraryId, slug)
      if (id) {
        passedIds.push(id)
        // Embed the brief immediately so subsequent runs detect semantic duplicates
        await embedBrief(id, candidate).catch((err) => {
          console.warn('[brief-shaper] Failed to embed brief for project', id, ':', err)
        })
      }
    } else {
      const id = await createFilteredProject(payload, candidate, itineraryId, slug)
      if (id) filteredIds.push(id)
    }
  }

  return { passedIds, filteredIds }
}

async function embedBrief(projectId: number, candidate: FilteredCandidate): Promise<void> {
  const chunkText = [
    candidate.title,
    candidate.briefSummary,
    candidate.targetAngle,
    candidate.destinations.length > 0 ? `Destinations: ${candidate.destinations.join(', ')}` : '',
    candidate.properties.length > 0 ? `Properties: ${candidate.properties.join(', ')}` : '',
    candidate.species.length > 0 ? `Species: ${candidate.species.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const chunk: ContentChunk = {
    id: `brief-${projectId}`,
    sourceCollection: 'content-projects',
    sourceId: String(projectId),
    sourceField: 'brief',
    chunkType: 'article_section',
    text: chunkText,
    metadata: {
      title: candidate.title,
      contentType: candidate.contentType,
      destinations: candidate.destinations,
      properties: candidate.properties,
      species: candidate.species,
      freshnessCategory: candidate.freshnessCategory,
      wordCount: chunkText.split(/\s+/).length,
    },
  }

  await embedChunks({ chunks: [chunk] })
  console.log(`[brief-shaper] Embedded brief for project ${projectId}: "${candidate.title}"`)
}

async function createPassedProject(
  payload: Payload,
  candidate: FilteredCandidate,
  itineraryId: number,
  slug: string,
): Promise<number | null> {
  try {
    const created = await payload.create({
      collection: 'content-projects',
      data: {
        title: candidate.title,
        slug,
        stage: 'brief',
        contentType: candidate.contentType,
        originPathway: 'itinerary',
        originItinerary: itineraryId,
        targetCollection: 'posts',
        briefSummary: candidate.briefSummary,
        targetAngle: candidate.targetAngle,
        targetAudience: candidate.targetAudience,
        competitiveNotes: candidate.competitiveNotes,
        destinations: candidate.destinations,
        properties: candidate.properties,
        species: candidate.species,
        freshnessCategory: candidate.freshnessCategory,
      },
    })
    return (created as unknown as { id: number }).id
  } catch (err) {
    // Handle slug uniqueness conflict — append -2 suffix
    if (String(err).includes('unique') || String(err).includes('duplicate')) {
      try {
        const created = await payload.create({
          collection: 'content-projects',
          data: {
            title: candidate.title,
            slug: `${slug}-2`,
            stage: 'brief',
            contentType: candidate.contentType,
            originPathway: 'itinerary',
            originItinerary: itineraryId,
            targetCollection: 'posts',
            briefSummary: candidate.briefSummary,
            targetAngle: candidate.targetAngle,
            targetAudience: candidate.targetAudience,
            competitiveNotes: candidate.competitiveNotes,
            destinations: candidate.destinations,
            properties: candidate.properties,
            species: candidate.species,
            freshnessCategory: candidate.freshnessCategory,
          },
        })
        return (created as unknown as { id: number }).id
      } catch (retryErr) {
        console.error('[brief-shaper] Failed to create passed project (retry):', candidate.title, retryErr)
        return null
      }
    }
    console.error('[brief-shaper] Failed to create passed project:', candidate.title, err)
    return null
  }
}

async function createFilteredProject(
  payload: Payload,
  candidate: FilteredCandidate,
  itineraryId: number,
  slug: string,
): Promise<number | null> {
  try {
    const created = await payload.create({
      collection: 'content-projects',
      data: {
        title: candidate.title,
        slug,
        stage: 'filtered',
        contentType: candidate.contentType,
        originPathway: 'itinerary',
        originItinerary: itineraryId,
        targetCollection: 'posts',
        briefSummary: candidate.briefSummary,
        filterReason: candidate.filterReason,
        destinations: candidate.destinations,
        properties: candidate.properties,
        species: candidate.species,
      },
    })
    return (created as unknown as { id: number }).id
  } catch (err) {
    // Handle slug uniqueness conflict
    if (String(err).includes('unique') || String(err).includes('duplicate')) {
      try {
        const created = await payload.create({
          collection: 'content-projects',
          data: {
            title: candidate.title,
            slug: `${slug}-2`,
            stage: 'filtered',
            contentType: candidate.contentType,
            originPathway: 'itinerary',
            originItinerary: itineraryId,
            targetCollection: 'posts',
            briefSummary: candidate.briefSummary,
            filterReason: candidate.filterReason,
            destinations: candidate.destinations,
            properties: candidate.properties,
            species: candidate.species,
          },
        })
        return (created as unknown as { id: number }).id
      } catch (retryErr) {
        console.error('[brief-shaper] Failed to create filtered project (retry):', candidate.title, retryErr)
        return null
      }
    }
    console.error('[brief-shaper] Failed to create filtered project:', candidate.title, err)
    return null
  }
}
