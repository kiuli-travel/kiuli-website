'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ActivityBlockProps {
  title: string
  description: React.ReactNode
  images: Array<{
    imgixUrl: string
    alt: string
  }>
  dayNumber?: number
}

export function ActivityBlock({
  title,
  description,
  images,
  dayNumber,
}: ActivityBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  const label = dayNumber ? `Day ${dayNumber} / Activity` : 'Activity'

  return (
    <article className="w-full max-w-3xl mx-auto px-6 md:px-8 py-12">
      {/* Label with separator */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-kiuli-charcoal/50 text-xs font-medium uppercase tracking-[0.15em]">
          {label}
        </span>
        <div className="flex-1 h-px bg-kiuli-gray" />
      </div>

      {/* Title */}
      <h3 className="font-serif text-2xl md:text-3xl text-kiuli-charcoal mb-6">
        {title}
      </h3>

      {/* Description */}
      <div className="prose prose-lg max-w-none text-kiuli-charcoal leading-relaxed mb-8">
        {description}
      </div>

      {/* Image Carousel */}
      {images.length > 0 && (
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded">
            {images.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                  index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <Image
                  src={image.imgixUrl}
                  alt={image.alt || title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 text-kiuli-charcoal" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 text-kiuli-charcoal" />
              </button>
            </>
          )}

          {/* Image Indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex
                      ? 'bg-white'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
