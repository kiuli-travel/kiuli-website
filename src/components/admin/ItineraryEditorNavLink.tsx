'use client'

import React from 'react'
import Link from 'next/link'

export const ItineraryEditorNavLink: React.FC = () => {
  return (
    <div style={{ padding: '0 1rem', marginTop: '0.25rem' }}>
      <Link
        href="/admin/itinerary-editor"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          color: '#486A6A',
          border: '1px solid #DADADA',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 500,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F5F3EB'
          e.currentTarget.style.borderColor = '#486A6A'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = '#DADADA'
        }}
      >
        <span style={{ fontSize: '0.875rem' }}>{'\u270E'}</span>
        <span>Editorial Editor</span>
      </Link>
    </div>
  )
}
