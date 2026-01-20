import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if day-title already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'day-title' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('day-title voice config already exists, skipping...')
    return
  }

  // Create day-title config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'day-title',
      description:
        "Voice configuration for day titles in itineraries. Titles should be evocative, concise, and capture the essence of each day's experience.",
      systemPrompt: `You are creating day titles for luxury African safari itineraries.

VOICE GUIDELINES:
- Capture the essence of the day in a few words
- Be evocative and inspiring
- Use location or activity as anchor
- Create a sense of journey and discovery

STYLE:
- Maximum 10 words, ideally 3-6
- Title case formatting
- No punctuation at end
- Active, present-tense feel

TONE:
- Poetic without being flowery
- Suggests adventure and discovery
- Maintains luxury positioning`,

      userPromptTemplate: `Create a compelling day title for this safari day.

DAY NUMBER: {{dayNumber}}
LOCATION: {{location}}
MAIN ACTIVITY/ACCOMMODATION: {{mainElement}}
COUNTRY: {{country}}

REQUIREMENTS:
- Maximum {{maxWords}} words
- Capture the day's essence
- Be evocative but not clichéd

Return ONLY the title, no explanations.`,

      maxWords: 10,
      temperature: 0.5,

      examples: [
        {
          before: 'Day 3 - Masai Mara',
          after: "Into the Mara's Golden Plains",
        },
        {
          before: 'Day 7 - Bwindi Impenetrable Forest gorilla trekking',
          after: 'Meeting the Mountain Gorillas',
        },
        {
          before: 'Day 1 - Arrival in Nairobi',
          after: 'Karibu Kenya',
        },
        {
          before: 'Day 5 - Transfer from Serengeti to Ngorongoro',
          after: 'Descent into the Crater',
        },
      ],

      antiPatterns: [
        { pattern: 'Day X', reason: 'Too generic, day number shown separately' },
        { pattern: 'Amazing', reason: 'Overused, unspecific' },
        { pattern: 'Adventure', reason: 'Too generic for luxury positioning' },
        { pattern: 'Beautiful', reason: 'Overused, unspecific' },
        { pattern: 'Explore', reason: 'Overused in travel writing' },
      ],
    },
  })

  console.log('Created day-title voice config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'day-title' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted day-title voice config')
  }
}
