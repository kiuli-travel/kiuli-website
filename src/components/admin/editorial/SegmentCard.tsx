"use client"

import { useState, type ReactNode } from "react"
import { ImageStrip, type StripImage } from "./ImageStrip"

// ─── Types ───────────────────────────────────────────────────────────────────

type SegmentType = "transfer" | "stay" | "activity"

interface SegmentCardProps {
  type: SegmentType
  segmentName: string

  descriptionItrvl: string
  descriptionEnhanced: string
  onDescriptionChange: (value: string) => void
  onDescriptionEnhance: () => Promise<void>
  isDescriptionEnhancing?: boolean

  titleItrvl?: string
  titleEnhanced?: string
  onTitleChange?: (value: string) => void
  onTitleEnhance?: () => Promise<void>
  isTitleEnhancing?: boolean

  inclusionsItrvl?: string
  inclusionsEnhanced?: string
  onInclusionsChange?: (value: string) => void
  onInclusionsEnhance?: () => Promise<void>
  isInclusionsEnhancing?: boolean

  images?: StripImage[]
  imagesReviewed?: boolean
  onImagesReviewedChange?: (checked: boolean) => void
  onAddImage?: () => void
  onRemoveImage?: (id: string) => void

  isReviewed: boolean
  onReviewedChange: (checked: boolean) => void

  className?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

// A1: Each segment type gets its own distinct visual identity
const TYPE_STYLES: Record<SegmentType, {
  accent: string        // Left border + badge text
  badgeBg: string       // Badge background
  cardBg: string        // Card body background tint
  headerBg: string      // Header background
  icon: string          // Type icon
  label: string         // Type label
}> = {
  transfer: {
    accent: "#486A6A",
    badgeBg: "#E8EFEF",
    cardBg: "#F7FAFA",
    headerBg: "#EDF3F3",
    icon: "\u2708",
    label: "TRANSFER",
  },
  stay: {
    accent: "#DA7A5A",
    badgeBg: "#FDEEE9",
    cardBg: "#FFFBF9",
    headerBg: "#FDF3EF",
    icon: "\uD83C\uDFE8",
    label: "STAY",
  },
  activity: {
    accent: "#7C6BBF",
    badgeBg: "#F0EDFB",
    cardBg: "#FAFAFF",
    headerBg: "#F3F1FC",
    icon: "\u26A1",
    label: "ACTIVITY",
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasEnhancedContent(
  descriptionEnhanced: string,
  titleEnhanced?: string,
  inclusionsEnhanced?: string,
): boolean {
  return (
    descriptionEnhanced.trim().length > 0 ||
    (titleEnhanced?.trim().length ?? 0) > 0 ||
    (inclusionsEnhanced?.trim().length ?? 0) > 0
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "6px 12px 3px", fontSize: 10, color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </div>
  )
}

function EnhanceButton({
  onClick,
  isEnhancing,
}: {
  onClick: () => void
  isEnhancing?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isEnhancing}
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        border: "none",
        background: "#DA7A5A",
        cursor: isEnhancing ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        flexShrink: 0,
        opacity: isEnhancing ? 0.6 : 1,
        transition: "opacity 150ms, transform 150ms",
        color: "white",
      }}
      aria-label="Enhance with AI"
      onMouseEnter={(e) => {
        if (!isEnhancing) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"
      }}
    >
      {isEnhancing ? (
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="white" />
        </svg>
      )}
    </button>
  )
}

