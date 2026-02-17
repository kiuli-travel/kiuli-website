/**
 * One-off script: reset ghost completion projects to idle state.
 * These projects have processing_status='completed' but no content.
 * Approved by Graham on 2026-02-17.
 *
 * Usage: npx tsx content-system/scripts/reset-ghost-completions.ts
 */
import { query, end } from '../db'

const GHOST_IDS = [79, 87, 89]

async function main() {
  console.log(`Resetting ${GHOST_IDS.length} ghost completions: ${GHOST_IDS.join(', ')}`)

  // Show before state
  const before = await query(
    `SELECT id, stage, processing_status, processing_error FROM content_projects WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log('\nBEFORE:')
  for (const row of before.rows) {
    console.log(`  ID ${row.id}: stage=${row.stage}, processing_status=${row.processing_status}, error=${row.processing_error}`)
  }

  // Reset
  const result = await query(
    `UPDATE content_projects SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log(`\nUpdated ${result.rowCount} rows`)

  // Show after state
  const after = await query(
    `SELECT id, stage, processing_status, processing_error FROM content_projects WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log('\nAFTER:')
  for (const row of after.rows) {
    console.log(`  ID ${row.id}: stage=${row.stage}, processing_status=${row.processing_status}, error=${row.processing_error}`)
  }

  await end()
}

main().catch((err) => {
  console.error('Script failed:', err)
  end().then(() => process.exit(1))
})
