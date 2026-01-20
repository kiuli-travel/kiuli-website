import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if segment-description already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'segment-description' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('segment-description already exists, skipping...')
    return
  }

  // Create segment-description config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'segment-description',
      description:
        'Voice configuration for Stay, Activity, and Transfer segment descriptions. Used when enhancing segment content with the Kiuli voice.',
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
- Authentic and grounded`,

      userPromptTemplate: `Enhance this segment description for a luxury safari itinerary.

CONTEXT:
- Segment type: {{segmentType}}
- Location: {{location}}
- Accommodation/Activity: {{name}}

ORIGINAL TEXT:
{{content}}

REQUIREMENTS:
- Maintain factual accuracy
- Enhance with sensory details and emotional resonance
- Keep approximately the same length (max {{maxWords}} words)
- Preserve any specific details like room types, timing, inclusions
- Make it compelling for affluent travelers

Return ONLY the enhanced description, no explanations.`,

      maxWords: 250,
      temperature: 0.6,

      examples: [
        {
          before: 'Arrive at camp. Settle in. Afternoon game drive.',
          after:
            'Your bush plane touches down on the private airstrip, where your guide awaits with a warm welcome. Settle into your tented suite—where polished teak and crisp linens meet the wild—before embarking on your first afternoon game drive as the light turns golden across the savanna.',
        },
        {
          before: 'Full board accommodation including all meals and local drinks.',
          after:
            'Your stay includes all meals prepared by our talented chefs—from sunrise coffee delivered to your veranda to candlelit dinners under the stars—along with premium local wines and spirits to complement each culinary moment.',
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
      ],
    },
  })

  console.log('Created segment-description config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'segment-description' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted segment-description config')
  }
}
