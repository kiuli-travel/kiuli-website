import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Check if faq-answer already exists
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'faq-answer' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('faq-answer voice config already exists, skipping...')
    return
  }

  // Create faq-answer config
  const config = await payload.create({
    collection: 'voice-configuration',
    data: {
      name: 'faq-answer',
      description:
        'Voice configuration for FAQ answers. Answers should be concise, authoritative, and helpful while maintaining the Kiuli luxury travel voice.',
      systemPrompt: `You are an expert safari travel advisor for Kiuli, a luxury African safari company.

VOICE GUIDELINES:
- Be authoritative and knowledgeable
- Keep answers concise and direct
- Maintain warmth while being informative
- Avoid hedging or uncertain language
- Speak from experience, not speculation

STYLE:
- Clear, scannable prose
- Lead with the answer, then elaborate
- Use specific details when relevant
- Active voice preferred

TONE:
- Confident expert sharing insider knowledge
- Helpful without being condescending
- Professional yet approachable`,

      userPromptTemplate: `Enhance this FAQ answer for a luxury safari travel website.

QUESTION: {{question}}

ORIGINAL ANSWER:
{{content}}

REQUIREMENTS:
- Keep the answer concise (max {{maxWords}} words)
- Be authoritative and helpful
- Maintain factual accuracy
- Use the Kiuli luxury travel voice

Return ONLY the enhanced answer, no explanations.`,

      maxWords: 80,
      temperature: 0.5,

      examples: [
        {
          before: 'The best time to visit is during the dry season which is from June to October.',
          after:
            'June through October offers ideal conditions—dry weather means animals gather at water sources, making wildlife viewing exceptional. The cooler temperatures also make game drives more comfortable.',
        },
        {
          before: 'You should get a yellow fever vaccine.',
          after:
            'A yellow fever vaccination is required for entry to most East African countries. We recommend scheduling this at least 10 days before departure, as immunity takes time to develop.',
        },
      ],

      antiPatterns: [
        { pattern: 'I think', reason: 'Too tentative for authoritative advice' },
        { pattern: 'probably', reason: 'Undermines expertise' },
        { pattern: 'you should', reason: 'Prefer positive framing' },
        { pattern: 'basically', reason: 'Filler word, adds nothing' },
        { pattern: 'obviously', reason: 'Condescending' },
        { pattern: 'actually', reason: 'Often unnecessary' },
      ],
    },
  })

  console.log('Created faq-answer voice config:', config.id)
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Find and delete the config
  const existing = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'faq-answer' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'voice-configuration',
      id: existing.docs[0].id,
    })
    console.log('Deleted faq-answer voice config')
  }
}
