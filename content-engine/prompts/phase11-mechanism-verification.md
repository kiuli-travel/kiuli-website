# Phase 11 — Mechanism Verification

## Purpose

The previous verification tested counts and shapes. This prompt tests whether the actual mechanisms work — whether data flows through real code paths and produces correct outcomes. Every test produces an evidence file that will be inspected by a separate reviewer who cannot see your console output.

**Evidence directory:** `content-engine/evidence/phase11/`

Create this directory first. Every evidence file must be valid JSON (unless specified as .txt). The reviewer will read these files directly — they are the ONLY proof that tests passed.

---

## GATE 1: Database Content Verification

The reviewer already knows the counts are correct. This gate proves the CONTENT is correct by extracting specific values that could only exist if real seed data was written.

Create `content-engine/evidence/phase11/gate1-db-content.json` containing the results of these queries (run them via psql or equivalent against the production database):

```sql
-- Query 1: First 3 banned phrases with their reasons
SELECT phrase, reason, alternative FROM brand_voice_banned_phrases ORDER BY _order LIMIT 3;

-- Query 2: Voice summary text (first 200 chars)
SELECT LEFT(voice_summary, 200) AS summary_excerpt FROM brand_voice;

-- Query 3: Content type guidance — all types with temperatures
SELECT content_type, label, temperature FROM brand_voice_content_type_guidance ORDER BY content_type;

-- Query 4: Section guidance for itinerary_enhancement — keys + word count ranges
SELECT section_key, section_label, word_count_range FROM brand_voice_section_guidance WHERE content_type = 'itinerary_enhancement' ORDER BY section_key;

-- Query 5: Count of do_list items per section (proves nested arrays populated with real content)
SELECT sg.section_key, sg.content_type, COUNT(dl.id) AS do_count
FROM brand_voice_section_guidance sg
LEFT JOIN brand_voice_section_guidance_do_list dl ON dl._parent_id = sg.id
GROUP BY sg.section_key, sg.content_type
ORDER BY sg.content_type, sg.section_key;

-- Query 6: One specific promptTemplate (segment_description) — first 300 chars
SELECT LEFT(prompt_template, 300) AS template_excerpt FROM brand_voice_section_guidance WHERE section_key = 'segment_description' AND content_type = 'itinerary_enhancement';

-- Query 7: Evolution log entry
SELECT date, change, reason, source FROM brand_voice_evolution_log;
```

File format:
```json
{
  "query1_banned_phrases": [ ... ],
  "query2_summary_excerpt": "...",
  "query3_content_type_guidance": [ ... ],
  "query4_itinerary_sections": [ ... ],
  "query5_do_list_counts": [ ... ],
  "query6_prompt_template_excerpt": "...",
  "query7_evolution_log": [ ... ]
}
```

**GATE REQUIREMENT:** All 7 queries must return non-empty results with substantive content. If any query returns empty, STOP.

---

## GATE 2: API Round-Trip Proof

This tests that the Payload REST API reads the BrandVoice global and returns the full structure. The dev server must be running.

Create a temporary test route at `src/app/(payload)/api/test-phase11/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config })
  
  // Read the BrandVoice global through Payload's API (same path as voice loader)
  const data = await (payload.findGlobal as any)({ slug: 'brand-voice' })
  
  // Extract specific evidence points that prove real data flows through
  const evidence = {
    // Prove core identity loads
    voiceSummaryFirst100: String(data.voiceSummary || '').substring(0, 100),
    audienceFirst100: String(data.audience || '').substring(0, 100),
    positioningFirst100: String(data.positioning || '').substring(0, 100),
    
    // Prove arrays are populated with real content (not empty objects)
    firstPrinciple: data.principles?.[0] || null,
    firstBannedPhrase: data.bannedPhrases?.[0] || null,
    firstAntiPattern: data.antiPatterns?.[0] || null,
    firstGoldStandard: data.goldStandard?.[0] ? {
      excerptFirst100: String(data.goldStandard[0].excerpt || '').substring(0, 100),
      contentType: data.goldStandard[0].contentType,
      context: data.goldStandard[0].context,
    } : null,
    
    // Prove content type guidance loads with real objectives
    contentTypeGuidance: (data.contentTypeGuidance || []).map((g: any) => ({
      contentType: g.contentType,
      label: g.label,
      temperature: g.temperature,
      objectiveFirst80: String(g.objective || '').substring(0, 80),
    })),
    
    // Prove section guidance loads with nested arrays
    sectionGuidanceSample: (data.sectionGuidance || [])
      .filter((s: any) => s.contentType === 'itinerary_enhancement')
      .map((s: any) => ({
        sectionKey: s.sectionKey,
        sectionLabel: s.sectionLabel,
        doListCount: (s.doList || []).length,
        dontListCount: (s.dontList || []).length,
        hasPromptTemplate: !!(s.promptTemplate && s.promptTemplate.length > 0),
        objectiveFirst80: String(s.objective || '').substring(0, 80),
      })),
    
    // Prove evolution log exists
    evolutionLog: data.evolutionLog || [],
    
    // Counts for cross-reference with Gate 1
    counts: {
      principles: (data.principles || []).length,
      bannedPhrases: (data.bannedPhrases || []).length,
      antiPatterns: (data.antiPatterns || []).length,
      goldStandard: (data.goldStandard || []).length,
      contentTypeGuidance: (data.contentTypeGuidance || []).length,
      sectionGuidance: (data.sectionGuidance || []).length,
      evolutionLog: (data.evolutionLog || []).length,
    },
  }
  
  return NextResponse.json(evidence)
}

export const dynamic = 'force-dynamic'
```

