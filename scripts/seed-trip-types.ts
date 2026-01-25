/**
 * Seed TripTypes Collection via HTTP API
 *
 * Prerequisites: Dev server must be running (npm run dev)
 *
 * Usage: npx tsx scripts/seed-trip-types.ts
 */

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '4ea3d6c7-6b4c-42e5-b61d-9cc1546252ff'

const tripTypes = [
  { name: 'Great Migration', slug: 'great-migration', sortOrder: 1, shortDescription: 'Witness the greatest wildlife spectacle on Earth' },
  { name: 'Gorilla Trekking', slug: 'gorilla-trekking', sortOrder: 2, shortDescription: 'Encounter mountain gorillas in their natural habitat' },
  { name: 'Beach & Bush', slug: 'beach-and-bush', sortOrder: 3, shortDescription: 'Combine safari adventure with Indian Ocean relaxation' },
  { name: 'Family Safari', slug: 'family-safari', sortOrder: 4, shortDescription: 'Create lasting memories with child-friendly experiences' },
  { name: 'Honeymoon', slug: 'honeymoon', sortOrder: 5, shortDescription: 'Romantic escapes in Africa\'s most intimate settings' },
  { name: 'Photography Safari', slug: 'photography-safari', sortOrder: 6, shortDescription: 'Capture Africa with expert guides and optimal positioning' },
] as const

async function checkExisting(slug: string): Promise<{ exists: boolean; id?: number }> {
  const url = `${PAYLOAD_API_URL}/api/trip-types?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`
  const response = await fetch(url, {
    headers: { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` },
  })
  const data = await response.json()
  if (data.docs?.[0]) {
    return { exists: true, id: data.docs[0].id }
  }
  return { exists: false }
}

async function createTripType(tripType: typeof tripTypes[number]): Promise<{ id: number }> {
  const url = `${PAYLOAD_API_URL}/api/trip-types`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tripType),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create ${tripType.name}: ${response.status} - ${error}`)
  }

  return await response.json()
}

async function getFinalCount(): Promise<number> {
  const url = `${PAYLOAD_API_URL}/api/trip-types?limit=1`
  const response = await fetch(url, {
    headers: { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` },
  })
  const data = await response.json()
  return data.totalDocs || 0
}

async function seed() {
  console.log(`[${new Date().toISOString()}] Starting trip-types seed...`)
  console.log(`API URL: ${PAYLOAD_API_URL}`)
  console.log(`Target count: ${tripTypes.length}`)
  console.log('')

  let created = 0
  let skipped = 0

  for (const tripType of tripTypes) {
    const { exists, id } = await checkExisting(tripType.slug)

    if (exists) {
      console.log(`SKIP: ${tripType.name} (already exists: ${id})`)
      skipped++
      continue
    }

    const created_doc = await createTripType(tripType)
    console.log(`CREATE: ${tripType.name} (id: ${created_doc.id})`)
    created++
  }

  console.log('')
  console.log(`[${new Date().toISOString()}] Seed complete`)
  console.log(`Created: ${created}, Skipped: ${skipped}, Total: ${created + skipped}`)

  const finalCount = await getFinalCount()
  console.log(`Final count in database: ${finalCount}`)

  process.exit(0)
}

seed().catch((err) => {
  console.error(`[${new Date().toISOString()}] SEED FAILED:`, err)
  process.exit(1)
})
