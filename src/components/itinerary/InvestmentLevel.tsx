import Link from 'next/link'

interface InvestmentLevelProps {
  price: number
  currency?: string
  includedItems?: string
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function InvestmentLevel({
  price,
  currency = 'USD',
  includedItems,
}: InvestmentLevelProps) {
  return (
    <section className="bg-kiuli-ivory py-20 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 text-center">
        {/* Section Label with Lines */}
        <div className="mb-12 flex items-center justify-center gap-4">
          <span className="h-px w-12 bg-kiuli-charcoal/30" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-kiuli-charcoal/70">
            Investment Level
          </span>
          <span className="h-px w-12 bg-kiuli-charcoal/30" aria-hidden="true" />
        </div>

        {/* Price Display */}
        <div className="mb-10">
          <p className="text-4xl font-light text-kiuli-teal md:text-5xl lg:text-[56px]">
            From {formatPrice(price, currency)}
          </p>
          <p className="mt-2 text-base text-kiuli-charcoal/80">per person</p>
        </div>

        {/* Includes Summary */}
        <div className="mx-auto mb-12 max-w-xl">
          <p className="text-base leading-relaxed text-kiuli-charcoal md:text-lg">
            {includedItems ||
              'Your journey includes all accommodations, private transfers, curated experiences, dedicated concierge support, and every thoughtful detail that transforms travel into art.'}
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="#contact"
            className="inline-block rounded-lg bg-kiuli-clay px-10 py-4 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-kiuli-clay-hover focus:outline-none focus:ring-2 focus:ring-kiuli-clay focus:ring-offset-2 focus:ring-offset-kiuli-ivory"
          >
            Begin a Conversation
          </Link>

          {/* Alternative Contact */}
          <p className="text-sm text-kiuli-charcoal/60">
            Or call{' '}
            <a
              href="tel:+254700000000"
              className="underline underline-offset-2 transition-colors hover:text-kiuli-charcoal"
            >
              +254 700 000 000
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