After creating the route, wait for the dev server to pick it up, then:

```bash
curl -s "http://localhost:3000/api/test-phase11" > content-engine/evidence/phase11/gate2-api-response.json
```

**GATE REQUIREMENT:** The JSON file must contain non-empty strings in voiceSummaryFirst100, audienceFirst100, positioningFirst100. The firstPrinciple must have a non-empty `principle` and `explanation`. The sectionGuidanceSample must have 6 entries for itinerary_enhancement. If any of these are empty/null, STOP.

---

## GATE 3: Voice Loader Mechanism

This tests whether the loader functions actually transform Payload data into the correct TypeScript interfaces. This is NOT the same as testing the API — the loader applies parsing, filtering, and type coercion.

Extend the test route (or create a second handler in the same file):

Add a POST handler to `src/app/(payload)/api/test-phase11/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  // Import the actual loader functions
  const { loadCoreVoice, loadVoiceForContentType, loadFullVoice, loadVoiceForSection, invalidateVoiceCache } = await import('../../../../../../content-system/voice/loader')
  const { buildVoicePrompt } = await import('../../../../../../content-system/voice/prompt-builder')
  
  // Clear cache to force fresh database read
  invalidateVoiceCache()
  
  const evidence: Record<string, unknown> = {}
  
  // --- Test loadCoreVoice ---
  const core = await loadCoreVoice()
  evidence.loadCoreVoice = {
    summaryFirst100: core.summary.substring(0, 100),
    principleCount: core.principles.length,
    firstPrincipleName: core.principles[0]?.principle || null,
    bannedPhraseCount: core.bannedPhrases.length,
    bannedPhrasesList: core.bannedPhrases.map(b => b.phrase),
    antiPatternCount: core.antiPatterns.length,
    goldStandardCount: core.goldStandard.length,
    audienceFirst100: core.audience.substring(0, 100),
    positioningFirst100: core.positioning.substring(0, 100),
  }
  
  // --- Test loadVoiceForContentType ---
  const destVoice = await loadVoiceForContentType('destination_page')
  evidence.loadVoiceForContentType_destination = {
    hasCore: destVoice.core.summary.length > 0,
    contentTypeFound: destVoice.contentType !== undefined,
    contentTypeLabel: destVoice.contentType?.label || null,
    contentTypeTemperature: destVoice.contentType?.temperature ?? null,
    objectiveFirst80: destVoice.contentType?.objective?.substring(0, 80) || null,
    hasSections: destVoice.sections !== undefined,
  }
  
  // Test with unknown type
  const unknownVoice = await loadVoiceForContentType('nonexistent_type_xyz')
  evidence.loadVoiceForContentType_unknown = {
    hasCore: unknownVoice.core.summary.length > 0,
    contentTypeFound: unknownVoice.contentType !== undefined,
  }
  
  // --- Test loadFullVoice ---
  invalidateVoiceCache() // fresh read
  const fullDest = await loadFullVoice('destination_page')
  evidence.loadFullVoice_destination = {
    sectionCount: fullDest.sections?.length ?? 0,
    sectionKeys: fullDest.sections?.map(s => s.sectionKey).sort() || [],
    // Prove nested arrays were parsed into string[] (not raw objects)
    overviewDoList: fullDest.sections?.find(s => s.sectionKey === 'overview')?.doList || [],
    overviewDontList: fullDest.sections?.find(s => s.sectionKey === 'overview')?.dontList || [],
    overviewObjectiveFirst80: fullDest.sections?.find(s => s.sectionKey === 'overview')?.objective?.substring(0, 80) || null,
  }
  
  const fullItin = await loadFullVoice('itinerary_enhancement')
  evidence.loadFullVoice_itinerary = {
    sectionCount: fullItin.sections?.length ?? 0,
    sectionKeys: fullItin.sections?.map(s => s.sectionKey).sort() || [],
    segDescHasPromptTemplate: !!(fullItin.sections?.find(s => s.sectionKey === 'segment_description')?.promptTemplate),
    segDescPromptFirst100: fullItin.sections?.find(s => s.sectionKey === 'segment_description')?.promptTemplate?.substring(0, 100) || null,
  }
  
  const fullProp = await loadFullVoice('property_page')
  evidence.loadFullVoice_property = {
    sectionCount: fullProp.sections?.length ?? 0,
    sectionKeys: fullProp.sections?.map(s => s.sectionKey).sort() || [],
  }
  
  // --- Test loadVoiceForSection ---
  const sectionVoice = await loadVoiceForSection('itinerary_enhancement', 'segment_description')
  evidence.loadVoiceForSection_specific = {
    hasCore: sectionVoice.core.summary.length > 0,
    sectionCount: sectionVoice.sections?.length ?? 0,
    sectionKey: sectionVoice.sections?.[0]?.sectionKey || null,
    hasPromptTemplate: !!(sectionVoice.sections?.[0]?.promptTemplate),
  }
  
  const noSection = await loadVoiceForSection('destination_page', 'nonexistent_section_xyz')
  evidence.loadVoiceForSection_missing = {
    hasCore: noSection.core.summary.length > 0,
    sectionCount: noSection.sections?.length ?? 0,
  }
  
  // --- Test buildVoicePrompt ---
  // Generate 3 prompts for different content types and save full text
  const promptEvidence: Record<string, unknown> = {}
  
  for (const ct of ['destination_page', 'itinerary_enhancement', 'property_page']) {
    invalidateVoiceCache()
    const voice = await loadFullVoice(ct)
    const prompt = buildVoicePrompt(voice)
    promptEvidence[ct] = {
      length: prompt.length,
      first500: prompt.substring(0, 500),
      last200: prompt.substring(Math.max(0, prompt.length - 200)),
      containsBannedSection: prompt.includes('BANNED PHRASES') || prompt.includes('banned'),
      containsPrinciplesSection: prompt.includes('PRINCIPLES') || prompt.includes('principles'),
      containsVoiceIdentity: prompt.includes('KIULI VOICE') || prompt.includes('quiet confidence'),
      containsSectionGuidance: prompt.includes('SECTION:') || prompt.includes('section'),
    }
  }
  evidence.promptBuilder = promptEvidence
  
  return NextResponse.json(evidence)
}
```

