import { getPayload } from 'payload'
import config from '../src/payload.config'

const destinations = [
  { name: 'Kenya', slug: 'kenya', type: 'country' },
  { name: 'Tanzania', slug: 'tanzania', type: 'country' },
  { name: 'Uganda', slug: 'uganda', type: 'country' },
  { name: 'Rwanda', slug: 'rwanda', type: 'country' },
  { name: 'Botswana', slug: 'botswana', type: 'country' },
  { name: 'South Africa', slug: 'south-africa', type: 'country' },
  { name: 'Zambia', slug: 'zambia', type: 'country' },
  { name: 'Zimbabwe', slug: 'zimbabwe', type: 'country' },
  { name: 'Namibia', slug: 'namibia', type: 'country' },
  { name: 'Mozambique', slug: 'mozambique', type: 'country' },
] as const

async function seed() {
  const payload = await getPayload({ config })

  console.log(`[${new Date().toISOString()}] Starting destinations seed...`)
  console.log(`Target count: ${destinations.length}`)

  let created = 0
  let skipped = 0

  for (const destination of destinations) {
    const existing = await payload.find({
      collection: 'destinations',
      where: { slug: { equals: destination.slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`SKIP: ${destination.name} (already exists: ${existing.docs[0].id})`)
      skipped++
      continue
    }

    const created_doc = await payload.create({
      collection: 'destinations',
      data: destination,
      draft: true, // heroImage is required but not provided, so create as draft
    })
    console.log(`CREATE: ${destination.name} (id: ${created_doc.id})`)
    created++
  }

  console.log(`[${new Date().toISOString()}] Seed complete`)
  console.log(`Created: ${created}, Skipped: ${skipped}, Total: ${created + skipped}`)

  // Final verification query
  const final = await payload.find({
    collection: 'destinations',
    limit: 100,
  })
  console.log(`Final count in database: ${final.totalDocs}`)

  process.exit(0)
}

seed().catch((err) => {
  console.error(`[${new Date().toISOString()}] SEED FAILED:`, err)
  process.exit(1)
})
