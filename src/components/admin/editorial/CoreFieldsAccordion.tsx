"use client"

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react"
import EditorialUnit from "./EditorialUnit"
import { SectionStatusBadge } from "./AccordionComponents"

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoreFieldsProps {
  isOpen: boolean
  onToggle: () => void

  // Title
  titleItrvl: string
  titleEnhanced: string
  titleReviewed: boolean
  slug: string
  onTitleChange: (v: string) => void
  onTitleEnhance: () => Promise<void>
  onTitleReviewedChange: (v: boolean) => void
  isTitleEnhancing?: boolean

  // Meta Title
  metaTitleItrvl: string
  metaTitleEnhanced: string
  metaTitleReviewed: boolean
  onMetaTitleChange: (v: string) => void
  onMetaTitleEnhance: () => Promise<void>
  onMetaTitleReviewedChange: (v: boolean) => void
  isMetaTitleEnhancing?: boolean

  // Meta Description
  metaDescriptionItrvl: string
  metaDescriptionEnhanced: string
  metaDescriptionReviewed: boolean
  onMetaDescriptionChange: (v: string) => void
  onMetaDescriptionEnhance: () => Promise<void>
  onMetaDescriptionReviewedChange: (v: boolean) => void
  isMetaDescriptionEnhancing?: boolean

  // Trip Types
  selectedTripTypes: string[]
  onTripTypesChange: (types: string[]) => void

  // Answer Capsule
  answerCapsule: string
  answerCapsuleReviewed: boolean
  onAnswerCapsuleChange: (v: string) => void
  onAnswerCapsuleReviewedChange: (v: boolean) => void

  // Focus Keyword
  focusKeyword: string
  focusKeywordReviewed: boolean
  onFocusKeywordChange: (v: string) => void
  onFocusKeywordReviewedChange: (v: boolean) => void

  className?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIP_TYPE_OPTIONS = [
  "Great Migration",
  "Gorilla Trekking",
  "Big Five Safari",
  "Family Safari",
  "Honeymoon Safari",
  "Photography Safari",
  "Walking Safari",
  "Beach & Bush",
  "Private Fly-Camp",
  "Conservation Safari",
]

// ─── Utility: field review state ─────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-200 text-kiuli-teal ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Character Counter ───────────────────────────────────────────────────────

function CharCounter({ value, limit }: { value: string; limit: number }) {
  const count = value.length
  const color = count <= limit ? "#16A34A" : "#DC2626"
  return (
    <div className="flex justify-end px-3 py-1" style={{ background: "transparent" }}>
      <span className="text-[11px] font-medium" style={{ color }}>
        {count}/{limit}
      </span>
    </div>
  )
}

// ─── Word Counter ────────────────────────────────────────────────────────────

function WordCounter({ value }: { value: string }) {
  const words = value.trim() === "" ? 0 : value.trim().split(/\s+/).length
  let color = "#888"
  let suffix = ""

  if (words >= 40 && words <= 60) {
    color = "#16A34A"
    suffix = " \u2713"
  } else if (words > 60) {
    color = "#DC2626"
    suffix = " — too long"
  }

  return (
    <div className="flex justify-end px-3 py-1">
      <span className="text-[11px] font-medium" style={{ color }}>
        {words}/60 words{suffix}
      </span>
    </div>
  )
}

// ─── Trip Types ──────────────────────────────────────────────────────────────

function TripTypesField({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (types: string[]) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const addType = useCallback(
    (type: string) => {
      if (!selected.includes(type)) {
        onChange([...selected, type])
      }
    },
    [selected, onChange]
  )

  const removeType = useCallback(
    (type: string) => {
      onChange(selected.filter((t) => t !== type))
    },
    [selected, onChange]
  )

  const isEmpty = selected.length === 0

  return (
    <div
      className={`border-b border-kiuli-gray pb-2.5 ${
        isEmpty
          ? "border-l-4 border-l-[#DC2626]"
          : "border-l-4 border-l-[#16A34A]"
      }`}
    >
      {/* Label */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
          Trip Types
        </span>
        <span className="ml-0.5 text-[10px] text-[#DC2626]">*</span>
      </div>

      {/* Warning banner */}
      {isEmpty && (
        <div
          className="mx-3 mb-2 border-l-4 border-l-[#DC2626] px-3 py-2 text-[12px] text-[#DC2626]"
          style={{ background: "#FEE2E2" }}
        >
          Required — select at least one trip type
        </div>
      )}

      {/* Selected pills + dropdown */}
      <div className="px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium text-kiuli-teal"
              style={{ background: "#E8EFEF" }}
            >
              {type}
              <button
                type="button"
                onClick={() => removeType(type)}
                className="ml-0.5 text-[12px] leading-none text-kiuli-teal hover:text-[#DC2626]"
                aria-label={`Remove ${type}`}
              >
                ×
              </button>
            </span>
          ))}

          {/* Dropdown trigger */}
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded border border-kiuli-gray bg-white px-2.5 py-1 text-[12px] text-kiuli-charcoal transition-colors hover:bg-kiuli-ivory"
            >
              Add trip type
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="#666" strokeWidth="1.2" fill="none" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                className="absolute left-0 z-20 mt-1 w-52 overflow-y-auto rounded border border-kiuli-gray bg-white shadow-sm"
                style={{ maxHeight: 160 }}
              >
                {TRIP_TYPE_OPTIONS.filter((t) => !selected.includes(t)).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        addType(type)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-kiuli-charcoal transition-colors hover:bg-kiuli-ivory"
                    >
                      <span className="text-kiuli-teal">+</span>
                      {type}
                    </button>
                  )
                )}
                {TRIP_TYPE_OPTIONS.filter((t) => !selected.includes(t)).length ===
                  0 && (
                  <div className="px-3 py-2 text-[11px] text-[#888]">
                    All types selected
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CoreFieldsAccordion({
  isOpen,
  onToggle,
  titleItrvl,
  titleEnhanced,
  titleReviewed,
  slug,
  onTitleChange,
  onTitleEnhance,
  onTitleReviewedChange,
  isTitleEnhancing,
  metaTitleItrvl,
  metaTitleEnhanced,
  metaTitleReviewed,
  onMetaTitleChange,
  onMetaTitleEnhance,
  onMetaTitleReviewedChange,
  isMetaTitleEnhancing,
  metaDescriptionItrvl,
  metaDescriptionEnhanced,
  metaDescriptionReviewed,
  onMetaDescriptionChange,
  onMetaDescriptionEnhance,
  onMetaDescriptionReviewedChange,
  isMetaDescriptionEnhancing,
  selectedTripTypes,
  onTripTypesChange,
  answerCapsule,
  answerCapsuleReviewed,
  onAnswerCapsuleChange,
  onAnswerCapsuleReviewedChange,
  focusKeyword,
  focusKeywordReviewed,
  onFocusKeywordChange,
  onFocusKeywordReviewedChange,
  className,
}: CoreFieldsProps) {
  // Count reviewed fields (6 total: title, metaTitle, metaDesc, tripTypes, answerCapsule, focusKeyword)
  const reviewedCount = [
    titleReviewed,
    metaTitleReviewed,
    metaDescriptionReviewed,
    selectedTripTypes.length > 0, // Trip Types: considered "reviewed" when filled
    answerCapsuleReviewed,
    focusKeywordReviewed,
  ].filter(Boolean).length

  return (
    <div className={className}>
      {/* ─── Accordion Header ─── */}
      <button
        type="button"
        onClick={onToggle}
        className="flex h-[44px] w-full items-center justify-between border border-kiuli-gray bg-white px-4 transition-colors hover:bg-[#FAFAFA]"
        style={{
          borderRadius: isOpen ? "6px 6px 0 0" : "6px",
        }}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon open={isOpen} />
          <span className="text-[13px] font-semibold text-kiuli-charcoal">Core Fields</span>
        </div>
        <SectionStatusBadge reviewed={reviewedCount} total={6} />
      </button>

      {/* ─── Accordion Content ─── */}
      {isOpen && (
        <div
          className="overflow-hidden border border-t-0 border-kiuli-gray bg-white"
          style={{ borderRadius: "0 0 6px 6px" }}
        >
          {/* 1. Title */}
          <div className="border-b border-kiuli-gray">
            <EditorialUnit
              fieldLabel="Title"
              itrvlValue={titleItrvl}
              enhancedValue={titleEnhanced}
              isReviewed={titleReviewed}
              onEnhancedChange={onTitleChange}
              onEnhance={onTitleEnhance}
              onReviewedChange={onTitleReviewedChange}
              isEnhancing={isTitleEnhancing}
            />
            <div className="border-t border-kiuli-gray bg-[#FAFAFA] px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-[#666]">Slug</span>
                <span className="font-mono text-[12px] text-kiuli-teal">{slug}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[#888]">
                {"→ kiuli.com/safaris/" + slug}
              </p>
            </div>
          </div>

          {/* 2. Meta Title */}
          <div className="border-b border-kiuli-gray">
            <EditorialUnit
              fieldLabel="Meta Title"
              itrvlValue={metaTitleItrvl}
              enhancedValue={metaTitleEnhanced}
              isReviewed={metaTitleReviewed}
              onEnhancedChange={onMetaTitleChange}
              onEnhance={onMetaTitleEnhance}
              onReviewedChange={onMetaTitleReviewedChange}
              isEnhancing={isMetaTitleEnhancing}
            />
            <CharCounter value={metaTitleEnhanced} limit={60} />
          </div>

          {/* 3. Meta Description */}
          <div className="border-b border-kiuli-gray">
            <EditorialUnit
              fieldLabel="Meta Description"
              itrvlValue={metaDescriptionItrvl}
              enhancedValue={metaDescriptionEnhanced}
              isReviewed={metaDescriptionReviewed}
              multiline
              onEnhancedChange={onMetaDescriptionChange}
              onEnhance={onMetaDescriptionEnhance}
              onReviewedChange={onMetaDescriptionReviewedChange}
              isEnhancing={isMetaDescriptionEnhancing}
            />
            <CharCounter value={metaDescriptionEnhanced} limit={160} />
          </div>

          {/* 4. Trip Types */}
          <TripTypesField
            selected={selectedTripTypes}
            onChange={onTripTypesChange}
          />

          {/* 5. Answer Capsule */}
          <div className="border-b border-kiuli-gray">
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
                Answer Capsule
              </span>
            </div>
            <p className="px-3 pb-1 text-[10px] text-[#888]">
              40–60 words. Optimised for AI search extraction.
            </p>
            <div className="px-3">
              <textarea
                value={answerCapsule}
                onChange={(e) => onAnswerCapsuleChange(e.target.value)}
                rows={3}
                placeholder="Write your answer capsule..."
                className="w-full resize-y rounded border border-kiuli-gray bg-white px-3 py-2 font-sans text-[12px] text-kiuli-charcoal outline-none placeholder:text-[#BBB] focus:border-kiuli-teal"
              />
            </div>
            <WordCounter value={answerCapsule} />
            <div className="flex items-center gap-2 border-t border-kiuli-gray px-3 py-1.5">
              <input
                type="checkbox"
                id="reviewed-answer-capsule"
                checked={answerCapsuleReviewed}
                onChange={(e) => onAnswerCapsuleReviewedChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-kiuli-gray"
                style={{ accentColor: "#486A6A" }}
              />
              <label
                htmlFor="reviewed-answer-capsule"
                className="text-[11px] text-[#666]"
              >
                Reviewed
              </label>
            </div>
          </div>

          {/* 6. Focus Keyword */}
          <div>
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
                Focus Keyword
              </span>
            </div>
            <p className="px-3 pb-1 text-[10px] text-[#888]">
              Primary SEO keyword this itinerary targets
            </p>
            <div className="px-3 pb-2">
              <input
                value={focusKeyword}
                onChange={(e) => onFocusKeywordChange(e.target.value)}
                placeholder="Enter focus keyword..."
                className="h-[30px] w-full rounded border border-kiuli-gray bg-white px-2.5 font-sans text-[12px] text-kiuli-charcoal outline-none placeholder:text-[#BBB] focus:border-kiuli-teal"
              />
            </div>
            <div className="flex items-center gap-2 border-t border-kiuli-gray px-3 py-1.5">
              <input
                type="checkbox"
                id="reviewed-focus-keyword"
                checked={focusKeywordReviewed}
                onChange={(e) => onFocusKeywordReviewedChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-kiuli-gray"
                style={{ accentColor: "#486A6A" }}
              />
              <label
                htmlFor="reviewed-focus-keyword"
                className="text-[11px] text-[#666]"
              >
                Reviewed
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
