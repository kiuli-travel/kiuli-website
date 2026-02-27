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

const BADGE_STYLES: Record<SegmentType, { bg: string; text: string; label: string }> = {
  transfer: { bg: "#E8EFEF", text: "#486A6A", label: "\u2708 TRANSFER" },
  stay: { bg: "#FDEEE9", text: "#DA7A5A", label: "\uD83C\uDFE0 STAY" },
  activity: { bg: "#EFF6FF", text: "#2563EB", label: "\u26A1 ACTIVITY" },
}

const STATE_COLORS = {
  unreviewed: { border: "#DC2626", bg: "#FFFAFA", label: "UNREVIEWED", labelColor: "#DC2626" },
  enhanced: { border: "#D97706", bg: "#FFFEF5", label: "ENHANCED", labelColor: "#D97706" },
  reviewed: { border: "#16A34A", bg: "#FAFFFE", label: "REVIEWED", labelColor: "#16A34A" },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCardState(
  isReviewed: boolean,
  descriptionEnhanced: string,
  titleEnhanced?: string,
  inclusionsEnhanced?: string,
): "unreviewed" | "enhanced" | "reviewed" {
  if (isReviewed) return "reviewed"
  const hasEnhanced =
    descriptionEnhanced.trim().length > 0 ||
    (titleEnhanced?.trim().length ?? 0) > 0 ||
    (inclusionsEnhanced?.trim().length ?? 0) > 0
  if (hasEnhanced) return "enhanced"
  return "unreviewed"
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "8px 12px 4px", fontSize: 10, color: "#888", fontWeight: 400 }}>
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
      className="bg-kiuli-clay"
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: "none",
        cursor: isEnhancing ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        flexShrink: 0,
        opacity: isEnhancing ? 0.6 : 1,
        transition: "opacity 150ms",
      }}
      aria-label="Enhance with AI"
    >
      {isEnhancing ? (
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      ) : (
        <span role="img" aria-hidden="true">
          ✨
        </span>
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
  const minH = isTextarea ? 56 : 30

  return (
    <div
      className="flex w-full border-y border-kiuli-gray"
    >
      {/* Left — iTrvl original (read-only) */}
      <div
        className="bg-kiuli-ivory"
        style={{
          width: "45%",
          padding: "6px 10px",
          fontSize: 12,
          color: "#666",
          minHeight: minH,
          lineHeight: 1.5,
          flexShrink: 0,
        }}
      >
        {isTextarea ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{itrvlValue}</div>
        ) : (
          <div
            style={{
              height: 30,
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
        className="border-x border-kiuli-gray"
        style={{
          width: 36,
          background: "#F0EEEA",
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
            placeholder="Enhanced copy..."
            className="text-kiuli-charcoal"
            style={{
              width: "100%",
              height: "100%",
              minHeight: minH,
              padding: "6px 10px",
              fontSize: 12,
              border: "none",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.5,
              background: "transparent",
            }}
          />
        ) : (
          <input
            type="text"
            value={enhancedValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enhanced copy..."
            className="text-kiuli-charcoal"
            style={{
              width: "100%",
              height: 30,
              padding: "6px 10px",
              fontSize: 12,
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
  const state = getCardState(isReviewed, descriptionEnhanced, titleEnhanced, inclusionsEnhanced)
  const stateStyle = STATE_COLORS[state]
  const badge = BADGE_STYLES[type]

  return (
    <div
      className={`border border-kiuli-gray ${className ?? ""}`}
      style={{
        borderRadius: 6,
        borderLeft: `4px solid ${stateStyle.border}`,
        overflow: "hidden",
        background: "#FFFFFF",
        transition: "border-color 200ms",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          background: stateStyle.bg,
          transition: "background-color 200ms",
        }}
      >
        {/* Type badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 20,
            padding: "0 8px",
            borderRadius: 999,
            background: badge.bg,
            color: badge.text,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>

        {/* Segment name */}
        <span
          className="text-kiuli-charcoal"
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {segmentName}
        </span>

        {/* Status label */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            color: stateStyle.labelColor,
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {stateStyle.label}
        </span>
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
        className="flex items-center border-t border-kiuli-gray"
        style={{
          height: 32,
          padding: "6px 12px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 12,
            color: isReviewed ? "#16A34A" : "#404040",
            fontWeight: isReviewed ? 500 : 400,
            transition: "color 200ms, font-weight 200ms",
          }}
        >
          <input
            type="checkbox"
            checked={isReviewed}
            onChange={(e) => onReviewedChange(e.target.checked)}
            style={{ width: 13, height: 13, accentColor: "#486A6A" }}
          />
          Reviewed
        </label>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
