"use client"

import { useState, useEffect, useCallback } from "react"

interface ItineraryEditorHeaderProps {
  itineraryTitle: string
  status: "draft" | "published"
  totalReviewed: number
  totalItems: number
  canPublish: boolean
  lastAutoSaved?: Date | null
  onNavigateToItineraries: () => void
  onEnhanceAll: () => Promise<void>
  onRescrape: () => void
  onSave: () => Promise<void>
  onPublish: () => void
  isEnhancingAll?: boolean
  itrvlUrl?: string | null
  className?: string
}

export default function ItineraryEditorHeader({
  itineraryTitle,
  status,
  totalReviewed,
  totalItems,
  canPublish,
  lastAutoSaved,
  onNavigateToItineraries,
  onEnhanceAll,
  onRescrape,
  onSave,
  onPublish,
  isEnhancingAll = false,
  itrvlUrl = null,
  className = "",
}: ItineraryEditorHeaderProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [showAutoSaved, setShowAutoSaved] = useState(!!lastAutoSaved)

  const progressPercent = totalItems > 0 ? (totalReviewed / totalItems) * 100 : 0
  const isComplete = totalReviewed === totalItems && totalItems > 0

  // Auto-saved indicator fade out
  useEffect(() => {
    if (lastAutoSaved) {
      setShowAutoSaved(true)
      const timer = setTimeout(() => setShowAutoSaved(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [lastAutoSaved])

  const handleSave = useCallback(async () => {
    if (saveState !== "idle") return
    setSaveState("saving")
    try {
      await onSave()
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch {
      setSaveState("idle")
    }
  }, [onSave, saveState])

  const formatAutoSavedTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const saveButtonText =
    saveState === "saving" ? "Saving\u2026" : saveState === "saved" ? "Saved \u2713" : "Save Draft"

  return (
    <header
      className={`sticky top-0 z-50 flex h-16 items-center border-b bg-white px-6 ${className}`}
      style={{
        borderColor: "#DADADA",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* LEFT SECTION */}
      <div className="flex w-[280px] shrink-0 flex-col justify-center gap-0.5">
        <div className="flex items-center">
          <button
            onClick={onNavigateToItineraries}
            className="cursor-pointer text-xs font-normal transition-colors hover:underline"
            style={{ color: "#486A6A" }}
          >
            Itineraries
          </button>
          <span
            className="mx-1.5 text-xs font-normal"
            style={{ color: "#DADADA" }}
          >
            /
          </span>
          <span
            className="max-w-[180px] truncate text-xs font-medium"
            style={{ color: "#404040" }}
            title={itineraryTitle}
          >
            {itineraryTitle}
          </span>

          {/* iTrvl source link */}
          {itrvlUrl && (
            <a
              href={itrvlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-[10px] font-normal transition-colors hover:underline"
              style={{ color: "#888" }}
              title="View original on iTrvl"
            >
              iTrvl &#8599;
            </a>
          )}

          {/* Auto-saved indicator */}
          {showAutoSaved && lastAutoSaved && (
            <span
              className="ml-3 text-[10px] font-normal transition-opacity duration-500"
              style={{ color: "#888" }}
            >
              Auto-saved {formatAutoSavedTime(lastAutoSaved)}
            </span>
          )}
        </div>

        {/* Status badge */}
        <div>
          {status === "draft" ? (
            <span
              className="inline-block rounded-full px-2 py-px text-[10px] font-semibold uppercase"
              style={{
                background: "#F5F3EB",
                border: "1px solid #DADADA",
                color: "#888",
              }}
            >
              Draft
            </span>
          ) : (
            <span
              className="inline-block rounded-full px-2 py-px text-[10px] font-semibold uppercase"
              style={{
                background: "#DCFCE7",
                border: "1px solid #BBF7D0",
                color: "#16A34A",
              }}
            >
              Published
            </span>
          )}
        </div>
      </div>

      {/* CENTER SECTION */}
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <span
          className="mb-1 text-center text-[11px] font-normal"
          style={{ color: "#888" }}
        >
          {totalReviewed} of {totalItems} reviewed
        </span>
        <div
          className="h-1 w-full rounded-full"
          style={{ background: "#DADADA" }}
        >
          <div
            className="h-1 rounded-full transition-all duration-300 ease-in-out"
            style={{
              width: `${progressPercent}%`,
              background: isComplete
                ? "#16A34A"
                : "#486A6A",
            }}
          />
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex w-[320px] shrink-0 items-center justify-end gap-2">
        {/* Enhance All */}
        <button
          onClick={onEnhanceAll}
          disabled={isEnhancingAll}
          className="cursor-pointer border-none bg-transparent text-xs font-medium transition-colors hover:underline disabled:cursor-wait disabled:opacity-60"
          style={{ color: "#DA7A5A" }}
          onMouseEnter={(e) => {
            if (!isEnhancingAll)
              (e.currentTarget as HTMLButtonElement).style.color =
                "#C46B4D"
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "#DA7A5A"
          }}
        >
          {isEnhancingAll ? "Enhancing\u2026" : "\u2728 Enhance All"}
        </button>

        {/* Rescrape */}
        <button
          onClick={onRescrape}
          className="cursor-pointer border-none bg-transparent text-xs font-medium transition-colors hover:underline"
          style={{ color: "#888" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "#486A6A"
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "#888"
          }}
        >
          {"\u21BB"} Rescrape
        </button>

        {/* Save Draft */}
        <button
          onClick={handleSave}
          disabled={saveState !== "idle"}
          className="h-[34px] cursor-pointer rounded-md bg-white px-4 text-xs font-medium transition-colors disabled:cursor-default"
          style={{
            border: "1px solid #DADADA",
            color:
              saveState === "saved"
                ? "#16A34A"
                : "#404040",
          }}
          onMouseEnter={(e) => {
            if (saveState === "idle") {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                "#486A6A"
              ;(e.currentTarget as HTMLButtonElement).style.color =
                "#486A6A"
            }
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor =
              "#DADADA"
            ;(e.currentTarget as HTMLButtonElement).style.color =
              saveState === "saved"
                ? "#16A34A"
                : "#404040"
          }}
        >
          {saveButtonText}
        </button>

        {/* Divider */}
        <div
          className="mx-1 h-5 w-px self-center"
          style={{ background: "#DADADA" }}
        />

        {/* Publish */}
        {status === "published" ? (
          <button
            disabled
            className="h-[34px] cursor-default rounded-md border-none bg-transparent px-4 text-xs font-semibold"
            style={{ color: "#16A34A" }}
          >
            Published {"\u2713"}
          </button>
        ) : canPublish ? (
          <button
            onClick={onPublish}
            className="h-[34px] cursor-pointer rounded-md border-none px-4 text-xs font-semibold text-white transition-colors"
            style={{ background: "#486A6A" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "#3A5757"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "#486A6A"
            }}
          >
            Publish
          </button>
        ) : (
          <div className="group relative">
            <button
              disabled
              className="h-[34px] cursor-not-allowed rounded-md px-4 text-xs font-semibold"
              style={{
                background: "#F5F3EB",
                border: "1px solid #DADADA",
                color: "#DADADA",
              }}
            >
              Publish
            </button>
            <div className="pointer-events-none absolute top-full right-0 z-10 mt-1 whitespace-nowrap rounded-md bg-[#404040] px-2.5 py-1.5 text-[11px] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              Complete all review items to publish
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
