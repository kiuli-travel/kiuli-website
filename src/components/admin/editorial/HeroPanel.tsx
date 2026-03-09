"use client"

import { useState } from "react"
import { Camera, Video, ChevronRight, ChevronDown, Lock } from "lucide-react"

interface HeroPanelProps {
  heroImageUrl: string | null
  heroImageAlt: string
  isImageLocked: boolean
  isImageReviewed: boolean
  onSelectImage: () => void
  onClearImage: () => void
  onImageLockedChange: (v: boolean) => void
  onImageReviewedChange: (v: boolean) => void

  heroVideoUrl: string | null
  heroVideoName: string
  isVideoReviewed: boolean
  showHeroVideo: boolean
  onVideoReviewedChange: (v: boolean) => void
  onShowHeroVideoChange: (v: boolean) => void

  className?: string
}

function StatusBadge({
  status,
}: {
  status: "reviewed" | "image-set" | "no-image"
}) {
  if (status === "reviewed") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
      >
        Reviewed
      </span>
    )
  }
  if (status === "image-set") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
      >
        Image set
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
    >
      No image
    </span>
  )
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
  helperText,
  checkedStyle,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  helperText: string
  checkedStyle?: { color: string; fontWeight: number }
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded cursor-pointer"
          style={{ accentColor: "#486A6A" }}
        />
        <span
          className="text-xs"
          style={
            checked && checkedStyle
              ? { color: checkedStyle.color, fontWeight: checkedStyle.fontWeight }
              : { color: "#404040", fontWeight: 400 }
          }
        >
          {label}
        </span>
      </label>
      <span className="ml-5.5 text-[10px]" style={{ color: "#888" }}>
        {helperText}
      </span>
    </div>
  )
}

