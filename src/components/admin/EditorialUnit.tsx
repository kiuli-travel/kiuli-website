'use client'

import React, { useId, useMemo } from 'react'

type EditorialState = 'UNREVIEWED' | 'ENHANCED_NOT_REVIEWED' | 'REVIEWED'

interface EditorialUnitProps {
  fieldLabel: string
  itrvlValue: string
  enhancedValue: string
  isReviewed: boolean
  multiline?: boolean
  onEnhancedChange: (value: string) => void
  onReviewedChange: (checked: boolean) => void
  onEnhance: () => Promise<void>
  isEnhancing?: boolean
  className?: string
}

const stateConfig: Record<
  EditorialState,
  {
    borderColor: string
    background: string
    label: string
    labelColor: string
  }
> = {
  UNREVIEWED: {
    borderColor: '#DC2626',
    background: '#FFF8F8',
    label: 'Unreviewed',
    labelColor: '#DC2626',
  },
  ENHANCED_NOT_REVIEWED: {
    borderColor: '#D97706',
    background: '#FFFDF0',
    label: 'Enhanced',
    labelColor: '#D97706',
  },
  REVIEWED: {
    borderColor: '#16A34A',
    background: '#F0FFF4',
    label: 'Reviewed',
    labelColor: '#16A34A',
  },
}

function deriveState(isReviewed: boolean, enhancedValue: string): EditorialState {
  if (isReviewed) return 'REVIEWED'
  if (enhancedValue.trim().length > 0) return 'ENHANCED_NOT_REVIEWED'
  return 'UNREVIEWED'
}

