import React from 'react'

import type { TestimonialBlock as TestimonialBlockProps } from '@/payload-types'

export const TestimonialBlock: React.FC<TestimonialBlockProps> = ({
  quote,
  attribution,
  context,
}) => {
  return (
    <section className="bg-white py-12 md:py-20">
      <div className="mx-auto max-w-[720px] px-6 text-center">
        {/* Decorative Quote Mark */}
        <div className="mb-6 select-none text-[80px] font-serif leading-none text-[#486A6A]/20">
          &ldquo;
        </div>

        {/* Quote */}
        <blockquote className="text-lg italic leading-relaxed text-[#404040] md:text-[22px] md:leading-relaxed">
          {quote}
        </blockquote>

        {/* Attribution */}
        <div className="mt-6">
          <p className="text-base font-semibold text-[#404040]">{attribution}</p>
          {context && <p className="mt-1 text-sm text-[#404040]/60">{context}</p>}
        </div>
      </div>
    </section>
  )
}
