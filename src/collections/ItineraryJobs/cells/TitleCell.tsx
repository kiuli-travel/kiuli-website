'use client'

import React from 'react'
import Link from 'next/link'

interface TitleCellProps {
  cellData?: string
  rowData?: {
    id?: string | number
    itrvlUrl?: string
    processedItinerary?: { id?: string | number; title?: string } | string | number
    itineraryId?: string
  }
}

export const TitleCell: React.FC<TitleCellProps> = ({ rowData }) => {
  // Try to get title from processed itinerary relationship
  let title = 'Untitled'
  let itineraryLink: string | null = null

  if (rowData?.processedItinerary) {
    if (typeof rowData.processedItinerary === 'object' && rowData.processedItinerary.title) {
      title = rowData.processedItinerary.title
      if (rowData.processedItinerary.id) {
        itineraryLink = `/admin/collections/itineraries/${rowData.processedItinerary.id}`
      }
    } else if (
      typeof rowData.processedItinerary === 'string' ||
      typeof rowData.processedItinerary === 'number'
    ) {
      // Just have the ID, not the populated object
      itineraryLink = `/admin/collections/itineraries/${rowData.processedItinerary}`
    }
  }

  // Fallback to itineraryId if no title
  if (title === 'Untitled' && rowData?.itineraryId) {
    title = `ID: ${rowData.itineraryId.slice(-8)}...`
  }

  // Truncate long titles
  const maxLength = 50
  const displayTitle = title.length > maxLength ? `${title.substring(0, maxLength)}...` : title

  if (itineraryLink) {
    return (
      <Link
        href={itineraryLink}
        onClick={(e) => e.stopPropagation()}
        style={{
          color: '#0066cc',
          textDecoration: 'none',
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = 'underline'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = 'none'
        }}
      >
        {displayTitle}
      </Link>
    )
  }

  return <span style={{ color: '#666' }}>{displayTitle}</span>
}
