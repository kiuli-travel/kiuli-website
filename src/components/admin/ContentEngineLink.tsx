'use client'

import React from 'react'
import Link from 'next/link'

export const ContentEngineLink: React.FC = () => {
  return (
    <div style={{ padding: '0.5rem 1rem', marginTop: '0.25rem' }}>
      <Link
        href="/admin/content-engine"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: '#DA7A5A',
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
          e.currentTarget.style.backgroundColor = '#c46a4d'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#DA7A5A'
        }}
      >
        <span>Content Engine</span>
      </Link>
    </div>
  )
}
