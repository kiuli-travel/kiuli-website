import type { Metadata } from 'next'
import type { Post, Author, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Breadcrumb from '@/components/Breadcrumb'
import ItineraryGrid from '@/components/ItineraryGrid'
import ArticleCard from '@/components/article/ArticleCard'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

export const revalidate = 600
export const dynamic = 'force-static'

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

// Helper: Get first author name
function getAuthorName(post: Post): string {
  if (!post.authors || post.authors.length === 0) return 'Kiuli Team'

  const firstAuthor = post.authors[0]
  if (typeof firstAuthor === 'number') return 'Kiuli Team'

  return (firstAuthor as Author).name || 'Kiuli Team'
}

// Generate BreadcrumbList JSON-LD
function generateBreadcrumbSchema() {
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
    ],
  }
}

export default async function ArticlesPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published articles
  const result = await payload.find({
    collection: 'posts',
    limit: 100,
    overrideAccess: true,
    depth: 2,
    where: {
      _status: { equals: 'published' },
    },
    sort: '-publishedAt',
  })

  const posts = result.docs || []

  // Extract data for cards
  const articleCards = posts
    .map((post) => {
      const heroImage = getHeroImage(post)
      if (!heroImage) return null

      return {
        slug: post.slug,
        title: post.title,
        heroImageUrl: heroImage.imgixUrl,
        heroImageAlt: heroImage.alt,
        excerpt: post.excerpt || undefined,
        authorName: getAuthorName(post),
        publishedDate: post.publishedAt || post.createdAt,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Articles' },
  ]

  // Generate schemas
  const breadcrumbSchema = generateBreadcrumbSchema()

  return (
    <main>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="mt-6 text-3xl font-bold text-[#404040] md:text-4xl">
            Safari Insights & Travel Guides
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Expert advice, destination guides, and insider knowledge to help you plan your
            perfect African safari adventure.
          </p>
        </div>
      </section>

      {/* Articles Grid */}
      {articleCards.length > 0 ? (
        <ItineraryGrid>
          {articleCards.map((card) => (
            <ArticleCard
              key={card.slug}
              title={card.title}
              slug={card.slug}
              heroImageUrl={card.heroImageUrl}
              heroImageAlt={card.heroImageAlt}
              excerpt={card.excerpt}
              authorName={card.authorName}
              publishedDate={card.publishedDate}
            />
          ))}
        </ItineraryGrid>
      ) : (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
            <p className="text-lg text-[#404040]/70">
              No articles available at the moment. Please check back soon.
            </p>
          </div>
        </section>
      )}

      {/* Inquiry CTA */}
      <InquiryCTA />
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Safari Articles & Travel Guides | Kiuli',
    description:
      'Expert safari advice, destination guides, and insider knowledge for planning your African adventure. Written by experienced travel designers.',
    alternates: {
      canonical: 'https://kiuli.com/articles',
    },
    openGraph: {
      title: 'Safari Articles & Travel Guides | Kiuli',
      description:
        'Expert safari advice, destination guides, and insider knowledge for planning your African adventure.',
      url: 'https://kiuli.com/articles',
    },
  }
}
