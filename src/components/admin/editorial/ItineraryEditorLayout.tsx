"use client"

import { useState, useEffect, useCallback } from "react"

interface ItineraryEditorLayoutProps {
  header: React.ReactNode
  sidebar: React.ReactNode
  mainContent: React.ReactNode
  progressPercent: number
  className?: string
}

export default function ItineraryEditorLayout({
  header,
  sidebar,
  mainContent,
  progressPercent,
  className = "",
}: ItineraryEditorLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isWide, setIsWide] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)")
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsWide(e.matches)
      if (e.matches) setDrawerOpen(false)
    }
    handler(mq)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <div className={`flex flex-col h-dvh overflow-hidden ${className}`} style={{ background: "#F5F3EB" }}>
      {/* FIXED HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: 64 }}>
        {header}
      </div>

      {/* BODY */}
      <div className="flex flex-row flex-1 overflow-hidden" style={{ marginTop: 64 }}>
        {/* MAIN COLUMN */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: "16px", paddingTop: "16px" }}
        >
          <div className="mx-auto" style={{ maxWidth: 860 }}>
            <div className="flex flex-col gap-2">
              {mainContent}
            </div>
          </div>
        </main>

        {/* SIDEBAR — desktop only */}
        {isWide && (
          <aside
            className="flex-shrink-0 overflow-y-auto"
            style={{
              width: 320,
              background: "#FFFFFF",
              borderLeft: "1px solid #DADADA",
              padding: "20px 16px",
            }}
          >
            {sidebar}
          </aside>
        )}
      </div>

      {/* MOBILE FAB */}
      {!isWide && !drawerOpen && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{
            bottom: 24,
            right: 24,
            width: 48,
            height: 48,
            background: "#486A6A",
            color: "#FFFFFF",
          }}
          aria-label={`Open sidebar. Progress: ${progressPercent}%`}
        >
          <span className="font-semibold" style={{ fontSize: 11 }}>
            {progressPercent}%
          </span>
        </button>
      )}

      {/* MOBILE DRAWER */}
      {!isWide && drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            className="fixed top-0 right-0 z-50 h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200"
            style={{
              width: 320,
              background: "#FFFFFF",
              padding: 20,
            }}
          >
            <button
              onClick={closeDrawer}
              className="absolute top-4 right-4 flex items-center justify-center rounded-full transition-colors hover:bg-[#F5F3EB]"
              style={{ width: 32, height: 32, color: "#404040" }}
              aria-label="Close sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
            <div className="pt-8">{sidebar}</div>
          </div>
        </>
      )}
    </div>
  )
}
