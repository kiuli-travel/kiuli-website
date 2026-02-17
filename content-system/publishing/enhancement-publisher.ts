import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { PublishResult } from './types'

const ALLOWED_COLLECTIONS = new Set(['destinations', 'itineraries', 'posts', 'properties'])

export async function publishEnhancement(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'itinerary_enhancement') {
    throw new Error(`Enhancement publisher received type: ${project.contentType}`)
  }

  const targetCollection = project.targetCollection as string
  const targetField = project.targetField as string
  const targetRecordId = parseInt(String(project.targetRecordId), 10)

  if (!targetCollection || !ALLOWED_COLLECTIONS.has(targetCollection)) {
    throw new Error(`Invalid target collection: ${targetCollection}`)
  }
  if (!targetField) throw new Error('Cannot publish: targetField is empty')
  if (isNaN(targetRecordId)) throw new Error('Cannot publish: targetRecordId is invalid')
  if (!project.body) throw new Error('Cannot publish: body is empty')

  // Read target for optimistic lock
  const target = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const baselineUpdatedAt = target.updatedAt as string

  // Verify no conflict
  const freshTarget = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshTarget.updatedAt as string) !== baselineUpdatedAt) {
    throw new Error(`Optimistic lock conflict on ${targetCollection}/${targetRecordId}`)
  }

  await payload.update({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    data: { [targetField]: project.body },
  })

  const now = new Date().toISOString()
  console.log(`[enhancement-publisher] Wrote to ${targetCollection}.${targetField} (ID ${targetRecordId}) for project ${projectId}`)

  return {
    success: true,
    targetCollection,
    targetId: targetRecordId,
    publishedAt: now,
  }
}
