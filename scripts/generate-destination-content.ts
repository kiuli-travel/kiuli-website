#!/usr/bin/env node

/**
 * generate-destination-content.ts
 *
 * Auto-generates content projects for destinations and properties with minimal content.
 *
 * Usage:
 *   npx tsx scripts/generate-destination-content.ts
 *   npx tsx scripts/generate-destination-content.ts --dry-run
 *   npx tsx scripts/generate-destination-content.ts --type=destination
 *   npx tsx scripts/generate-destination-content.ts --type=property --dry-run
 *
 * Flags:
 *   --dry-run          Don't create content projects or trigger workflows
 *   --type=<type>     Filter: "country", "destination", or "property" (default: all)
 *
 * Process:
 *   1. Query all destinations (countries and child destinations) and properties with empty/minimal description
 *   2. For each entity, create a ContentProject with contentType destination_page or property_page
 *   3. Trigger research pipeline with HNWI-targeted queries
 *   4. Trigger drafting pipeline
 *   5. Leave as drafts for travel designer review
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'

// ────────────────────────────────────────────────────────────────────────────

interface CliOptions {
  dryRun: boolean
  type: 'country' | 'destination' | 'property' | 'all'
}

interface Entity {
  id: number
  name: string
  type: 'country' | 'destination' | 'property'
  hasContent: boolean
  parentName?: string // For properties: destination name
}

interface GenerationResult {
  entity: Entity
  action: 'created' | 'skipped' | 'error'
  projectId?: number
  error?: string
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    type: (
      args.find((a) => a.startsWith('--type='))?.split('=')[1] || 'all'
    ) as CliOptions['type'],
  }
}

/**
 * Determine if a destination has meaningful content
 */
function hasContent(dest: Record<string, unknown>): boolean {
  const desc = dest.description
  if (!desc) return false
  if (typeof desc !== 'object' || desc === null) return false

  // description is a Lexical JSON object — check if it has root.children with actual content
  const lexical = desc as Record<string, unknown>
  const root = lexical.root as Record<string, unknown> | undefined
  if (!root || !Array.isArray(root.children)) return false

  // Has content if it has more than 2 children (basic structure often has 1-2 empty nodes)
  if (root.children.length > 2) return true

  // Or if any child has actual text
  return root.children.some((child: unknown) => {
    const c = child as Record<string, unknown> | undefined
    if (!c) return false
    if (Array.isArray(c.children)) {
      return c.children.some((cc: unknown) => {
        const inner = cc as Record<string, unknown> | undefined
        return inner?.text && String(inner.text).trim().length > 20
      })
    }
    return false
  })
}

/**
 * Fetch all destinations that need content
 */
async function fetchDestinationsNeedingContent(
  payload: ReturnType<typeof getPayload>,
  typeFilter: 'country' | 'destination' | 'property' | 'all',
): Promise<Entity[]> {
  const entities: Entity[] = []

  // Query destinations
  if (typeFilter === 'all' || typeFilter === 'country' || typeFilter === 'destination') {
    console.log('[destinations] Querying destinations...')

    const result = await payload.find({
      collection: 'destinations',
      where: {},
      limit: 1000,
      depth: 1,
    })

    for (const dest of result.docs) {
      const d = dest as unknown as Record<string, unknown>
      const destType = (d.type as string) || 'destination'

      // Filter by type if specified
      if (typeFilter !== 'all' && destType !== typeFilter) continue

      const hasDesc = hasContent(d)
      entities.push({
        id: d.id as number,
        name: (d.name as string) || 'Untitled',
        type: destType as 'country' | 'destination',
        hasContent: hasDesc,
      })
    }
  }

  // Query properties
  if (typeFilter === 'all' || typeFilter === 'property') {
    console.log('[properties] Querying properties...')

    const result = await payload.find({
      collection: 'properties',
      where: {},
      limit: 1000,
      depth: 1,
    })

    for (const prop of result.docs) {
      const p = prop as unknown as Record<string, unknown>

      // Check if property has any description field with content
      const hasDesc =
        hasContent({ description: p.description_reviewed }) ||
        hasContent({ description: p.description_enhanced }) ||
        (typeof p.description_itrvl === 'string' && String(p.description_itrvl).trim().length > 20)

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
        hasContent: hasDesc,
        parentName,
      })
    }
  }

  return entities
}

/**
 * Generate HNWI-targeted research queries for a destination
 */
function buildDestinationResearchQueries(destName: string): string[] {
  return [
    `What makes ${destName} special for luxury safari travelers? Exclusive experiences, wildlife, conservation`,
    `Best time to visit ${destName} for safari — seasonal wildlife patterns and weather`,
    `Conservation status and exclusive access opportunities at ${destName}`,
    `${destName} luxury lodges and camps — exclusive properties for high-end travelers`,
    `${destName} safari costs and investment expectations for luxury travelers`,
  ]
}

/**
 * Generate HNWI-targeted research queries for a property
 */
function buildPropertyResearchQueries(propName: string, destName: string): string[] {
  return [
    `What sets ${propName} apart from other luxury lodges in ${destName}?`,
    `${propName} luxury accommodations, amenities, and exclusive experiences`,
    `${propName} conservation initiatives and community impact`,
    `${propName} seasonal access, cost per night, and booking exclusivity`,
  ]
}

/**
 * Create a content project and trigger workflows
 */
