/**
 * Seed BrandVoice sectionGuidance with itinerary_title, meta_title, meta_description entries.
 *
 * Usage: npx tsx scripts/seed-title-voice-guidance.ts
 *
 * Appends to existing sectionGuidance — safe to re-run (skips keys that already exist).
 */
import { getPayload } from 'payload'
import config from '@payload-config'

interface SectionEntry {
  contentType: 'destination_page' | 'property_page' | 'itinerary_enhancement'
  sectionKey: string
  sectionLabel: string
  objective: string
  toneNotes?: string
  wordCountRange?: string
  doList?: { item: string }[]
  dontList?: { item: string }[]
  examples?: { before: string; after: string }[]
  promptTemplate?: string
}

const NEW_SECTIONS: SectionEntry[] = [
  {
    contentType: 'itinerary_enhancement',
    sectionKey: 'itinerary_title',
    sectionLabel: 'Itinerary Title',
    objective: 'A specific, evocative title that names the destination and hints at the experience. Never generic.',
    wordCountRange: '6-10 words',
    doList: [
      { item: 'Name the country or region' },
      { item: 'Hint at the experience type' },
      { item: 'Use specific nouns' },
    ],
    dontList: [
      { item: 'Use markdown formatting' },
      { item: 'Write sentences or paragraphs' },
      { item: 'Use exclamation marks' },
      { item: 'Exceed 10 words' },
      { item: 'Start with A or An unless essential' },
    ],
  },
  {
    contentType: 'itinerary_enhancement',
    sectionKey: 'meta_title',
    sectionLabel: 'Meta Title',
    objective: 'SEO-optimised page title for Google. Must include destination and experience type. Hard limit 60 characters.',
    wordCountRange: '6-9 words',
    doList: [
      { item: 'Include primary keyword' },
      { item: 'Include destination name' },
      { item: 'Keep under 60 characters' },
      { item: 'End with | Kiuli if space allows' },
    ],
    dontList: [
      { item: 'Use markdown' },
      { item: 'Exceed 60 characters' },
      { item: 'Write as a sentence' },
      { item: 'Use punctuation except pipe separator' },
    ],
  },
  {
    contentType: 'itinerary_enhancement',
    sectionKey: 'meta_description',
    sectionLabel: 'Meta Description',
    objective: 'Compelling 150-160 character search snippet. Must make the prospect want to click. Ends with a soft CTA.',
    wordCountRange: '25-35 words',
    doList: [
      { item: 'Lead with the most compelling detail' },
      { item: 'Include destination and experience type' },
      { item: 'End with action phrase' },
      { item: 'Stay between 150-160 characters' },
    ],
    dontList: [
      { item: 'Use markdown' },
      { item: 'Exceed 160 characters' },
      { item: 'Be generic' },
      { item: 'Start with the itinerary title verbatim' },
      { item: 'Use exclamation marks' },
    ],
  },
]

async function seed() {
  const payload = await getPayload({ config })

  // Read current BrandVoice global
  const current = await payload.findGlobal({ slug: 'brand-voice' }) as unknown as Record<string, unknown>
  const existingSections = (current.sectionGuidance || []) as SectionEntry[]
  const existingKeys = new Set(existingSections.map((s) => s.sectionKey))

  console.log(`[seed] Current sectionGuidance has ${existingSections.length} entries`)

  // Filter to only new sections
  const toAdd = NEW_SECTIONS.filter((s) => !existingKeys.has(s.sectionKey))

  if (toAdd.length === 0) {
    console.log('[seed] All 3 section keys already exist. Nothing to do.')
    process.exit(0)
  }

  console.log(`[seed] Adding ${toAdd.length} new section(s): ${toAdd.map((s) => s.sectionKey).join(', ')}`)

  const updatedSections = [...existingSections, ...toAdd]

  await payload.updateGlobal({
    slug: 'brand-voice',
    data: {
      sectionGuidance: updatedSections,
    },
  })

  // Verify
  const after = await payload.findGlobal({ slug: 'brand-voice' }) as unknown as Record<string, unknown>
  const afterSections = (after.sectionGuidance || []) as SectionEntry[]
  console.log(`[seed] Done. sectionGuidance now has ${afterSections.length} entries`)

  for (const key of ['itinerary_title', 'meta_title', 'meta_description']) {
    const found = afterSections.find((s) => s.sectionKey === key)
    console.log(`[seed]   ${key}: ${found ? 'PRESENT' : 'MISSING'}`)
  }

  process.exit(0)
}

seed().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
