"use client"

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"

// ----- Types -----
type SegmentType = "transfer" | "stay" | "activity"

interface SegmentSummary {
  id: string
  type: SegmentType
  name: string
  isReviewed: boolean
  hasEnhancedContent: boolean
}

interface DayAccordionProps {
  dayNumber: number
  dayTitleItrvl: string
  dayTitleEnhanced: string
  dayTitleReviewed: boolean
  segments: SegmentSummary[]
  isOpen: boolean
  onToggle: () => void
  onDayTitleChange: (value: string) => void
  onDayTitleEnhance: () => Promise<void>
  onDayTitleReviewedChange: (checked: boolean) => void
  onEnhanceAll: () => Promise<void>
  onMarkAllReviewed: () => void
  isDayTitleEnhancing?: boolean
  isEnhancingAll?: boolean
  children?: ReactNode
  className?: string
}

// ----- Helpers -----
const SEGMENT_TYPE_COLORS: Record<SegmentType, string> = {
  transfer: "#486A6A",
  stay: "#DA7A5A",
  activity: "#D97706",
}

const SEGMENT_TYPE_LABELS: Record<SegmentType, string> = {
  transfer: "Transfer",
  stay: "Stay",
  activity: "Activity",
}

function getProgressBadge(reviewed: number, total: number) {
  if (reviewed === 0) {
    return { bg: "#FEE2E2", text: "#DC2626" }
  }
  if (reviewed === total) {
    return { bg: "#DCFCE7", text: "#16A34A" }
  }
  return { bg: "#FEF3C7", text: "#D97706" }
}

// ----- Sparkle Icon -----
function SparkleIcon({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
        fill={color}
      />
    </svg>
  )
}

// ----- Spinner -----
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ----- Chevron Icon -----
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 200ms ease",
        flexShrink: 0,
      }}
    >
      <path d="M6 4L10 8L6 12" stroke="#486A6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ----- Pencil Icon -----
function PencilIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.474 5.408l2.118 2.117m-.756-3.982L12.109 9.27a2.118 2.118 0 00-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 10-2.621-2.621z"
        stroke="#888"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 15v3a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h3"
        stroke="#888"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ----- Checkbox Icon -----
