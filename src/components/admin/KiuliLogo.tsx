'use client'

import React from 'react'

export const KiuliLogo: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 0',
    }}>
      {/* Light mode: dark logo visible on white background */}
      <img
        src="/logos/full/kiuli-full-black.svg"
        alt="Kiuli"
        className="dark:hidden"
        style={{ height: '48px', width: 'auto' }}
      />
      {/* Dark mode: white logo visible on dark background */}
      <img
        src="/logos/full/kiuli-full-white.svg"
        alt="Kiuli"
        className="hidden dark:block"
        style={{ height: '48px', width: 'auto' }}
      />
    </div>
  )
}
