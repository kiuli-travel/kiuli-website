/**
 * Seed BrandVoice global with initial Kiuli voice configuration.
 *
 * Usage: npx tsx scripts/seed-brand-voice.ts
 *
 * Safe to re-run — overwrites all data in the brand-voice global.
 * Optionally migrates data from voice-configuration collection if records exist.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

async function seedBrandVoice() {
  const payload = await getPayload({ config })

  console.log('[seed] Loading existing voice-configuration records for migration...')
  const legacyConfigs: Record<string, Record<string, unknown>> = {}
  try {
    const result = await payload.find({
      collection: 'voice-configuration',
      limit: 100,
    })
    for (const doc of result.docs) {
      const d = doc as unknown as Record<string, unknown>
      legacyConfigs[String(d.name)] = d
    }
    console.log(`[seed] Found ${Object.keys(legacyConfigs).length} legacy voice-configuration records`)
  } catch {
    console.log('[seed] No legacy voice-configuration records found (or collection missing), proceeding with defaults')
  }

  // ── Layer 1: Core Identity ─────────────────────────────────────────

  const voiceSummary = `Kiuli writes with quiet confidence — the authority of decades spent in the African bush, delivered with warmth and specificity. We never oversell. We show, we don't tell. Every sentence earns its place.`

  const principles = [
    {
      principle: 'Specificity over generality',
      explanation: 'Name the bird species, describe the actual view, cite the specific lodge. Generic descriptions are the hallmark of operators who haven\'t been there.',
      example: 'Instead of "beautiful wildlife", write "a breeding herd of 200 elephants crossing the Mara River at Governor\'s Camp".',
    },
    {
      principle: 'Quiet confidence, not boastfulness',
      explanation: 'Kiuli\'s expertise speaks through knowledge and specificity, not through superlatives or self-congratulation. Let the experience do the talking.',
      example: 'Instead of "we offer the best safaris in Africa", write "our decade-long partnership with Singita means priority access to suites that rarely appear on standard allocation lists".',
    },
    {
      principle: 'Show, don\'t tell',
      explanation: 'Paint pictures with sensory details. Transport the reader rather than instructing them how to feel.',
      example: 'Instead of "the food is amazing", write "your private chef prepares boma dinners under the Milky Way, the smoke from the braai mixing with the scent of wild sage".',
    },
    {
      principle: 'Warmth without gush',
      explanation: 'Be approachable and human, but never effusive. Kiuli is the knowledgeable friend who happens to be an expert, not a salesperson.',
    },
    {
      principle: 'Transparency builds trust',
      explanation: 'Be honest about costs, limitations, and trade-offs. Affluent travellers distrust hard sells. Acknowledging what a destination lacks builds credibility for what it offers.',
      example: 'Instead of hiding that a camp has no WiFi, write "connectivity is limited by design — this is a place to disconnect".',
    },
    {
      principle: 'Earned authority',
      explanation: 'Every factual claim must be supportable. Cite sources for statistics. Use first-hand knowledge where available. Never fabricate or embellish.',
    },
    {
      principle: 'Every sentence earns its place',
      explanation: 'No filler. No padding. If a sentence doesn\'t add value, cut it. Concise writing respects the reader\'s time and intelligence.',
    },
  ]

  const audience = `US high-net-worth individuals planning $25,000-$100,000+ safari experiences. They are sophisticated, well-travelled, and research-intensive. They distrust hard sells and respond to earned authority. Their average consideration window is 217 days. They value exclusivity, authenticity, and expertise. Many have travelled to Africa before and are looking for deeper, more curated experiences.`

  const positioning = `Kiuli is one of the few luxury safari operators to show pricing upfront — only 5% of competitors do this. Our travel designers have decades of direct experience across East and Southern Africa. We have personal relationships with camp owners, guides, and conservancy managers. We provide insider access and honest guidance, not brochure copy. Our competitive advantage is depth of knowledge combined with radical transparency.`

  const bannedPhrases = [
    { phrase: 'breathtaking', reason: 'Generic superlative — says nothing specific', alternative: 'Describe the specific vista instead' },
    { phrase: 'unforgettable', reason: 'Tells the reader how to feel instead of showing', alternative: 'Describe what makes the moment memorable' },
    { phrase: 'amazing', reason: 'Empty superlative with no information content', alternative: 'Be specific about what impressed' },
    { phrase: 'stunning', reason: 'Overused in travel writing, has lost all meaning', alternative: 'Describe the visual in specific terms' },
    { phrase: 'once-in-a-lifetime', reason: 'Cliché that undermines credibility', alternative: 'Explain what makes it rare or unique' },
    { phrase: 'nestled', reason: 'The most overused word in lodge descriptions', alternative: 'Describe the actual setting and relationship to landscape' },
    { phrase: 'paradise', reason: 'Hyperbolic and generic', alternative: 'Describe what makes the place exceptional' },
    { phrase: 'bucket list', reason: 'Overused in travel marketing, feels cheap at this price point', alternative: 'Describe why this experience matters' },
    { phrase: 'hidden gem', reason: 'Cliché — if you\'re writing about it, it\'s not hidden', alternative: 'Explain what makes it lesser-known or exclusive' },
    { phrase: 'like nowhere else on earth', reason: 'Hyperbolic and unverifiable', alternative: 'Be specific about what distinguishes it' },
    { phrase: 'teeming with wildlife', reason: 'Generic and overused in safari writing', alternative: 'Name specific species and densities' },
  ]

  const antiPatterns = [
    { pattern: 'Opening with a rhetorical question', explanation: 'Rhetorical questions feel manipulative at this price point. Lead with authority and specificity instead.' },
    { pattern: 'Stacking superlatives', explanation: 'Multiple adjectives in a row ("stunning, breathtaking, unforgettable") signal lazy writing. One specific detail beats three adjectives.' },
    { pattern: 'Passive voice for Kiuli actions', explanation: 'When describing what Kiuli does, use active voice. "We arrange" not "arrangements are made".' },
    { pattern: 'Burying the lead', explanation: 'The most compelling aspect should come first. Don\'t make readers wade through setup to reach the good part.' },
    { pattern: 'Forced urgency', explanation: '"Book now before it\'s too late" or "limited availability" without evidence. Let scarcity speak for itself with specific facts.' },
  ]

  const goldStandard = [
    {
      excerpt: 'From the ancient baobabs of Tarangire to the endless plains of the Serengeti, this ten-night journey traces the path of the Great Migration. Three hand-selected camps — each with their own character and rhythm — place you at the heart of the action, whether witnessing a river crossing or sharing sundowners with Maasai warriors. This is Tanzania as few experience it: unhurried, intimate, and utterly transformative.',
      contentType: 'itinerary_enhancement',
      context: 'Itinerary overview — specific, evocative, shows rather than tells, no banned phrases',
      addedAt: new Date().toISOString(),
    },
    {
      excerpt: 'Our decade-long partnership with the Singita collection means priority access to their most coveted suites — the ones that rarely appear on standard allocation lists. We\'ve walked these properties with their founders, trained alongside their guides, and understand the subtle differences that make each camp perfect for particular travelers. When availability seems impossible, we often find a way.',
      contentType: 'itinerary_enhancement',
      context: 'Why Kiuli section — demonstrates earned authority, specific relationships, quiet confidence',
      addedAt: new Date().toISOString(),
    },
  ]

  // ── Layer 2: Content Type Guidance ─────────────────────────────────

  const contentTypeGuidance = [
    {
      contentType: 'itinerary_cluster',
      label: 'Itinerary Cluster (Article)',
      objective: 'Build topical authority and capture search intent. Articles are Kiuli\'s claim to expertise — they must teach the reader something they cannot learn from competitors. Every article naturally links to relevant itineraries.',
      toneShift: 'More educational and analytical than destination pages. Can be slightly more formal. Always evidence-based.',
      structuralNotes: '1,500-3,000 words. H2 sections with clear logical flow. Answer capsule in first 70 words. FAQ section with 8-10 questions optimised for AI Overview.',
      temperature: 0.5,
    },
    {
      contentType: 'authority',
      label: 'Authority Article',
      objective: 'Establish Kiuli as the definitive expert on a specific topic. These articles target questions that affluent travellers ask during their 217-day consideration window.',
      toneShift: 'Most authoritative and researched. Can reference sources. Balanced and fair when comparing options.',
      structuralNotes: '2,000-4,000 words. Deep, comprehensive coverage. Competitive differentiation through proprietary angles.',
      temperature: 0.5,
    },
    {
      contentType: 'designer_insight',
      label: 'Designer Insight',
      objective: 'Share first-hand experience from Emily, Jody, or Kiuli\'s network. These feel personal and authentic — like advice from a trusted friend who happens to be an expert.',
      toneShift: 'Most personal and warm. First person singular is acceptable here. Anecdotes welcome.',
      structuralNotes: '800-1,500 words. Conversational structure. Light on research, heavy on personal experience.',
      temperature: 0.7,
    },
    {
      contentType: 'destination_page',
      label: 'Destination Page',
      objective: 'Create desire and qualify on investment. The destination page is where a prospect falls in love with a place. It must paint a vivid picture while being honest about costs, logistics, and what to expect.',
      toneShift: 'More evocative and sensory than articles. Paint pictures. Use present tense. First person plural ("we") when referring to Kiuli\'s access and expertise.',
      structuralNotes: '9 sections: overview, when to visit, why choose, key experiences, getting there, health & safety, investment expectation, top lodges, FAQ. Each section has a distinct job.',
      temperature: 0.6,
    },
    {
      contentType: 'property_page',
      label: 'Property Page',
      objective: 'Sell the stay. Property pages must make the reader feel what it\'s like to wake up at this lodge. Specificity is paramount — room types, views, what makes THIS property different from the one down the road.',
      toneShift: 'Most intimate and sensory of all types. Close the distance between reader and place.',
      structuralNotes: 'Overview, FAQ, and future sections (experience highlights, amenities context). Shorter than destination pages.',
      temperature: 0.6,
    },
    {
      contentType: 'itinerary_enhancement',
      label: 'Itinerary Enhancement',
      objective: 'Transform raw iTrvl segment descriptions into compelling, specific content that sells each component of the journey.',
      toneShift: 'Concise and evocative. Each segment description must earn its words — no filler.',
      structuralNotes: '100-200 words per segment. Focus on what makes THIS stay/activity/transfer special.',
      temperature: 0.7,
    },
  ]

  // ── Layer 3: Section Guidance ──────────────────────────────────────

  // Helper to extract from legacy config
  function migrateLegacy(name: string) {
    const lc = legacyConfigs[name]
    if (!lc) return null
    return {
      examples: (Array.isArray(lc.examples) ? lc.examples : []).map((e: Record<string, unknown>) => ({
        before: String(e.before || ''),
        after: String(e.after || ''),
      })),
      promptTemplate: lc.userPromptTemplate ? String(lc.userPromptTemplate) : undefined,
      dontList: (Array.isArray(lc.antiPatterns) ? lc.antiPatterns : []).map((a: Record<string, unknown>) => ({
        item: String(a.pattern || ''),
      })),
    }
  }

  // Itinerary enhancement sections (migrated from voice-configuration)
  const overviewLegacy = migrateLegacy('overview-summary')
  const segmentLegacy = migrateLegacy('segment-description')
  const dayTitleLegacy = migrateLegacy('day-title')
  const faqLegacy = migrateLegacy('faq-answer')
  const investmentLegacy = migrateLegacy('investment-includes')
  const whyKiuliLegacy = migrateLegacy('why-kiuli')

  const sectionGuidance = [
    // ── Itinerary Enhancement sections ────────────────────────────────
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'overview',
      sectionLabel: 'Itinerary Overview',
      objective: 'Capture the essence and flow of the journey. The overview is the first thing prospects read and must immediately convey value and create desire.',
      toneNotes: 'Evocative and sensory. Lead with the most compelling aspect. Paint a picture of the overall arc.',
      wordCountRange: '150-200',
      doList: [
        { item: 'Lead with the most compelling aspect of the journey' },
        { item: 'Convey the rhythm and arc of the trip' },
        { item: 'Hint at exclusive access and insider knowledge' },
        { item: 'Create desire while maintaining credibility' },
      ],
      dontList: [
        { item: 'List camps or lodges without context' },
        { item: 'Use generic safari descriptions' },
        { item: 'Open with the number of nights (lead with the experience)' },
        ...(overviewLegacy?.dontList || []),
      ],
      examples: overviewLegacy?.examples || [],
      promptTemplate: overviewLegacy?.promptTemplate || `Enhance this itinerary overview summary for a luxury safari.\n\nCONTEXT:\n- Itinerary: {{itineraryTitle}}\n- Duration: {{nights}} nights\n- Destinations: {{destinations}}\n- Highlights: {{highlights}}\n\nORIGINAL TEXT:\n{{content}}\n\nREQUIREMENTS:\n- Capture the essence and flow of the journey\n- Highlight what makes this itinerary special\n- Create desire without overselling\n- Keep to approximately 150-200 words\n- Make affluent travelers want to learn more\n\nReturn ONLY the enhanced summary, no explanations.`,
    },
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'segment_description',
      sectionLabel: 'Segment Description',
      objective: 'Transform generic segment text into vivid, specific descriptions that sell each stay, activity, or transfer.',
      toneNotes: 'Concise and evocative. Each word must earn its place.',
      wordCountRange: '100-200',
      doList: [
        { item: 'Focus on sensory details specific to THIS property or activity' },
        { item: 'Mention what makes this segment unique within the journey' },
        { item: 'Use active voice and present tense' },
      ],
      dontList: [
        { item: 'Repeat information from other segments' },
        { item: 'Use generic descriptions that could apply to any lodge' },
        ...(segmentLegacy?.dontList || []),
      ],
      examples: segmentLegacy?.examples || [],
      promptTemplate: segmentLegacy?.promptTemplate || `Enhance this safari segment description.\n\nCONTEXT:\n- Segment type: {{segmentType}}\n- Property/Activity: {{name}}\n- Location: {{location}}\n- Country: {{country}}\n\nORIGINAL TEXT:\n{{content}}\n\nReturn ONLY the enhanced description, no explanations.`,
    },
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'day_title',
      sectionLabel: 'Day Title',
      objective: 'Create evocative day titles that capture the essence of each day\'s experience.',
      toneNotes: 'Brief and evocative. Should intrigue, not just describe.',
      wordCountRange: '5-15',
      doList: [
        { item: 'Capture the day\'s defining moment or experience' },
        { item: 'Be specific to this itinerary, not generic' },
      ],
      dontList: [
        { item: 'Use "Day X:" prefix (that\'s handled by the template)' },
        { item: 'Be purely logistical ("Transfer to Camp")' },
        ...(dayTitleLegacy?.dontList || []),
      ],
      examples: dayTitleLegacy?.examples || [],
      promptTemplate: dayTitleLegacy?.promptTemplate || `Create an evocative day title for this safari day.\n\nCONTEXT:\n- Day: {{dayNumber}}\n- Location: {{location}}\n- Main element: {{mainElement}}\n- Country: {{country}}\n\nORIGINAL TITLE:\n{{content}}\n\nReturn ONLY the enhanced title, no explanations.`,
    },
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'faq_answer',
      sectionLabel: 'FAQ Answer',
      objective: 'Provide concise, authoritative answers optimised for AI Overview inclusion.',
      toneNotes: 'Direct and informative. Answer the question immediately, then add value.',
      wordCountRange: '40-80',
      doList: [
        { item: 'Answer the question in the first sentence' },
        { item: 'Include one specific detail or fact' },
        { item: 'Be concise enough for AI Overview extraction' },
      ],
      dontList: [
        { item: 'Open with "Great question" or similar filler' },
        { item: 'Hedge unnecessarily' },
        ...(faqLegacy?.dontList || []),
      ],
      examples: faqLegacy?.examples || [],
      promptTemplate: faqLegacy?.promptTemplate || `Enhance this FAQ answer for a luxury safari itinerary.\n\nQUESTION: {{question}}\n\nORIGINAL ANSWER:\n{{content}}\n\nREQUIREMENTS:\n- Answer concisely (40-80 words)\n- Be direct and authoritative\n- Include at least one specific detail\n\nReturn ONLY the enhanced answer, no explanations.`,
    },
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'investment_includes',
      sectionLabel: 'Investment Includes',
      objective: 'Transform a dry inclusions list into compelling value communication that justifies the investment level.',
      toneNotes: 'Factual but warm. Communicate value without being salesy.',
      wordCountRange: '100-150',
      doList: [
        { item: 'Group inclusions logically (accommodation, experiences, logistics)' },
        { item: 'Highlight what\'s exceptional about specific inclusions' },
        { item: 'Mention specific property names' },
      ],
      dontList: [
        { item: 'Use bullet points (write flowing prose)' },
        { item: 'Sound like terms and conditions' },
        ...(investmentLegacy?.dontList || []),
      ],
      examples: investmentLegacy?.examples || [],
      promptTemplate: investmentLegacy?.promptTemplate || `Enhance this investment inclusions description.\n\nCONTEXT:\n- Itinerary: {{itineraryTitle}}\n- Accommodations: {{accommodations}}\n\nORIGINAL TEXT:\n{{content}}\n\nReturn ONLY the enhanced description, no explanations.`,
    },
    {
      contentType: 'itinerary_enhancement',
      sectionKey: 'why_kiuli',
      sectionLabel: 'Why Kiuli',
      objective: 'Explain why Kiuli is the ideal partner for this specific journey — our access, relationships, and insider knowledge.',
      toneNotes: 'Confident without arrogance. Be specific about relationships and access.',
      wordCountRange: '100-150',
      doList: [
        { item: 'Mention specific relationships with camps, guides, or conservancies' },
        { item: 'Highlight insider access or special arrangements' },
        { item: 'Be concrete about what Kiuli brings to THIS journey' },
      ],
      dontList: [
        { item: 'Make generic claims ("we\'re the best")' },
        { item: 'Sound salesy or promotional' },
        ...(whyKiuliLegacy?.dontList || []),
      ],
      examples: whyKiuliLegacy?.examples || [],
      promptTemplate: whyKiuliLegacy?.promptTemplate || `Enhance the "Why Kiuli" section for this luxury safari itinerary.\n\nCONTEXT:\n- Itinerary: {{itineraryTitle}}\n- Destinations: {{destinations}}\n\nORIGINAL TEXT:\n{{content}}\n\nREQUIREMENTS:\n- Explain why Kiuli is the ideal partner for this specific journey\n- Be specific about relationships, access, or expertise\n- Show value without being salesy\n- Keep to approximately 100-150 words\n\nReturn ONLY the enhanced text, no explanations.`,
    },

    // ── Destination Page sections ─────────────────────────────────────
    {
      contentType: 'destination_page',
      sectionKey: 'overview',
      sectionLabel: 'Overview',
      objective: 'Set the scene and create desire. The overview is the hook — it must make the reader want to keep scrolling.',
      toneNotes: 'Most evocative section. Rich sensory language. Present tense.',
      wordCountRange: '200-300',
      doList: [
        { item: 'Open with the destination\'s defining characteristic' },
        { item: 'Paint a sensory picture of what it feels like to be there' },
        { item: 'Mention what makes this destination unique vs others in the region' },
      ],
      dontList: [
        { item: 'Open with geographic coordinates or encyclopedia-style facts' },
        { item: 'List attractions without context' },
      ],
      examples: [],
      promptTemplate: `Write the Overview section for the {{destination}} destination page.\n\nCONTEXT:\n{{context}}\n\nREQUIREMENTS:\n- 200-300 words\n- Create desire and set the scene\n- Sensory, evocative, present tense\n\nReturn ONLY the section content.`,
    },
    {
      contentType: 'destination_page',
      sectionKey: 'when_to_visit',
      sectionLabel: 'When to Visit',
      objective: 'Help prospects understand timing — seasons, migration patterns, weather, crowds. Must be genuinely useful for trip planning.',
      toneNotes: 'Informative and practical. Still warm but more factual than overview.',
      wordCountRange: '250-400',
      doList: [
        { item: 'Break down by season or month range' },
        { item: 'Mention specific wildlife events (migration, calving, etc.)' },
        { item: 'Be honest about shoulder seasons and trade-offs' },
        { item: 'Include practical weather information' },
      ],
      dontList: [
        { item: 'Say "any time is a good time" — be specific about trade-offs' },
        { item: 'Ignore green/wet season advantages' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'why_choose',
      sectionLabel: 'Why Choose This Destination',
      objective: 'Differentiate this destination from alternatives. Why here and not somewhere else?',
      toneNotes: 'Balanced and honest. Acknowledge alternatives fairly while highlighting unique strengths.',
      wordCountRange: '200-300',
      doList: [
        { item: 'Compare with similar destinations honestly' },
        { item: 'Highlight unique selling points with evidence' },
        { item: 'Address common misconceptions' },
      ],
      dontList: [
        { item: 'Trash competing destinations' },
        { item: 'Make unsubstantiated claims of superiority' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'key_experiences',
      sectionLabel: 'Key Experiences',
      objective: 'Showcase the headline experiences available at this destination. What will you actually DO here?',
      toneNotes: 'Vivid and experiential. Help the reader imagine themselves doing these things.',
      wordCountRange: '300-500',
      doList: [
        { item: 'Describe 4-6 signature experiences in detail' },
        { item: 'Include insider tips for each' },
        { item: 'Mention which properties are best positioned for each experience' },
      ],
      dontList: [
        { item: 'Simply list activities without context' },
        { item: 'Include generic activities available everywhere' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'getting_there',
      sectionLabel: 'Getting There',
      objective: 'Practical logistics — flights, transfers, visa requirements, journey time. Reduce uncertainty.',
      toneNotes: 'Clear and practical. Most factual section.',
      wordCountRange: '150-250',
      doList: [
        { item: 'Include hub airports and connection options' },
        { item: 'Mention charter flight options where relevant' },
        { item: 'Note visa requirements for US citizens' },
        { item: 'Give realistic total journey time estimates' },
      ],
      dontList: [
        { item: 'Include outdated airline routes without verification' },
        { item: 'Ignore visa requirements' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'health_safety',
      sectionLabel: 'Health & Safety',
      objective: 'Address health and safety concerns honestly and reassuringly. Build confidence without minimising real risks.',
      toneNotes: 'Reassuring but honest. Matter-of-fact.',
      wordCountRange: '150-250',
      doList: [
        { item: 'Cover malaria risk and prophylaxis options' },
        { item: 'Mention required/recommended vaccinations' },
        { item: 'Address altitude if relevant' },
        { item: 'Note medical evacuation availability' },
      ],
      dontList: [
        { item: 'Minimise genuine health risks' },
        { item: 'Provide specific medical advice (direct to professionals)' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'investment_expectation',
      sectionLabel: 'Investment Expectation',
      objective: 'Set pricing expectations with transparency. This is where qualification happens — present investment level AFTER value has been established.',
      toneNotes: 'Direct and transparent. Frame as investment, not cost.',
      wordCountRange: '150-250',
      doList: [
        { item: 'Give realistic per-person-per-night ranges' },
        { item: 'Explain what drives price variation (season, property tier)' },
        { item: 'Mention what is typically included/excluded' },
        { item: 'Reference specific Kiuli itineraries with their investment levels' },
      ],
      dontList: [
        { item: 'Be vague about pricing (that\'s what competitors do)' },
        { item: 'Apologise for high prices' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'top_lodges',
      sectionLabel: 'Top Lodges',
      objective: 'Highlight the best properties at this destination with honest assessments of what each offers.',
      toneNotes: 'Knowledgeable and opinionated. This is where Kiuli\'s expertise shines.',
      wordCountRange: '300-500',
      doList: [
        { item: 'Feature 4-6 properties with specific reasons to choose each' },
        { item: 'Include "best for" categories (families, honeymoon, photography, etc.)' },
        { item: 'Mention Kiuli\'s personal experience with each property' },
        { item: 'Link to relevant Kiuli itineraries featuring these properties' },
      ],
      dontList: [
        { item: 'List every property — curate the best' },
        { item: 'Copy lodge marketing materials' },
      ],
      examples: [],
    },
    {
      contentType: 'destination_page',
      sectionKey: 'faq',
      sectionLabel: 'FAQ',
      objective: 'Answer the most common questions about this destination. Optimised for AI Overview extraction.',
      toneNotes: 'Direct and concise. Each answer should work as a standalone snippet.',
      wordCountRange: '400-600',
      doList: [
        { item: 'Include 8-10 questions' },
        { item: 'Answer each in 40-80 words' },
        { item: 'Front-load the answer in the first sentence' },
        { item: 'Include practical, actionable information' },
      ],
      dontList: [
        { item: 'Include questions nobody actually asks' },
        { item: 'Give vague non-answers' },
      ],
      examples: [],
    },

    // ── Property Page sections ────────────────────────────────────────
    {
      contentType: 'property_page',
      sectionKey: 'overview',
      sectionLabel: 'Property Overview',
      objective: 'Make the reader feel what it\'s like to stay at this property. This is the most intimate content on the site.',
      toneNotes: 'Intimate and sensory. Close the distance between reader and place. Present tense.',
      wordCountRange: '200-350',
      doList: [
        { item: 'Describe the arrival experience' },
        { item: 'Mention specific room types and views' },
        { item: 'Note what makes this property different from others in the area' },
        { item: 'Include sensory details (sounds, scents, light)' },
      ],
      dontList: [
        { item: 'Copy the lodge\'s own marketing copy' },
        { item: 'List amenities without context' },
      ],
      examples: [],
    },
    {
      contentType: 'property_page',
      sectionKey: 'faq',
      sectionLabel: 'Property FAQ',
      objective: 'Answer practical questions about staying at this property.',
      toneNotes: 'Helpful and specific. Mix practical logistics with insider tips.',
      wordCountRange: '300-500',
      doList: [
        { item: 'Include 6-8 questions' },
        { item: 'Cover: room types, dining, activities, children, connectivity, accessibility' },
        { item: 'Include at least one insider tip per answer' },
      ],
      dontList: [
        { item: 'Duplicate information from the overview' },
        { item: 'Include generic questions not specific to this property' },
      ],
      examples: [],
    },
  ]

  // ── Layer 4: Evolution Log ─────────────────────────────────────────

  const evolutionLog = [
    {
      date: new Date().toISOString(),
      change: 'Initial brand voice configuration — migrated from voice-configuration collection and project knowledge documents',
      reason: 'Unified voice system replacing fragmented per-field voice configs. Single editable source for all content production.',
      source: 'initial_setup',
    },
  ]

  // ── Write to global ────────────────────────────────────────────────

  console.log('[seed] Writing BrandVoice global...')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.updateGlobal as any)({
    slug: 'brand-voice',
    data: {
      voiceSummary: voiceSummary,
      principles,
      audience,
      positioning,
      bannedPhrases,
      antiPatterns,
      goldStandard,
      contentTypeGuidance,
      sectionGuidance,
      evolutionLog,
    },
  })

  console.log('[seed] BrandVoice global seeded successfully:')
  console.log(`  - ${principles.length} principles`)
  console.log(`  - ${bannedPhrases.length} banned phrases`)
  console.log(`  - ${antiPatterns.length} anti-patterns`)
  console.log(`  - ${goldStandard.length} gold standard examples`)
  console.log(`  - ${contentTypeGuidance.length} content type guidances`)
  console.log(`  - ${sectionGuidance.length} section guidances`)
  console.log(`  - ${evolutionLog.length} evolution log entries`)

  process.exit(0)
}

seedBrandVoice().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
