import Link from 'next/link'
import Image from 'next/image'

interface PropertyCardProps {
  name: string
  slug: string
  imageUrl?: string
  type?: string
  priceTier?: string
  destinationName?: string
}

// Map price tier values to display labels
function formatPriceTier(tier: string): string {
  const tierMap: Record<string, string> = {
    comfort: 'Comfort',
    premium: 'Premium',
    luxury: 'Luxury',
    ultra_luxury: 'Ultra Luxury',
  }
  return tierMap[tier] || tier
}

// Map type values to display labels
function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    lodge: 'Lodge',
    camp: 'Camp',
    hotel: 'Hotel',
    villa: 'Villa',
    mobile_camp: 'Mobile Camp',
    tented_camp: 'Tented Camp',
  }
  return typeMap[type] || type
}

export default function PropertyCard({
  name,
  slug,
  imageUrl,
  type,
  priceTier,
  destinationName,
}: PropertyCardProps) {
  return (
    <Link
      href={`/properties/${slug}`}
      className="group block rounded-sm border border-[#DADADA] bg-white transition-colors duration-200 ease-in-out hover:border-[#486A6A]"
    >
      {imageUrl ? (
        <div className="relative aspect-[5/3] overflow-hidden">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
          {priceTier && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded">
              <span className="text-xs uppercase tracking-[0.05em] font-medium text-[#486A6A]">
                {formatPriceTier(priceTier)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-[5/3] items-center justify-center bg-[#F5F3EB]">
          <span className="text-xl font-medium text-[#486A6A]">{name}</span>
        </div>
      )}
      <div className="p-4">
        {type && (
          <span className="block text-xs uppercase tracking-[0.05em] text-[#486A6A] mb-1">
            {formatType(type)}
          </span>
        )}
        <h3 className="text-lg font-semibold leading-tight text-[#404040]">{name}</h3>
        {destinationName && (
          <p className="mt-1 text-sm font-normal text-[#404040]/70">{destinationName}</p>
        )}
        <p className="mt-3 text-sm font-medium text-[#486A6A]">
          {'View Details '}
          <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">
            {'\u2192'}
          </span>
        </p>
      </div>
    </Link>
  )
}
