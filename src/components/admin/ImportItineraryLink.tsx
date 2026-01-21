'use client'

import React from 'react'
import Link from 'next/link'

export const ImportItineraryLink: React.FC = () => {
  return (
    <div style={{ padding: '0.5rem 1rem', marginTop: '0.5rem' }}>
      <Link
        href="/admin/scrape"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: '#486A6A',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: 600,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3d5a5a'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#486A6A'
        }}
      >
        <span style={{ fontSize: '1rem' }}>+</span>
        <span>Import Itinerary</span>
      </Link>
    </div>
  )
}
