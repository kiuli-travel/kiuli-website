import type { Metadata } from 'next'
import type { Author, Post, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import Breadcrumb from '@/components/Breadcrumb'
import AuthorHero from '@/components/author/AuthorHero'
import ArticleCard from '@/components/article/ArticleCard'
import ItineraryGrid from '@/components/ItineraryGrid'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'
import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

export const revalidate = 600
export const dynamic = 'force-static'
export const dynamicParams = false

type Args = {
  params: Promise<{
    slug: string
  }>
}

// Helper: Extract plain text from Lexical richText
function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return ''

  const root = (richText as { root?: { children?: unknown[] } }).root
  if (!root?.children) return ''

  const extractText = (nodes: unknown[]): string => {
    return nodes
      .map((node) => {
        if (!node || typeof node !== 'object') return ''
        const n = node as { type?: string; text?: string; children?: unknown[] }

        if (n.type === 'text' && n.text) {
          return n.text
        }
        if (n.children && Array.isArray(n.children)) {
          return extractText(n.children)
        }
        return ''
      })
      .join('')
  }

  return extractText(root.children)
}

// Helper: Get photo data
function getPhotoData(author: Author): { imgixUrl: string; alt: string } | null {
  const photo = author.photo
  if (!photo || typeof photo === 'number') return null

  const media = photo as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || author.name,
  }
}

// Helper: Get article hero image
function getArticleHeroImage(post: Post): { imgixUrl: string; alt: string } | null {
  const heroImage = post.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || post.title,
  }
}

// Generate Person JSON-LD
function generatePersonSchema(author: Author, photoUrl: string | null) {
  const bioText = extractTextFromRichText(author.bio)
  const description = bioText ? bioText.substring(0, 300) : author.shortBio || ''

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: `https://kiuli.com/authors/${author.slug}`,
    worksFor: {
      '@type': 'Organization',
      name: 'Kiuli',
      url: 'https://kiuli.com',
    },
  }

  if (author.role) {
    schema.jobTitle = author.role
  }

  if (description) {
    schema.description = description
  }

  if (photoUrl) {
    schema.image = photoUrl
  }

  return schema
}

// Generate BreadcrumbList JSON-LD
function generateBreadcrumbSchema(author: Author) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://kiuli.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Our Team',
        item: 'https://kiuli.com/authors',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: author.name,
        item: `https://kiuli.com/authors/${author.slug}`,
      },
    ],
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })

  const authors = await payload.find({
    collection: 'authors',
    where: { _status: { equals: 'published' } },
    limit: 100,
    select: { slug: true },
  })

  return authors.docs.map((a) => ({ slug: a.slug }))
}

export default async function AuthorPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  // Fetch author with depth 1 to populate photo
  const result = await payload.find({
    collection: 'authors',
    draft,
    limit: 1,
    overrideAccess: true,
    depth: 1,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  const author = result.docs?.[0]

  if (!author) {
    notFound()
  }

  // Fetch articles by this author
  const articlesResult = await payload.find({
    collection: 'posts',
    draft,
    limit: 50,
    overrideAccess: true,
    depth: 2,
    where: {
      and: [
        { authors: { contains: author.id } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
    sort: '-publishedAt',
  })
  const articles = articlesResult.docs || []

  // Get photo data
  const photo = getPhotoData(author)

  // Extract credentials as string array
  const credentials: string[] = []
  if (author.credentials && author.credentials.length > 0) {
    for (const cred of author.credentials) {
      if (cred.text) credentials.push(cred.text)
    }
  }

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Our Team', href: '/authors' },
    { label: author.name },
  ]

  // Generate schemas
  const personSchema = generatePersonSchema(author, photo?.imgixUrl || null)
  const breadcrumbSchema = generateBreadcrumbSchema(author)

  return (
    <article>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6 pt-4 pb-2 md:px-8">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Author Hero */}
      <AuthorHero
        name={author.name}
        role={author.role || undefined}
        photoUrl={photo?.imgixUrl}
        photoAlt={photo?.alt}
        shortBio={author.shortBio || undefined}
        credentials={credentials.length > 0 ? credentials : undefined}
      />

      {/* Full Bio */}
      {author.bio && (
        <section className="w-full py-8 px-6 md:py-12">
          <div className="mx-auto max-w-[720px]">
            <div className="prose prose-lg max-w-none text-[#404040] leading-[1.6]">
              <RichText
                data={author.bio as DefaultTypedEditorState}
                enableGutter={false}
                enableProse={false}
              />
            </div>
          </div>
        </section>
      )}

      {/* Articles by Author */}
      {articles.length > 0 && (
        <ItineraryGrid heading={`Articles by ${author.name}`}>
          {articles.map((article) => {
            const heroImage = getArticleHeroImage(article)
            if (!heroImage) return null

            // Get first author name (should be this author)
            const authorName = author.name

            return (
              <ArticleCard
                key={article.id}
                title={article.title}
                slug={article.slug}
                heroImageUrl={heroImage.imgixUrl}
                heroImageAlt={heroImage.alt}
                excerpt={article.excerpt || undefined}
                authorName={authorName}
                publishedDate={article.publishedAt || article.createdAt}
              />
            )
          })}
        </ItineraryGrid>
      )}

      {/* Inquiry CTA */}
      <InquiryCTA />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'authors',
    draft,
    limit: 1,
    overrideAccess: true,
    depth: 1,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  const author = result.docs?.[0]

  if (!author) {
    return {
      title: 'Author Not Found',
    }
  }

  // Get photo for OG image
  const photo = getPhotoData(author)
  const ogImageUrl = photo ? `${photo.imgixUrl}?w=1200&h=630&fit=crop` : undefined

  // Build title
  const title = author.metaTitle || (author.role ? `${author.name} — ${author.role} | Kiuli` : `${author.name} | Kiuli`)

  // Build description
  const description = author.metaDescription || (author.shortBio ? author.shortBio.substring(0, 160) : `Meet ${author.name} at Kiuli.`)

  return {
    title,
    description,
    alternates: {
      canonical: author.canonicalUrl || `https://kiuli.com/authors/${author.slug}`,
    },
    openGraph: ogImageUrl
      ? {
          images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        }
      : undefined,
  }
}