Add `import { NextRequest } from 'next/server'` to the top of the file.

After the dev server picks it up:

```bash
curl -s -X POST "http://localhost:3000/api/test-phase11" > content-engine/evidence/phase11/gate3-loader-and-prompts.json
```

**GATE REQUIREMENT:**
- loadCoreVoice must return non-empty summary, 7 principles, 11 banned phrases
- loadFullVoice_destination must have 9 sections with correct keys
- loadFullVoice_itinerary must have 6 sections
- loadVoiceForSection_specific must return exactly 1 section with a promptTemplate
- loadVoiceForSection_missing must return 0 sections
- All 3 prompts must have length > 500, contain banned phrases section, and voice identity

If ANY check fails, STOP.

---

## GATE 4: Write Mutation Round-Trip

This is the most critical gate. It proves that the BrandVoice global can be mutated and that changes propagate through the loader. This is exactly what the conversation handler's update_voice action does.

Add another endpoint or extend the test route. Create `src/app/(payload)/api/test-phase11-mutation/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

const CANARY_PHRASE = 'VERIFICATION_CANARY_' + Date.now()

export async function POST() {
  const payload = await getPayload({ config })
  const { loadCoreVoice, invalidateVoiceCache } = await import('../../../../../../content-system/voice/loader')
  
  const evidence: Record<string, unknown> = {}
  
  // Step 1: Read BEFORE state
  invalidateVoiceCache()
  const before = await loadCoreVoice()
  evidence.before = {
    bannedPhraseCount: before.bannedPhrases.length,
    bannedPhrases: before.bannedPhrases.map(b => b.phrase),
    containsCanary: before.bannedPhrases.some(b => b.phrase === CANARY_PHRASE),
  }
  
  // Step 2: Write mutation (same pattern as conversation handler processVoiceActions)
  const current = await (payload.findGlobal as any)({ slug: 'brand-voice' })
  const existingBanned = Array.isArray(current.bannedPhrases) ? [...current.bannedPhrases] : []
  existingBanned.push({
    phrase: CANARY_PHRASE,
    reason: 'Phase 11 verification test — will be removed',
    alternative: null,
  })
  
  // Also append to evolution log (same as handler does)
  const existingLog = Array.isArray(current.evolutionLog) ? [...current.evolutionLog] : []
  existingLog.push({
    date: new Date().toISOString(),
    change: `Added test canary phrase: ${CANARY_PHRASE}`,
    reason: 'Phase 11 mechanism verification',
    source: 'direct_edit',
  })
  
  await (payload.updateGlobal as any)({
    slug: 'brand-voice',
    data: {
      bannedPhrases: existingBanned,
      evolutionLog: existingLog,
    },
  })
  
  // Step 3: Invalidate cache and read AFTER state through the loader
  invalidateVoiceCache()
  const after = await loadCoreVoice()
  evidence.after = {
    bannedPhraseCount: after.bannedPhrases.length,
    containsCanary: after.bannedPhrases.some(b => b.phrase === CANARY_PHRASE),
    canaryPhrase: after.bannedPhrases.find(b => b.phrase === CANARY_PHRASE) || null,
    countIncreased: after.bannedPhrases.length === before.bannedPhrases.length + 1,
  }
  
  // Step 4: Clean up — remove the canary
  const afterData = await (payload.findGlobal as any)({ slug: 'brand-voice' })
  const cleanedBanned = (afterData.bannedPhrases || []).filter((b: any) => b.phrase !== CANARY_PHRASE)
  const cleanedLog = (afterData.evolutionLog || []).filter((e: any) => !String(e.change || '').includes(CANARY_PHRASE))
  
  await (payload.updateGlobal as any)({
    slug: 'brand-voice',
    data: {
      bannedPhrases: cleanedBanned,
      evolutionLog: cleanedLog,
    },
  })
  
  // Step 5: Verify cleanup through the loader
  invalidateVoiceCache()
  const cleanup = await loadCoreVoice()
  evidence.cleanup = {
    bannedPhraseCount: cleanup.bannedPhrases.length,
    containsCanary: cleanup.bannedPhrases.some(b => b.phrase === CANARY_PHRASE),
    restoredToOriginalCount: cleanup.bannedPhrases.length === before.bannedPhrases.length,
  }
  
  evidence.canaryUsed = CANARY_PHRASE
  evidence.testPassed = (
    !evidence.before || !(evidence.before as any).containsCanary
  ) && (
    !evidence.after || (evidence.after as any).containsCanary
  ) && (
    !evidence.cleanup || !(evidence.cleanup as any).containsCanary
  )
  
  return NextResponse.json(evidence)
}

export const dynamic = 'force-dynamic'
```

