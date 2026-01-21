'use client'

import React from 'react'

interface ItrvlUrlCellProps {
  cellData?: string
}

export const ItrvlUrlCell: React.FC<ItrvlUrlCellProps> = ({ cellData }) => {
  if (!cellData) return <span style={{ color: '#999' }}>&mdash;</span>

  // Extract a short display name from the URL
  let displayText = 'View in iTrvl'
  try {
    const url = new URL(cellData)
    const pathParts = url.pathname.split('/').filter((part) => part.length > 0)
    const portalIndex = pathParts.indexOf('portal')
    if (portalIndex !== -1 && pathParts.length >= portalIndex + 3) {
      // Show last 6 chars of itinerary ID
      const itineraryId = pathParts[portalIndex + 2]
      displayText = `...${itineraryId.slice(-8)}`
    }
  } catch {
    // Use default text
  }

  return (
    <a
      href={cellData}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        color: '#0066cc',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = 'underline'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none'
      }}
    >
      {displayText}
      <span style={{ fontSize: '0.75rem' }}>&nearr;</span>
    </a>
  )
}
