'use client'

import React, { useEffect } from 'react'

/** Read the kiuli_session cookie value. Exported for InquiryForm.tsx to import. */
export function getSessionCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )kiuli_session=([^;]+)/)
  return match ? match[1] : null
}

async function initSession(): Promise<void> {
  // Skip admin routes
  if (window.location.pathname.startsWith('/admin')) return

  const existingSessionId = getSessionCookie()
  const params = new URLSearchParams(window.location.search)

  // Check for gclid with kclid as backup (Google Ads Final URL Suffix)
  const gclid = params.get('gclid') || params.get('kclid') || null
  const gbraid = params.get('gbraid') || null
  const wbraid = params.get('wbraid') || null

  if (!existingSessionId) {
    // First visit: create session
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        gclid,
        gbraid,
        wbraid,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term'),
        referrer: document.referrer || null,
        landing_page: window.location.pathname,
      }),
    })
    return
  }

  // Existing session: only update if new click IDs found
  if (gclid || gbraid || wbraid) {
    await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        session_id: existingSessionId,
        gclid,
        gbraid,
        wbraid,
      }),
    })
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSession().catch((err) => console.warn('[Kiuli Session]', err))
  }, [])

  return <>{children}</>
}
