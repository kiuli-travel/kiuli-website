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

  // Strip [IMAGE: ...] placeholder text from body
  const cleanedBody = stripImagePlaceholders(body)

  // Insert article images into body at specified positions
  const articleImages = parseArticleImages(project.articleImages)
  const finalBody = articleImages.length > 0 ? insertImagesIntoBody(cleanedBody, articleImages) : cleanedBody

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

  // answerCapsule has a 40-60 word validation on Posts; only include if valid
  const capsuleWords = answerCapsule ? answerCapsule.trim().split(/\s+/).filter((w: string) => w.length > 0).length : 0
  const validCapsule = capsuleWords >= 40 && capsuleWords <= 60 ? answerCapsule : undefined

  // Hero image passthrough
  const heroImageId = project.heroImage as number | null | undefined

  const postData: Record<string, unknown> = {
    title,
    content: finalBody,
    slug,
    publishedAt: now,
    _status: 'published',
    faqItems: faqItems.length > 0 ? faqItems : [],
    meta: {
      title: metaTitle || undefined,
      description: metaDescription || undefined,
      answerCapsule: validCapsule,
      image: heroImageId || undefined,
    },
    heroImage: heroImageId || undefined,
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
      overrideAccess: true,
      context: { skipSearchSync: true },
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

// ── Article Image Insertion ─────────────────────────────────────────────────

interface ArticleImagePlacement {
  position: number
  mediaId: number
  caption?: string
}

function parseArticleImages(value: unknown): ArticleImagePlacement[] {
  if (!value) return []
  const arr = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(arr)) return []
  return arr
    .filter((item: Record<string, unknown>) => item && typeof item.mediaId === 'number')
    .map((item: Record<string, unknown>) => ({
      position: Number(item.position) || 0,
      mediaId: item.mediaId as number,
      caption: (item.caption as string) || undefined,
    }))
}

function createMediaBlockNode(mediaId: number): Record<string, unknown> {
  const id = Math.random().toString(36).slice(2, 14)
  return {
    type: 'block',
    version: 1,
    format: '',
    fields: {
      id,
      blockType: 'mediaBlock',
      blockName: '',
      media: mediaId,
    },
  }
}

function insertImagesIntoBody(
  body: unknown,
  images: ArticleImagePlacement[],
): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lexical = body as any
  if (!lexical?.root?.children || !Array.isArray(lexical.root.children)) {
    return body
  }

  const children = [...lexical.root.children]

  // Find heading positions
  const headingIndices: number[] = []
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'heading') {
      headingIndices.push(i)
    }
  }

  // Sort images by position descending so insertion doesn't shift earlier indices
  const sorted = [...images].sort((a, b) => b.position - a.position)

  for (const img of sorted) {
    // Find the heading at this position
    if (img.position < headingIndices.length) {
      const headingIndex = headingIndices[img.position]
      // Insert after the next paragraph (or right after the heading if no paragraph follows)
      let insertAt = headingIndex + 1
      // Skip past the first paragraph after this heading
      if (insertAt < children.length && children[insertAt].type === 'paragraph') {
        insertAt++
      }
      children.splice(insertAt, 0, createMediaBlockNode(img.mediaId))
    }
  }

  return {
    ...lexical,
    root: {
      ...lexical.root,
      children,
    },
  }
}

/**
 * Strip [IMAGE: ...] placeholder paragraphs from Lexical body.
 * The drafter includes these as text markers for where images should go.
 * If no articleImages are populated, they render as raw text — strip them.
 */
function stripImagePlaceholders(body: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lexical = body as any
  if (!lexical?.root?.children || !Array.isArray(lexical.root.children)) {
    return body
  }

  const filtered = lexical.root.children.filter((node: Record<string, unknown>) => {
    if (node.type !== 'paragraph') return true
    // Check if this paragraph's text content is an image placeholder
    const children = node.children as Array<Record<string, unknown>> | undefined
    if (!children || children.length === 0) return true
    const text = children
      .map((c: Record<string, unknown>) => (c.text as string) || '')
      .join('')
      .trim()
    // Match [IMAGE: ...] pattern
    return !text.match(/^\[IMAGE:\s*.*\]$/i)
  })

  return {
    ...lexical,
    root: {
      ...lexical.root,
      children: filtered,
    },
  }
}