function CheckIcon({ checked }: { checked: boolean }) {
  if (!checked) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          border: "1.5px solid #DADADA",
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="14" height="14" rx="3" fill="#486A6A" />
      <path d="M3.5 7L6 9.5L10.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ----- Segment Placeholder Card -----
function SegmentPlaceholderCard({ segment }: { segment: SegmentSummary }) {
  const [reviewed, setReviewed] = useState(segment.isReviewed)
  const borderColor = SEGMENT_TYPE_COLORS[segment.type]

  const statusLabel = segment.isReviewed
    ? "Reviewed"
    : segment.hasEnhancedContent
      ? "Enhanced"
      : "Pending"

  const statusStyle = segment.isReviewed
    ? { bg: "#DCFCE7", text: "#16A34A" }
    : segment.hasEnhancedContent
      ? { bg: "#FEF3C7", text: "#D97706" }
      : { bg: "#FEE2E2", text: "#DC2626" }

  return (
    <div
      style={{
        border: "1px solid #DADADA",
        borderRadius: 6,
        borderLeft: `4px solid ${borderColor}`,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          background: "white",
        }}
      >
        {/* Type badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            color: borderColor,
            background: `${borderColor}14`,
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: "0.02em",
          }}
        >
          {SEGMENT_TYPE_LABELS[segment.type]}
        </span>
        {/* Name */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#404040",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {segment.name}
        </span>
        {/* Status label */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: statusStyle.text,
            background: statusStyle.bg,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {statusLabel}
        </span>
      </div>
      {/* Content placeholder */}
      <div
        style={{
          height: 36,
          background: "#F5F3EB",
          margin: "0 10px",
          borderRadius: 4,
        }}
      />
      {/* Footer row */}
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 6,
          borderTop: "1px solid #DADADA",
          marginTop: 6,
          cursor: "pointer",
        }}
        onClick={() => setReviewed(!reviewed)}
      >
        <CheckIcon checked={reviewed} />
        <span style={{ fontSize: 11, color: "#666" }}>Reviewed</span>
      </div>
    </div>
  )
}

// ----- DayAccordion Component -----
export default function DayAccordion({
  dayNumber,
  dayTitleItrvl,
  dayTitleEnhanced,
  dayTitleReviewed,
  segments,
  isOpen,
  onToggle,
  onDayTitleChange,
  onDayTitleEnhance,
  onDayTitleReviewedChange,
  onEnhanceAll,
  onMarkAllReviewed,
  isDayTitleEnhancing = false,
  isEnhancingAll = false,
  children,
  className = "",
}: DayAccordionProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editValue, setEditValue] = useState(
    dayTitleEnhanced || dayTitleItrvl
  )
  const [confirmMarkAll, setConfirmMarkAll] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Day title counts as a reviewable item
  const totalReviewable = segments.length + 1
  const reviewedCount =
    segments.filter((s) => s.isReviewed).length + (dayTitleReviewed ? 1 : 0)
  const progressColors = getProgressBadge(reviewedCount, totalReviewable)

  // Display title for header
  const displayTitle =
    dayTitleEnhanced || dayTitleItrvl || `Day ${dayNumber}`
  const truncatedTitle =
    displayTitle.length > 40
      ? displayTitle.slice(0, 40) + "..."
      : displayTitle

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  const handleTitleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isOpen) return
      setEditValue(dayTitleEnhanced || dayTitleItrvl)
      setIsEditingTitle(true)
    },
    [isOpen, dayTitleEnhanced, dayTitleItrvl]
  )

  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false)
    onDayTitleChange(editValue)
  }, [editValue, onDayTitleChange])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTitleSave()
      }
      if (e.key === "Escape") {
        setIsEditingTitle(false)
      }
    },
    [handleTitleSave]
  )

  return (
    <div className={className}>
      {/* HEADER */}
      <div
        onClick={onToggle}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          cursor: "pointer",
          border: "1px solid #DADADA",
          borderRadius: isOpen ? "6px 6px 0 0" : 6,
          background: isOpen ? "#FAFAFA" : isHeaderHovered ? "#F5F3EB" : "white",
          position: isOpen ? "sticky" : "relative",
          top: isOpen ? 64 : "auto",
          zIndex: isOpen ? 10 : "auto",
          boxShadow: isOpen ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
          borderBottom: isOpen ? "1px solid #DADADA" : undefined,
          transition: "background 150ms ease",
        }}
      >
        {/* Chevron */}
        <ChevronIcon isOpen={isOpen} />

        {/* Gap */}
        <div style={{ width: 8 }} />

        {/* Day badge */}
        <span
          style={{
            background: "#486A6A",
            color: "white",
            fontWeight: 600,
            fontSize: 11,
            padding: "2px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Day {dayNumber}
        </span>

        {/* Gap */}
        <div style={{ width: 10 }} />

        {/* Day title - editable inline */}
        {isEditingTitle ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: "inherit",
              fontWeight: 500,
              fontSize: 14,
              color: "#404040",
              border: "1px solid #486A6A",
              borderRadius: 4,
              padding: "2px 6px",
              outline: "none",
              flex: 1,
              minWidth: 0,
            }}
          />
        ) : (
          <div
            onClick={handleTitleClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              cursor: isOpen ? "text" : "pointer",
            }}
          >
            <span
              style={{
                fontWeight: 500,
                fontSize: 14,
                color: "#404040",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {truncatedTitle}
            </span>
            {isHeaderHovered && (
              <span style={{ flexShrink: 0 }}>
                <PencilIcon />
              </span>
            )}
          </div>
        )}

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* Segment count */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: "#888",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </span>

        {/* Gap */}
        <div style={{ width: 12 }} />

        {/* Progress badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: progressColors.text,
            background: progressColors.bg,
            padding: "2px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {reviewedCount}/{totalReviewable} reviewed
        </span>
      </div>

      {/* PANEL (when open) */}
      {isOpen && (
        <div
          style={{
            border: "1px solid #DADADA",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
          }}
        >
          {/* DAY TITLE EDITORIAL UNIT */}
          <div
            style={{
              background: "white",
              borderBottom: "none",
            }}
          >
            {/* Label row */}
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                color: "#888",
                padding: "8px 12px 4px",
                fontWeight: 500,
                letterSpacing: "0.04em",
              }}
            >
              Day Title
            </div>

            {/* Field pair */}
            <div
              style={{
                display: "flex",
                margin: "0 12px",
                border: "1px solid #DADADA",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {/* Left column - iTrvl title */}
              <div
                style={{
                  flex: 1,
                  height: 32,
                  fontSize: 12,
                  padding: "6px 10px",
                  background: "#F5F3EB",
                  color: "#666",
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {dayTitleItrvl}
              </div>

              {/* Center button column */}
              <div
                style={{
                  width: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#F0EEEA",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={onDayTitleEnhance}
                  disabled={isDayTitleEnhancing}
                  style={{
                    width: 24,
                    height: 24,
                    background: "#DA7A5A",
                    border: "none",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDayTitleEnhancing ? "not-allowed" : "pointer",
                    opacity: isDayTitleEnhancing ? 0.6 : 1,
                  }}
                  aria-label="Enhance day title"
                >
                  {isDayTitleEnhancing ? (
                    <Spinner size={12} />
                  ) : (
                    <SparkleIcon size={14} />
                  )}
                </button>
              </div>

              {/* Right column - Enhanced title */}
              <input
                value={dayTitleEnhanced}
                onChange={(e) => onDayTitleChange(e.target.value)}
                placeholder="Enhanced title..."
                style={{
                  flex: 1,
                  height: 32,
                  fontSize: 12,
                  padding: "6px 10px",
                  background: "white",
                  color: "#404040",
                  border: "none",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Reviewed row */}
            <div
              style={{
                padding: "6px 12px",
                borderTop: "1px solid #DADADA",
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
              onClick={() => onDayTitleReviewedChange(!dayTitleReviewed)}
            >
              <CheckIcon checked={dayTitleReviewed} />
              <span style={{ fontSize: 11, color: "#666" }}>
                Day Title Reviewed
              </span>
            </div>
          </div>

          {/* SEGMENT CARDS */}
          <div
            style={{
              padding: "6px 10px 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {children || segments.map((segment) => (
              <SegmentPlaceholderCard key={segment.id} segment={segment} />
            ))}
          </div>

          {/* BULK ACTIONS */}
          <div
            style={{
              borderTop: "1px solid #DADADA",
              margin: "8px 0 0",
              padding: "8px 10px 12px",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {/* Enhance All Button */}
            <button
              onClick={onEnhanceAll}
              disabled={isEnhancingAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: isEnhancingAll ? "#C46B4D" : "#DA7A5A",
                color: "white",
                fontWeight: 500,
                fontSize: 12,
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: isEnhancingAll ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isEnhancingAll) {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    "#C46B4D"
                }
              }}
              onMouseLeave={(e) => {
                if (!isEnhancingAll) {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    "#DA7A5A"
                }
              }}
            >
              {isEnhancingAll ? (
                <>
                  <Spinner size={12} />
                  <span>{"Enhancing\u2026"}</span>
                </>
              ) : (
                <>
                  <SparkleIcon size={12} />
                  <span>
                    Enhance All Day {dayNumber} Content
                  </span>
                </>
              )}
            </button>

            {/* Mark All Reviewed Button */}
            {confirmMarkAll ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#404040",
                  fontFamily: "inherit",
                }}
              >
                <span>
                  Mark all {totalReviewable} as reviewed?
                </span>
                <button
                  onClick={() => {
                    onMarkAllReviewed()
                    setConfirmMarkAll(false)
                  }}
                  style={{
                    background: "#486A6A",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmMarkAll(false)}
                  style={{
                    background: "white",
                    color: "#666",
                    border: "1px solid #DADADA",
                    borderRadius: 4,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmMarkAll(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "white",
                  color: "#404040",
                  fontWeight: 500,
                  fontSize: 12,
                  border: "1px solid #DADADA",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 150ms ease, color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  btn.style.borderColor = "#486A6A"
                  btn.style.color = "#486A6A"
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  btn.style.borderColor = "#DADADA"
                  btn.style.color = "#404040"
                }}
              >
                <CheckIcon checked={false} />
                <span>
                  Mark All Day {dayNumber} as Reviewed
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
