import Image from 'next/image'
import Link from 'next/link'

interface ArticleHeroProps {
  title: string
  imageUrl: string
  imageAlt: string
  authorName: string
  authorSlug: string
  authorPhotoUrl?: string
  publishedDate: string
  readTime?: number
}

export default function ArticleHero({
  title,
  imageUrl,
  imageAlt,
  authorName,
  authorSlug,
  authorPhotoUrl,
  publishedDate,
  readTime,
}: ArticleHeroProps) {
  const formattedDate = new Date(publishedDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <article>
      <div className="relative h-[350px] w-full md:h-[450px]">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1280px] items-end px-6 pb-12">
          <h1 className="max-w-[800px] font-sans text-[28px] font-bold leading-tight text-white md:text-[40px]">
            {title}
          </h1>
        </div>
      </div>
      <div className="border-b border-[#DADADA] bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center px-6 pb-4 pt-5">
          {authorPhotoUrl && (
            <Image
              src={authorPhotoUrl}
              alt={`Photo of ${authorName}`}
              width={32}
              height={32}
              className="mr-2.5 h-8 w-8 rounded-full object-cover"
            />
          )}
          <Link
            href={`/authors/${authorSlug}`}
            className="text-sm font-medium text-[#404040] no-underline hover:underline"
          >
            {authorName}
          </Link>
          <span className="mx-2 text-[#DADADA]">{'·'}</span>
          <span className="text-sm font-normal text-[#404040]/60">{formattedDate}</span>
          {readTime && (
            <>
              <span className="mx-2 text-[#DADADA]">{'·'}</span>
              <span className="text-sm font-normal text-[#404040]/60">{readTime} min read</span>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
