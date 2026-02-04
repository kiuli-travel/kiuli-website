import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { detectTrafficSource } from '@/lib/traffic-source'

// Rate limiting store (in-memory, resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

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

function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // Allow requests without Origin (e.g. same-origin navigations)
  if (process.env.NODE_ENV === 'development') {
    return origin.includes('localhost') || origin.includes('127.0.0.1')
  }
  return origin.includes('kiuli.com')
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60 // 7776000

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429 }
      )
    }

    // Origin check
    if (!isValidOrigin(request)) {
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403 }
      )
    }

    // Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid_json' },
        { status: 400 }
      )
    }

    // Generate session ID
    const sessionId = crypto.randomUUID()

    // Extract browser context from headers
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || null

    // Transform snake_case to camelCase
    const sessionData = {
      sessionId,
      trafficSource: detectTrafficSource({
        gclid: body.gclid || null,
        gbraid: body.gbraid || null,
        wbraid: body.wbraid || null,
        utmSource: body.utm_source || null,
        utmMedium: body.utm_medium || null,
        referrer: body.referrer || null,
      }),
      gclid: body.gclid || null,
      gbraid: body.gbraid || null,
      wbraid: body.wbraid || null,
      utmSource: body.utm_source || null,
      utmMedium: body.utm_medium || null,
      utmCampaign: body.utm_campaign || null,
      utmContent: body.utm_content || null,
      utmTerm: body.utm_term || null,
      referrer: body.referrer || null,
      landingPage: body.landing_page || '/',
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + NINETY_DAYS_MS).toISOString(),
      status: 'active' as const,
    }

    // Create session via Payload
    const payload = await getPayload({ config })
    await payload.create({
      collection: 'sessions',
      data: sessionData,
    })

    // Build Set-Cookie header
    let cookieValue = `kiuli_session=${sessionId}; Path=/; Max-Age=${NINETY_DAYS_SECONDS}; SameSite=Lax`
    if (process.env.NODE_ENV !== 'development') {
      cookieValue += '; Domain=kiuli.com; Secure'
    }

    return NextResponse.json(
      { session_id: sessionId },
      {
        status: 201,
        headers: { 'Set-Cookie': cookieValue },
      }
    )
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'session_creation_failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid_json' },
        { status: 400 }
      )
    }

    const { session_id, gclid, gbraid, wbraid } = body

    if (!session_id) {
      return NextResponse.json({ updated: false }, { status: 200 })
    }

    const payload = await getPayload({ config })

    // Find session by sessionId
    const sessionResult = await payload.find({
      collection: 'sessions',
      where: { sessionId: { equals: session_id } },
      limit: 1,
    })

    if (sessionResult.docs.length === 0) {
      return NextResponse.json({ updated: false }, { status: 200 })
    }

    const session = sessionResult.docs[0]

    // Build update object: only update fields that are null on session and non-null in request
    const updateObj: Record<string, string> = {}

    if (!session.gclid && gclid) {
      updateObj.gclid = gclid
    }
    if (!session.gbraid && gbraid) {
      updateObj.gbraid = gbraid
    }
    if (!session.wbraid && wbraid) {
      updateObj.wbraid = wbraid
    }

    // Nothing to update
    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ updated: false }, { status: 200 })
    }

    // Update session — do NOT change trafficSource
    await payload.update({
      collection: 'sessions',
      id: session.id,
      data: updateObj,
    })

    return NextResponse.json({ updated: true }, { status: 200 })
  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json(
      { error: 'session_update_failed' },
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
      'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
