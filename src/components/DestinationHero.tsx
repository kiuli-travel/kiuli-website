import Image from 'next/image'

interface DestinationHeroProps {
  name: string
  tagline?: string
  imageUrl: string
  imageAlt: string
  type: 'country' | 'region' | 'park'
  parentName?: string
}

export default function DestinationHero({
  name,
  tagline,
  imageUrl,
  imageAlt,
  type,
  parentName,
}: DestinationHeroProps) {
  const showParentLabel = (type === 'region' || type === 'park') && parentName

  return (
    <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        sizes="100vw"
        priority
        className="object-cover object-center"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.55))',
        }}
      />
      <div className="absolute inset-0 flex items-end">
        <div className="w-full max-w-[1280px] mx-auto px-6 pb-12">
          {showParentLabel && (
            <span className="block text-xs uppercase tracking-[0.1em] text-white/70 mb-2">
              {parentName}
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">{name}</h1>
          {tagline && (
            <p className="mt-2 text-base md:text-lg text-white/80 font-normal">{tagline}</p>
          )}
        </div>
      </div>
    </section>
  )
}
