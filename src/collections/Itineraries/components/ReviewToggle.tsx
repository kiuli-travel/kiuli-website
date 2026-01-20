'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

interface ReviewToggleProps {
  path: string
}

/**
 * Visual toggle for marking segment content as reviewed.
 * Shows current status and allows click to toggle.
 */
export const ReviewToggle: React.FC<ReviewToggleProps> = ({ path }) => {
  // The path points to this UI field, but we need the reviewed field path
  // UI field path: days.0.segments.0.reviewUI
  // Reviewed field path: days.0.segments.0.reviewed
  const reviewedPath = path.replace(/\.reviewUI$/, '.reviewed')

  const { value, setValue } = useField<boolean>({ path: reviewedPath })

  const isReviewed = value === true

  return (
    <div
      onClick={() => setValue(!isReviewed)}
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