function EditorialField({
  itrvlValue,
  enhancedValue,
  onChange,
  onEnhance,
  isEnhancing,
  variant = "textarea",
}: {
  itrvlValue: string
  enhancedValue: string
  onChange: (value: string) => void
  onEnhance: () => Promise<void>
  isEnhancing?: boolean
  variant?: "textarea" | "input"
}) {
  const isTextarea = variant === "textarea"
  const minH = isTextarea ? 48 : 28

  return (
    <div
      className="flex w-full"
      style={{ borderTop: "1px solid #E8E6E0", borderBottom: "1px solid #E8E6E0" }}
    >
      {/* Left — iTrvl original (read-only) */}
      <div
        style={{
          width: "45%",
          padding: "5px 10px",
          fontSize: 12,
          color: "#888",
          minHeight: minH,
          lineHeight: 1.45,
          flexShrink: 0,
          background: "rgba(0,0,0,0.02)",
        }}
      >
        {isTextarea ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{itrvlValue}</div>
        ) : (
          <div
            style={{
              height: 28,
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {itrvlValue}
          </div>
        )}
      </div>

      {/* Center — enhance button */}
      <div
        style={{
          width: 40,
          borderLeft: "1px solid #E8E6E0",
          borderRight: "1px solid #E8E6E0",
          background: "#F5F3EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <EnhanceButton onClick={onEnhance} isEnhancing={isEnhancing} />
      </div>

      {/* Right — enhanced value (editable) */}
      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          minHeight: minH,
        }}
      >
        {isTextarea ? (
          <textarea
            value={enhancedValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Click \u2728 to enhance, or type directly..."
            style={{
              width: "100%",
              height: "100%",
              minHeight: minH,
              padding: "5px 10px",
              fontSize: 12,
              color: "#404040",
              border: "none",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.45,
              background: "transparent",
            }}
          />
        ) : (
          <input
            type="text"
            value={enhancedValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Click \u2728 to enhance, or type directly..."
            style={{
              width: "100%",
              height: 28,
              padding: "5px 10px",
              fontSize: 12,
              color: "#404040",
              border: "none",
              outline: "none",
              fontFamily: "inherit",
              background: "transparent",
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Collapsed Row ───────────────────────────────────────────────────────────

function CollapsedRow({
  type,
  segmentName,
  isReviewed,
  hasEnhanced,
  onToggle,
}: {
  type: SegmentType
  segmentName: string
  isReviewed: boolean
  hasEnhanced: boolean
  onToggle: () => void
}) {
  const typeStyle = TYPE_STYLES[type]

  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        height: 36,
        padding: "0 10px",
        gap: 8,
        cursor: "pointer",
        borderRadius: 6,
        border: "1px solid #E8E6E0",
        borderLeft: `4px solid ${typeStyle.accent}`,
        background: isReviewed ? "#FAFFFE" : typeStyle.cardBg,
        transition: "background 150ms, box-shadow 150ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)"
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none"
      }}
    >
      {/* Expand chevron */}
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M6 4L10 8L6 12" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Type badge — compact */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          color: typeStyle.accent,
          background: typeStyle.badgeBg,
          padding: "2px 6px",
          borderRadius: 3,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        {typeStyle.icon} {typeStyle.label}
      </span>

      {/* Name */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 500,
          color: "#404040",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {segmentName}
      </span>

      {/* Status indicators */}
      {isReviewed ? (
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <rect width="14" height="14" rx="3" fill="#16A34A" />
            <path d="M3.5 7L6 9.5L10.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : hasEnhanced ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            color: "#D97706",
            background: "#FEF3C7",
            padding: "1px 6px",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          ENHANCED
        </span>
      ) : null}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SegmentCard({
  type,
  segmentName,
  descriptionItrvl,
  descriptionEnhanced,
  onDescriptionChange,
  onDescriptionEnhance,
  isDescriptionEnhancing,
  titleItrvl,
  titleEnhanced,
  onTitleChange,
  onTitleEnhance,
  isTitleEnhancing,
  inclusionsItrvl,
  inclusionsEnhanced,
  onInclusionsChange,
  onInclusionsEnhance,
  isInclusionsEnhancing,
  images,
  imagesReviewed,
  onImagesReviewedChange,
  onAddImage,
  onRemoveImage,
  isReviewed,
  onReviewedChange,
  className,
}: SegmentCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const typeStyle = TYPE_STYLES[type]
  const enhanced = hasEnhancedContent(descriptionEnhanced, titleEnhanced, inclusionsEnhanced)

  // A2: Collapsed view — single compact row
  if (isCollapsed) {
    return (
      <CollapsedRow
        type={type}
        segmentName={segmentName}
        isReviewed={isReviewed}
        hasEnhanced={enhanced}
        onToggle={() => setIsCollapsed(false)}
      />
    )
  }

  return (
    <div
      className={className ?? ""}
      style={{
        borderRadius: 6,
        border: "1px solid #E8E6E0",
        borderLeft: `4px solid ${typeStyle.accent}`,
        overflow: "hidden",
        background: typeStyle.cardBg,
        transition: "border-color 200ms, box-shadow 200ms",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 8,
          background: typeStyle.headerBg,
        }}
      >
        {/* Collapse chevron */}
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Collapse segment"
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Type badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 18,
            padding: "0 7px",
            borderRadius: 3,
            background: typeStyle.badgeBg,
            color: typeStyle.accent,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {typeStyle.icon} {typeStyle.label}
        </span>

        {/* Segment name */}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: "#404040",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {segmentName}
        </span>

        {/* A5: Status — only show when reviewed or enhanced, no UNREVIEWED label */}
        {isReviewed ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <rect width="14" height="14" rx="3" fill="#16A34A" />
              <path d="M3.5 7L6 9.5L10.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#16A34A" }}>REVIEWED</span>
          </span>
        ) : enhanced ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: "#D97706",
              background: "#FEF3C7",
              padding: "2px 7px",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            ENHANCED
          </span>
        ) : null}
      </div>

      {/* ── Body ── */}
      <div>
        {/* Description (all variants) */}
        <FieldLabel>Description</FieldLabel>
        <EditorialField
          itrvlValue={descriptionItrvl}
          enhancedValue={descriptionEnhanced}
          onChange={onDescriptionChange}
          onEnhance={onDescriptionEnhance}
          isEnhancing={isDescriptionEnhancing}
          variant="textarea"
        />

        {/* Title (stay + activity only) */}
        {type !== "transfer" && titleItrvl !== undefined && onTitleChange && onTitleEnhance && (
          <>
            <FieldLabel>
              {type === "stay" ? "Property Name" : "Title"}
            </FieldLabel>
            <EditorialField
              itrvlValue={titleItrvl}
              enhancedValue={titleEnhanced ?? ""}
              onChange={onTitleChange}
              onEnhance={onTitleEnhance}
              isEnhancing={isTitleEnhancing}
              variant="input"
            />
          </>
        )}

        {/* Inclusions (stay only) */}
        {type === "stay" &&
          inclusionsItrvl !== undefined &&
          onInclusionsChange &&
          onInclusionsEnhance && (
            <>
              <FieldLabel>Inclusions</FieldLabel>
              <EditorialField
                itrvlValue={inclusionsItrvl}
                enhancedValue={inclusionsEnhanced ?? ""}
                onChange={onInclusionsChange}
                onEnhance={onInclusionsEnhance}
                isEnhancing={isInclusionsEnhancing}
                variant="textarea"
              />
            </>
          )}

        {/* Images (stay + activity) */}
        {(type === "stay" || type === "activity") && images && onImagesReviewedChange && onAddImage && onRemoveImage && (
          <ImageStrip
            images={images}
            imagesReviewed={imagesReviewed ?? false}
            onImagesReviewedChange={onImagesReviewedChange}
            onAddImage={onAddImage}
            onRemoveImage={onRemoveImage}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 10px",
          borderTop: "1px solid #E8E6E0",
          background: isReviewed ? "#F0FFF4" : "transparent",
          transition: "background 200ms",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 11,
            color: isReviewed ? "#16A34A" : "#666",
            fontWeight: isReviewed ? 500 : 400,
            transition: "color 200ms",
          }}
        >
          <input
            type="checkbox"
            checked={isReviewed}
            onChange={(e) => onReviewedChange(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "#486A6A" }}
          />
          Mark as reviewed
        </label>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
