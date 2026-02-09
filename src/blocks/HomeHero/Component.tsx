'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

import type { HomeHeroBlock as HomeHeroBlockProps, Media } from '@/payload-types'

export const HomeHeroBlock: React.FC<HomeHeroBlockProps> = ({
  heading,
  subheading,
  backgroundImage,
  backgroundVideo,
  ctaLabel,
  ctaLink,
  overlayOpacity = 40,
}) => {
  // Get background image URL
  const bgImage = backgroundImage as Media | null
  const bgImageUrl = bgImage?.imgixUrl || bgImage?.url || ''
  const bgImageAlt = bgImage?.alt || bgImage?.altText || heading || 'Safari background'

  // Get background video URL if present
  const bgVideo = backgroundVideo as Media | null
  const bgVideoUrl = bgVideo?.url || ''

  // Calculate overlay opacity
  const opacity = (overlayOpacity ?? 40) / 100

  return (
    <section className="relative h-[70vh] w-full md:h-screen">
      {/* Background Video (priority over image) */}
      {bgVideoUrl ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={bgVideoUrl} type="video/mp4" />
        </video>
      ) : bgImageUrl ? (
        <Image
          src={bgImageUrl}
          alt={bgImageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      ) : null}

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, transparent 30%, rgba(0, 0, 0, ${opacity}) 100%)`,
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 md:pb-20">
          <h1 className="max-w-[700px] text-[32px] font-bold leading-tight text-white md:text-[48px]">
            {heading}
          </h1>
          {subheading && (
            <p className="mt-4 max-w-[600px] text-base text-white/85 md:text-xl">{subheading}</p>
          )}
          {ctaLabel && ctaLink && (
            <Link
              href={ctaLink}
              className="mt-6 inline-flex rounded-sm bg-[#DA7A5A] px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#C66A4A]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
