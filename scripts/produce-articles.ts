#!/usr/bin/env node
// @ts-nocheck — standalone script, not part of Next.js build

const fetch = globalThis.fetch

/**
 * Content Engine Article Production Script
 * Produces 5 authority articles end-to-end through the Content Engine pipeline
 *
 * Usage:
 *   npx tsx scripts/produce-articles.ts [--dry-run]
 *
 * Requires:
 *   - CONTENT_SYSTEM_SECRET env var
 *   - NEXT_PUBLIC_SERVER_URL or defaults to https://kiuli.com
 */

const CONTENT_SYSTEM_SECRET = process.env.CONTENT_SYSTEM_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'

if (!CONTENT_SYSTEM_SECRET) {
  console.error('ERROR: CONTENT_SYSTEM_SECRET environment variable is required')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')

// Article briefs — each targeting a specific itinerary
const articleBriefs = [
  {
    itineraryId: 41,
    title: 'Serengeti Safari: The Migration and Beyond',
    briefSummary: 'The Serengeti is Africa\'s greatest wildlife spectacle. This article explores the Great Migration, the big five, and why Serengeti safaris remain the gold standard for luxury African travel.',
    targetAngle: 'Move beyond the cliché "witness the wildebeest crossing" narrative. Focus on the Serengeti as a precision ecosystem, the economics of conservation, and how luxury operators curate experiences that transcend simple game viewing.',
    targetAudience: ['customer', 'professional'],
    competitiveNotes: 'Competitors focus on wildlife lists and logistics. We emphasize the human side: how guides read landscapes, conservation partnerships, and the sensory experience of being in wild Africa.',
    destinations: ['Tanzania', 'Serengeti', 'Tarangire', 'Ngorongoro'],
    imagePrompts: [
      'A herd of African wildebeest in full gallop across a dusty Serengeti plain at sunset, creating a dynamic dust cloud behind them. Shot on Canon EOS R5 with Canon RF 400mm f/2.8L IS USM, f/2.8, ISO 400. Strong backlighting, naturalistic grain, shallow depth of field with out-of-focus foreground grasses.',
      'A single African lion resting in golden grassland, head alert toward camera, taken from 60 meters away. Shot on Nikon Z9 with NIKKOR Z 600mm f/4 TC VR S, f/4, ISO 800. Soft directional light, realistic bokeh, natural skin texture detail.',
    ],
  },
  {
    itineraryId: 42,
    title: 'Kenya Family Safari: Adventure and Wonder for All Ages',
    briefSummary: 'Family safaris in Kenya are not compromises — they\'re gateways to lifelong passion. Explore how Lewa, Loisaba, and Masai Mara create multi-generational experiences that educate, excite, and inspire conservation values.',
    targetAngle: 'Family safaris are often positioned as "safer" versions of adult trips. Invert this: position them as elite experiences requiring unique expertise. Focus on educational design, age-appropriate activities, and how young travelers process wonder.',
    targetAudience: ['customer'],
    competitiveNotes: 'Competitors offer "kid-friendly" lodges. We offer conservation education integrated into daily routines, conservation partnerships that children can participate in, and emotional resonance that lasts decades.',
    destinations: ['Kenya', 'Lewa', 'Loisaba', 'Masai Mara'],
    imagePrompts: [
      'A young child (age 6-8) with a guide using binoculars to spot wildlife in an acacia savanna, guide pointing toward distant trees. Golden late-afternoon light. Shot on Canon EOS R5 with Canon RF 70-200mm f/2.8L IS USM, f/4, ISO 400. Emotional moment capture, soft focus on background, natural moment (not staged).',
      'Aerial view of a Masai Mara landscape at dawn: scattered acacia trees, grassland with wildlife dotted across, morning mist in distant valleys. Shot on drone or wide telephoto. Natural color saturation, no oversaturation, realistic atmospheric perspective.',
    ],
  },
  {
    itineraryId: 43,
    title: 'Mountain Gorillas and Cloud Forests: Rwanda\'s Conservation Masterpiece',
    briefSummary: 'Rwanda transformed from conflict to become Africa\'s conservation leader. This article examines gorilla trekking as luxury experience, the ecological importance of Volcanoes, and Rwanda\'s model for sustainable tourism.',
    targetAngle: 'Gorilla trekking is often positioned as a bucket-list item. Reframe it as a profound conservation experience where luxury enables research, protection, and community benefit. Emphasize Rwanda\'s 25-year recovery as a leadership case study.',
    targetAudience: ['customer', 'professional'],
    competitiveNotes: 'Competitors focus on the gorilla encounter moment. We explore the full ecosystem: how permit costs fund protection, what researchers are discovering, and how visitors become conservation advocates.',
    destinations: ['Rwanda', 'Volcanoes National Park', 'Akagera', 'Nyungwe'],
    imagePrompts: [
      'A silverback mountain gorilla in misty cloud forest, moving through dense vegetation, facial expression visible, rain-wet fur. Shot on Nikon Z9 with NIKKOR Z 70-200mm f/2.8S, f/2.8, ISO 1600. Low light, natural mist, shallow focus on gorilla face, lush green forest bokeh.',
      'A female mountain gorilla cradling an infant, tender moment, dappled light through canopy. Shot on canon EOS R5 with 70-200mm telephoto, f/2.8, ISO 800. Intimate, emotional, bokeh of green leaves, natural depth of field.',
    ],
  },
  {
    itineraryId: 44,
    title: 'Kenya\'s Honeymoon Circuit: Romantic Safari Luxury Redefined',
    briefSummary: 'Honeymoon safaris in Kenya combine adventure and intimacy. Explore how Giraffe Manor, Loisaba, Angama Mara, and Diani create bespoke romantic experiences while offering uncompromising wildlife encounters and cultural immersion.',
    targetAngle: 'Position honeymoon safaris as sophisticated alternatives to beach-only destinations. Emphasize personalization, intimate wildlife moments, exclusivity, and how adventure deepens romantic connection. Avoid saccharine "sunset champagne" clichés.',
    targetAudience: ['customer'],
    competitiveNotes: 'Competitors rely on romance imagery. We focus on craft: how guides create intimate moments, how lodges understand couple dynamics, and how luxury safari differs fundamentally from resort romance.',
    destinations: ['Kenya', 'Giraffe Manor', 'Loisaba', 'Angama Mara', 'Diani'],
    imagePrompts: [
      'A couple standing at a viewpoint overlooking the Masai Mara at sunrise, silhouetted, peaceful moment. Shot on Canon EOS R5 with 24-70mm f/2.8, f/4, ISO 400. Golden light, natural composition (not overly staged), emotional but authentic.',
      'Two guests on a private game drive in early morning, guide driving, distant wildlife visible. Golden hour light, natural interaction. Shot on Nikon Z9 with 70-200mm, f/4, ISO 500. Candid, documentary-style, beautiful bokeh of acacia trees.',
    ],
  },
  {
    itineraryId: 45,
    title: 'Southern Africa\'s Untamed Frontier: Cape Town, Sabi Sands, and Benguerra',
    briefSummary: 'This itinerary spans three ecosystems: Table Mountain\'s urban wilderness, Sabi Sands\' Big Five habitat, and Benguerra\'s pristine island coast. Explore why Southern Africa\'s diversity makes it the continent\'s most comprehensive safari destination.',
    targetAngle: 'Southern Africa is often overshadowed by East Africa. Emphasize its geological majesty, ecological diversity, and sophistication. Position it as the destination for travelers seeking contrast: city-to-bush-to-island within one journey.',
    targetAudience: ['customer', 'professional'],
    competitiveNotes: 'Competitors rarely connect Southern Africa\'s three major ecosystems. We tell the integrated story of landscape, wildlife, and culture across a transforming continent.',
    destinations: ['South Africa', 'Mozambique', 'Cape Town', 'Sabi Sands', 'Benguerra'],
    imagePrompts: [
      'Table Mountain at sunset with Cape Town cityscape below, dramatic sky. Shot on Canon EOS R5 with 24-70mm f/2.8, f/5.6, ISO 400. Golden light, atmospheric, sharp mountain detail with soft city lights.',
      'An African leopard on a termite mound at dusk, alert pose, Sabi Sands landscape. Shot on Nikon Z9 with NIKKOR Z 600mm f/4 TC VR S, f/4.5, ISO 1000. Dramatic pose, natural light, bokeh of golden grass.',
    ],
  },
]

interface ArticleBrief {
  itineraryId: number
  title: string
  briefSummary: string
  targetAngle: string
  targetAudience: string[]
  competitiveNotes: string
  destinations: string[]
  imagePrompts: string[]
}

interface ContentProject {
  id?: number
  title: string
  slug: string
  stage: string
  contentType: string
  originPathway: string
  originItinerary?: number
  briefSummary: string
  targetAngle: string
  targetAudience: string[]
  competitiveNotes: string
  destinations: string[]
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function apiCall(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${CONTENT_SYSTEM_SECRET}`,
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const data = await response.json() as Record<string, unknown>

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`)
  }

  return data
}

