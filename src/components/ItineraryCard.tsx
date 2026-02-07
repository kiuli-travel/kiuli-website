import Link from 'next/link'
import Image from 'next/image'

interface ItineraryCardProps {
  title: string
  slug: string
  heroImageUrl: string
  heroImageAlt: string
  nights: number
  priceFrom: number
  countries: string[]
}

export default function ItineraryCard({
  title,
  slug,
  heroImageUrl,
  heroImageAlt,
  nights,
  priceFrom,
  countries,
}: ItineraryCardProps) {
  const formattedPrice = priceFrom.toLocaleString('en-US')
  const countriesLabel = countries.join(', ')

  return (
    <Link
      href={`/safaris/${slug}`}
      className="group block overflow-hidden rounded-[2px] bg-white transition-shadow duration-200 ease-in-out hover:shadow-md"
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <Image
          src={heroImageUrl}
          alt={heroImageAlt}
          fill
          className="object-cover transition-transform duration-[400ms] ease-in-out group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="px-5 pb-5 pt-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-[#404040]">{title}</h3>
        <p className="mt-2 text-sm text-[#404040]/60">
          {countriesLabel} &middot; {nights} nights
        </p>
        <p className="mt-3 text-sm font-medium text-[#486A6A]">From ${formattedPrice} pp</p>
      </div>
    </Link>
  )
}
