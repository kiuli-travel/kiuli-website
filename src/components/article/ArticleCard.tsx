import Image from 'next/image'
import Link from 'next/link'

interface ArticleCardProps {
  title: string
  slug: string
  heroImageUrl: string
  heroImageAlt: string
  excerpt?: string
  authorName: string
  publishedDate: string
}

export default function ArticleCard({
  title,
  slug,
  heroImageUrl,
  heroImageAlt,
  excerpt,
  authorName,
  publishedDate,
}: ArticleCardProps) {
  const formattedDate = new Date(publishedDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link
      href={`/articles/${slug}`}
      className="group block overflow-hidden rounded-[2px] bg-white shadow-none transition-shadow duration-200 ease-in-out hover:shadow-md"
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <Image
          src={heroImageUrl}
          alt={heroImageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="h-full w-full object-cover transition-transform duration-[400ms] ease-in-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="px-5 pb-5 pt-4">
        <h3 className="mb-1.5 line-clamp-2 text-lg font-semibold leading-snug text-[#404040]">
          {title}
        </h3>
        {excerpt && (
          <p className="mb-3 line-clamp-2 text-sm font-normal text-[#404040]/70">{excerpt}</p>
        )}
        <p className="text-[13px] text-[#404040]/50">
          {authorName}
          <span className="mx-1.5">{'·'}</span>
          {formattedDate}
        </p>
      </div>
    </Link>
  )
}
