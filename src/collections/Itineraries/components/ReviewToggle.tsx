'use client'

import React from 'react'
import { useField, useForm } from '@payloadcms/ui'

interface ReviewToggleProps {
  path: string
}

/**
 * Visual toggle for marking segment content as reviewed.
 * Shows current status and allows click to toggle.
 *
 * When toggled, sets ALL per-field reviewed flags for the segment:
 * - All segments: reviewed, descriptionReviewed
 * - Stay: + accommodationNameReviewed, inclusionsReviewed
 * - Activity/Transfer: + titleReviewed
 */
export const ReviewToggle: React.FC<ReviewToggleProps> = ({ path }) => {
  const form = useForm()

  // Get the segment base path (e.g., days.0.segments.0)
  const segmentPath = path.replace(/\.reviewUI$/, '')

  // Get segment data to determine block type (guard against missing form context)
  const segment = form?.getDataByPath?.(segmentPath) as { blockType?: string } | undefined
  const blockType = segment?.blockType || 'stay'

  // Main reviewed flag
  const { value: reviewedValue, setValue: setReviewed } = useField<boolean>({
    path: `${segmentPath}.reviewed`,
  })

  // Per-field reviewed flags - all segments have description
  const { setValue: setDescriptionReviewed } = useField<boolean>({
    path: `${segmentPath}.descriptionReviewed`,
  })

  // Stay-specific fields
  const { setValue: setAccommodationNameReviewed } = useField<boolean>({
    path: `${segmentPath}.accommodationNameReviewed`,
  })
  const { setValue: setInclusionsReviewed } = useField<boolean>({
    path: `${segmentPath}.inclusionsReviewed`,
  })

  // Activity/Transfer title field
  const { setValue: setTitleReviewed } = useField<boolean>({
    path: `${segmentPath}.titleReviewed`,
  })

  // Guard against missing form context (shouldn't happen but safety first)
  if (!form) {
    return null
  }

  const isReviewed = reviewedValue === true

  const handleToggle = () => {
    const newValue = !isReviewed

    // Set the main reviewed flag
    setReviewed(newValue)

    // Set all per-field reviewed flags based on segment type
    // All segments have description
    setDescriptionReviewed(newValue)

    if (blockType === 'stay') {
      setAccommodationNameReviewed(newValue)
      setInclusionsReviewed(newValue)
    }

    if (blockType === 'activity' || blockType === 'transfer') {
      setTitleReviewed(newValue)
    }
  }

  return (
    <div
      onClick={handleToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: isReviewed ? '#d4edda' : '#fff3cd',
        border: isReviewed ? '1px solid #28a745' : '1px solid #ffc107',
        color: isReviewed ? '#155724' : '#856404',
        fontWeight: 500,
        fontSize: '0.875rem',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
      title={isReviewed ? 'Click to mark as needs review' : 'Click to mark as reviewed'}
    >
      <span style={{ fontSize: '1rem' }}>{isReviewed ? '✓' : '○'}</span>
      <span>{isReviewed ? 'Reviewed' : 'Needs Review'}</span>
    </div>
  )
}
