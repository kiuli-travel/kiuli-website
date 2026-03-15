"use client"

import { cn } from "@/utilities/ui"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavSection {
  id: string
  label: string
  reviewed: number
  total: number
  isBlocker?: boolean
  blockerCount?: number
  subItems?: NavSection[]
}

interface QuickNavProps {
  sections: NavSection[]
  onNavigate: (sectionId: string) => void
  expandedDays?: boolean
}

interface ChecklistSection {
  id: string
  label: string
  reviewed: number
  total: number
}

interface PublishChecklistProps {
  sections: ChecklistSection[]
  className?: string
}

interface EditorSidebarProps {
  navSections: NavSection[]
  checklistSections: ChecklistSection[]
  onNavigate: (sectionId: string) => void
  onPublish: () => void
  canPublish: boolean
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusColor(reviewed: number, total: number): string {
  if (total === 0) return "#DADADA"
  if (reviewed === 0) return "#DC2626"
  if (reviewed < total) return "#D97706"
  return "#16A34A"
}

// ─── QuickNav ────────────────────────────────────────────────────────────────

export function QuickNav({ sections, onNavigate, expandedDays = false }: QuickNavProps) {
  return (
    <nav>
      <p
        className="pb-2"
        style={{
          fontWeight: 500,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#888",
        }}
      >
        Navigate to
      </p>
      <ul className="flex flex-col">
        {sections.map((section) => {
          const isBlockerSection = section.isBlocker
          const hasBlockers = isBlockerSection && (section.blockerCount ?? 0) > 0
          const dotColor = isBlockerSection
            ? hasBlockers
              ? "#DC2626"
              : "#DADADA"
            : getStatusColor(section.reviewed, section.total)

          return (
            <li key={section.id}>
              <button
                onClick={() => onNavigate(section.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 transition-colors hover:bg-[#F5F3EB]"
                style={{ height: "32px" }}
              >
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: dotColor,
                  }}
                />
                <span
                  className="flex-1 text-left"
                  style={{ fontSize: "12px", fontWeight: 400, color: "#404040" }}
                >
                  {section.label}
                </span>
                {isBlockerSection && hasBlockers ? (
                  <span style={{ fontSize: "11px", fontWeight: 400, color: "#DC2626" }}>
                    {section.blockerCount} blocker{section.blockerCount !== 1 ? "s" : ""}
                  </span>
                ) : !isBlockerSection && section.total > 0 ? (
                  <span style={{ fontSize: "11px", fontWeight: 400, color: "#888" }}>
                    {section.reviewed}/{section.total}
                  </span>
                ) : null}
              </button>

              {/* Sub-items for days */}
              {section.subItems && expandedDays && (
                <ul className="flex flex-col">
                  {section.subItems.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => onNavigate(sub.id)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded transition-colors hover:bg-[#F5F3EB]"
                        style={{ height: "32px", paddingLeft: "24px", paddingRight: "8px" }}
                      >
                        <span
                          className="shrink-0 rounded-full"
                          style={{
                            width: "8px",
                            height: "8px",
                            backgroundColor: getStatusColor(sub.reviewed, sub.total),
                          }}
                        />
                        <span
                          className="flex-1 text-left"
                          style={{ fontSize: "11px", fontWeight: 400, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {sub.label}
                        </span>
                        {sub.total > 0 && (
                          <span style={{ fontSize: "11px", fontWeight: 400, color: "#888" }}>
                            {sub.reviewed}/{sub.total}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ─── PublishChecklist ────────────────────────────────────────────────────────

export function PublishChecklist({ sections, className }: PublishChecklistProps) {
  const totalReviewed = sections.reduce((s, sec) => s + sec.reviewed, 0)
  const totalItems = sections.reduce((s, sec) => s + sec.total, 0)
  const isReady = totalReviewed === totalItems && totalItems > 0
  const progressPercent = totalItems > 0 ? (totalReviewed / totalItems) * 100 : 0

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#404040" }}>
          Publish Checklist
        </span>
        <span
          className="rounded-full"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 10px",
            backgroundColor: isReady ? "#DCFCE7" : "#FEE2E2",
            color: isReady ? "#16A34A" : "#DC2626",
          }}
        >
          {isReady ? "Ready" : "Not Ready"}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full overflow-hidden"
        style={{ height: "4px", borderRadius: "2px", backgroundColor: "#DADADA" }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            backgroundColor: "#486A6A",
            borderRadius: "2px",
            transition: "width 300ms",
          }}
        />
      </div>

      {/* Section rows */}
      <div className="flex flex-col">
        {sections.map((sec) => {
          const color = getStatusColor(sec.reviewed, sec.total)
          return (
            <div
              key={sec.id}
              className="flex items-center gap-2 px-1"
              style={{ height: "28px" }}
            >
              <span
                className="shrink-0 rounded-full"
                style={{ width: "8px", height: "8px", backgroundColor: color }}
              />
              <span
                className="flex-1"
                style={{ fontSize: "12px", fontWeight: 400, color: "#404040" }}
              >
                {sec.label}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 500, color }}>
                {sec.reviewed}/{sec.total}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-3 border-t pt-3"
        style={{ borderColor: "#DADADA" }}
      >
        <span className="flex items-center gap-1" style={{ fontSize: "10px", color: "#888" }}>
          <span
            className="inline-block rounded-full"
            style={{ width: "6px", height: "6px", backgroundColor: "#DC2626" }}
          />
          Unreviewed
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: "10px", color: "#888" }}>
          <span
            className="inline-block rounded-full"
            style={{ width: "6px", height: "6px", backgroundColor: "#D97706" }}
          />
          Partial
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: "10px", color: "#888" }}>
          <span
            className="inline-block rounded-full"
            style={{ width: "6px", height: "6px", backgroundColor: "#16A34A" }}
          />
          Complete
        </span>
      </div>
    </div>
  )
}

// ─── EditorSidebar ───────────────────────────────────────────────────────────

export default function EditorSidebar({
  navSections,
  checklistSections,
  onNavigate,
  onPublish,
  canPublish,
  className,
}: EditorSidebarProps) {
  return (
    <div
      className={cn("flex flex-col", className)}
      style={{
        width: "280px",
        backgroundColor: "#FFFFFF",
        border: "1px solid #DADADA",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <QuickNav sections={navSections} onNavigate={onNavigate} expandedDays />

      <div style={{ borderTop: "1px solid #DADADA", margin: "16px 0" }} />

      <PublishChecklist sections={checklistSections} />

      <div style={{ borderTop: "1px solid #DADADA", margin: "16px 0" }} />

      <button
        onClick={canPublish ? onPublish : undefined}
        disabled={!canPublish}
        className={cn(
          "w-full transition-colors",
          canPublish
            ? "cursor-pointer hover:bg-[#3A5757]"
            : "cursor-not-allowed"
        )}
        style={{
          height: "40px",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: 600,
          backgroundColor: canPublish ? "#486A6A" : "#F5F3EB",
          color: canPublish ? "#FFFFFF" : "#888",
          border: canPublish ? "none" : "1px solid #DADADA",
        }}
      >
        {canPublish ? "Publish Itinerary" : "Complete review to publish"}
      </button>
    </div>
  )
}