async function createProject(brief: ArticleBrief): Promise<number> {
  const slug = brief.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)

  const project: ContentProject = {
    title: brief.title,
    slug: `${slug}-${Date.now()}`,
    stage: 'idea',
    contentType: 'authority',
    originPathway: 'itinerary',
    originItinerary: brief.itineraryId,
    briefSummary: brief.briefSummary,
    targetAngle: brief.targetAngle,
    targetAudience: brief.targetAudience,
    competitiveNotes: brief.competitiveNotes,
    destinations: brief.destinations,
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] Would create project:')
    console.log(JSON.stringify(project, null, 2))
    return 0 // Dummy ID for dry run
  }

  const response = (await apiCall('POST', '/api/content/projects', project)) as Record<string, unknown>
  const projectId = response.id as number

  if (!projectId) {
    throw new Error('No project ID returned from creation')
  }

  console.log(`✓ Created project ${projectId}: ${brief.title}`)
  return projectId
}

async function advanceStage(projectId: number, targetStage: string): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would advance project ${projectId} to stage: ${targetStage}`)
    return
  }

  await apiCall('PATCH', `/api/content/projects?id=${projectId}`, {
    stage: targetStage,
  })

  console.log(`  ✓ Advanced to ${targetStage}`)
}

async function triggerResearch(projectId: number): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would trigger research for project ${projectId}`)
    return
  }

  await apiCall('POST', '/api/content/research', { projectId })

  // Poll for completion
  let attempts = 0
  const maxAttempts = 120 // 10 minutes with 5s intervals
  while (attempts < maxAttempts) {
    await sleep(5000)
    const project = (await apiCall('GET', `/api/content/projects?id=${projectId}`)) as Record<string, unknown>
    const status = project.processingStatus as string

    if (status === 'completed' || status === 'idle') {
      // Check if synthesis was populated (research done)
      if (project.synthesis || status === 'completed') {
        console.log('  ✓ Research completed')
        return
      }
    }
    if (status === 'failed') {
      throw new Error(`Research failed: ${project.processingError}`)
    }

    attempts++
    if (attempts % 12 === 0) {
      console.log(`  → Still researching... (${attempts * 5}s elapsed)`)
    }
  }

  throw new Error('Research timeout after 10 minutes')
}

