"use client"

import { useId, useState } from "react"

export interface EditorialUnitProps {
  fieldLabel: string
  itrvlValue: string
  enhancedValue: string
  isReviewed: boolean
  multiline?: boolean
  onEnhancedChange: (value: string) => void
  onReviewedChange: (checked: boolean) => void
  onEnhance: () => Promise<void>
  isEnhancing?: boolean
  className?: string
}

type UnitState = "unreviewed" | "enhanced" | "reviewed"

function getState(isReviewed: boolean, enhancedValue: string): UnitState {
  if (isReviewed) return "reviewed"
  if (enhancedValue.trim().length > 0) return "enhanced"
  return "unreviewed"
}

const stateStyles = {
  unreviewed: {
    border: "#DADADA",
    headerBg: "#FAFAF8",
    bodyBg: "#FFFFFF",
    label: "",
    labelColor: "transparent",
  },
  enhanced: {
    border: "#D97706",
    headerBg: "rgba(254,243,199,0.25)",
    bodyBg: "#FFFEF5",
    label: "ENHANCED",
    labelColor: "#D97706",
  },
  reviewed: {
    border: "#16A34A",
    headerBg: "rgba(220,252,231,0.25)",
    bodyBg: "#FAFFFE",
    label: "REVIEWED",
    labelColor: "#16A34A",
  },
} as const

function Spinner() {
  return (
    <svg
      className="animate-spin"
      style={{ width: 14, height: 14 }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export default function EditorialUnit({
  fieldLabel,
  itrvlValue,
  enhancedValue,
  isReviewed,
  multiline = false,
  onEnhancedChange,
  onReviewedChange,
  onEnhance,
  isEnhancing = false,
  className = "",
}: EditorialUnitProps) {
  const state = getState(isReviewed, enhancedValue)
  const styles = stateStyles[state]
  const enhancedId = useId()
  const checkboxId = useId()
  const hasEnhancedContent = enhancedValue.trim().length > 0
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className={`rounded-[6px] overflow-hidden transition-all duration-200 ${className}`}
      style={{
        borderLeft: `4px solid ${styles.border}`,
        background: styles.bodyBg,
      }}
    >
      {/* Header row — 32px */}
      <div
        className="flex items-center justify-between border-b border-kiuli-gray"
        style={{
          height: 32,
          padding: "0 12px",
          background: styles.headerBg,
        }}
      >
        <span
          className="font-medium text-kiuli-charcoal"
          style={{ fontSize: 12 }}
        >
          {fieldLabel}
        </span>
        <span
          className="font-medium uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: styles.labelColor,
          }}
        >
          {styles.label}
        </span>
      </div>

      {/* Content area — three columns */}
      <div className="flex" style={{ minHeight: multiline ? 64 : 34 }}>
        {/* iTrvl original column — 45% */}
        <div
          className="flex-none bg-kiuli-ivory"
          style={{
            width: "45%",
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.4,
            color: "#666",
          }}
        >
          {multiline ? (
            <div
              className="whitespace-pre-wrap select-text"
              style={{ minHeight: 48 }}
              role="textbox"
              aria-readonly="true"
              aria-label={`${fieldLabel} original value`}
            >
              {itrvlValue || (
                <span className="italic" style={{ color: "#aaa" }}>
                  No iTrvl content
                </span>
              )}
            </div>
          ) : (
            <div
              className="truncate select-text"
              style={{ lineHeight: "18px" }}
              role="textbox"
              aria-readonly="true"
              aria-label={`${fieldLabel} original value`}
            >
              {itrvlValue || (
                <span className="italic" style={{ color: "#aaa" }}>
                  No iTrvl content
                </span>
              )}
            </div>
          )}
        </div>

        {/* Button column — 44px */}
        <div
          className="flex-none flex items-center justify-center relative border-x border-kiuli-gray"
          style={{
            width: 44,
            background: "#F0EEEA",
          }}
        >
          <button
            type="button"
            onClick={onEnhance}
            disabled={isEnhancing}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label={hasEnhancedContent ? "Re-enhance with AI" : "Enhance with AI"}
            className="flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed bg-kiuli-clay hover:scale-105"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              fontSize: 14,
              ...(isEnhancing ? { background: "#c4937f" } : {}),
            }}
          >
            {isEnhancing ? <Spinner /> : "✨"}
          </button>
          {/* Tooltip */}
          {showTooltip && !isEnhancing && (
            <div
              className="absolute z-10 whitespace-nowrap pointer-events-none"
              style={{
                top: "50%",
                left: "100%",
                transform: "translateY(-50%)",
                marginLeft: 6,
                padding: "3px 8px",
                borderRadius: 4,
                background: "#333",
                color: "#fff",
                fontSize: 10,
                lineHeight: 1.4,
              }}
            >
              {hasEnhancedContent ? "Re-enhance" : "Enhance with AI"}
            </div>
          )}
        </div>

        {/* Enhanced column — remaining */}
        <div
          className="flex-1 min-w-0"
          style={{
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.4,
            background: "white",
          }}
        >
          {multiline ? (
            <textarea
              id={enhancedId}
              value={enhancedValue}
              onChange={(e) => onEnhancedChange(e.target.value)}
              placeholder="Type or click Enhance..."
              className="w-full resize-y border-none bg-transparent p-0 focus:outline-none placeholder:text-[#aaa] text-kiuli-charcoal"
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                minHeight: 48,
              }}
              aria-label={`${fieldLabel} enhanced value`}
            />
          ) : (
            <input
              id={enhancedId}
              type="text"
              value={enhancedValue}
              onChange={(e) => onEnhancedChange(e.target.value)}
              placeholder="Type or click Enhance..."
              className="w-full border-none bg-transparent p-0 focus:outline-none placeholder:text-[#aaa] text-kiuli-charcoal"
              style={{
                fontSize: 12,
                lineHeight: "18px",
              }}
              aria-label={`${fieldLabel} enhanced value`}
            />
          )}
        </div>
      </div>

      {/* Footer row — 28px */}
      <div
        className="flex items-center border-t border-kiuli-gray"
        style={{
          height: 28,
          padding: "0 12px",
          gap: 6,
        }}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={isReviewed}
          onChange={(e) => onReviewedChange(e.target.checked)}
          className="cursor-pointer"
          style={{ width: 14, height: 14, accentColor: "#486A6A" }}
        />
        <label
          htmlFor={checkboxId}
          className="cursor-pointer select-none transition-colors"
          style={{
            fontSize: 12,
            fontWeight: isReviewed ? 500 : 400,
            color: isReviewed ? "#16A34A" : "#404040",
          }}
        >
          Reviewed
        </label>
      </div>
    </div>
  )
}
