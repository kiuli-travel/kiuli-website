import { MapPin, Users, Calendar, Moon } from 'lucide-react'

interface TripOverviewProps {
  title: string
  destinations: string[]
  totalNights: number
  travelers?: string
  startDate?: string
  endDate?: string
  investmentLevel: {
    fromPrice: number
    currency: string
  } | null
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function TripOverview({
  title,
  destinations,
  totalNights,
  travelers,
  startDate,
  endDate,
  investmentLevel,
}: TripOverviewProps) {
  const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : null

  return (
    <section className="bg-kiuli-ivory py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          {/* Left Column - Trip Details */}
          <div className="flex-1 lg:flex-[3]">
            <h1 className="font-heading text-3xl font-semibold tracking-wide text-kiuli-charcoal md:text-4xl lg:text-5xl">
              {title}
            </h1>

            <div className="my-6 h-px w-full bg-kiuli-gray" />

            <div className="flex flex-col gap-4">
              {/* Destinations */}
              {destinations.length > 0 && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-kiuli-teal flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-base text-kiuli-charcoal md:text-lg">
                    {destinations.join(', ')}
                  </span>
                </div>
              )}

              {/* Nights */}
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-kiuli-teal flex-shrink-0" strokeWidth={1.5} />
                <span className="text-base text-kiuli-charcoal md:text-lg">
                  {totalNights} {totalNights === 1 ? 'night' : 'nights'}
                </span>
              </div>

              {/* Travelers */}
              {travelers && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-kiuli-teal flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-base text-kiuli-charcoal md:text-lg">{travelers}</span>
                </div>
              )}

              {/* Date Range */}
              {dateRange && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-kiuli-teal flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-base text-kiuli-charcoal md:text-lg">{dateRange}</span>
                </div>
              )}
            </div>

            {/* Price Section */}
            {investmentLevel?.fromPrice && (
              <div className="mt-8">
                <span className="label-caps text-kiuli-charcoal/60">Total</span>
                <p className="mt-1 font-heading text-3xl font-semibold text-kiuli-teal md:text-4xl">
                  {formatPrice(investmentLevel.fromPrice, investmentLevel.currency)}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Map Placeholder */}
          <div className="flex-1 lg:flex-[2]">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-kiuli-gray">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="mx-auto h-8 w-8 text-kiuli-teal/40" strokeWidth={1.5} />
                  <span className="mt-2 block text-sm text-kiuli-charcoal/40">
                    Map coming soon
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
