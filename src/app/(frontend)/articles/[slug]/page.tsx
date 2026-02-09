import type { Metadata } from 'next'
import type { Post, Author, Media, Itinerary } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import Breadcrumb from '@/components/Breadcrumb'
import ArticleHero from '@/components/article/ArticleHero'
import AuthorBioCard from '@/components/author/AuthorBioCard'
import AnswerCapsule from '@/components/AnswerCapsule'
import ItineraryGrid from '@/components/ItineraryGrid'
import ItineraryCard from '@/components/ItineraryCard'
import { FAQSection } from '@/components/itinerary/FAQSection'
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
      .join(' ')
  }

  return extractText(root.children)
}

// Helper: Calculate read time from content (words / 200, rounded up)
function calculateReadTime(content: unknown): number {
  const text = extractTextFromRichText(content)
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

// Helper: Get hero image data
function getHeroImage(post: Post): { imgixUrl: string; alt: string } | null {
  const heroImage = post.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || post.title,
  }
}

// Helper: Get author data
function getAuthorData(post: Post): Author | null {
  if (!post.authors || post.authors.length === 0) return null

  const firstAuthor = post.authors[0]
  if (typeof firstAuthor === 'number') return null

  return firstAuthor as Author
}

// Helper: Get author photo URL
function getAuthorPhotoUrl(author: Author): string | undefined {
  const photo = author.photo
  if (!photo || typeof photo === 'number') return undefined

  const media = photo as Media
  return media.imgixUrl || undefined
}

// Helper: Extract FAQs from post
function extractFAQs(post: Post): Array<{ question: string; answer: string }> {
  if (!post.faqItems || post.faqItems.length === 0) return []

  return post.faqItems
    .map((item) => {
      const question = item.question || ''
      const answer = extractTextFromRichText(item.answer)

      if (!question || !answer) return null

      return { question, answer }
    })
    .filter((item): item is { question: string; answer: string } => item !== null)
}

// Helper: Extract itinerary data for cards
function extractItineraryData(itinerary: Itinerary): {
  slug: string
  title: string
  heroImageUrl: string
  heroImageAlt: string
  nights: number
  priceFrom: number
  countries: string[]
} | null {
  const heroImage = itinerary.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  // Extract countries from overview
  const countries: string[] = []
  if (itinerary.overview?.countries) {
    for (const c of itinerary.overview.countries) {
      if (c.country) countries.push(c.country)
    }
  }

  // Get nights
  const nights = itinerary.overview?.nights || 0

  // Get price
  const priceFrom = itinerary.investmentLevel?.fromPrice || 0

  if (countries.length === 0 || nights === 0 || priceFrom === 0) return null

  return {
    slug: itinerary.slug,
    title: itinerary.title,
    heroImageUrl: media.imgixUrl,
    heroImageAlt: media.alt || media.altText || itinerary.title,
    nights,
    priceFrom,
    countries,
  }
}

// Generate Article JSON-LD
function generateArticleSchema(
  post: Post,
  author: Author | null,
  heroImage: { imgixUrl: string; alt: string } | null,
) {
  const publishedDate = post.publishedAt || post.createdAt
  const modifiedDate = post.meta?.lastModified || post.updatedAt

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    url: `https://kiuli.com/articles/${post.slug}`,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    publisher: {
      '@type': 'Organization',
      name: 'Kiuli',
      url: 'https://kiuli.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://kiuli.com/kiuli-logo.png',
      },
    },
  }

  if (heroImage) {
    schema.image = heroImage.imgixUrl
  }

  if (post.excerpt) {
    schema.description = post.excerpt
  }

  if (author) {
    const authorPhotoUrl = getAuthorPhotoUrl(author)
    schema.author = {
      '@type': 'Person',
      name: author.name,
      url: `https://kiuli.com/authors/${author.slug}`,
      ...(authorPhotoUrl && { image: authorPhotoUrl }),
    }
  }

  return schema
}

