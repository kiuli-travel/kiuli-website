import Image from 'next/image'
import type { Media } from '@/payload-types'
import { HeroVideoPlayer } from './HeroVideoPlayer'

interface ItineraryHeroProps {
  title: string
  heroImage: {
    imgixUrl: string
    alt: string
  } | null
  heroVideo?: Media | null
  showHeroVideo?: boolean
}

// Extract video URL from Media object
function getVideoUrl(media: Media): string | null {
  // Prefer imgixUrl for S3-hosted media, otherwise use url
  if (media.imgixUrl?.startsWith('http')) return media.imgixUrl
  if (media.url?.startsWith('http')) return media.url
  if (media.url) return media.url
  return null
}

export function ItineraryHero({ title, heroImage, heroVideo, showHeroVideo }: ItineraryHeroProps) {
  // Determine if we should show video
  const shouldShowVideo = showHeroVideo && heroVideo && typeof heroVideo === 'object'
  const videoUrl = shouldShowVideo ? getVideoUrl(heroVideo) : null

  return (
    <section className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden group">
      {/* Background Video or Image with Zoom Effect */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.02]">
        {shouldShowVideo && videoUrl ? (
          // Video player with controls (no autoplay)
          <HeroVideoPlayer
            src={videoUrl}
            poster={heroImage?.imgixUrl}
            className="absolute inset-0"
          />
        ) : heroImage?.imgixUrl ? (
          // Image background
          <Image
            src={heroImage.imgixUrl}
            alt={heroImage.alt || title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          // Fallback gradient when no hero media
          <div className="absolute inset-0 bg-gradient-to-br from-kiuli-teal to-kiuli-charcoal" />
        )}
      </div>

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
        aria-hidden="true"
      />

      {/* Content Layer */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Breadcrumb - Top Left */}
        <div className="px-6 pt-8 md:px-12 md:pt-12 lg:px-16 lg:pt-16">
          <p
            className="text-white text-xs tracking-widest font-medium"
            style={{ fontSize: '12px', letterSpacing: '1px' }}
          >
            <span className="opacity-70">ITINERARIES</span>
            <span className="mx-2 opacity-50">&gt;</span>
            <span className="uppercase">{title}</span>
          </p>
        </div>

        {/* Spacer to push breadcrumb to top */}
        <div />
      </div>
    </section>
  )
}
