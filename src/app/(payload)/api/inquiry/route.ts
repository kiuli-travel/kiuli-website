import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { createOrUpdateContactAndDeal } from '@/lib/hubspot'

// Rate limiting store (in-memory, resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

// Valid enum values
const VALID_TIMING_TYPES = ['specific', 'flexible', 'exploring'] as const
const VALID_PARTY_TYPES = ['solo', 'couple', 'family', 'multigenerational', 'friends', 'multiple_families', 'other'] as const
const VALID_INTERESTS = [
  'migration', 'gorillas', 'big_cats', 'beach', 'culture', 'walking',
  'wine_culinary', 'luxury_camp', 'celebration', 'photography', 'horse_riding', 'other'
] as const
const VALID_BUDGET_RANGES = ['10k-15k', '15k-25k', '25k-40k', '40k-60k', '60k-80k', '80k-100k', '100k+', 'unsure'] as const
const VALID_HOW_HEARD = ['google', 'ai', 'referral', 'advisor', 'press', 'social', 'podcast', 'returning', 'other'] as const
const VALID_INQUIRY_TYPES = ['form', 'phone', 'email', 'chat'] as const

interface ValidationErrors {
  [key: string]: string
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidYearMonth(value: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/
  return regex.test(value)
}

function isValidISODate(value: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

function isValidE164(phone: string): boolean {
  if (!phone || !phone.startsWith('+')) return false
  const digits = phone.substring(1)
  if (!/^\d+$/.test(digits)) return false
  return phone.length >= 8 && phone.length <= 16
}

function capitalizeName(name: string): string {
  if (!name) return ''
  return name.trim().split(/\s+/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ')
}

function validateRequest(body: any): ValidationErrors {
  const errors: ValidationErrors = {}

  // Destinations
  if (!body.destinations || !Array.isArray(body.destinations) || body.destinations.length === 0) {
    errors.destinations = 'Please select at least one destination'
  }

  // Timing
  if (!body.timing_type || !VALID_TIMING_TYPES.includes(body.timing_type)) {
    errors.timing_type = "Please select when you'd like to travel"
  } else {
    if (body.timing_type === 'specific') {
      if (!body.travel_date_start || !isValidISODate(body.travel_date_start)) {
        errors.travel_date_start = 'Please enter your travel start date'
      }
      if (!body.travel_date_end || !isValidISODate(body.travel_date_end)) {
        errors.travel_date_end = 'Please enter your travel end date'
      }
    } else if (body.timing_type === 'flexible') {
      if (!body.travel_window_earliest || !isValidYearMonth(body.travel_window_earliest)) {
        errors.travel_window_earliest = 'Please enter your earliest travel month'
      }
      if (!body.travel_window_latest || !isValidYearMonth(body.travel_window_latest)) {
        errors.travel_window_latest = 'Please enter your latest travel month'
      }
    }
  }

  // Party
  if (!body.party_type || !VALID_PARTY_TYPES.includes(body.party_type)) {
    errors.party_type = 'Please select who will be traveling'
  }

  // Travelers
  if (typeof body.total_travelers !== 'number' || body.total_travelers < 1 || body.total_travelers > 21) {
    errors.total_travelers = 'Please enter number of travelers (1-20+)'
  }
  if (typeof body.children_count !== 'number' || body.children_count < 0 || body.children_count > 11) {
    errors.children_count = 'Please enter number of children'
  }

  // Interests (multi-select array)
  if (!body.interests || !Array.isArray(body.interests) || body.interests.length === 0) {
    errors.interests = 'Please select at least one experience'
  } else if (!body.interests.every((i: string) => VALID_INTERESTS.includes(i as typeof VALID_INTERESTS[number]))) {
    errors.interests = 'Invalid experience selection'
  }

  // Budget
  if (!body.budget_range || !VALID_BUDGET_RANGES.includes(body.budget_range)) {
    errors.budget_range = 'Please select your investment level'
  }
  if (typeof body.stated_budget_cents !== 'number' || body.stated_budget_cents <= 0) {
    errors.stated_budget_cents = 'Invalid budget amount'
  }
  if (typeof body.projected_profit_cents !== 'number' || body.projected_profit_cents <= 0) {
    errors.projected_profit_cents = 'Invalid projected profit'
  }

  // Contact
  if (!body.first_name || typeof body.first_name !== 'string' || body.first_name.trim().length < 2) {
    errors.first_name = 'Please enter your first name (at least 2 characters)'
  }
  if (!body.last_name || typeof body.last_name !== 'string' || body.last_name.trim().length < 2) {
    errors.last_name = 'Please enter your last name (at least 2 characters)'
  }
  if (!body.email || !isValidEmail(body.email)) {
    errors.email = 'Please enter a valid email address'
  }
  if (!body.phone || !isValidE164(body.phone)) {
    errors.phone = 'Please enter a valid phone number'
  }
  // phone_country_code is now optional (E.164 phone includes country code)
  if (!body.how_heard || !VALID_HOW_HEARD.includes(body.how_heard)) {
    errors.how_heard = 'Please select how you heard about us'
  }

  // Optional message length check
  if (body.message && typeof body.message === 'string' && body.message.length > 500) {
    errors.message = 'Message must be 500 characters or less'
  }

  return errors
}

function transformToPayload(body: any): any {
  return {
    // Destinations - transform string array to object array
    destinations: body.destinations.map((code: string) => ({ code })),

    // Timing
    timingType: body.timing_type,
    travelDateStart: body.travel_date_start || null,
    travelDateEnd: body.travel_date_end || null,
    travelWindowEarliest: body.travel_window_earliest || null,
    travelWindowLatest: body.travel_window_latest || null,

    // Party
    partyType: body.party_type,
    totalTravelers: body.total_travelers,
    childrenCount: body.children_count,

    // Interests (multi-select)
    interests: body.interests,

    // Budget
    budgetRange: body.budget_range,
    statedBudgetCents: body.stated_budget_cents,
    projectedProfitCents: body.projected_profit_cents,

    // Contact (names capitalized server-side)
    firstName: capitalizeName(body.first_name),
    lastName: capitalizeName(body.last_name),
    email: body.email.toLowerCase().trim(),
    phone: body.phone,
    phoneCountryCode: body.phone_country_code?.toUpperCase() || null,
    howHeard: body.how_heard,
    message: body.message || null,
    marketingConsent: body.marketing_consent === true,
    contactConsent: body.contact_consent === true,

    // Attribution
    sessionId: body.session_id || null,
    gclid: body.gclid || null,
    utmSource: body.utm_source || null,
    utmMedium: body.utm_medium || null,
    utmCampaign: body.utm_campaign || null,
    utmContent: body.utm_content || null,
    utmTerm: body.utm_term || null,
    referrer: body.referrer || null,
    landingPage: body.landing_page || null,
    pageUrl: body.page_url || null,
    itinerarySlug: body.itinerary_slug || null,

    // Meta
    formStartedAt: body.form_started_at || null,
    inquiryType: body.inquiry_type || 'form',
    status: 'new',
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validate
    const errors = validateRequest(body)
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { success: false, errors },
        { status: 400 }
      )
    }

    // Transform
    const payloadData = transformToPayload(body)

    // Create via Payload
    const payload = await getPayload({ config })
    const inquiry = await payload.create({
      collection: 'inquiries',
      data: payloadData,
    })

    // HubSpot integration (non-blocking)
    let hubspotContactId: string | null = null
    let hubspotDealId: string | null = null

    try {
      const hubspotResult = await createOrUpdateContactAndDeal({
        firstName: payloadData.firstName,
        lastName: payloadData.lastName,
        email: payloadData.email,
        phone: payloadData.phone,
        projectedProfitCents: payloadData.projectedProfitCents,
        sessionId: payloadData.sessionId,
        gclid: payloadData.gclid,
        utmSource: payloadData.utmSource,
        landingPage: payloadData.landingPage,
        inquiryType: payloadData.inquiryType,
        // Full form data for HubSpot Note
        destinations: payloadData.destinations,
        timingType: payloadData.timingType,
        travelDateStart: payloadData.travelDateStart,
        travelDateEnd: payloadData.travelDateEnd,
        travelWindowEarliest: payloadData.travelWindowEarliest,
        travelWindowLatest: payloadData.travelWindowLatest,
        partyType: payloadData.partyType,
        totalTravelers: payloadData.totalTravelers,
        childrenCount: payloadData.childrenCount,
        interests: payloadData.interests,
        budgetRange: payloadData.budgetRange,
        howHeard: payloadData.howHeard,
        message: payloadData.message,
        marketingConsent: payloadData.marketingConsent,
        pageUrl: payloadData.pageUrl,
      })

      hubspotContactId = hubspotResult.contactId
      hubspotDealId = hubspotResult.dealId

      // Update inquiry with HubSpot IDs
      if (hubspotContactId || hubspotDealId) {
        await payload.update({
          collection: 'inquiries',
          id: inquiry.id,
          data: {
            hubspotContactId: hubspotContactId || undefined,
            hubspotDealId: hubspotDealId || undefined,
          },
        })
      }

      if (hubspotResult.error) {
        console.error('HubSpot partial failure:', hubspotResult.error)
      }
    } catch (hubspotError) {
      // Log but don't fail the request
      console.error('HubSpot integration failed:', hubspotError)
    }

    return NextResponse.json(
      {
        success: true,
        inquiry_id: inquiry.id,
        message: 'Inquiry received',
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Inquiry API error:', error)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// Prevent static optimization
export const dynamic = 'force-dynamic'
