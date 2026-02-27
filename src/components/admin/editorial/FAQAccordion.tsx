"use client"

import { FAQCard } from "./FAQCard"
import { SectionStatusBadge } from "./AccordionComponents"
import type { FAQItem } from "./FAQCard"

export interface FAQAccordionProps {
  isOpen: boolean
  onToggle: () => void
  items: FAQItem[]
  onItemChange: (id: string, field: keyof FAQItem, value: string | boolean) => void
  onEnhanceAnswer: (id: string) => Promise<void>
  onEnhanceAll: () => Promise<void>
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  enhancingId?: string | null
  isEnhancingAll?: boolean
  className?: string
}

export default function FAQAccordion({
  isOpen,
  onToggle,
  items,
  onItemChange,
  onEnhanceAnswer,
  onEnhanceAll,
  onAddItem,
  onDeleteItem,
  enhancingId,
  isEnhancingAll,
  className = "",
}: FAQAccordionProps) {
  const reviewedCount = items.filter((i) => i.isReviewed).length

  return (
    <div className={className}>
      {/* ACCORDION HEADER */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-11 w-full items-center gap-2 border border-kiuli-gray bg-white px-3 text-left ${
          isOpen ? "rounded-t-md" : "rounded-md"
        }`}
      >
        {/* Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-kiuli-teal transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="text-sm font-medium text-kiuli-charcoal">FAQs</span>

        <div className="flex-1" />

        <SectionStatusBadge reviewed={reviewedCount} total={items.length} />
      </button>

      {/* ACCORDION CONTENT */}
      {isOpen && (
        <div className="overflow-hidden rounded-b-md border border-t-0 border-kiuli-gray bg-white">
          {/* FAQ CARDS */}
          <div className="divide-y divide-kiuli-gray">
            {items.map((item, index) => (
              <FAQCard
                key={item.id}
                item={item}
                index={index}
                onItemChange={onItemChange}
                onEnhanceAnswer={onEnhanceAnswer}
                onDeleteItem={onDeleteItem}
                enhancingId={enhancingId}
              />
            ))}
          </div>

          {/* BOTTOM ACTIONS */}
          <div className="flex items-center justify-between border-t border-kiuli-gray px-3 py-2.5">
            <button
              type="button"
              onClick={onAddItem}
              className="rounded-md border border-kiuli-gray bg-white px-3.5 py-1.5 text-xs font-medium text-kiuli-charcoal hover:border-kiuli-teal hover:text-kiuli-teal"
            >
              + Add FAQ
            </button>
            <button
              type="button"
              onClick={onEnhanceAll}
              disabled={isEnhancingAll}
              className="rounded-md bg-kiuli-clay px-3.5 py-1.5 text-xs font-medium text-white hover:bg-kiuli-clay-hover disabled:opacity-50"
            >
              {isEnhancingAll ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Enhancing...
                </span>
              ) : (
                "\u2728 Enhance All FAQs"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
