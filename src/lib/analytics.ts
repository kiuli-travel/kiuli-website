// src/lib/analytics.ts — GA4 + Google Ads conversion tracking

const ENGAGED_VISITOR_LABEL = 'AW-17918105806/vMBZCL6X7O8bEM6xguBC'
const INQUIRY_SUBMITTED_LABEL = 'AW-17918105806/skUzCOjz6-8bEM6xguBC'

const SLIDE_NAMES: Record<number, string> = {
  0: 'destinations',
  1: 'timing',
  2: 'travelers',
  3: 'experiences',
  4: 'budget',
  5: 'contact',
}

/** SSR-safe gtag wrapper — silently no-ops if gtag not loaded */
function gtag(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...(args as Parameters<typeof window.gtag>))
  }
}

/** SHA-256 hash using Web Crypto API */
async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Fires once when the form first renders */
export function trackFormStart(): void {
  gtag('event', 'form_start', {
    form_name: 'safari_inquiry',
  })
}

/** Fires each time a slide becomes visible */
export function trackStepView(slide: number): void {
  gtag('event', 'form_step_view', {
    form_name: 'safari_inquiry',
    step_name: SLIDE_NAMES[slide] || `slide_${slide}`,
    step_number: slide,
  })
}

/** Fires when user advances past a slide (clicks Next) */
export function trackStepComplete(
  slide: number,
  selections: Record<string, string>
): void {
  gtag('event', 'form_step_complete', {
    form_name: 'safari_inquiry',
    step_name: SLIDE_NAMES[slide] || `slide_${slide}`,
    step_number: slide,
    ...selections,
  })
}

/** Fires when user leaves the page mid-form (visibilitychange → hidden) */
export function trackFormAbandon(slide: number): void {
  gtag('event', 'form_abandon', {
    form_name: 'safari_inquiry',
    last_step_name: SLIDE_NAMES[slide] || `slide_${slide}`,
    last_step_number: slide,
  })
}

/** Google Ads "Engaged Visitor" conversion — fires once when user reaches slide 3 */
export function trackEngagedVisitor(): void {
  gtag('event', 'conversion', {
    send_to: ENGAGED_VISITOR_LABEL,
  })
}

/** GA4 event + Google Ads "Inquiry Submitted" conversion with Enhanced Conversions */
export async function trackInquirySubmitted(
  valueDollars: number,
  email: string
): Promise<void> {
  // Enhanced Conversions: set hashed user data before firing conversion
  try {
    const hashedEmail = await sha256(email)
    gtag('set', 'user_data', {
      sha256_email_address: hashedEmail,
    })
  } catch {
    // Non-blocking: Enhanced Conversions fail gracefully
  }

  // GA4 custom event
  gtag('event', 'inquiry_submitted', {
    form_name: 'safari_inquiry',
    value: valueDollars,
    currency: 'USD',
  })

  // Google Ads conversion
  gtag('event', 'conversion', {
    send_to: INQUIRY_SUBMITTED_LABEL,
    value: valueDollars,
    currency: 'USD',
  })
}
