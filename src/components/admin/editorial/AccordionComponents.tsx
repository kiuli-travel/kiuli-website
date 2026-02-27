"use client"

import * as React from "react"
import { cn } from "@/utilities/ui"

// ─── SectionStatusBadge ─────────────────────────────────────────────

export interface SectionStatusBadgeProps {
  reviewed: number
  total: number
  className?: string
}

export function SectionStatusBadge({
  reviewed,
  total,
  className,
}: SectionStatusBadgeProps) {
  let bgColor: string
  let textColor: string

  if (reviewed === 0) {
    bgColor = "bg-[#FEE2E2]"
    textColor = "text-[#DC2626]"
  } else if (reviewed < total) {
    bgColor = "bg-[#FEF3C7]"
    textColor = "text-[#D97706]"
  } else {
    bgColor = "bg-[#DCFCE7]"
    textColor = "text-[#16A34A]"
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 h-5 font-medium text-[11px] leading-none",
        bgColor,
        textColor,
        className
      )}
    >
      {reviewed}/{total} reviewed
    </span>
  )
}

// ─── AccordionHeader ────────────────────────────────────────────────

export interface AccordionHeaderProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  reviewed?: number
  total?: number
  rightContent?: React.ReactNode
  className?: string
}

export function AccordionHeader({
  label,
  isOpen,
  onToggle,
  reviewed,
  total,
  rightContent,
  className,
}: AccordionHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onToggle()
    }
  }

  const showBadge = reviewed !== undefined && total !== undefined && total > 0

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center h-[44px] bg-white border border-kiuli-gray px-4 cursor-pointer select-none transition-colors duration-150 hover:bg-[#FAFAFA]",
        isOpen ? "rounded-t-[6px] rounded-b-none" : "rounded-[6px]",
        className
      )}
    >
      {/* Chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 text-kiuli-teal"
        style={{
          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        <path
          d="M6 3L11 8L6 13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Gap + Label */}
      <span
        className="ml-2.5 font-semibold text-sm text-kiuli-charcoal truncate"
        style={{ fontSize: "14px" }}
      >
        {label}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Badge */}
      {showBadge && (
        <SectionStatusBadge reviewed={reviewed!} total={total!} />
      )}

      {/* Right Content */}
      {rightContent && <span className="ml-2">{rightContent}</span>}
    </div>
  )
}
