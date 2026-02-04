// src/lib/analytics.ts — GA4 + Google Ads conversion tracking
// Specification: PHASE_6_OUTCOMES.md

const ENGAGED_VISITOR_LABEL = 'AW-17918105806/vMBZCL6X7O8bEM6xguBC'
const INQUIRY_SUBMITTED_LABEL = 'AW-17918105806/skUzCOjz6-8bEM6xguBC'

const SLIDE_NAMES: Record<number, string> = {
  1: 'destinations',
  2: 'timing',
  3: 'travelers',
  4: 'experiences',
  5: 'investment',
  6: 'contact',
}

// Module-level deduplication flags (fire-once per page load)
let _formViewedFired = false
let _engagedVisitorFired = false
let _formAbandonedFired = false

// Module-level timestamps for duration tracking
let _formViewedAt = 0
let _slideViewedAt = 0

/** SSR-safe gtag wrapper — silently no-ops if gtag not loaded */
function gtagSafe(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...(args as Parameters<typeof window.gtag>))
  }
}

/** SHA-256 hash using Web Crypto API (for Enhanced Conversions) */
async function sha256Hash(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase()
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized)
  )
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
// GA4 Events
// ---------------------------------------------------------------------------

/** C.1: form_viewed — fires once on component mount */
export function trackFormViewed(): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (_formViewedFired) return
  _formViewedFired = true
  _formViewedAt = Date.now()

  gtagSafe('event', 'form_viewed', {
    form_name: 'kiuli_inquiry',
    page_url: window.location.href,
  })
}

/** C.2: slide_viewed — fires each time currentSlide changes */
export function trackSlideViewed(slideInternal: number): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  _slideViewedAt = Date.now()
  const slideNumber = slideInternal + 1

  gtagSafe('event', 'slide_viewed', {
    form_name: 'kiuli_inquiry',
    slide_number: slideNumber,
    slide_name: SLIDE_NAMES[slideNumber] || `slide_${slideNumber}`,
  })
}

/** C.3: slide_completed — fires when user clicks Next (slides 1-5 spec / 0-4 internal) */
export function trackSlideCompleted(
  slideInternal: number,
  selections: string
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const slideNumber = slideInternal + 1
  const timeOnSlide = _slideViewedAt > 0 ? Date.now() - _slideViewedAt : 0

  gtagSafe('event', 'slide_completed', {
    form_name: 'kiuli_inquiry',
    slide_number: slideNumber,
    slide_name: SLIDE_NAMES[slideNumber] || `slide_${slideNumber}`,
    time_on_slide_ms: timeOnSlide,
    selections,
  })
}

/** C.4: form_abandoned — fires once on visibilitychange → hidden */
export function trackFormAbandoned(slideInternal: number): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (_formAbandonedFired) return
  _formAbandonedFired = true
  const slideNumber = slideInternal + 1
  const timeInForm = _formViewedAt > 0 ? Date.now() - _formViewedAt : 0

  gtagSafe('event', 'form_abandoned', {
    form_name: 'kiuli_inquiry',
    last_slide: slideNumber,
    last_slide_name: SLIDE_NAMES[slideNumber] || `slide_${slideNumber}`,
    time_in_form_ms: timeInForm,
  })
}

/** C.5a: form_submitted — custom event on successful 201 */
export function trackFormSubmitted(
  inquiryId: string,
  destinations: string,
  budgetRange: string,
  projectedProfitDollars: number
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  gtagSafe('event', 'form_submitted', {
    form_name: 'kiuli_inquiry',
    inquiry_id: inquiryId,
    destinations,
    budget_range: budgetRange,
    projected_profit_dollars: projectedProfitDollars,
  })
}

/** C.5b: generate_lead — GA4 recommended event on successful 201 */
export function trackGenerateLead(
  projectedProfitDollars: number,
  destinations: string,
  budgetRange: string
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  gtagSafe('event', 'generate_lead', {
    currency: 'USD',
    value: projectedProfitDollars,
    form_name: 'kiuli_inquiry',
    destinations,
    budget_range: budgetRange,
  })
}

/** C.6: form_error — fires on validation failures and submission errors */
export function trackFormError(
  errorType: string,
  errorMessage: string,
  slideInternal: number
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const slideNumber = slideInternal + 1

  gtagSafe('event', 'form_error', {
    form_name: 'kiuli_inquiry',
    error_type: errorType,
    error_message: errorMessage.slice(0, 100),
    slide_number: slideNumber,
    slide_name: SLIDE_NAMES[slideNumber] || `slide_${slideNumber}`,
  })
}

// ---------------------------------------------------------------------------
// Google Ads Conversions
// ---------------------------------------------------------------------------

/** D.1: Engaged Visitor — fires once when leaving experiences slide (4→5 spec) */
export function trackEngagedVisitor(): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (_engagedVisitorFired) return
  _engagedVisitorFired = true

  gtagSafe('event', 'conversion', {
    send_to: ENGAGED_VISITOR_LABEL,
    value: 500.00,
    currency: 'USD',
  })
}

/** D.2: Inquiry Submitted — fires on successful 201 with Enhanced Conversions */
export async function trackInquiryConversion(
  projectedProfitDollars: number,
  inquiryId: string,
  email: string
): Promise<void> {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  // Enhanced Conversions: set hashed user data before firing conversion
  try {
    const hashedEmail = await sha256Hash(email)
    gtagSafe('set', 'user_data', {
      sha256_email_address: hashedEmail,
    })
  } catch {
    // Non-blocking: Enhanced Conversions fail gracefully
  }

  // Fire conversion with dynamic value and transaction_id for deduplication
  gtagSafe('event', 'conversion', {
    send_to: INQUIRY_SUBMITTED_LABEL,
    value: projectedProfitDollars,
    currency: 'USD',
    transaction_id: inquiryId,
  })
}
