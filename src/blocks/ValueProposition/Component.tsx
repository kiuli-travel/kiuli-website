import React from 'react'
import Image from 'next/image'

import type { ValuePropositionBlock as ValuePropositionBlockProps, Media } from '@/payload-types'
import RichText from '@/components/RichText'

export const ValuePropositionBlock: React.FC<ValuePropositionBlockProps> = ({
  heading,
  content,
  image,
  imagePosition = 'right',
}) => {
  const imageData = image as Media | null
  const imageUrl = imageData?.imgixUrl || imageData?.url || ''
  const imageAlt = imageData?.alt || imageData?.altText || heading || 'Value proposition'

  const isImageLeft = imagePosition === 'left'

  return (
    <section className="bg-[#F5F3EB] py-12 md:py-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div
          className={`flex flex-col gap-10 md:flex-row md:items-center md:gap-16 ${
            isImageLeft ? 'md:flex-row-reverse' : ''
          }`}
        >
          {/* Text Side */}
          <div className="flex-1">
            {heading && (
              <h2 className="text-[28px] font-semibold text-[#404040]">{heading}</h2>
            )}
            {content && (
              <div className="mt-6">
                <RichText
                  data={content}
                  enableGutter={false}
                  className="prose prose-lg max-w-none text-[#404040]/80 prose-p:leading-relaxed prose-p:text-[#404040]/80"
                />
              </div>
            )}
          </div>

          {/* Image Side */}
          {imageUrl && (
            <div className="flex-1">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
