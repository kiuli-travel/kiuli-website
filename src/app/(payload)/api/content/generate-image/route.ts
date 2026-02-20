import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateAndSave } from '../../../../../../content-system/images/image-generator'
import { isPropertyType, PROPERTY_GUARD_MESSAGE } from '../../../../../../content-system/images/types'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { prompt?: string; metadata?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, metadata } = body

  if (!prompt || typeof prompt !== 'string') {
    return Response.json({ error: 'Missing or invalid prompt' }, { status: 400 })
  }

  if (!metadata || !metadata.type || typeof metadata.type !== 'string') {
    return Response.json({ error: 'Missing or invalid metadata.type' }, { status: 400 })
  }

  if (isPropertyType(metadata.type)) {
    return Response.json({ error: PROPERTY_GUARD_MESSAGE }, { status: 400 })
  }

  try {
    const result = await generateAndSave(prompt, {
      type: metadata.type as 'wildlife' | 'landscape' | 'destination' | 'country',
      species: Array.isArray(metadata.species) ? metadata.species as string[] : undefined,
      country: typeof metadata.country === 'string' ? metadata.country : undefined,
      destination: typeof metadata.destination === 'string' ? metadata.destination : undefined,
      aspectRatio: typeof metadata.aspectRatio === 'string' ? metadata.aspectRatio : undefined,
    })
    return Response.json(result)
  } catch (error) {
    console.error('[generate-image] Error:', error instanceof Error ? error.message : error)
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