async function triggerDraft(projectId: number): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would trigger draft for project ${projectId}`)
    return
  }

  await apiCall('POST', '/api/content/draft', { projectId })

  // Poll for completion
  let attempts = 0
  const maxAttempts = 120 // 10 minutes with 5s intervals
  while (attempts < maxAttempts) {
    await sleep(5000)
    const project = (await apiCall('GET', `/api/content/projects?id=${projectId}`)) as Record<string, unknown>
    const status = project.processingStatus as string

    if (status === 'completed' || status === 'idle') {
      // Check if body was populated (draft done)
      if (project.body || status === 'completed') {
        console.log('  ✓ Draft completed')
        return
      }
    }
    if (status === 'failed') {
      throw new Error(`Draft failed: ${project.processingError}`)
    }

    attempts++
    if (attempts % 12 === 0) {
      console.log(`  → Still drafting... (${attempts * 5}s elapsed)`)
    }
  }

  throw new Error('Draft timeout after 10 minutes')
}

async function generateImage(
  projectId: number,
  prompt: string,
  index: number,
): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would generate image ${index + 1} for project ${projectId}`)
    console.log(`         Prompt: ${prompt.substring(0, 80)}...`)
    return
  }

  try {
    const result = (await apiCall('POST', '/api/content/generate-image', {
      prompt,
      metadata: {
        type: 'landscape',
        country: 'Multiple',
        aspectRatio: '16:9',
      },
    })) as Record<string, unknown>

    console.log(`  ✓ Generated image ${index + 1}`)
    if (result.imgixUrl) {
      console.log(`     URL: ${result.imgixUrl}`)
    }
  } catch (error) {
    console.warn(`  ⚠ Image generation failed (continuing): ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function runQualityGates(projectId: number): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would run quality gates for project ${projectId}`)
    return
  }

  const result = (await apiCall('POST', '/api/content/quality-gates', {
    projectId,
  })) as Record<string, unknown>

  if (result.passed) {
    console.log('  ✓ Quality gates passed')
  } else {
    const violations = (result.violations as Array<Record<string, unknown>>) || []
    console.warn(`  ⚠ Quality gates found ${violations.length} issue(s)`)
    violations.forEach((v) => {
      console.warn(`     - ${v.message}`)
    })
  }
}

