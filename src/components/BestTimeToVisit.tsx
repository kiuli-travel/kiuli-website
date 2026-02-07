import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

interface BestTimeToVisitProps {
  content: DefaultTypedEditorState | null | undefined
}

export default function BestTimeToVisit({ content }: BestTimeToVisitProps) {
  if (!content) return null

  // Check if content has any actual data
  const root = content as { root?: { children?: unknown[] } }
  if (!root.root?.children || root.root.children.length === 0) return null

  return (
    <section className="w-full py-8 px-6 md:py-12">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="mb-6 text-2xl font-semibold text-[#404040] md:text-[28px]">
          Best Time to Visit
        </h2>
        <div className="prose prose-lg max-w-none text-[#404040] leading-[1.6]">
          <RichText data={content} enableGutter={false} enableProse={false} />
        </div>
      </div>
    </section>
  )
}
