interface WhyKiuliProps {
  content: string
}

export function WhyKiuli({ content }: WhyKiuliProps) {
  if (!content) return null

  // Split content into paragraphs for better rendering
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-[900px] px-6">
        {/* Section Label with Lines */}
        <div className="mb-12 flex items-center justify-center gap-4">
          <span className="h-px w-12 bg-kiuli-charcoal/30" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-kiuli-charcoal/70">
            Why Kiuli
          </span>
          <span className="h-px w-12 bg-kiuli-charcoal/30" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="space-y-6 text-center">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="text-base leading-relaxed text-kiuli-charcoal/80 md:text-lg"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