```bash
curl -s -X POST "http://localhost:3000/api/test-phase11-mutation" > content-engine/evidence/phase11/gate4-mutation-roundtrip.json
```

**GATE REQUIREMENT:**
- before.containsCanary must be false
- after.containsCanary must be true
- after.countIncreased must be true
- cleanup.containsCanary must be false
- cleanup.restoredToOriginalCount must be true
- testPassed must be true

If ANY of these fail, STOP.

---

## GATE 5: Draft Dispatch Mechanism

This creates a real content project and attempts to dispatch a draft. We don't expect the draft to succeed (no OpenRouter API key or insufficient context), but the ERROR MESSAGE reveals how far the code got. The error is the evidence.

Create `src/app/(payload)/api/test-phase11-dispatch/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { dispatchDraft } from '../../../../../../content-system/drafting'

export async function POST() {
  const payload = await getPayload({ config })
  const evidence: Record<string, unknown> = {}
  
  // Test 1: Create a temporary content project with type destination_page
  let projectId: number | null = null
  try {
    const project = await payload.create({
      collection: 'content-projects',
      data: {
        title: 'PHASE11_TEST_DISPATCH_' + Date.now(),
        contentType: 'destination_page',
        stage: 'draft',
        status: 'active',
      } as any,
    })
    projectId = project.id as number
    evidence.projectCreated = { id: projectId, contentType: 'destination_page' }
  } catch (err) {
    evidence.projectCreated = { error: err instanceof Error ? err.message : String(err) }
    return NextResponse.json(evidence)
  }
  
  // Test 2: Dispatch draft — capture the error
  try {
    await dispatchDraft(projectId)
    evidence.dispatchResult = { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack?.substring(0, 500) : undefined
    evidence.dispatchResult = {
      success: false,
      error: message,
      stackTrace: stack,
      // Classify the error to prove how far the code got
      reachedDrafter: message.includes('OpenRouter') || message.includes('OPENROUTER') || message.includes('model') || message.includes('API') || message.includes('callModel') || message.includes('fetch'),
      reachedVoiceLoader: message.includes('brand-voice') || message.includes('voice') || message.includes('global'),
      projectNotFound: message.includes('not found') || message.includes('Not Found'),
      unknownContentType: message.includes('No drafter available'),
    }
  }
  
  // Test 3: Also test dispatch with an article type
  let articleProjectId: number | null = null
  try {
    const articleProject = await payload.create({
      collection: 'content-projects',
      data: {
        title: 'PHASE11_TEST_ARTICLE_' + Date.now(),
        contentType: 'authority',
        stage: 'research',
        status: 'active',
      } as any,
    })
    articleProjectId = articleProject.id as number
    
    await dispatchDraft(articleProjectId)
    evidence.articleDispatch = { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    evidence.articleDispatch = {
      success: false,
      error: message,
      reachedDrafter: message.includes('OpenRouter') || message.includes('OPENROUTER') || message.includes('model') || message.includes('API') || message.includes('callModel') || message.includes('fetch'),
    }
  }
  
  // Test 4: Test dispatch with unknown type — should throw "No drafter available"
  let unknownProjectId: number | null = null
  try {
    const unknownProject = await payload.create({
      collection: 'content-projects',
      data: {
        title: 'PHASE11_TEST_UNKNOWN_' + Date.now(),
        contentType: 'nonexistent_type',
        stage: 'draft',
        status: 'active',
      } as any,
    })
    unknownProjectId = unknownProject.id as number
    
    await dispatchDraft(unknownProjectId)
    evidence.unknownTypeDispatch = { success: true, problem: 'Should have thrown error for unknown type' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    evidence.unknownTypeDispatch = {
      success: false,
      error: message,
      correctlyRejected: message.includes('No drafter available'),
    }
  }
  
  // Cleanup: delete test projects
  const cleanupIds = [projectId, articleProjectId, unknownProjectId].filter(Boolean) as number[]
  for (const id of cleanupIds) {
    try {
      await payload.delete({ collection: 'content-projects', id })
    } catch { /* ignore cleanup errors */ }
  }
  evidence.cleanup = { deletedProjects: cleanupIds }
  
  return NextResponse.json(evidence)
}

export const dynamic = 'force-dynamic'
```

