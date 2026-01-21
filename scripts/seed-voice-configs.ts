import { getPayload } from 'payload'
import config from '@payload-config'

async function seedVoiceConfigs() {
  const payload = await getPayload({ config })

  // Seed overview-summary
  const existingOverview = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'overview-summary' } },
    limit: 1,
  })

  if (existingOverview.docs.length === 0) {
    const overviewConfig = await payload.create({
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
    console.log('Created overview-summary config:', overviewConfig.id)
  } else {
    console.log('overview-summary already exists')
  }

  // Seed why-kiuli
  const existingWhyKiuli = await payload.find({
    collection: 'voice-configuration',
    where: { name: { equals: 'why-kiuli' } },
    limit: 1,
  })

  if (existingWhyKiuli.docs.length === 0) {
    const whyKiuliConfig = await payload.create({
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
    console.log('Created why-kiuli config:', whyKiuliConfig.id)
  } else {
    console.log('why-kiuli already exists')
  }

  console.log('Done seeding voice configurations')
}

seedVoiceConfigs()
  .then(() => {
    console.log('Seeding complete')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
