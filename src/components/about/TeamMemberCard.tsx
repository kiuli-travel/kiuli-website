import Image from 'next/image'
import Link from 'next/link'

interface TeamMemberCardProps {
  name: string
  slug: string
  role?: string
  photoUrl?: string
  photoAlt?: string
  shortBio?: string
}

export default function TeamMemberCard({
  name,
  slug,
  role,
  photoUrl,
  photoAlt,
  shortBio,
}: TeamMemberCardProps) {
  const initial = name.charAt(0).toUpperCase()

  return (
    <Link
      href={`/authors/${slug}`}
      className="group flex flex-col items-center text-center transition-opacity hover:opacity-90"
    >
      {/* Photo or Initial */}
      <div className="mb-4">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={photoAlt ?? name}
            width={120}
            height={120}
            className="h-[120px] w-[120px] rounded-full border-2 border-[#DADADA] object-cover"
          />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-[#DADADA] bg-[#E8E5DD]">
            <span className="text-[36px] font-semibold text-[#486A6A]">{initial}</span>
          </div>
        )}
      </div>

      {/* Name */}
      <h3 className="text-lg font-semibold text-[#404040] group-hover:text-[#486A6A]">{name}</h3>

      {/* Role */}
      {role && <p className="mt-1 text-sm text-[#486A6A]">{role}</p>}

      {/* Short Bio */}
      {shortBio && (
        <p className="mt-2 line-clamp-3 max-w-[280px] text-sm text-[#404040]/70">{shortBio}</p>
      )}
    </Link>
  )
}
