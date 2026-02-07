import React from 'react'

interface ItineraryGridProps {
  heading?: string
  children: React.ReactNode
}

export default function ItineraryGrid({ heading, children }: ItineraryGridProps) {
  return (
    <section className="w-full py-8 px-6 sm:py-12 lg:py-12">
      <div className="mx-auto max-w-[1280px]">
        {heading && (
          <h2 className="mb-6 text-2xl font-semibold text-[#404040] sm:mb-8 sm:text-[28px] sm:leading-tight">
            {heading}
          </h2>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {children}
        </div>
      </div>
    </section>
  )
}