async function createContentProject(
  payload: ReturnType<typeof getPayload>,
  entity: Entity,
  dryRun: boolean,
): Promise<GenerationResult> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
  const secret = process.env.CONTENT_SYSTEM_SECRET

  if (!secret) {
    return {
      entity,
      action: 'error',
      error: 'CONTENT_SYSTEM_SECRET not set',
    }
  }

  try {
    // Check if project already exists
    const existing = await payload.find({
      collection: 'content-projects',
      where: {
        and: [
          {
            targetCollection: {
              equals: entity.type === 'property' ? 'properties' : 'destinations',
            },
          },
          { targetRecordId: { equals: String(entity.id) } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      return {
        entity,
        action: 'skipped',
        projectId: (existing.docs[0] as unknown as { id: number }).id,
      }
    }

    if (dryRun) {
      return {
        entity,
        action: 'skipped', // Would create but in dry-run mode
      }
    }

    const contentType = entity.type === 'property' ? 'property_page' : 'destination_page'
    const targetCollection = entity.type === 'property' ? 'properties' : 'destinations'

    // Create the project
    const created = await payload.create({
      collection: 'content-projects',
      data: {
        title: entity.name,
        slug: entity.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        stage: 'idea',
        contentType: contentType as 'destination_page' | 'property_page',
        originPathway: 'cascade' as const,
        targetCollection: targetCollection as 'destinations' | 'properties',
        targetRecordId: String(entity.id),
        briefSummary:
          entity.type === 'property'
            ? `Create a rich, HNWI-focused property page for ${entity.name} in ${entity.parentName}. Emphasize luxury, exclusivity, and unique experiences.`
            : `Create a comprehensive HNWI-focused destination page for ${entity.name}. Emphasize wildlife, conservation, exclusivity, and why luxury travelers choose this destination.`,
        targetAngle:
          entity.type === 'property'
            ? 'High-net-worth travelers seeking luxury and exclusivity'
            : 'Luxury safari enthusiasts, conservationists, and HNWI travelers',
      },
    })

    const projectId = (created as unknown as { id: number }).id

    // Build research queries
    const queries =
      entity.type === 'property'
        ? buildPropertyResearchQueries(entity.name, entity.parentName || 'Unknown')
        : buildDestinationResearchQueries(entity.name)

    // Trigger research asynchronously (fire-and-forget)
    console.log(`[research] Triggering research for project ${projectId}...`)
    fetch(`${baseUrl}/api/content/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ projectId }),
    }).catch((err) => {
      console.error(`[research] Failed to trigger for project ${projectId}:`, err.message)
    })

    // Trigger drafting asynchronously (fire-and-forget)
    console.log(`[drafting] Triggering draft for project ${projectId}...`)
    fetch(`${baseUrl}/api/content/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ projectId }),
    }).catch((err) => {
      console.error(`[drafting] Failed to trigger for project ${projectId}:`, err.message)
    })

    return {
      entity,
      action: 'created',
      projectId,
    }
  } catch (err) {
    return {
      entity,
      action: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Main script
 */
async function main() {
  const options = parseArgs()

  console.log(`\n${'═'.repeat(70)}`)
  console.log('  KIULI DESTINATION CONTENT AUTO-GENERATOR')
  console.log(`${'═'.repeat(70)}\n`)

  console.log(`Options:`)
  console.log(`  --dry-run: ${options.dryRun ? 'enabled' : 'disabled'}`)
  console.log(`  --type: ${options.type}\n`)

  if (!process.env.CONTENT_SYSTEM_SECRET) {
    console.error('❌ CONTENT_SYSTEM_SECRET not set in environment')
    process.exit(1)
  }

  try {
    const payload = await getPayload({ config: configPromise })

    // Step 1: Fetch entities needing content
    console.log('Step 1: Fetching entities with minimal content...')
    const entities = await fetchDestinationsNeedingContent(payload, options.type)
    console.log(`Found ${entities.length} total entities\n`)

    const needsContent = entities.filter((e) => !e.hasContent)
    console.log(
      `${needsContent.length} entities need content:`,
    )
    needsContent.forEach((e) => {
      const typeLabel = e.type === 'property' ? `${e.name} (in ${e.parentName})` : e.name
      console.log(`  • ${typeLabel}`)
    })
    console.log('')

    // Step 2: Create projects and trigger workflows
    console.log(`Step 2: ${options.dryRun ? '[DRY RUN] Would create' : 'Creating'} content projects...`)
    const results: GenerationResult[] = []

    for (const entity of needsContent) {
      const result = await createContentProject(payload, entity, options.dryRun)
      results.push(result)

      const status =
        result.action === 'created'
          ? `✓ Created (ID: ${result.projectId})`
          : result.action === 'skipped'
            ? '⊘ Skipped (exists)'
            : `✗ Error: ${result.error}`

      const typeLabel = entity.type === 'property' ? `${entity.name} (${entity.parentName})` : entity.name
      console.log(`  ${status} | ${typeLabel}`)
    }

    // Summary
    const created = results.filter((r) => r.action === 'created').length
    const skipped = results.filter((r) => r.action === 'skipped').length
    const errors = results.filter((r) => r.action === 'error').length

    console.log(`\n${'═'.repeat(70)}`)
    console.log('SUMMARY')
    console.log(`${'═'.repeat(70)}`)
    console.log(`Created:  ${created}`)
    console.log(`Skipped:  ${skipped}`)
    console.log(`Errors:   ${errors}`)
    console.log(`Total:    ${results.length}\n`)

    if (errors > 0) {
      console.log('Failed entities:')
      results
        .filter((r) => r.action === 'error')
        .forEach((r) => {
          console.log(`  ✗ ${r.entity.name}: ${r.error}`)
        })
      console.log('')
    }

    if (options.dryRun) {
      console.log('(DRY RUN MODE — no projects or workflows were actually created)\n')
    }

    process.exit(errors > 0 ? 1 : 0)
  } catch (err) {
    console.error('Fatal error:', err instanceof Error ? err.message : String(err))
    console.error(err)
    process.exit(1)
  }
}

main()