export default function EditorialUnit({
  fieldLabel,
  itrvlValue,
  enhancedValue,
  isReviewed,
  multiline = false,
  onEnhancedChange,
  onReviewedChange,
  onEnhance,
  isEnhancing = false,
  className = '',
}: EditorialUnitProps) {
  const id = useId()
  const enhancedId = `${id}-enhanced`
  const reviewedId = `${id}-reviewed`

  const state = useMemo(() => deriveState(isReviewed, enhancedValue), [isReviewed, enhancedValue])
  const config = stateConfig[state]

  const hasEnhancedContent = enhancedValue.trim().length > 0

  return (
    <div
      className={`rounded-lg p-5 transition-colors duration-200 ${className}`}
      style={{
        borderLeft: `4px solid ${config.borderColor}`,
        backgroundColor: config.background,
      }}
    >
      {/* 1. Field Label Row */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-medium text-[#404040]"
          style={{ fontFamily: "'Inter', 'General Sans', system-ui, sans-serif", fontSize: '13px' }}
        >
          {fieldLabel}
        </span>
        <span
          className="font-medium uppercase tracking-wider"
          style={{
            fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: config.labelColor,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* 2. iTRVL Original Field (read-only) */}
      <div className="mb-3">
        <label
          className="block mb-1.5 uppercase text-[#888]"
          style={{
            fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
            fontSize: '10px',
            letterSpacing: '0.08em',
          }}
        >
          iTRVL Original
        </label>
        {multiline ? (
          <div
            className="rounded border border-[#DADADA] bg-[#F5F3EB] px-3 py-2.5 text-[#666] select-text cursor-default"
            style={{
              fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
              fontSize: '13px',
              minHeight: '80px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}
            role="textbox"
            aria-readonly="true"
            aria-label={`${fieldLabel} - iTRVL Original`}
            tabIndex={0}
          >
            {itrvlValue ? (
              itrvlValue
            ) : (
              <span className="italic text-[#aaa]">No iTrvl content</span>
            )}
          </div>
        ) : (
          <div
            className="rounded border border-[#DADADA] bg-[#F5F3EB] px-3 py-2.5 text-[#666] select-text cursor-default truncate"
            style={{
              fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
              fontSize: '13px',
              lineHeight: '1.5',
            }}
            role="textbox"
            aria-readonly="true"
            aria-label={`${fieldLabel} - iTRVL Original`}
            tabIndex={0}
          >
            {itrvlValue ? (
              itrvlValue
            ) : (
              <span className="italic text-[#aaa]">No iTrvl content</span>
            )}
          </div>
        )}
      </div>

      {/* 3. Enhance Button Row */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={onEnhance}
          disabled={isEnhancing}
          className="inline-flex items-center justify-center rounded-md text-white font-medium transition-colors duration-200"
          style={{
            fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
            fontSize: '12px',
            backgroundColor: isEnhancing ? '#DA7A5A' : '#DA7A5A',
            padding: '6px 14px',
            height: '30px',
            borderRadius: '6px',
            opacity: isEnhancing ? 0.7 : 1,
            cursor: isEnhancing ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isEnhancing) {
              e.currentTarget.style.backgroundColor = '#C46B4D'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#DA7A5A'
          }}
          aria-label={isEnhancing ? 'Enhancing content' : `Enhance ${fieldLabel}`}
          aria-busy={isEnhancing}
        >
          {isEnhancing ? (
            <>
              <svg
                className="animate-spin mr-1.5 -ml-0.5"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Enhancing&hellip;</span>
            </>
          ) : (
            <span>{hasEnhancedContent ? '\u2728 Re-enhance' : '\u2728 Enhance'}</span>
          )}
        </button>
      </div>

      {/* 4. Enhanced Field (editable) */}
      <div className="mb-4">
        <label
          htmlFor={enhancedId}
          className="block mb-1.5 uppercase text-[#888]"
          style={{
            fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
            fontSize: '10px',
            letterSpacing: '0.08em',
          }}
        >
          Enhanced
        </label>
        {multiline ? (
          <textarea
            id={enhancedId}
            value={enhancedValue}
            onChange={(e) => onEnhancedChange(e.target.value)}
            placeholder="Start typing, or click Enhance with AI&hellip;"
            className="w-full rounded border border-[#DADADA] bg-white px-3 py-2.5 text-[#404040] placeholder:text-[#aaa] focus:border-[#486A6A] focus:outline-none focus:ring-1 focus:ring-[#486A6A]"
            style={{
              fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
              fontSize: '13px',
              minHeight: '80px',
              resize: 'vertical',
              lineHeight: '1.5',
            }}
            aria-label={`${fieldLabel} - Enhanced`}
          />
        ) : (
          <input
            id={enhancedId}
            type="text"
            value={enhancedValue}
            onChange={(e) => onEnhancedChange(e.target.value)}
            placeholder="Start typing, or click Enhance with AI&hellip;"
            className="w-full rounded border border-[#DADADA] bg-white px-3 py-2.5 text-[#404040] placeholder:text-[#aaa] focus:border-[#486A6A] focus:outline-none focus:ring-1 focus:ring-[#486A6A]"
            style={{
              fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
              fontSize: '13px',
              lineHeight: '1.5',
            }}
            aria-label={`${fieldLabel} - Enhanced`}
          />
        )}
      </div>

      {/* 5. Reviewed Checkbox Row */}
      <div className="flex items-center gap-2">
        <input
          id={reviewedId}
          type="checkbox"
          checked={isReviewed}
          onChange={(e) => onReviewedChange(e.target.checked)}
          className="h-4 w-4 rounded cursor-pointer"
          style={{ accentColor: '#486A6A' }}
          aria-label={`Mark ${fieldLabel} as reviewed`}
        />
        <label
          htmlFor={reviewedId}
          className="cursor-pointer select-none"
          style={{
            fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
            fontSize: '13px',
            fontWeight: isReviewed ? 500 : 400,
            color: isReviewed ? '#16A34A' : '#404040',
            transition: 'color 200ms ease, font-weight 200ms ease',
          }}
        >
          Reviewed
        </label>
      </div>
    </div>
  )
}
