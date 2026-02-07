import Link from 'next/link'
import Image from 'next/image'

interface DestinationCardProps {
  name: string
  slug: string
  countrySlug: string
  imageUrl?: string
  description?: string
}

export default function DestinationCard({
  name,
  slug,
  countrySlug,
  imageUrl,
  description,
}: DestinationCardProps) {
  return (
    <Link
      href={`/destinations/${countrySlug}/${slug}`}
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
        </div>
      ) : (
        <div className="flex aspect-[5/3] items-center justify-center bg-[#F5F3EB]">
          <span className="text-xl font-medium text-[#486A6A]">{name}</span>
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold leading-tight text-[#404040]">{name}</h3>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm font-normal text-[#404040]/70">{description}</p>
        )}
        <p className="mt-3 text-sm font-medium text-[#486A6A]">
          {'Explore '}
          <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">
            {'\u2192'}
          </span>
        </p>
      </div>
    </Link>
  )
}