async function publishArticle(projectId: number): Promise<void> {
  if (isDryRun) {
    console.log(`[DRY RUN] Would publish project ${projectId}`)
    return
  }

  const result = (await apiCall('POST', '/api/content/publish', {
    projectId,
  })) as Record<string, unknown>

  if (result.success) {
    console.log('  ✓ Published to Posts collection')
  } else {
    throw new Error(`Publish failed: ${result.error}`)
  }
}

async function processArticle(brief: ArticleBrief): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Article: ${brief.title}`)
  console.log(`Itinerary: ${brief.itineraryId}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // 1. Create project
    const projectId = await createProject(brief)
    if (isDryRun || projectId === 0) {
      return
    }

    // 2. Advance to research
    await advanceStage(projectId, 'research')
    await triggerResearch(projectId)

    // 3. Advance to draft
    await advanceStage(projectId, 'draft')
    await triggerDraft(projectId)

    // 4. Generate images
    for (let i = 0; i < brief.imagePrompts.length; i++) {
      await generateImage(projectId, brief.imagePrompts[i], i)
      await sleep(2000) // Rate limit between image requests
    }

    // 5. Run quality gates
    await runQualityGates(projectId)

    // 6. Publish
    await publishArticle(projectId)

    console.log(`\n✅ Completed: ${brief.title}`)
  } catch (error) {
    console.error(`\n❌ Failed: ${brief.title}`)
    console.error(`   ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('Kiuli Content Engine Article Production')
  console.log('='.repeat(60))
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Dry run: ${isDryRun ? 'YES' : 'NO'}`)
  console.log(`Articles to process: ${articleBriefs.length}`)

  for (const brief of articleBriefs) {
    await processArticle(brief)
    await sleep(2000) // Brief pause between articles
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Article production complete')
  console.log('='.repeat(60))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
