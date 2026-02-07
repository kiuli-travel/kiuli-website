interface HighlightsListProps {
  items: { highlight: string }[]
}

export default function HighlightsList({ items }: HighlightsListProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="w-full py-8 px-6 md:py-12">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="mb-6 text-2xl font-semibold text-[#404040] md:text-[28px]">Key Highlights</h2>
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={index}
              className="border-l-[3px] border-[#486A6A] pl-4 text-base leading-[1.6] text-[#404040]"
            >
              {item.highlight}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
