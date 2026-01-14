import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice(7)
  return token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY
}

// GET - List notifications
export async function GET(request: NextRequest) {
  // Validate authentication
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const jobId = searchParams.get('jobId')
  const type = searchParams.get('type')

  const payload = await getPayload({ config })

  try {
    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    if (unreadOnly) {
      where.read = { equals: false }
    }

    if (jobId) {
      where.job = { equals: jobId }
    }

    if (type && ['success', 'error', 'warning', 'info'].includes(type)) {
      where.type = { equals: type }
    }

    const notifications = await payload.find({
      collection: 'notifications',
      where: Object.keys(where).length > 0 ? where : undefined,
      limit,
      sort: '-createdAt',
    })

    // Get unread count
    const unreadCount = await payload.count({
      collection: 'notifications',
      where: { read: { equals: false } },
    })

    return NextResponse.json({
      success: true,
      notifications: notifications.docs,
      pagination: {
        total: notifications.totalDocs,
        limit: notifications.limit,
        page: notifications.page,
        totalPages: notifications.totalPages,
      },
      unreadCount: unreadCount.totalDocs,
    })
  } catch (error) {
    console.error('[notifications] Error fetching:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST - Mark notifications as read/unread
export async function POST(request: NextRequest) {
  // Validate authentication
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { action, notificationIds, markAll } = body

  if (!action || !['read', 'unread', 'delete'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'action must be one of: read, unread, delete' },
      { status: 400 }
    )
  }

  if (!markAll && (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0)) {
    return NextResponse.json(
      { success: false, error: 'notificationIds array is required (or set markAll: true)' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })

  try {
    let updated = 0
    let deleted = 0

    if (markAll && action === 'read') {
      // Mark all unread as read
      const unreadNotifications = await payload.find({
        collection: 'notifications',
        where: { read: { equals: false } },
        limit: 1000,
      })

      for (const notification of unreadNotifications.docs) {
        await payload.update({
          collection: 'notifications',
          id: notification.id,
          data: {
            read: true,
            readAt: new Date().toISOString(),
          },
        })
        updated++
      }
    } else if (markAll && action === 'delete') {
      // Delete all read notifications
      const readNotifications = await payload.find({
        collection: 'notifications',
        where: { read: { equals: true } },
        limit: 1000,
      })

      for (const notification of readNotifications.docs) {
        await payload.delete({
          collection: 'notifications',
          id: notification.id,
        })
        deleted++
      }
    } else {
      // Process individual notifications
      for (const id of notificationIds) {
        try {
          if (action === 'delete') {
            await payload.delete({
              collection: 'notifications',
              id,
            })
            deleted++
          } else {
            await payload.update({
              collection: 'notifications',
              id,
              data: {
                read: action === 'read',
                readAt: action === 'read' ? new Date().toISOString() : null,
              },
            })
            updated++
          }
        } catch (err) {
          console.error(`[notifications] Failed to process notification ${id}:`, err)
        }
      }
    }

    // Get updated unread count
    const unreadCount = await payload.count({
      collection: 'notifications',
      where: { read: { equals: false } },
    })

    return NextResponse.json({
      success: true,
      action,
      updated,
      deleted,
      unreadCount: unreadCount.totalDocs,
    })
  } catch (error) {
    console.error('[notifications] Error processing:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process notifications' },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
