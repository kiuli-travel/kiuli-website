'use client'

import React from 'react'

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<typeof status, { bg: string; text: string; border: string }> = {
    pending: {
      bg: '#f0f0f0',
      text: '#666',
      border: '#d0d0d0',
    },
    processing: {
      bg: '#e3f2fd',
      text: '#1976d2',
      border: '#90caf9',
    },
    completed: {
      bg: '#d4edda',
      text: '#155724',
      border: '#c3e6cb',
    },
    failed: {
      bg: '#f8d7da',
      text: '#721c24',
      border: '#f5c6cb',
    },
  }

  const labels: Record<typeof status, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  }

  const style = styles[status] || styles.pending

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.875rem',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {labels[status]}
    </span>
  )
}
