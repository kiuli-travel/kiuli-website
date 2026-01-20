import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if meta-description already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'meta-description' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('meta-description voice config already exists, skipping...')
    return
  }

  // Create meta-description config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'meta-description',
      description:
        'Voice configuration for SEO meta descriptions. Must be under 160 characters, compelling for search results, and accurately represent page content.',
      systemPrompt: `You are an SEO specialist for Kiuli, a luxury African safari company.

VOICE GUIDELINES:
- Be concise and compelling
- Include relevant keywords naturally
- Create urgency without being pushy
- Highlight unique value propositions
- Maintain luxury positioning

STYLE:
- Under 160 characters total
- Front-load important keywords
- Action-oriented when appropriate
- No quotes or special characters

TONE:
- Sophisticated and aspirational
- Clear and direct
- Enticing without clickbait`,

      userPromptTemplate: `Write a compelling SEO meta description for this safari itinerary page.

PAGE TITLE: {{title}}
DESTINATIONS: {{destinations}}
HIGHLIGHTS: {{highlights}}

REQUIREMENTS:
- Maximum 155 characters
- Include key destinations
- Compelling for search results
- Maintain luxury safari positioning

Return ONLY the meta description, no explanations.`,

      maxWords: 30,
      temperature: 0.4,

      examples: [
        {
          before: 'This is a safari trip to Kenya and Tanzania with gorillas and wildlife.',
          after:
            "Experience Kenya & Tanzania's finest lodges, witness the Great Migration, and track mountain gorillas on this exclusive 14-night luxury safari.",
        },
        {
          before: 'A Uganda trip with gorilla trekking and other activities.',
          after:
            "Trek with endangered mountain gorillas in Uganda's Bwindi Forest. Luxury lodges, expert guides, and life-changing wildlife encounters await.",
        },
      ],

      antiPatterns: [
        { pattern: 'click here', reason: 'Spammy, hurts SEO' },
        { pattern: 'best', reason: 'Unsubstantiated superlative' },
        { pattern: '!!!', reason: 'Unprofessional' },
        { pattern: 'cheap', reason: 'Contradicts luxury positioning' },
        { pattern: 'discount', reason: 'Contradicts luxury positioning' },
      ],
    },
  })

  console.log('Created meta-description voice config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'meta-description' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted meta-description voice config')
  }
}
