/**
 * One-off script: delete orphaned embeddings and verify final state.
 * Usage: npx tsx content-system/scripts/cleanup-embeddings.ts
 */
import { query, end } from '../db'

async function main() {
  // Delete orphaned embeddings where the content_project no longer exists
  console.log('--- Deleting orphaned embeddings ---')
  const deleteResult = await query(`
    DELETE FROM content_embeddings
    WHERE content_project_id IS NOT NULL
      AND content_project_id NOT IN (
        SELECT id FROM content_projects
        WHERE content_type IN ('itinerary_cluster', 'authority')
          AND stage = 'brief'
      )
  `)
  console.log(`Deleted ${deleteResult.rowCount} orphaned embeddings`)

  // Verify final state
  const finalCount = await query(
    'SELECT COUNT(*) as cnt FROM content_embeddings WHERE content_project_id IS NOT NULL',
  )
  console.log(`\nFinal state: ${finalCount.rows[0].cnt} project embeddings`)

  const perItinerary = await query(`
    SELECT cp.origin_itinerary_id, COUNT(ce.id) as embeddings, COUNT(DISTINCT cp.id) as projects
    FROM content_projects cp
    JOIN content_embeddings ce ON ce.content_project_id = cp.id
    WHERE cp.content_type IN ('itinerary_cluster', 'authority')
    GROUP BY cp.origin_itinerary_id
    ORDER BY cp.origin_itinerary_id
  `)
  for (const row of perItinerary.rows) {
    console.log(`  Itinerary ${row.origin_itinerary_id}: ${row.projects} projects, ${row.embeddings} embeddings`)
  }

  // Check for any unembedded briefs
  const unembedded = await query(`
    SELECT cp.id, cp.title
    FROM content_projects cp
    LEFT JOIN content_embeddings ce ON ce.content_project_id = cp.id
    WHERE cp.content_type IN ('itinerary_cluster', 'authority')
      AND cp.stage = 'brief'
      AND ce.id IS NULL
    ORDER BY cp.id
  `)
  if (unembedded.rows.length > 0) {
    console.log(`\nWARNING: ${unembedded.rows.length} unembedded briefs:`)
    for (const row of unembedded.rows) {
      console.log(`  ID ${row.id}: ${row.title}`)
    }
  } else {
    console.log('\nAll briefs have embeddings.')
  }

  await end()
}

main().catch((err) => {
  console.error('Script failed:', err)
  end().then(() => process.exit(1))
})
