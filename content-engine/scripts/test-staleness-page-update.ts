/**
 * Integration test for Step 5b of consistency-checker.ts
 * Tests: page_update project creation and deduplication
 *
 * Uses the same Payload API calls as Step 5b, expressed as direct SQL
 * (Payload's local API requires Next.js runtime; CLI scripts use direct SQL).
 *
 * Run: npx tsx content-engine/scripts/test-staleness-page-update.ts
 */

import { query, end } from '../../content-system/db'

async function run() {
  // ── Synthetic staleness issue (same shape as consistency-checker produces) ──
  const syntheticStale = {
    issueType: 'staleness' as const,
    existingContent: 'The lodge has 12 rooms and was built in 2010',
    newContent: 'After 2024 renovations, the lodge now features 20 suites',
    sourceRecord: 'TEST-STALENESS: Integration test for Step 5b verification',
    resolution: 'pending' as const,
  }

  const titlePrefix = `Update: ${syntheticStale.sourceRecord}`.slice(0, 200)
  const briefSummary = `[Staleness from project 9999] Existing content may be outdated. New content states: "${syntheticStale.newContent}". Existing content: "${syntheticStale.existingContent}". Source: ${syntheticStale.sourceRecord}.`

  console.log('=== Step 5b Integration Test ===\n')

  // ── Test 1: Create page_update project ──────────────────────────────────

  console.log('TEST 1: Create page_update project')

  let createdId: number | null = null
  try {
    const result = await query(
      `INSERT INTO content_projects (title, content_type, stage, processing_status, origin_pathway, brief_summary, created_at, updated_at)
       VALUES ($1, 'page_update', 'proposed', 'idle', 'cascade', $2, NOW(), NOW())
       RETURNING id`,
      [titlePrefix, briefSummary]
    )
    createdId = result.rows[0].id
    console.log(`  PASS: Created project ID ${createdId}`)
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await end()
    process.exit(1)
  }

  // ── Test 2: Verify created project has correct fields ───────────────────

  console.log('\nTEST 2: Verify fields')

  try {
    const result = await query(
      `SELECT content_type, stage, processing_status, origin_pathway, brief_summary
       FROM content_projects WHERE id = $1`,
      [createdId]
    )

    if (result.rows.length === 0) {
      console.log(`  FAIL: Project ${createdId} not found after creation`)
      await end()
      process.exit(1)
    }

    const row = result.rows[0]
    const checks = [
      { field: 'content_type', expected: 'page_update', actual: row.content_type },
      { field: 'stage', expected: 'proposed', actual: row.stage },
      { field: 'processing_status', expected: 'idle', actual: row.processing_status },
      { field: 'origin_pathway', expected: 'cascade', actual: row.origin_pathway },
    ]

    let allPass = true
    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`  PASS: ${check.field} = '${check.actual}'`)
      } else {
        console.log(`  FAIL: ${check.field} expected '${check.expected}', got '${check.actual}'`)
        allPass = false
      }
    }

    // briefSummary should contain the staleness context
    if (row.brief_summary && row.brief_summary.includes('Staleness from project') && row.brief_summary.includes(syntheticStale.newContent)) {
      console.log(`  PASS: brief_summary contains staleness context (${row.brief_summary.length} chars)`)
    } else {
      console.log(`  FAIL: brief_summary missing or doesn't contain expected text`)
      allPass = false
    }

    if (!allPass) {
      console.log('\n  FAIL: Field verification failed')
      await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
      await end()
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
    await end()
    process.exit(1)
  }

  // ── Test 3: Dedup query finds the existing project ──────────────────────

  console.log('\nTEST 3: Dedup query')

  try {
    // This is the SQL equivalent of Step 5b's Payload find query
    const result = await query(
      `SELECT id FROM content_projects
       WHERE content_type = 'page_update'
         AND stage NOT IN ('published', 'rejected', 'filtered')
         AND title LIKE $1
       LIMIT 1`,
      [`%${syntheticStale.sourceRecord.slice(0, 50)}%`]
    )

    if (result.rows.length > 0 && result.rows[0].id === createdId) {
      console.log(`  PASS: Dedup query found project ID ${createdId}`)
    } else if (result.rows.length > 0) {
      console.log(`  FAIL: Dedup query found wrong project: ID ${result.rows[0].id}`)
      await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
      await end()
      process.exit(1)
    } else {
      console.log(`  FAIL: Dedup query returned 0 results — Step 5b would create a duplicate`)
      await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
      await end()
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
    await end()
    process.exit(1)
  }

  // ── Test 4: Dedup prevents duplicate creation ───────────────────────────

  console.log('\nTEST 4: Dedup prevents duplicate')

  try {
    // Simulate Step 5b running again with the same staleness issue
    const result = await query(
      `SELECT id FROM content_projects
       WHERE content_type = 'page_update'
         AND stage NOT IN ('published', 'rejected', 'filtered')
         AND title LIKE $1
       LIMIT 1`,
      [`%${syntheticStale.sourceRecord.slice(0, 50)}%`]
    )

    if (result.rows.length > 0) {
      console.log(`  PASS: Dedup found existing project — would NOT create duplicate`)
    } else {
      console.log(`  FAIL: Dedup returned 0 — would incorrectly create duplicate`)
      await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
      await end()
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
    await end()
    process.exit(1)
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  console.log('\nCLEANUP:')

  try {
    await query(`DELETE FROM content_projects WHERE id = $1`, [createdId])
    console.log(`  Deleted test project ID ${createdId}`)
  } catch (error) {
    console.log(`  WARNING: Failed to delete test project ${createdId}: ${error instanceof Error ? error.message : String(error)}`)
  }

  // ── Verify cleanup ─────────────────────────────────────────────────────

  console.log('\nVERIFY CLEANUP:')
  try {
    const result = await query(`SELECT id FROM content_projects WHERE id = $1`, [createdId])
    if (result.rows.length === 0) {
      console.log(`  PASS: Project ${createdId} confirmed deleted`)
    } else {
      console.log(`  FAIL: Project ${createdId} still exists after delete`)
      await end()
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await end()
    process.exit(1)
  }

  console.log('\n=== ALL TESTS PASS ===')
  await end()
  process.exit(0)
}

run().catch(async (error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`)
  await end()
  process.exit(1)
})
