import Image from 'next/image'

interface PropertyHeroProps {
  name: string
  heroImageUrl: string
  heroImageAlt: string
  destinationName?: string // Park/region name, e.g. "Masai Mara"
  countryName?: string // e.g. "Kenya"
  type?: string // e.g. "Lodge", "Camp", "Hotel"
  priceTier?: string // e.g. "Luxury", "Ultra Luxury"
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

export default function PropertyHero({
  name,
  heroImageUrl,
  heroImageAlt,
  destinationName,
  countryName,
  type,
  priceTier,
}: PropertyHeroProps) {
  // Build location string
  const locationParts: string[] = []
  if (destinationName) locationParts.push(destinationName)
  if (countryName) locationParts.push(countryName)
  const locationString = locationParts.join(', ')

  return (
    <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
      <Image
        src={heroImageUrl}
        alt={heroImageAlt}
        fill
        sizes="100vw"
        priority
        className="object-cover object-center"
      />

      {/* Price tier badge - top right */}
      {priceTier && (
        <div className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-sm rounded">
          <span className="text-xs uppercase tracking-[0.1em] font-medium text-[#486A6A]">
            {formatPriceTier(priceTier)}
          </span>
        </div>
      )}

      {/* Gradient overlay at bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.55))',
        }}
      />

      {/* Content over gradient */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full max-w-[1280px] mx-auto px-6 pb-12">
          {/* Type badge */}
          {type && (
            <span className="block text-xs uppercase tracking-[0.1em] text-white/80 mb-2">
              {formatType(type)}
            </span>
          )}

          {/* Property name */}
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">{name}</h1>

          {/* Location context */}
          {locationString && (
            <p className="mt-2 text-base md:text-lg text-white/70 font-normal">{locationString}</p>
          )}
        </div>
      </div>
    </section>
  )
}
