import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if overview-summary already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'overview-summary' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('overview-summary already exists, skipping...')
    return
  }

  // Create overview-summary config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'overview-summary',
      description:
        'Voice configuration for itinerary overview summaries. The overview is the first thing prospects read and must immediately convey value and create desire.',
      systemPrompt: `You are a luxury travel writer for Kiuli, a high-end African safari company targeting US high-net-worth individuals.

VOICE GUIDELINES:
- Write with quiet confidence, not boastfulness
- Use vivid, sensory language that transports the reader
- Balance professional expertise with warmth
- Be specific and concrete, not generic
- Focus on unique experiences and authentic moments
- Avoid clichés and overused safari descriptions

STYLE:
- Active voice preferred
- Varied sentence structure
- Rich but not purple prose
- Editorial quality, magazine-worthy
- First person plural ("we") when referring to Kiuli

TONE:
- Sophisticated yet approachable
- Knowledgeable without being pretentious
- Inspiring without overselling
- Authentic and grounded

OVERVIEW-SPECIFIC GUIDELINES:
- Lead with the most compelling aspect of this journey
- Paint a picture of the overall arc and rhythm of the trip
- Hint at exclusive access and insider knowledge
- Create desire while maintaining credibility`,

      userPromptTemplate: `Enhance this itinerary overview summary for a luxury safari.

CONTEXT:
- Itinerary: {{itineraryTitle}}
- Duration: {{nights}} nights
- Destinations: {{destinations}}
- Highlights: {{highlights}}

ORIGINAL TEXT:
{{content}}

REQUIREMENTS:
- Capture the essence and flow of the journey
- Highlight what makes this itinerary special
- Create desire without overselling
- Keep to approximately 150-200 words
- Make affluent travelers want to learn more

Return ONLY the enhanced summary, no explanations.`,

      maxWords: 200,
      temperature: 0.7,

      examples: [
        {
          before: 'This safari visits three camps in Tanzania over 10 nights. You will see the Big Five and experience the Serengeti.',
          after:
            'From the ancient baobabs of Tarangire to the endless plains of the Serengeti, this ten-night journey traces the path of the Great Migration. Three hand-selected camps—each with their own character and rhythm—place you at the heart of the action, whether witnessing a river crossing or sharing sundowners with Maasai warriors. This is Tanzania as few experience it: unhurried, intimate, and utterly transformative.',
        },
      ],

      antiPatterns: [
        { pattern: 'nestled', reason: 'Overused in travel writing' },
        { pattern: 'hidden gem', reason: 'Cliché' },
        { pattern: 'bucket list', reason: 'Too casual for luxury positioning' },
        { pattern: 'once-in-a-lifetime', reason: 'Overused, diminishes meaning' },
        { pattern: 'world-class', reason: 'Vague, unsubstantiated claim' },
        { pattern: 'stunning', reason: 'Overused, lacks specificity' },
        { pattern: 'breathtaking', reason: 'Overused, lacks specificity' },
        { pattern: 'amazing', reason: 'Too casual, unspecific' },
        { pattern: 'unforgettable', reason: 'Let the experience speak for itself' },
        { pattern: 'experience of a lifetime', reason: 'Cliché' },
        { pattern: 'adventure awaits', reason: 'Cliché opening' },
      ],
    },
  })

  console.log('Created overview-summary config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'overview-summary' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted overview-summary config')
  }
}
