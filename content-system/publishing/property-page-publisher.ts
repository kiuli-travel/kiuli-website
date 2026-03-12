import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult } from './types'

export async function publishPropertyPage(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'property_page') {
    throw new Error(`Property publisher received type: ${project.contentType}`)
  }

  const sections = project.sections as Record<string, string> | null
  if (!sections || !sections.overview) {
    throw new Error('Cannot publish: sections.overview is empty')
  }

  // Resolve property — prefer targetRecordId (set by cascade), fall back to properties[] name
  let property: Record<string, unknown> | null = null

  const targetRecordId = project.targetRecordId as string | null
  if (targetRecordId && (project.targetCollection as string) === 'properties') {
    const doc = await payload.findByID({
      collection: 'properties',
      id: Number(targetRecordId),
      depth: 0,
    }).catch(() => null)
    if (doc) property = doc as unknown as Record<string, unknown>
  }

  if (!property) {
    const properties = Array.isArray(project.properties) ? (project.properties as string[]) : []
    if (properties.length === 0) {
      throw new Error('Cannot publish: no property name or targetRecordId on content project')
    }

    const propResult = await payload.find({
      collection: 'properties',
      where: { name: { equals: properties[0] } },
      limit: 1,
      depth: 0,
    })

    if (propResult.docs.length === 0) {
      throw new Error(`Cannot publish: property "${properties[0]}" not found in properties collection`)
    }

    property = propResult.docs[0] as unknown as Record<string, unknown>
  }
  const propertyId = property.id as number
  const baselineUpdatedAt = property.updatedAt as string

  // Build update — set _status to published so property is visible on frontend
  const updateData: Record<string, unknown> = {
    _status: 'published',
    description_enhanced: textToLexical(sections.overview),
  }

  if (project.metaTitle) updateData.metaTitle = project.metaTitle
  if (project.metaDescription) updateData.metaDescription = project.metaDescription
  if (project.answerCapsule) updateData.answerCapsule = project.answerCapsule

  // FAQ
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  if (rawFaq.length > 0) {
    updateData.faqItems = rawFaq
      .filter((f) => f.question && f.answer)
      .map((f) => ({
        question: String(f.question),
        answer: textToLexical(String(f.answer)),
      }))
  }

  // Optimistic lock: verify baseline before write
  const freshProp = await payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshProp.updatedAt as string) !== baselineUpdatedAt) {
    console.warn(`[property-publisher] Conflict on property ${propertyId}, retrying`)
    const retryBaseline = freshProp.updatedAt as string

    const retryCheck = await payload.findByID({
      collection: 'properties',
      id: propertyId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((retryCheck.updatedAt as string) !== retryBaseline) {
      throw new Error(
        `Optimistic lock failed after retry on properties/${propertyId}: ` +
        `expected ${retryBaseline}, got ${retryCheck.updatedAt}`
      )
    }
  }

  await payload.update({
    collection: 'properties',
    id: propertyId,
    data: updateData,
  })

  const now = new Date().toISOString()
  console.log(`[property-publisher] Updated property ${propertyId} for project ${projectId}`)

  return {
    success: true,
    targetCollection: 'properties',
    targetId: propertyId,
    publishedAt: now,
  }
}