```bash
curl -s -X POST "http://localhost:3000/api/test-phase11-dispatch" > content-engine/evidence/phase11/gate5-dispatch.json
```

**GATE REQUIREMENT:**
- projectCreated must have an id (not an error)
- dispatchResult.reachedDrafter OR dispatchResult.success must be true (proves the code got through voice loading and into the actual drafter code)
- unknownTypeDispatch.correctlyRejected must be true (proves dispatch routing works)
- If dispatchResult shows projectNotFound or unknownContentType, that's a FAILURE — it means the dispatch chain is broken

---

## GATE 6: Code Integration Proof

This verifies the import chains are real — that the actual source files reference the correct modules. Run grep/search and save results.

Create `content-engine/evidence/phase11/gate6-import-chains.json` with the results of these searches:

```bash
# 1. enhancer.ts imports loadVoiceForSection from voice/loader
grep -n "import.*loadVoiceForSection.*from.*voice/loader" src/services/enhancer.ts

# 2. enhancer.ts calls loadVoiceForSection
grep -n "loadVoiceForSection" src/services/enhancer.ts

# 3. conversation handler imports from voice/loader
grep -n "import.*from.*voice/loader" content-system/conversation/handler.ts

# 4. conversation handler calls invalidateVoiceCache
grep -n "invalidateVoiceCache" content-system/conversation/handler.ts

# 5. conversation handler writes to brand-voice global
grep -n "brand-voice" content-system/conversation/handler.ts

# 6. article-drafter imports loadVoiceForContentType
grep -n "import.*loadVoiceForContentType.*from.*voice/loader" content-system/drafting/article-drafter.ts

# 7. destination-page-drafter imports loadFullVoice
grep -n "import.*loadFullVoice.*from.*voice/loader" content-system/drafting/destination-page-drafter.ts

# 8. segment-enhancer imports loadVoiceForSection
grep -n "import.*loadVoiceForSection.*from.*voice/loader" content-system/drafting/segment-enhancer.ts

# 9. draft route imports dispatchDraft
grep -n "import.*dispatchDraft" src/app/\(payload\)/api/content/draft/route.ts

# 10. dispatch index imports all drafters
grep -n "import.*from" content-system/drafting/index.ts

# 11. payload.config.ts includes BrandVoice in globals
grep -n "BrandVoice" src/payload.config.ts

# 12. enhancer.ts has the VOICE_CONFIG_TO_SECTION_KEY mapping (backwards compat)
grep -n "VOICE_CONFIG_TO_SECTION_KEY" src/services/enhancer.ts
```

