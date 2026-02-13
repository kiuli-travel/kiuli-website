import { NextResponse } from 'next/server'
import { callModel } from '../../../../../../content-system/openrouter-client'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await callModel(
      'ideation',
      [{ role: 'user', content: 'Respond with exactly: "Content engine connected"' }],
      { maxTokens: 50, temperature: 0 },
    )

    return NextResponse.json({
      status: 'connected',
      model: response.model,
      response: response.content,
      usage: response.usage,
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
