import Image from 'next/image'

interface AuthorHeroProps {
  name: string
  role?: string
  photoUrl?: string
  photoAlt?: string
  shortBio?: string
  credentials?: string[]
}

export default function AuthorHero({
  name,
  role,
  photoUrl,
  photoAlt,
  shortBio,
  credentials,
}: AuthorHeroProps) {
  const initial = name.charAt(0).toUpperCase()

  return (
    <section className="w-full bg-[#F5F3EB]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center px-6 py-10 md:flex-row md:items-center md:gap-12 md:pb-12 md:pt-16">
        <div className="mb-6 shrink-0 md:mb-0">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={photoAlt ?? name}
              width={160}
              height={160}
              className="h-[120px] w-[120px] rounded-full border-[3px] border-[#DADADA] object-cover transition-opacity duration-300 md:h-[160px] md:w-[160px]"
            />
          ) : (
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-[3px] border-[#DADADA] bg-[#E8E5DD] md:h-[160px] md:w-[160px]">
              <span className="text-[36px] font-semibold text-[#486A6A] md:text-[48px]">
                {initial}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <h1 className="text-[28px] font-bold leading-tight text-[#404040] md:text-[36px]">
            {name}
          </h1>
          {role && (
            <p className="mt-1.5 text-[16px] font-medium uppercase tracking-[0.05em] text-[#486A6A]">
              {role}
            </p>
          )}
          {shortBio && (
            <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-[#404040]">
              {shortBio}
            </p>
          )}
          {credentials && credentials.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2">
              {credentials.map((credential, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full bg-[#486A6A]" />
                  <span className="text-[14px] text-[#404040]/80">{credential}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