export default function HeroPanel({
  heroImageUrl,
  heroImageAlt,
  isImageLocked,
  isImageReviewed,
  onSelectImage,
  onClearImage,
  onImageLockedChange,
  onImageReviewedChange,
  heroVideoUrl,
  heroVideoName,
  isVideoReviewed,
  showHeroVideo,
  onVideoReviewedChange,
  onShowHeroVideoChange,
  className,
}: HeroPanelProps) {
  const [videoExpanded, setVideoExpanded] = useState(false)

  const hasImage = heroImageUrl !== null
  const hasVideo = heroVideoUrl !== null

  const status: "reviewed" | "image-set" | "no-image" = isImageReviewed
    ? "reviewed"
    : hasImage
      ? "image-set"
      : "no-image"

  return (
    <div className={className}>
      {/* Panel Header */}
      <div
        className="flex h-11 items-center justify-between rounded-t-md px-4"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #DADADA",
        }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "#404040" }}
        >
          Hero Image & Video
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Hero Image Section */}
      <div
        className="p-4"
        style={{
          backgroundColor: "#FFFFFF",
          borderLeft: "1px solid #DADADA",
          borderRight: "1px solid #DADADA",
          borderBottom: "1px solid #DADADA",
        }}
      >
        <div className="flex gap-4">
          {/* Left Column — Image Preview */}
          <div className="shrink-0" style={{ width: 200 }}>
            {hasImage ? (
              <div
                className="relative overflow-hidden rounded-md"
                style={{
                  width: 200,
                  height: 133,
                  backgroundColor: "#C8C0B0",
                }}
              >
                <img
                  src={heroImageUrl!}
                  alt={heroImageAlt}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {isImageLocked && (
                  <div
                    className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.5)",
                      color: "#FFFFFF",
                      fontSize: 10,
                    }}
                  >
                    <Lock className="h-2.5 w-2.5" />
                    <span>Locked</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center rounded-md"
                style={{
                  width: 200,
                  height: 133,
                  border: "2px dashed #DADADA",
                  backgroundColor: "#FAFAFA",
                }}
              >
                <Camera
                  className="mb-1"
                  style={{ width: 24, height: 24, color: "#DADADA" }}
                />
                <span style={{ fontSize: 11, color: "#DADADA" }}>
                  No image selected
                </span>
              </div>
            )}
          </div>

          {/* Right Column — Controls */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {/* Row 1: Alt text */}
            {hasImage && heroImageAlt && (
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "#666" }}
                >
                  Alt text
                </span>
                <p
                  className="line-clamp-2 text-xs"
                  style={{ color: "#404040" }}
                >
                  {heroImageAlt}
                </p>
              </div>
            )}

            {/* Row 2: Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSelectImage}
                className="cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  border: "1px solid #486A6A",
                  color: "#486A6A",
                  backgroundColor: "#FFFFFF",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#F0F5F5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#FFFFFF")
                }
              >
                Select Image
              </button>
              {hasImage && (
                <button
                  type="button"
                  onClick={onClearImage}
                  className="cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    border: "1px solid #DC2626",
                    color: "#DC2626",
                    backgroundColor: "#FFFFFF",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#FEE2E2")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#FFFFFF")
                  }
                >
                  Clear
                </button>
              )}
            </div>

            {/* Row 3: Checkboxes */}
            <div className="flex flex-col gap-2">
              <Checkbox
                id="image-locked"
                checked={isImageLocked}
                onChange={onImageLockedChange}
                label="Hero Image Locked"
                helperText="Lock to prevent auto-replacement on re-scrape"
              />
              <Checkbox
                id="image-reviewed"
                checked={isImageReviewed}
                onChange={onImageReviewedChange}
                label="Hero Image Reviewed"
                helperText="Hero image selection has been reviewed"
                checkedStyle={{ color: "#16A34A", fontWeight: 500 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Video Section — Collapsible Accordion */}
      <div>
        {/* Collapsed Header */}
        <button
          type="button"
          onClick={() => setVideoExpanded((v) => !v)}
          className="flex h-11 w-full cursor-pointer items-center justify-between px-4"
          style={{
            backgroundColor: "#FAFAFA",
            borderTop: "1px solid #DADADA",
            borderLeft: "1px solid #DADADA",
            borderRight: "1px solid #DADADA",
            borderBottom: "1px solid #DADADA",
            borderRadius: videoExpanded ? 0 : "0 0 6px 6px",
          }}
        >
          <div className="flex items-center gap-2">
            {videoExpanded ? (
              <ChevronDown
                className="h-3.5 w-3.5"
                style={{ color: "#486A6A" }}
              />
            ) : (
              <ChevronRight
                className="h-3.5 w-3.5"
                style={{ color: "#486A6A" }}
              />
            )}
            <span
              className="text-[13px] font-medium"
              style={{ color: "#404040" }}
            >
              Hero Video
            </span>
          </div>
          <span className="text-xs" style={{ color: "#888" }}>
            {hasVideo ? heroVideoName : "No video from iTrvl"}
          </span>
        </button>

        {/* Expanded Content */}
        {videoExpanded && (
          <div
            className="rounded-b-md p-4"
            style={{
              backgroundColor: "#FFFFFF",
              borderLeft: "1px solid #DADADA",
              borderRight: "1px solid #DADADA",
              borderBottom: "1px solid #DADADA",
            }}
          >
            <div className="flex flex-col gap-3">
              {/* Video Preview */}
              {hasVideo ? (
                <div
                  className="overflow-hidden rounded-md"
                  style={{
                    width: 200,
                    height: 133,
                    backgroundColor: "#C8C0B0",
                  }}
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-md"
                  style={{
                    width: 200,
                    height: 133,
                    border: "1px dashed #DADADA",
                    backgroundColor: "#FAFAFA",
                  }}
                >
                  <Video
                    className="mb-1"
                    style={{ width: 24, height: 24, color: "#DADADA" }}
                  />
                  <span style={{ fontSize: 11, color: "#DADADA" }}>
                    No video from iTrvl
                  </span>
                </div>
              )}

              {/* Checkboxes */}
              <div className="flex flex-col gap-2">
                <Checkbox
                  id="video-reviewed"
                  checked={isVideoReviewed}
                  onChange={onVideoReviewedChange}
                  label="Hero Video Reviewed"
                  helperText="Hero video selection has been reviewed"
                  checkedStyle={{ color: "#16A34A", fontWeight: 500 }}
                />
                <Checkbox
                  id="show-hero-video"
                  checked={showHeroVideo}
                  onChange={onShowHeroVideoChange}
                  label="Show Hero Video"
                  helperText="Include video on the published page (when frontend is built)"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
