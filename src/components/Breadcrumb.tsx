import Link from 'next/link'

interface BreadcrumbProps {
  items: {
    label: string
    href?: string
  }[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center text-sm font-normal">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span aria-hidden="true" className="mx-3 select-none text-[#DADADA]">/</span>
              )}
              {isLast ? (
                <span aria-current="page" className="text-[#404040]">{item.label}</span>
              ) : (
                <Link href={item.href!} className="text-[#404040]/60 transition-all duration-200 ease-in-out hover:text-[#404040] hover:underline">{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
