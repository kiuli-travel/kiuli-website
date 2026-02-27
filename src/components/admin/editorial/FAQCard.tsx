"use client"

import { useState } from "react"

export interface FAQItem {
  id: string
  questionItrvl: string
  questionEnhanced: string
  answerItrvl: string
  answerEnhanced: string
  isReviewed: boolean
}

interface FAQCardProps {
  item: FAQItem
  index: number
  onItemChange: (id: string, field: keyof FAQItem, value: string | boolean) => void
  onEnhanceAnswer: (id: string) => Promise<void>
  onDeleteItem: (id: string) => void
  enhancingId?: string | null
}

function getCardState(item: FAQItem): "reviewed" | "enhanced" | "unreviewed" {
  if (item.isReviewed) return "reviewed"
  if (item.answerEnhanced.trim() !== "" || item.questionEnhanced.trim() !== "") return "enhanced"
  return "unreviewed"
}

const stateConfig = {
  reviewed: {
    borderColor: "border-l-[#16A34A]",
    bgColor: "bg-[#DCFCE7]",
    headerBg: "bg-[#16A34A]/5",
    label: "REVIEWED",
    labelColor: "text-[#16A34A]",
  },
  enhanced: {
    borderColor: "border-l-[#D97706]",
    bgColor: "bg-[#FEF3C7]",
    headerBg: "bg-[#D97706]/5",
    label: "ENHANCED",
    labelColor: "text-[#D97706]",
  },
  unreviewed: {
    borderColor: "border-l-[#DC2626]",
    bgColor: "bg-[#FEE2E2]",
    headerBg: "bg-[#DC2626]/5",
    label: "UNREVIEWED",
    labelColor: "text-[#DC2626]",
  },
}

export function FAQCard({
  item,
  index,
  onItemChange,
  onEnhanceAnswer,
  onDeleteItem,
  enhancingId,
}: FAQCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const state = getCardState(item)
  const config = stateConfig[state]
  const isEnhancing = enhancingId === item.id

  return (
    <div
      className={`border-l-4 ${config.borderColor} ${config.bgColor} ${isDragging ? "opacity-50" : ""}`}
      style={{ transition: "opacity 150ms" }}
    >
      {/* CARD HEADER */}
      <div
        className={`flex h-8 items-center gap-2 border-b border-kiuli-gray px-3 ${config.headerBg}`}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="flex cursor-grab items-center justify-center text-kiuli-gray hover:text-[#888] active:cursor-grabbing"
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          aria-label="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.2" />
            <circle cx="11" cy="3" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="13" r="1.2" />
            <circle cx="11" cy="13" r="1.2" />
          </svg>
        </button>

        {/* FAQ label */}
        <span className="text-xs font-semibold text-kiuli-teal">
          FAQ {index + 1}
        </span>

        <div className="flex-1" />

        {/* Status label */}
        <span className={`text-[10px] font-medium uppercase ${config.labelColor}`}>
          {config.label}
        </span>

        {/* Delete button / confirm */}
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-[11px]">
            <span className="text-kiuli-charcoal">Delete?</span>
            <button
              type="button"
              className="font-medium text-[#DC2626] hover:underline"
              onClick={() => {
                onDeleteItem(item.id)
                setConfirmDelete(false)
              }}
            >
              Confirm
            </button>
            <span className="text-kiuli-gray">/</span>
            <button
              type="button"
              className="font-medium text-kiuli-charcoal hover:underline"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-[#888] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete FAQ ${index + 1}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* QUESTION ROW */}
      <div className="border-b border-kiuli-gray">
        <div className="px-3 pt-1.5 pb-1 text-[10px] font-medium uppercase text-[#888]">
          Question
        </div>
        <div className="flex">
          {/* Left: iTrvl read-only */}
          <div className="w-[45%] border-r border-kiuli-gray bg-kiuli-ivory px-2.5 py-1.5">
            <div className="min-h-8 text-xs text-[#666]">
              {item.questionItrvl}
            </div>
          </div>
          {/* Right: editable enhanced */}
          <div className="flex-1 bg-white px-2.5 py-1.5">
            <input
              type="text"
              className="min-h-8 w-full border-none bg-transparent text-xs text-kiuli-charcoal outline-none placeholder:text-[#bbb]"
              value={item.questionEnhanced}
              onChange={(e) => onItemChange(item.id, "questionEnhanced", e.target.value)}
              placeholder="Enhanced question..."
            />
          </div>
        </div>
      </div>

      {/* ANSWER ROW */}
      <div className="border-b border-kiuli-gray">
        <div className="px-3 pt-1.5 pb-1 text-[10px] font-medium uppercase text-[#888]">
          Answer
        </div>
        <div className="flex">
          {/* Left: iTrvl read-only */}
          <div className="w-[45%] border-r border-kiuli-gray bg-kiuli-ivory px-2.5 py-1.5">
            <div className="min-h-[72px] text-xs leading-relaxed text-[#666]">
              {item.answerItrvl}
            </div>
          </div>
          {/* Center: Enhance button */}
          <div className="flex w-9 items-center justify-center border-r border-kiuli-gray bg-[#F0EEEA]">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded bg-kiuli-clay text-sm text-white hover:bg-[#C46B4D] disabled:opacity-50"
              onClick={() => onEnhanceAnswer(item.id)}
              disabled={isEnhancing}
              aria-label={`Enhance answer for FAQ ${index + 1}`}
            >
              {isEnhancing ? (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                "\u2728"
              )}
            </button>
          </div>
          {/* Right: editable enhanced */}
          <div className="flex-1 bg-white px-2.5 py-1.5">
            <textarea
              className="min-h-[72px] w-full resize-none border-none bg-transparent text-xs leading-relaxed text-kiuli-charcoal outline-none placeholder:text-[#bbb]"
              value={item.answerEnhanced}
              onChange={(e) => onItemChange(item.id, "answerEnhanced", e.target.value)}
              placeholder="Enhanced answer..."
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex h-8 items-center gap-2 px-3">
        <input
          type="checkbox"
          id={`reviewed-${item.id}`}
          checked={item.isReviewed}
          onChange={(e) => onItemChange(item.id, "isReviewed", e.target.checked)}
          className="h-3.5 w-3.5 rounded"
          style={{ accentColor: "#486A6A" }}
        />
        <label
          htmlFor={`reviewed-${item.id}`}
          className={`text-xs ${
            item.isReviewed ? "font-medium text-[#16A34A]" : "font-normal text-kiuli-charcoal"
          }`}
        >
          Reviewed
        </label>
      </div>
    </div>
  )
}
