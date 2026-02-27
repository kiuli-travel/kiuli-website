"use client"

import { useEffect, useRef, useState } from "react"

export interface Blocker {
  id: string
  message: string
  onFix: () => void
}

export interface BlockersPanelProps {
  blockers: Blocker[]
  className?: string
}

export default function BlockersPanel({ blockers, className }: BlockersPanelProps) {
  const [showResolved, setShowResolved] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const prevBlockersRef = useRef<Blocker[]>(blockers)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const hadBlockers = prevBlockersRef.current.length > 0
    const hasNone = blockers.length === 0

    if (hadBlockers && hasNone) {
      // All blockers just resolved
      setShowResolved(true)
      setFadeOut(false)

      timerRef.current = setTimeout(() => {
        setFadeOut(true)
        fadeTimerRef.current = setTimeout(() => {
          setShowResolved(false)
          setFadeOut(false)
        }, 400)
      }, 2000)
    }

    if (blockers.length > 0) {
      // If new blockers appear, cancel resolved state
      setShowResolved(false)
      setFadeOut(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }

    prevBlockersRef.current = blockers

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [blockers])

  // State 3 — All resolved success state
  if (showResolved) {
    return (
      <div
        className={`rounded-[6px] border border-[#BBF7D0] border-l-4 border-l-[#16A34A] flex items-center justify-center h-10 transition-opacity duration-400 ${
          fadeOut ? "opacity-0" : "opacity-100"
        } ${className ?? ""}`}
        style={{ background: "#DCFCE7" }}
        role="status"
        aria-live="polite"
      >
        <span className="font-sans text-[13px] font-medium text-[#16A34A]">
          {"✓ All blockers resolved — ready to publish"}
        </span>
      </div>
    )
  }

  // State 2 — No blockers
  if (blockers.length === 0) {
    return null
  }

  // State 1 — Blockers exist
  return (
    <div
      className={`rounded-[6px] border border-[#FECACA] border-l-4 border-l-[#DC2626] ${className ?? ""}`}
      style={{ background: "#FEE2E2" }}
      role="alert"
      aria-live="polite"
    >
      {/* Header row */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#FECACA]">
        <span className="font-sans text-[13px] font-semibold text-[#991B1B]">
          {"⚠ Publish Blockers"}
        </span>
        <span className="inline-flex items-center justify-center rounded-full bg-[#DC2626] px-2 py-[1px] font-sans text-[11px] font-semibold text-white leading-tight">
          {blockers.length}
        </span>
      </div>

      {/* Blocker list */}
      <div>
        {blockers.map((blocker, index) => (
          <div
            key={blocker.id}
            className={`min-h-9 px-4 flex items-center gap-[10px] ${
              index < blockers.length - 1 ? "border-b border-[#FECACA]" : ""
            }`}
          >
            {/* X icon */}
            <span className="font-sans text-[13px] font-semibold text-[#DC2626] shrink-0" aria-hidden="true">
              {"✕"}
            </span>

            {/* Description */}
            <span className="font-sans text-[12px] font-normal text-[#991B1B] flex-grow">
              {blocker.message}
            </span>

            {/* Fix link */}
            <button
              onClick={blocker.onFix}
              className="font-sans text-[12px] font-medium text-kiuli-teal hover:underline cursor-pointer shrink-0 bg-transparent border-none p-0"
              type="button"
            >
              {"→ Fix"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
