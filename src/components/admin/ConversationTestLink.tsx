'use client'

import React from 'react'
import Link from 'next/link'

export const ConversationTestLink: React.FC = () => {
  return (
    <div style={{ padding: '0.25rem 1rem' }}>
      <Link
        href="/admin/conversation-test"
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
          e.currentTarget.style.backgroundColor = '#3a5656'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#486A6A'
        }}
      >
        <span>Conversation Test</span>
      </Link>
    </div>
  )
}
