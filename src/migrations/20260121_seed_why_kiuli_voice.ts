import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if why-kiuli already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'why-kiuli' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('why-kiuli already exists, skipping...')
    return
  }

  // Create why-kiuli config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'why-kiuli',
      description:
        'Voice configuration for the "Why Kiuli" section. This section explains why Kiuli is the right partner for this specific journey—our access, relationships, and insider knowledge.',
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

WHY KIULI-SPECIFIC GUIDELINES:
- Focus on Kiuli's unique advantages for THIS specific itinerary
- Mention specific relationships with camps, guides, or conservancies
- Highlight insider access or special arrangements
- Explain how Kiuli's expertise enhances this particular journey
- Be concrete about what Kiuli brings to the table`,

      userPromptTemplate: `Enhance the "Why Kiuli" section for this luxury safari itinerary.

CONTEXT:
- Itinerary: {{itineraryTitle}}
- Destinations: {{destinations}}

ORIGINAL TEXT:
{{content}}

REQUIREMENTS:
- Explain why Kiuli is the ideal partner for this specific journey
- Be specific about relationships, access, or expertise
- Show value without being salesy
- Keep to approximately 100-150 words
- Build trust and confidence in Kiuli

Return ONLY the enhanced text, no explanations.`,

      maxWords: 150,
      temperature: 0.6,

      examples: [
        {
          before: 'Kiuli has good relationships with these camps and can get you the best rates and availability.',
          after:
            'Our decade-long partnership with the Singita collection means priority access to their most coveted suites—the ones that rarely appear on standard allocation lists. We\'ve walked these properties with their founders, trained alongside their guides, and understand the subtle differences that make each camp perfect for particular travelers. When availability seems impossible, we often find a way.',
        },
      ],

      antiPatterns: [
        { pattern: 'world-class', reason: 'Vague, unsubstantiated claim' },
        { pattern: 'best rates', reason: 'Leads with price, not value' },
        { pattern: 'amazing', reason: 'Too casual, unspecific' },
        { pattern: 'we are the best', reason: 'Boastful, unsubstantiated' },
        { pattern: 'unparalleled', reason: 'Overused, unsubstantiated' },
        { pattern: 'second to none', reason: 'Cliché, unsubstantiated' },
        { pattern: 'exclusive access', reason: 'Overused, be specific instead' },
        { pattern: 'VIP treatment', reason: 'Too commercial sounding' },
      ],
    },
  })

  console.log('Created why-kiuli config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'why-kiuli' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted why-kiuli config')
  }
}
