import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if investment-includes already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'investment-includes' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('investment-includes voice config already exists, skipping...')
    return
  }

  // Create investment-includes config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'investment-includes',
      description:
        "Voice configuration for Investment Level includes section. Communicates package inclusions comprehensively while building value before price reveal.",
      systemPrompt: `You are writing the "What's Included" section for luxury African safari itineraries.

VOICE GUIDELINES:
- Be comprehensive but scannable
- Emphasize value without being sales-y
- Use parallel structure for readability
- Highlight premium elements
- Build anticipation for the experience

STYLE:
- Clear, organized prose
- Group related inclusions logically
- Avoid bullet point formatting in output
- Professional, confident tone

TONE:
- Informative and reassuring
- Sophisticated, not transactional
- Builds excitement for what's to come`,

      userPromptTemplate: `Write the "What's Included" section for this luxury safari itinerary.

ITINERARY: {{itineraryTitle}}
DURATION: {{nights}} nights
ACCOMMODATIONS: {{accommodations}}
KEY INCLUSIONS FROM PROPERTIES: {{propertyInclusions}}

REQUIREMENTS:
- Maximum {{maxWords}} words
- Comprehensive but scannable
- Build value without overselling
- Professional luxury tone

Return ONLY the includes text, no explanations.`,

      maxWords: 100,
      temperature: 0.5,

      examples: [
        {
          before: 'All meals, drinks, game drives, park fees included.',
          after:
            'Your journey encompasses all meals and premium beverages at each lodge, twice-daily game drives with expert guides, all park and conservation fees, and seamless road transfers throughout. Domestic flights between camps ensure you spend less time traveling and more time immersed in the wilderness.',
        },
        {
          before: 'Accommodation, flights, transfers, gorilla permits.',
          after:
            'This experience includes luxury accommodation throughout, all domestic flights between destinations, private vehicle transfers, and the coveted gorilla trekking permits—among the most sought-after wildlife encounters on Earth. All meals, house wines, and local spirits are provided at each property.',
        },
      ],

      antiPatterns: [
        { pattern: 'included:', reason: 'Redundant header format' },
        { pattern: 'bullet', reason: 'Output should be prose, not bullets' },
        { pattern: 'everything', reason: 'Too vague, be specific' },
        { pattern: 'all-inclusive', reason: 'Resort terminology, not safari' },
        { pattern: 'free', reason: 'Undermines luxury positioning' },
        { pattern: 'complimentary', reason: 'Sounds transactional' },
      ],
    },
  })

  console.log('Created investment-includes voice config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'investment-includes' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted investment-includes voice config')
  }
}