File format — each key is the search description, value is the matching lines:
```json
{
  "enhancer_imports_loadVoiceForSection": ["line:text", ...],
  "enhancer_calls_loadVoiceForSection": [...],
  "handler_imports_voice_loader": [...],
  "handler_calls_invalidateVoiceCache": [...],
  "handler_writes_brand_voice": [...],
  "article_drafter_imports": [...],
  "destination_drafter_imports": [...],
  "segment_enhancer_imports": [...],
  "draft_route_imports_dispatch": [...],
  "dispatch_imports_all_drafters": [...],
  "payload_config_includes_brandvoice": [...],
  "enhancer_backwards_compat_mapping": [...]
}
```

**GATE REQUIREMENT:** Every single one of the 12 searches must return at least 1 matching line. If any returns empty, the import chain is broken.

---

## GATE 7: Full Prompt Text Capture

Save the COMPLETE generated prompts (not just excerpts) for the reviewer to inspect. This proves the prompt builder produces real, usable LLM system prompts.

Create `content-engine/evidence/phase11/gate7-full-prompts/` directory, then save:

Using the test-phase11 POST endpoint or a new one, generate and save full prompt texts:

Create `src/app/(payload)/api/test-phase11-prompts/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  await getPayload({ config })
  const { loadFullVoice, invalidateVoiceCache } = await import('../../../../../../content-system/voice/loader')
  const { buildVoicePrompt } = await import('../../../../../../content-system/voice/prompt-builder')
  
  const prompts: Record<string, string> = {}
  
  for (const ct of ['destination_page', 'itinerary_enhancement', 'property_page', 'authority']) {
    invalidateVoiceCache()
    const voice = await loadFullVoice(ct)
    prompts[ct] = buildVoicePrompt(voice)
  }
  
  return NextResponse.json(prompts)
}

export const dynamic = 'force-dynamic'
```

```bash
curl -s "http://localhost:3000/api/test-phase11-prompts" > content-engine/evidence/phase11/gate7-full-prompts.json
```

**GATE REQUIREMENT:** Each of the 4 prompts must be > 500 characters. The destination_page and itinerary_enhancement prompts must contain SECTION: headings. All prompts must contain BANNED PHRASES.

---

## Cleanup

After ALL gates pass and ALL evidence files are written:

1. Delete the test routes:
   - `src/app/(payload)/api/test-phase11/route.ts`
   - `src/app/(payload)/api/test-phase11-mutation/route.ts`
   - `src/app/(payload)/api/test-phase11-dispatch/route.ts`
   - `src/app/(payload)/api/test-phase11-prompts/route.ts`
   - Delete the containing directories if empty

2. Do NOT delete the evidence files — the reviewer needs them.

3. Do NOT commit any of the test routes. They should never reach git.

4. Verify the repo is clean of test artifacts:
   ```bash
   git status
   ```
   The only new untracked files should be in `content-engine/evidence/phase11/`.

---

## Rules

- Every gate must produce its evidence file BEFORE moving to the next gate.
- If a gate fails, STOP and document the failure in the evidence file. Do NOT proceed to subsequent gates.
- Do NOT modify any existing source code (only create temporary test routes).
- Do NOT hardcode expected values into test routes — let the actual data flow through.
- Do NOT summarise or truncate evidence — save the raw data.
- The evidence files are the ONLY output that matters. Console output is not reviewed.
