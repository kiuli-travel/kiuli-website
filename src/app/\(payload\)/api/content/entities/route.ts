import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * GET /api/content/entities
 *
 * Returns destinations and properties data for content generation scripts.
 * Requires Bearer token authentication via CONTENT_SYSTEM_SECRET.
 *
 * Query params:
 *   - type: "destination" | "property" | "all" (default: "all")
 */

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!secret || secret !== process.env.CONTENT_SYSTEM_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const typeFilter = url.searchParams.get('type') || 'all'

    const payload = await getPayload({ config: configPromise })
    const entities: Array<{
      id: number
      name: string
      type: 'country' | 'destination' | 'property'
      parentName?: string
    }> = []

    // Query destinations
    if (typeFilter === 'all' || typeFilter === 'destination') {
      const destResult = await payload.find({
        collection: 'destinations',
        limit: 1000,
        depth: 1,
      })

      for (const dest of destResult.docs) {
        const d = dest as unknown as Record<string, unknown>
        const destType = (d.type as string) || 'destination'

        if (typeFilter !== 'all' && destType !== typeFilter) continue

        entities.push({
          id: d.id as number,
          name: (d.name as string) || 'Untitled',
          type: destType as 'country' | 'destination',
        })
      }
    }

    // Query properties
    if (typeFilter === 'all' || typeFilter === 'property') {
      const propResult = await payload.find({
        collection: 'properties',
        limit: 1000,
        depth: 1,
      })

      for (const prop of propResult.docs) {
        const p = prop as unknown as Record<string, unknown>

        // Get parent destination name
        const destRel = p.destination as Record<string, unknown> | undefined | number
        let parentName = 'Unknown'

        if (typeof destRel === 'object' && destRel?.name) {
          parentName = String(destRel.name)
        } else if (typeof destRel === 'number') {
          try {
            const destRecord = await payload.findByID({
              collection: 'destinations',
              id: destRel,
              depth: 0,
            })
            parentName = String((destRecord as Record<string, unknown>).name || 'Unknown')
          } catch {
            // ignore
          }
        }

        entities.push({
          id: p.id as number,
          name: (p.name as string) || 'Untitled',
          type: 'property',
          parentName,
        })
      }
    }

    return Response.json({ entities })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
