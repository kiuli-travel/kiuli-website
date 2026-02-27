"use client"

import { useId } from "react"
import { TierSelector } from "./TierSelector"

export type InvestmentTier = "essential" | "classic" | "premium" | "ultra" | null

interface EditorialFieldProps {
  label: string
  helper: string
  itrvlValue: string
  enhancedValue: string
  reviewed: boolean
  onEnhancedChange: (v: string) => void
  onEnhance: () => Promise<void>
  onReviewedChange: (v: boolean) => void
  isEnhancing?: boolean
  minHeight?: string
}

function getReviewedState(enhancedValue: string, reviewed: boolean): "unreviewed" | "enhanced" | "reviewed" {
  if (reviewed) return "reviewed"
  if (enhancedValue.trim().length > 0) return "enhanced"
  return "unreviewed"
}

function getBorderColor(state: "unreviewed" | "enhanced" | "reviewed"): string {
  switch (state) {
    case "reviewed": return "border-l-[#16A34A]"
    case "enhanced": return "border-l-[#D97706]"
    case "unreviewed": return "border-l-[#DC2626]"
  }
}

function InvestmentEditorialUnit({
  label,
  helper,
  itrvlValue,
  enhancedValue,
  reviewed,
  onEnhancedChange,
  onEnhance,
  onReviewedChange,
  isEnhancing = false,
  minHeight = "56px",
}: EditorialFieldProps) {
  const id = useId()
  const state = getReviewedState(enhancedValue, reviewed)
  const borderColor = getBorderColor(state)

  return (
    <div className="border-t border-kiuli-gray">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
          {label}
        </span>
      </div>
      <div className="px-3 pb-1">
        <span className="text-[10px] text-[#888]">{helper}</span>
      </div>

      <div className={`mx-3 mb-2 border-l-4 ${borderColor} rounded`}>
        <div className="grid grid-cols-[1fr_36px_1fr]">
          <div
            className="bg-kiuli-ivory p-1.5 px-2.5 text-[12px] text-[#666]"
            style={{ minHeight }}
          >
            {itrvlValue || (
              <span className="italic text-[#aaa]">No iTrvl content</span>
            )}
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={onEnhance}
              disabled={isEnhancing}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-kiuli-ivory disabled:opacity-50 text-kiuli-clay ${isEnhancing ? "animate-pulse" : ""}`}
              aria-label={`Enhance ${label.toLowerCase()}`}
            >
              ✨
            </button>
          </div>

          <textarea
            value={enhancedValue}
            onChange={(e) => onEnhancedChange(e.target.value)}
            className="resize-none bg-white p-1.5 px-2.5 text-[12px] text-kiuli-charcoal outline-none focus:ring-1 focus:ring-kiuli-teal/30"
            style={{ minHeight }}
            placeholder="Enhanced content..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-kiuli-gray px-3 py-[5px]">
        <input
          type="checkbox"
          id={`${id}-reviewed`}
          checked={reviewed}
          onChange={(e) => onReviewedChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-kiuli-gray"
          style={{ accentColor: "#486A6A" }}
        />
        <label
          htmlFor={`${id}-reviewed`}
          className={`text-[11px] ${reviewed ? "font-medium text-[#16A34A]" : "text-[#888]"}`}
        >
          Reviewed
        </label>
      </div>
    </div>
  )
}

function InvestmentStatusBadge({
  current,
  total,
  isBlocker,
  blockerText = "Required",
}: {
  current: number
  total: number
  isBlocker?: boolean
  blockerText?: string
}) {
  if (isBlocker) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[10px] font-medium text-[#DC2626]">
        {blockerText}
      </span>
    )
  }

  const isComplete = current === total && total > 0
  const bgColor = isComplete ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]"
  const textColor = isComplete ? "text-[#16A34A]" : "text-[#D97706]"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${bgColor} ${textColor}`}
    >
      {current}/{total}
    </span>
  )
}