// Generate FAQPage JSON-LD
function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  if (faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// Generate BreadcrumbList JSON-LD
function generateBreadcrumbSchema(title: string, slug: string) {
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
        name: 'Articles',
        item: 'https://kiuli.com/articles',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `https://kiuli.com/articles/${slug}`,
      },
    ],
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    limit: 500,
    select: { slug: true },
  })

  return posts.docs.map((p) => ({ slug: p.slug }))
}

export default async function ArticlePage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  // Fetch post with depth to populate heroImage, authors, and relatedItineraries
  const result = await payload.find({
    collection: 'posts',
    draft,
    limit: 1,
    overrideAccess: true,
    depth: 2,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  const post = result.docs?.[0]

  if (!post) {
    notFound()
  }

  // Get hero image data
  const heroImage = getHeroImage(post)

  // Get author data
  const author = getAuthorData(post)
  const authorPhotoUrl = author ? getAuthorPhotoUrl(author) : undefined

  // Calculate read time
  const readTime = calculateReadTime(post.content)

  // Extract FAQs
  const faqs = extractFAQs(post)

  // Get related itineraries
  const relatedItineraries = post.relatedItineraries || []
  const itineraryCards = relatedItineraries
    .map((itinerary) => {
      if (typeof itinerary === 'number') return null
      return extractItineraryData(itinerary as Itinerary)
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Articles', href: '/articles' },
    { label: post.title },
  ]

  // Generate schemas
  const articleSchema = generateArticleSchema(post, author, heroImage)
  const faqSchema = generateFAQSchema(faqs)
  const breadcrumbSchema = generateBreadcrumbSchema(post.title, post.slug)

  // Get answer capsule and focus keyword from meta
  const answerCapsule = post.meta?.answerCapsule
  const focusKeyword = post.meta?.focusKeyword

  return (
    <article>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6 pt-4 pb-2 md:px-8">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Article Hero */}
      {heroImage && author && (
        <ArticleHero
          title={post.title}
          imageUrl={heroImage.imgixUrl}
          imageAlt={heroImage.alt}
          authorName={author.name}
          authorSlug={author.slug}
          authorPhotoUrl={authorPhotoUrl}
          publishedDate={post.publishedAt || post.createdAt}
          readTime={readTime}
        />
      )}

      {/* Answer Capsule */}
      {answerCapsule && (
        <AnswerCapsule text={answerCapsule} focusKeyword={focusKeyword || undefined} />
      )}

      {/* Article Content */}
      {post.content && (
        <section className="w-full py-8 px-6 md:py-12">
          <div className="mx-auto max-w-[720px]">
            <div className="prose prose-lg max-w-none text-[#404040] leading-[1.6]">
              <RichText
                data={post.content as DefaultTypedEditorState}
                enableGutter={false}
                enableProse={false}
              />
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && <FAQSection faqs={faqs} />}

      {/* Related Safaris */}
      {itineraryCards.length > 0 && (
        <ItineraryGrid heading="Related Safaris">
          {itineraryCards.map((card) => (
            <ItineraryCard
              key={card.slug}
              title={card.title}
              slug={card.slug}
              heroImageUrl={card.heroImageUrl}
              heroImageAlt={card.heroImageAlt}
              nights={card.nights}
              priceFrom={card.priceFrom}
              countries={card.countries}
            />
          ))}
        </ItineraryGrid>
      )}

      {/* Author Bio Card */}
      {author && (
        <AuthorBioCard
          name={author.name}
          slug={author.slug}
          role={author.role || undefined}
          photoUrl={authorPhotoUrl}
          photoAlt={author.name}
          shortBio={author.shortBio || undefined}
        />
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
    collection: 'posts',
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

  const post = result.docs?.[0]

  if (!post) {
    return {
      title: 'Article Not Found',
    }
  }

  // Get hero image for OG image
  const heroImage = getHeroImage(post)
  const ogImageUrl = heroImage ? `${heroImage.imgixUrl}?w=1200&h=630&fit=crop` : undefined

  // Build title
  const title = post.meta?.title || `${post.title} | Kiuli`

  // Build description
  const description = post.meta?.description || post.excerpt || `Read ${post.title} on Kiuli.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://kiuli.com/articles/${post.slug}`,
    },
    openGraph: ogImageUrl
      ? {
          images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        }
      : undefined,
  }
}
