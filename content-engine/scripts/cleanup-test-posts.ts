/**
 * Remove diagnostic test posts created during Phase 13 debugging.
 * Posts 14, 18, 21 are test artifacts. Post 22 is the real published article.
 *
 * Payload's delete cascades to:
 * - posts_faq_items (FK _parent_id)
 * - _posts_v (FK parent_id) → cascades to _posts_v_version_faq_items, _posts_v_version_populated_authors
 * - posts_rels, posts_populated_authors
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TEST_POST_IDS = [14, 18, 21]

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('=== Cleanup Diagnostic Test Posts ===\n')

  // Verify these are actually test posts before deleting
  for (const id of TEST_POST_IDS) {
    try {
      const post = await payload.findByID({ collection: 'posts', id, depth: 0 }) as any
      const title = post.title as string
      if (!title.startsWith('Diag') && title !== 'Diagnostic Test Post') {
        console.log(`ABORT: Post ${id} title "${title}" does not look like a test post`)
        process.exit(1)
      }
      console.log(`Post ${id}: "${title}" — confirmed test post`)
    } catch {
      console.log(`Post ${id}: not found (already deleted) — skip`)
    }
  }

  console.log('')

  // Delete via Payload (handles cascade)
  for (const id of TEST_POST_IDS) {
    try {
      await payload.delete({ collection: 'posts', id })
      console.log(`Deleted post ${id}`)
    } catch {
      console.log(`Post ${id}: delete failed or not found — skip`)
    }
  }

  console.log('\nVerification:')

  // Verify posts gone
  const remaining = await payload.find({
    collection: 'posts',
    where: { id: { in: TEST_POST_IDS } },
    depth: 0,
  })
  console.log(`Posts remaining with test IDs: ${remaining.docs.length} (expected 0)`)

  // Verify post 22 still exists
  try {
    const post22 = await payload.findByID({ collection: 'posts', id: 22, depth: 0 }) as any
    console.log(`Post 22 ("${(post22.title as string).slice(0, 50)}...") still exists — GOOD`)
  } catch {
    console.log('CRITICAL: Post 22 is missing!')
    process.exit(1)
  }

  // Count remaining posts
  const allPosts = await payload.find({ collection: 'posts', limit: 100, depth: 0 })
  console.log(`Total posts in collection: ${allPosts.docs.length}`)

  console.log('\n=== CLEANUP COMPLETE ===')
  process.exit(0)
}

run().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1) })
