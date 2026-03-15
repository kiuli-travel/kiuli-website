'use client'

import React from 'react'

export const KiuliIcon: React.FC = () => {
  return (
    <>
      {/* Light mode: clay mark on white */}
      <img
        src="/logos/mark/kiuli-mark-clay.svg"
        alt="Kiuli"
        className="dark:hidden"
        style={{ height: '24px', width: 'auto' }}
      />
      {/* Dark mode: white mark on dark */}
      <img
        src="/logos/mark/kiuli-mark-white.svg"
        alt="Kiuli"
        className="hidden dark:block"
        style={{ height: '24px', width: 'auto' }}
      />
    </>
  )
}
