import React from 'react'

const BeforeLogin: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      <p
        style={{
          fontFamily: "'Satoshi', system-ui, sans-serif",
          fontSize: '0.9375rem',
          color: '#666',
          margin: 0,
          letterSpacing: '0.01em',
        }}
      >
        Sign in to your workspace
      </p>
    </div>
  )
}

export default BeforeLogin
