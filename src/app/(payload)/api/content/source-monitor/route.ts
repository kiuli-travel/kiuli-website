import { NextResponse } from 'next/server'
import { checkSources } from '../../../../../../content-system/signals/source-monitor'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Auth: Bearer CONTENT_SYSTEM_SECRET
  const authHeader = request.headers.get('Authorization')
  if (
    !authHeader?.startsWith('Bearer ') ||
    authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await checkSources()

    const totalItemsFound = results.reduce((s, r) => s + r.itemsFound, 0)
    const totalNewItems = results.reduce((s, r) => s + r.newItems, 0)
    const totalProjectsCreated = results.reduce((s, r) => s + r.projectsCreated, 0)
    const errors = results.filter((r) => r.error)

    return NextResponse.json({
      success: true,
      summary: {
        sourcesChecked: results.length,
        totalItemsFound,
        totalNewItems,
        totalProjectsCreated,
        errors: errors.length,
      },
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[source-monitor] Failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
