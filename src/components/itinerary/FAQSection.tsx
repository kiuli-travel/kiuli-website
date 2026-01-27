'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string | React.ReactNode
}

interface FAQSectionProps {
  faqs: FAQItem[]
}

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0)
    }
  }, [isOpen])

  return (
    <div className="border-b border-kiuli-gray">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-kiuli-teal"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-kiuli-charcoal md:text-lg">
          {item.question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-kiuli-charcoal/60 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      <div
        style={{ height }}
        className="overflow-hidden transition-[height] duration-300 ease-out"
      >
        <div ref={contentRef} className="pb-6">
          {typeof item.answer === 'string' ? (
            <p className="text-base leading-relaxed text-kiuli-charcoal/70">
              {item.answer}
            </p>
          ) : (
            <div className="text-base leading-relaxed text-kiuli-charcoal/70">
              {item.answer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FAQSection({ faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!faqs || faqs.length === 0) return null

  return (
    <section className="w-full bg-white py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-6">
        {/* Heading */}
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-kiuli-charcoal md:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto mt-4 h-px w-12 bg-kiuli-teal" />
        </div>

        {/* FAQ Items */}
        <div className="border-t border-kiuli-gray">
          {faqs.map((item, index) => (
            <FAQAccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
