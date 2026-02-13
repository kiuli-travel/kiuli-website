import { query } from '../db'
import {
  chunkItineraryStays,
  chunkItineraryActivities,
  chunkFaqItems,
  chunkProperties,
  chunkDestinations,
  type BootstrapChunk,
} from './chunker'
import { embedAndInsertBatches } from './embedder'

interface BootstrapResult {
  total: number
  byType: Record<string, number>
  skipped: { stays: number; activities: number; faqs: number; properties: number; destinations: number }
}

export async function bootstrap(): Promise<BootstrapResult> {
  const allChunks: BootstrapChunk[] = []
  const skipped = { stays: 0, activities: 0, faqs: 0, properties: 0, destinations: 0 }

  // --- Itinerary stays ---
  console.log('Querying itinerary stays...')
  const stays = await query(`
    SELECT s.id, s._parent_id as itinerary_id, s.accommodation_name, s.description_itrvl,
           s.location, s.country, s.property_id
    FROM itineraries_blocks_stay s
    WHERE s.description_itrvl IS NOT NULL
  `)
  const stayChunks = chunkItineraryStays(stays.rows)
  skipped.stays = stays.rows.length - stayChunks.length
  console.log(`  Stays: ${stayChunks.length} chunks (${skipped.stays} skipped)`)
  allChunks.push(...stayChunks)

  // --- Itinerary activities ---
  console.log('Querying itinerary activities...')
  const activities = await query(`
    SELECT a.id, a._parent_id as itinerary_id, a.title, a.description_itrvl
    FROM itineraries_blocks_activity a
    WHERE a.description_itrvl IS NOT NULL
  `)
  const activityChunks = chunkItineraryActivities(activities.rows)
  skipped.activities = activities.rows.length - activityChunks.length
  console.log(`  Activities: ${activityChunks.length} chunks (${skipped.activities} skipped)`)
  allChunks.push(...activityChunks)

  // --- FAQ items ---
  console.log('Querying FAQ items...')
  const faqs = await query(`
    SELECT f.id, f._parent_id as itinerary_id, f.question, f.answer_itrvl
    FROM itineraries_faq_items f
    WHERE f.answer_itrvl IS NOT NULL
  `)
  const faqChunks = chunkFaqItems(faqs.rows)
  skipped.faqs = faqs.rows.length - faqChunks.length
  console.log(`  FAQs: ${faqChunks.length} chunks (${skipped.faqs} skipped)`)
  allChunks.push(...faqChunks)

  // --- Properties ---
  console.log('Querying properties...')
  const properties = await query(`
    SELECT p.id, p.name, p.slug, p.description_itrvl, p.destination_id
    FROM properties p
    WHERE p.description_itrvl IS NOT NULL
  `)
  const propertyChunks = chunkProperties(properties.rows)
  skipped.properties = properties.rows.length - propertyChunks.length
  console.log(`  Properties: ${propertyChunks.length} chunks (${skipped.properties} skipped)`)
  allChunks.push(...propertyChunks)

  // --- Destinations ---
  console.log('Querying destinations...')
  const destinations = await query(`
    SELECT d.id, d.name, d.slug, d.description, d.answer_capsule, d.best_time_to_visit
    FROM destinations d
    WHERE d.description IS NOT NULL
  `)
  const destChunks = chunkDestinations(destinations.rows)
  skipped.destinations = destinations.rows.length - destChunks.length
  console.log(`  Destinations: ${destChunks.length} chunks (${skipped.destinations} skipped)`)
  allChunks.push(...destChunks)

  console.log(`\nTotal chunks to embed: ${allChunks.length}`)

  // --- Idempotency: delete existing embeddings per source ---
  console.log('Clearing existing embeddings for idempotency...')

  // Collect unique itinerary IDs from segments and FAQs
  const itineraryIds = new Set<number>()
  for (const chunk of allChunks) {
    if ((chunk.chunkType === 'itinerary_segment' || chunk.chunkType === 'faq_answer') && chunk.itineraryId) {
      itineraryIds.add(chunk.itineraryId)
    }
  }
  for (const id of itineraryIds) {
    await query(`DELETE FROM content_embeddings WHERE chunk_type = 'itinerary_segment' AND itinerary_id = $1`, [id])
    await query(`DELETE FROM content_embeddings WHERE chunk_type = 'faq_answer' AND itinerary_id = $1`, [id])
  }

  // Collect unique property IDs
  const propertyIds = new Set<number>()
  for (const chunk of allChunks) {
    if (chunk.chunkType === 'property_section' && chunk.propertyId) {
      propertyIds.add(chunk.propertyId)
    }
  }
  for (const id of propertyIds) {
    await query(`DELETE FROM content_embeddings WHERE chunk_type = 'property_section' AND property_id = $1`, [id])
  }

  // Collect unique destination IDs
  const destinationIds = new Set<number>()
  for (const chunk of allChunks) {
    if (chunk.chunkType === 'destination_section' && chunk.destinationId) {
      destinationIds.add(chunk.destinationId)
    }
  }
  for (const id of destinationIds) {
    await query(`DELETE FROM content_embeddings WHERE chunk_type = 'destination_section' AND destination_id = $1`, [id])
  }

  console.log('Existing embeddings cleared.')

  // --- Embed and insert ---
  console.log('Embedding and inserting...')
  await embedAndInsertBatches(allChunks, (batch, total) => {
    console.log(`  Embedding batch ${batch}/${total} (${Math.min(batch * 20, allChunks.length)} chunks)`)
  })

  // --- Summary ---
  const byType: Record<string, number> = {}
  for (const chunk of allChunks) {
    byType[chunk.chunkType] = (byType[chunk.chunkType] ?? 0) + 1
  }

  return { total: allChunks.length, byType, skipped }
}
