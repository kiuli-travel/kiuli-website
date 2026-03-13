'use client'

import React from 'react'
import Link from 'next/link'

export const ImageLibraryLink: React.FC = () => {
  return (
    <div style={{ padding: '0.25rem 1rem' }}>
      <Link
        href="/admin/image-library"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: '#5B7A8A',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#4d6a78'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#5B7A8A'
        }}
      >
        <span>Image Library</span>
      </Link>
    </div>
  )
}
