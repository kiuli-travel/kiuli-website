import Image from 'next/image'
import Link from 'next/link'

interface AuthorBioCardProps {
  name: string
  slug: string
  role?: string
  photoUrl?: string
  photoAlt?: string
  shortBio?: string
}

export default function AuthorBioCard({
  name,
  slug,
  role,
  photoUrl,
  photoAlt,
  shortBio,
}: AuthorBioCardProps) {
  const initial = name.charAt(0).toUpperCase()

  return (
    <section className="w-full border-t border-[#DADADA] bg-white">
      <div className="mx-auto max-w-[720px] px-6 py-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.1em] text-[#486A6A]">
          About the Author
        </p>
        <div className="flex items-start gap-4">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={photoAlt || name}
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-full border-2 border-[#DADADA] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[#DADADA] bg-[#E8E5DD]">
              <span className="text-2xl font-semibold text-[#486A6A]">{initial}</span>
            </div>
          )}
          <div className="min-w-0">
            <Link
              href={`/authors/${slug}`}
              className="text-lg font-semibold text-[#404040] no-underline hover:underline"
            >
              {name}
            </Link>
            {role && <p className="mt-0.5 text-sm font-medium text-[#486A6A]">{role}</p>}
            {shortBio && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#404040]/60">
                {shortBio}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
