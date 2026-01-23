'use client'

import React from 'react'

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: 'video' | 'image' | 'info'
}

/**
 * A prominent section header for admin UI.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, icon }) => {
  const getIcon = () => {
    switch (icon) {
      case 'video':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        )
      case 'image':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div
      style={{
        marginTop: '1.5rem',
        marginBottom: '0.75rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#6f42c1',
        borderRadius: '6px',
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {getIcon()}
        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</span>
      </div>
      {description && (
        <div style={{ fontSize: '0.8125rem', opacity: 0.9, marginTop: '0.25rem' }}>
          {description}
        </div>
      )}
    </div>
  )
}

export const HeroVideoSectionHeader: React.FC = () => (
  <SectionHeader
    title="Hero Video"
    description="Select a video to display on the itinerary page. Watch the video below to review it before publishing."
    icon="video"
  />
)