interface InvestmentAccordionProps {
  isOpen: boolean
  onToggle: () => void
  selectedTier: InvestmentTier
  onTierChange: (tier: InvestmentTier) => void
  calloutItrvl: string
  calloutEnhanced: string
  calloutReviewed: boolean
  onCalloutChange: (v: string) => void
  onCalloutEnhance: () => Promise<void>
  onCalloutReviewedChange: (v: boolean) => void
  isCalloutEnhancing?: boolean
  inclusionsItrvl: string
  inclusionsEnhanced: string
  inclusionsReviewed: boolean
  onInclusionsChange: (v: string) => void
  onInclusionsEnhance: () => Promise<void>
  onInclusionsReviewedChange: (v: boolean) => void
  isInclusionsEnhancing?: boolean
  investmentReviewed: boolean
  onInvestmentReviewedChange: (v: boolean) => void
  className?: string
}

export default function InvestmentAccordion({
  isOpen,
  onToggle,
  selectedTier,
  onTierChange,
  calloutItrvl,
  calloutEnhanced,
  calloutReviewed,
  onCalloutChange,
  onCalloutEnhance,
  onCalloutReviewedChange,
  isCalloutEnhancing,
  inclusionsItrvl,
  inclusionsEnhanced,
  inclusionsReviewed,
  onInclusionsChange,
  onInclusionsEnhance,
  onInclusionsReviewedChange,
  isInclusionsEnhancing,
  investmentReviewed,
  onInvestmentReviewedChange,
  className = "",
}: InvestmentAccordionProps) {
  const id = useId()
  const isBlocker = selectedTier === null
  const reviewedCount = investmentReviewed ? 1 : 0

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-[44px] w-full cursor-pointer items-center border border-kiuli-gray px-3 ${
          isOpen ? "rounded-t-[6px] rounded-b-none" : "rounded-[6px]"
        } bg-white transition-colors hover:bg-[#FAFAFA]`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`mr-2 h-4 w-4 text-kiuli-teal transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        >
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] font-medium text-kiuli-charcoal">Investment Level</span>
        <span className="ml-auto">
          <InvestmentStatusBadge current={reviewedCount} total={1} isBlocker={isBlocker} blockerText="Required" />
        </span>
      </button>

      {isOpen && (
        <div className="rounded-b-[6px] border border-t-0 border-kiuli-gray bg-white">
          <TierSelector selectedTier={selectedTier} onTierChange={onTierChange} />

          <InvestmentEditorialUnit
            label="Investment Callout"
            helper="Short text shown to the prospect on the itinerary page. 1-2 sentences."
            itrvlValue={calloutItrvl}
            enhancedValue={calloutEnhanced}
            reviewed={calloutReviewed}
            onEnhancedChange={onCalloutChange}
            onEnhance={onCalloutEnhance}
            onReviewedChange={onCalloutReviewedChange}
            isEnhancing={isCalloutEnhancing}
            minHeight="56px"
          />

          <InvestmentEditorialUnit
            label="What's Included"
            helper="List what is included in the investment. Displayed on the itinerary page."
            itrvlValue={inclusionsItrvl}
            enhancedValue={inclusionsEnhanced}
            reviewed={inclusionsReviewed}
            onEnhancedChange={onInclusionsChange}
            onEnhance={onInclusionsEnhance}
            onReviewedChange={onInclusionsReviewedChange}
            isEnhancing={isInclusionsEnhancing}
            minHeight="80px"
          />

          <div className="flex items-center justify-between border-t border-kiuli-gray px-3 py-2.5">
            <span className="text-[12px] text-[#666]">Mark investment section as complete</span>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${id}-investment-reviewed`}
                checked={investmentReviewed}
                onChange={(e) => onInvestmentReviewedChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-kiuli-gray"
                style={{ accentColor: "#486A6A" }}
              />
              <label
                htmlFor={`${id}-investment-reviewed`}
                className={`text-[12px] ${investmentReviewed ? "font-medium text-[#16A34A]" : "text-[#666]"}`}
              >
                Investment Reviewed
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
