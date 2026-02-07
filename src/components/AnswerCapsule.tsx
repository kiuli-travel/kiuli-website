interface AnswerCapsuleProps {
  text: string
  focusKeyword?: string
}

export default function AnswerCapsule({ text, focusKeyword }: AnswerCapsuleProps) {
  return (
    <section className="w-full border-y border-[#DADADA] bg-[#F5F3EB] px-6 py-8 md:py-12">
      <div className="mx-auto max-w-[720px]">
        {focusKeyword && (
          <p className="mb-4 text-center text-xs uppercase tracking-[0.1em] text-[#486A6A]">{focusKeyword}</p>
        )}
        <p className="text-center text-base leading-[1.6] text-[#404040] md:text-lg">{text}</p>
      </div>
    </section>
  )
}
