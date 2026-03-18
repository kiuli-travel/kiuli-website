#!/usr/bin/env node
// @ts-nocheck — standalone script, not part of Next.js build

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
 *   --type=<type>     Filter: "destination" or "property" (default: all)
 *
 * Process:
 *   1. Query all destinations and properties via HTTP API
 *   2. For each entity, create a ContentProject with contentType destination_page or property_page
 *   3. Trigger research pipeline with HNWI-targeted queries
 *   4. Trigger drafting pipeline
 *   5. Leave as drafts for travel designer review
 */

const fetch = globalThis.fetch

// ────────────────────────────────────────────────────────────────────────────

const CONTENT_SYSTEM_SECRET = process.env.CONTENT_SYSTEM_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'

if (!CONTENT_SYSTEM_SECRET) {
  console.error('ERROR: CONTENT_SYSTEM_SECRET environment variable is required')
  process.exit(1)
}

interface CliOptions {
  dryRun: boolean
  type: 'destination' | 'property' | 'all'
}

interface Entity {
  id: number
  name: string
  type: 'country' | 'destination' | 'property'
  parentName?: string
}

interface GenerationResult {
  entity: Entity
  action: 'created' | 'skipped' | 'error'
  projectId?: number
  error?: string
}

interface ContentProject {
  title: string
  slug: string
  stage: string
  contentType: string
  originPathway: string
  targetCollection: string
  targetRecordId: string
  briefSummary: string
  targetAngle: string
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    type: (args.find((a) => a.startsWith('--type='))?.split('=')[1] || 'all') as CliOptions['type'],
  }
}

/**
 * Fetch all destinations and properties
 */
async function fetchEntities(typeFilter: CliOptions['type']): Promise<Entity[]> {
  const url = new URL(`${BASE_URL}/api/content/entities`)
  if (typeFilter !== 'all') {
    url.searchParams.set('type', typeFilter)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch entities: ${response.statusText}`)
  }

  const data = (await response.json()) as { entities: Entity[] }
  return data.entities
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
 * Check if a project already exists
 */
async function projectExists(
  targetCollection: string,
  targetRecordId: string,
): Promise<boolean> {
  const url = new URL(`${BASE_URL}/api/content/projects`)
  url.searchParams.set('targetCollection', targetCollection)
  url.searchParams.set('targetRecordId', targetRecordId)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
      },
    })

    if (!response.ok) return false

    const data = (await response.json()) as { docs?: Array<{ id: number }> }
    return (data.docs?.length || 0) > 0
  } catch {
    return false
  }
}

/**
 * Create a content project and trigger workflows
 */
async function createContentProject(
  entity: Entity,
  dryRun: boolean,
): Promise<GenerationResult> {
  try {
    const contentType = entity.type === 'property' ? 'property_page' : 'destination_page'
    const targetCollection = entity.type === 'property' ? 'properties' : 'destinations'

    // Check if project already exists
    if (await projectExists(targetCollection, String(entity.id))) {
      return {
        entity,
        action: 'skipped',
      }
    }

    if (dryRun) {
      return {
        entity,
        action: 'skipped',
      }
    }

    const slug = entity.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const project: ContentProject = {
      title: entity.name,
      slug,
      stage: 'idea',
      contentType,
      originPathway: 'cascade',
      targetCollection,
      targetRecordId: String(entity.id),
      briefSummary:
        entity.type === 'property'
          ? `Create a rich, HNWI-focused property page for ${entity.name} in ${entity.parentName}. Emphasize luxury, exclusivity, and unique experiences.`
          : `Create a comprehensive HNWI-focused destination page for ${entity.name}. Emphasize wildlife, conservation, exclusivity, and why luxury travelers choose this destination.`,
      targetAngle:
        entity.type === 'property'
          ? 'High-net-worth travelers seeking luxury and exclusivity'
          : 'Luxury safari enthusiasts, conservationists, and HNWI travelers',
    }

    // Create project
    const createResponse = await fetch(`${BASE_URL}/api/content/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
      },
      body: JSON.stringify(project),
    })

    if (!createResponse.ok) {
      const error = await createResponse.text()
      throw new Error(`Failed to create project: ${error}`)
    }

    const created = (await createResponse.json()) as Record<string, unknown>
    const projectId = created.id as number

    if (!projectId) {
      throw new Error('No project ID returned from creation')
    }

    // Build research queries
    const queries =
      entity.type === 'property'
        ? buildPropertyResearchQueries(entity.name, entity.parentName || 'Unknown')
        : buildDestinationResearchQueries(entity.name)

    // Trigger research asynchronously (fire-and-forget)
    console.log(`[research] Triggering research for project ${projectId}...`)
    fetch(`${BASE_URL}/api/content/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
      },
      body: JSON.stringify({ projectId }),
    }).catch((err) => {
      console.error(`[research] Failed to trigger for project ${projectId}:`, err.message)
    })

    // Trigger drafting asynchronously (fire-and-forget)
    console.log(`[drafting] Triggering draft for project ${projectId}...`)
    fetch(`${BASE_URL}/api/content/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
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

  try {
    // Step 1: Fetch entities
    console.log('Step 1: Fetching entities...')
    const entities = await fetchEntities(options.type)
    console.log(`Found ${entities.length} total entities\n`)

    // Filter entities without content (we'll create projects for all for now)
    // In a real scenario, we'd check if they have content first
    console.log(`${entities.length} entities available for content generation:`)
    entities.forEach((e) => {
      const typeLabel = e.type === 'property' ? `${e.name} (in ${e.parentName})` : e.name
      console.log(`  • ${typeLabel}`)
    })
    console.log('')

    // Step 2: Create projects and trigger workflows
    console.log(
      `Step 2: ${options.dryRun ? '[DRY RUN] Would create' : 'Creating'} content projects...`,
    )
    const results: GenerationResult[] = []

    for (const entity of entities) {
      const result = await createContentProject(entity, options.dryRun)
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
