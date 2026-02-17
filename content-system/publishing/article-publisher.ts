import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult } from './types'

const ARTICLE_TYPES = new Set(['itinerary_cluster', 'authority', 'designer_insight'])

export async function publishArticle(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const contentType = project.contentType as string
  if (!ARTICLE_TYPES.has(contentType)) {
    throw new Error(`Article publisher received non-article type: ${contentType}`)
  }

  // Validate required fields
  const title = project.title as string
  if (!title) throw new Error('Cannot publish: title is empty')

  const body = project.body
  if (!body) throw new Error('Cannot publish: body is empty')

  const metaTitle = project.metaTitle as string
  const metaDescription = project.metaDescription as string
  const answerCapsule = project.answerCapsule as string

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)

  // Convert FAQ answers to Lexical richText
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  const faqItems = rawFaq
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      question: String(f.question),
      answer: textToLexical(String(f.answer)),
    }))

  // Check for existing post with this slug (idempotent re-publish)
  const existing = await payload.find({
    collection: 'posts',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })

  const now = new Date().toISOString()

  const postData: Record<string, unknown> = {
    title,
    content: body,
    slug,
    publishedAt: now,
    _status: 'published',
    faqItems: faqItems.length > 0 ? faqItems : [],
    meta: {
      title: metaTitle || undefined,
      description: metaDescription || undefined,
      answerCapsule: answerCapsule || undefined,
    },
  }

  let postId: number

  if (existing.docs.length > 0) {
    const existingPost = existing.docs[0] as unknown as Record<string, unknown>
    const existingUpdatedAt = existingPost.updatedAt as string

    // Optimistic lock: re-read to verify
    const freshPost = await payload.findByID({
      collection: 'posts',
      id: existingPost.id as number,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((freshPost.updatedAt as string) !== existingUpdatedAt) {
      throw new Error(`Optimistic lock conflict on post ${existingPost.id}: updatedAt changed between reads`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await payload.update({
      collection: 'posts',
      id: existingPost.id as number,
      data: postData as any,
    })
    postId = updated.id as number
    console.log(`[article-publisher] Updated existing post ${postId} for project ${projectId}`)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await payload.create({
      collection: 'posts',
      data: postData as any,
    })
    postId = created.id as number
    console.log(`[article-publisher] Created new post ${postId} for project ${projectId}`)
  }

  return {
    success: true,
    targetCollection: 'posts',
    targetId: postId,
    publishedAt: now,
  }
}
