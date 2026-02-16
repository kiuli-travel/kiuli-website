# Phase 11a: BrandVoice Global — The Kiuli Way

**Date:** February 16, 2026
**Depends on:** Phase 10 (workspace UI) — complete
**Blocks:** Phase 11b (drafters), all future content production
**Specification:** KIULI_CONTENT_SYSTEM_V6.md + this document

---

## Why This Phase Exists

Every content-producing path (scraper enhancement, conversation handler, drafters, social summariser) currently has its own hardcoded or fragmented voice definition. The conversation handler has a one-liner. The `voice-configuration` collection has 8+ records each duplicating the same principles. The project knowledge docs contain detailed guidelines that no code reads at runtime.

Phase 11a creates a single, editable, authoritative voice configuration that ALL content-producing code draws from. It is directly editable in the Payload admin. It is also editable via Kiuli conversation. It evolves over time through both pathways.

---

## Outcomes

1. A `brand-voice` Payload global with four structured layers.
2. A `loadBrandVoice()` utility that all content producers call, receiving a structured object they can insert into LLM system prompts.
3. The conversation handler loads voice context from BrandVoice and gains a new `update_voice` action type.
4. The scraper enhance endpoint (`/api/enhance`) switches from reading `voice-configuration` collection to reading BrandVoice (Layer 1 + Layer 3 section guidance).
5. Data from existing `voice-configuration` records is migrated into BrandVoice Layer 3.
6. The `voice-configuration` collection is deprecated (not deleted — just no longer the source of truth).

---

## Schema: BrandVoice Global

**Slug:** `brand-voice`
**Admin group:** Configuration
**Access:** read: () => true, update: authenticated

### Layer 1: Core Identity

These fields define WHO Kiuli is as a writer. They load into every LLM call that produces content.

```
voiceSummary            textarea      "Who Kiuli is as a writer — 2-3 sentences that anchor every piece of content"
                                      Default: "Kiuli writes with quiet confidence — the authority of decades spent in the African bush, delivered with warmth and specificity. We never oversell. We show, we don't tell. Every sentence earns its place."

principles              array         "Core voice principles that apply to all Kiuli content"
  ├─ principle          text          e.g. "Specificity over generality"
  ├─ explanation        textarea      e.g. "Name the bird species, describe the actual view, cite the specific lodge. Generic descriptions are the hallmark of operators who haven't been there."
  └─ example            textarea      Optional. A concrete example of the principle in action.

audience                textarea      "Who we are writing for — their expectations, sophistication level, what they respond to"
                                      Default: "US high-net-worth individuals planning $25,000-$100,000+ safari experiences. They are sophisticated, well-travelled, and research-intensive. They distrust hard sells and respond to earned authority. Their average consideration window is 217 days."

positioning             textarea      "How Kiuli differentiates from competitors — what we can say that they cannot"
                                      Default: "Kiuli is one of the few luxury safari operators to show pricing upfront. Our travel designers have decades of direct experience. We have personal relationships with camp owners, guides, and conservancy managers. We provide insider access and honest guidance, not brochure copy."

bannedPhrases           array         "Words and phrases that must never appear in Kiuli content"
  ├─ phrase             text          e.g. "breathtaking"
  ├─ reason             text          e.g. "Generic superlative — says nothing specific"
  └─ alternative        text          Optional. e.g. "Describe the specific vista instead"

antiPatterns            array         "Writing patterns to avoid — broader than single phrases"
  ├─ pattern            text          e.g. "Opening with a question"
  ├─ explanation        textarea      e.g. "Rhetorical questions feel manipulative at this price point. Lead with authority instead."

goldStandard            array         "Exemplary Kiuli writing — excerpts that define 'what good looks like'"
  ├─ excerpt            textarea      The actual text
  ├─ contentType        select        article | destination_page | property_page | itinerary_enhancement | general
  ├─ context            text          Where this came from, why it's good
  └─ addedAt            date          When this was added (auto-set)
```

### Layer 2: Content Type Objectives

Each content type has different strategic goals. These load alongside Layer 1 when producing content of a specific type.

```
contentTypeGuidance     array         "How Kiuli's voice adapts for different content types"
  ├─ contentType        select        itinerary_cluster | authority | designer_insight | destination_page | property_page | itinerary_enhancement
  ├─ label              text          Human-readable name, e.g. "Destination Page"
  ├─ objective          textarea      "What this content type exists to achieve — its job in the funnel"
  ├─ toneShift          textarea      "How tone shifts for this type relative to core voice"
  ├─ structuralNotes    textarea      "Structural expectations — length, sections, pacing"
  └─ temperature        number        LLM temperature for this type (min 0, max 1, step 0.1, default 0.6)
```

Seed with these content types:

**itinerary_cluster (Article):**
- Objective: "Build topical authority and capture search intent. Articles are Kiuli's claim to expertise — they must teach the reader something they cannot learn from competitors. Every article naturally links to relevant itineraries."
- Tone shift: "More educational and analytical than destination pages. Can be slightly more formal. Always evidence-based."
- Structural notes: "1,500-3,000 words. H2 sections with clear logical flow. Answer capsule in first 70 words. FAQ section with 8-10 questions optimised for AI Overview."
- Temperature: 0.5

**destination_page:**
- Objective: "Create desire and qualify on investment. The destination page is where a prospect falls in love with a place. It must paint a vivid picture while being honest about costs, logistics, and what to expect."
- Tone shift: "More evocative and sensory than articles. Paint pictures. Use present tense. First person plural ('we') when referring to Kiuli's access and expertise."
- Structural notes: "9 sections: overview, when to visit, why choose, key experiences, getting there, health & safety, investment expectation, top lodges, FAQ. Each section has a distinct job."
- Temperature: 0.6

**property_page:**
- Objective: "Sell the stay. Property pages must make the reader feel what it's like to wake up at this lodge. Specificity is paramount — room types, views, what makes THIS property different from the one down the road."
- Tone shift: "Most intimate and sensory of all types. Close the distance between reader and place."
- Structural notes: "Overview, FAQ, and future sections (experience highlights, amenities context). Shorter than destination pages."
- Temperature: 0.6

**itinerary_enhancement:**
- Objective: "Transform raw iTrvl segment descriptions into compelling, specific content that sells each component of the journey."
- Tone shift: "Concise and evocative. Each segment description must earn its words — no filler."
- Structural notes: "100-200 words per segment. Focus on what makes THIS stay/activity/transfer special."
- Temperature: 0.7

**authority:**
- Objective: "Establish Kiuli as the definitive expert on a specific topic. These articles target questions that affluent travellers ask during their 217-day consideration window."
- Tone shift: "Most authoritative and researched. Can reference sources. Balanced and fair when comparing options."
- Structural notes: "2,000-4,000 words. Deep, comprehensive coverage. Competitive differentiation through proprietary angles."
- Temperature: 0.5

**designer_insight:**
- Objective: "Share first-hand experience from Emily, Jody, or Kiuli's network. These feel personal and authentic — like advice from a trusted friend who happens to be an expert."
- Tone shift: "Most personal and warm. First person singular is acceptable here. Anecdotes welcome."
- Structural notes: "800-1,500 words. Conversational structure. Light on research, heavy on personal experience."
- Temperature: 0.7

### Layer 3: Section Guidance

For compound types (destination/property pages) and for the scraper's per-field enhancement. This replaces the `voice-configuration` collection.

```
sectionGuidance         array         "Section-specific guidance for compound types and field-level enhancement"
  ├─ contentType        select        destination_page | property_page | itinerary_enhancement
  ├─ sectionKey         text          "Machine key: overview, when_to_visit, segment_description, faq_answer, etc."
  ├─ sectionLabel       text          "Human label: Overview, When to Visit, etc."
  ├─ objective          textarea      "What this section must achieve"
  ├─ toneNotes          textarea      "Section-specific tone shifts"
  ├─ wordCountRange     text          e.g. "150-200"
  ├─ doList             array         "Things to do"
  │   └─ item           text
  ├─ dontList           array         "Things to avoid"
  │   └─ item           text
  ├─ examples           array         "Before/after pairs"
  │   ├─ before         textarea
  │   └─ after          textarea
  └─ promptTemplate     textarea      "For scraper enhance: user prompt template with {{content}}, {{context}} etc. placeholders"
```

Migrate existing `voice-configuration` records into this:
- `overview-summary` → sectionKey: `overview`, contentType: `itinerary_enhancement`
- `segment-description` → sectionKey: `segment_description`, contentType: `itinerary_enhancement`
- `day-title` → sectionKey: `day_title`, contentType: `itinerary_enhancement`
- `faq-answer` → sectionKey: `faq_answer`, contentType: `itinerary_enhancement`
- `investment-includes` → sectionKey: `investment_includes`, contentType: `itinerary_enhancement`
- `why-kiuli` → sectionKey: `why_kiuli`, contentType: `itinerary_enhancement`

Also seed section guidance for destination_page (9 sections) and property_page (2+ sections) from the V6 spec and launch architecture doc. Use the objectives/guidance from KIULI_LAUNCH_ARCHITECTURE.md section prompts.

### Layer 4: Evolution Log

Tracks what changed and why. The conversation handler writes here when it updates voice. Designers can also add entries manually.

```
evolutionLog            array         "How the Kiuli voice has evolved over time"
  ├─ date               date          Auto-set to now
  ├─ change             textarea      What was changed
  ├─ reason             textarea      Why
  └─ source             select        designer_conversation | direct_edit | performance_insight | initial_setup
```

---

## Claude CLI Tasks

### Task 1: Create BrandVoice Global

**File:** `src/globals/BrandVoice.ts`

Create the Payload global with ALL fields from the schema above. Use the admin group "Configuration". Every array field must have `admin.description` on the array and on each sub-field.

### Task 2: Register BrandVoice Global

**File:** `src/payload.config.ts`

Add BrandVoice to the globals array. Import from `src/globals/BrandVoice`.

### Task 3: Create Voice Loader Utility

**File:** `content-system/voice/loader.ts`

This is the single entry point for all content-producing code to load voice context. All functions cache the global read per-invocation (no repeated DB calls within a single request).

```typescript
export interface VoiceContext {
  core: {
    summary: string
    principles: Array<{ principle: string; explanation: string; example?: string }>
    audience: string
    positioning: string
    bannedPhrases: Array<{ phrase: string; reason: string; alternative?: string }>
    antiPatterns: Array<{ pattern: string; explanation: string }>
    goldStandard: Array<{ excerpt: string; contentType: string; context: string }>
  }
  contentType?: {
    contentType: string
    objective: string
    toneShift: string
    structuralNotes: string
    temperature: number
  }
  sections?: Array<{
    sectionKey: string
    sectionLabel: string
    objective: string
    toneNotes: string
    wordCountRange: string
    doList: string[]
    dontList: string[]
    examples: Array<{ before: string; after: string }>
    promptTemplate?: string
  }>
}

// Load core voice only (Layer 1). Used by simple operations.
export async function loadCoreVoice(): Promise<VoiceContext['core']>

// Load core + content type guidance (Layers 1+2). Used by conversation handler and article drafter.
export async function loadVoiceForContentType(contentType: string): Promise<VoiceContext>

// Load core + content type + all section guidance for that type (Layers 1+2+3). Used by compound drafters.
export async function loadFullVoice(contentType: string): Promise<VoiceContext>

// Load core + specific section guidance (Layers 1+3). Used by scraper enhance endpoint.
export async function loadVoiceForSection(contentType: string, sectionKey: string): Promise<VoiceContext>
```

### Task 4: Create Voice Prompt Builder

**File:** `content-system/voice/prompt-builder.ts`

Converts VoiceContext into system prompt text that can be prepended to any LLM call.

```typescript
// Builds the voice portion of a system prompt from VoiceContext.
// Does NOT include project-specific context — that's the caller's job.
export function buildVoicePrompt(voice: VoiceContext): string
```

The output should be structured as:

```
KIULI VOICE IDENTITY:
{voiceSummary}

PRINCIPLES:
- {principle}: {explanation}
  Example: {example}
[... for each principle]

AUDIENCE:
{audience}

POSITIONING:
{positioning}

BANNED PHRASES:
- "{phrase}" — {reason}. Use instead: {alternative}
[... for each]

ANTI-PATTERNS:
- {pattern}: {explanation}
[... for each]

GOLD STANDARD EXAMPLES:
---
{excerpt}
[Context: {context}]
---
[... for each, filtered to contentType if contentType is set]

[If contentType guidance present:]
CONTENT TYPE: {label}
OBJECTIVE: {objective}
TONE: {toneShift}
STRUCTURE: {structuralNotes}

[If section guidance present:]
SECTION: {sectionLabel} ({sectionKey})
OBJECTIVE: {objective}
TONE: {toneNotes}
WORD COUNT: {wordCountRange}
DO: {doList items}
DON'T: {dontList items}
[If examples present:]
EXAMPLES:
BEFORE: {before}
AFTER: {after}
[... for each section]
```

### Task 5: Update Conversation Handler

**File:** `content-system/conversation/handler.ts`

Changes:

1. Import `loadVoiceForContentType` and `buildVoicePrompt`.
2. In `buildSystemPrompt`, replace the hardcoded one-liner with:
   ```
   const voice = await loadVoiceForContentType(ctx.contentType)
   const voicePrompt = buildVoicePrompt(voice)
   ```
   Insert `voicePrompt` at the start of the system prompt, after the initial "You are Kiuli" line.
3. Add `update_voice` action type to the available actions in the prompt:
   ```
   6. update_voice — Update the Kiuli brand voice configuration
      { "type": "update_voice", "operation": "add_banned_phrase", "phrase": "...", "reason": "...", "alternative": "..." }
      { "type": "update_voice", "operation": "add_gold_standard", "excerpt": "...", "context": "..." }
      { "type": "update_voice", "operation": "add_anti_pattern", "pattern": "...", "explanation": "..." }
      { "type": "update_voice", "operation": "add_principle", "principle": "...", "explanation": "...", "example": "..." }
      { "type": "update_voice", "operation": "update_summary", "value": "..." }
      Only use when the designer explicitly talks about how Kiuli should write IN GENERAL — not about this specific content.
      "Kiuli should never say 'nestled'" → add_banned_phrase
      "This paragraph is perfect, save this voice" → add_gold_standard
      "Make this warmer" → NO update_voice (that's about this content, use edit actions)
   ```
4. Add `update_voice` to `validateAction` and `processActions`. The `update_voice` action does NOT accumulate into the project data object — it writes to the BrandVoice global directly via `payload.updateGlobal({ slug: 'brand-voice', ... })`. It also appends to the evolutionLog.
5. Since `buildSystemPrompt` now awaits an async function, make it `async` and update the caller in `handleMessage`.

**File:** `content-system/conversation/types.ts`

Add `update_voice` to ConversationAction type.

### Task 6: Update Enhance Endpoint

**File:** `src/services/enhancer.ts`

Replace `getVoiceConfig` (which reads from `voice-configuration` collection) with voice loading from BrandVoice:

1. Import `loadVoiceForSection` and `buildVoicePrompt`.
2. The `enhanceContent` function signature changes: `configName: string` becomes `sectionKey: string`.
3. Load voice: `const voice = await loadVoiceForSection('itinerary_enhancement', sectionKey)`.
4. Use `buildVoicePrompt(voice)` as the system prompt base.
5. If the section guidance has a `promptTemplate`, use it for the user prompt (replacing {{content}}, {{context}} placeholders). Otherwise, build a default user prompt.
6. Temperature comes from `voice.contentType?.temperature ?? 0.7`.

**File:** `src/app/(payload)/api/enhance/route.ts`

Update to pass `sectionKey` instead of `voiceConfig` name. The mapping:
- `voiceConfig: 'overview-summary'` → `sectionKey: 'overview'`
- `voiceConfig: 'segment-description'` → `sectionKey: 'segment_description'`
- etc.

For backwards compatibility during migration, if the caller still sends `voiceConfig`, map it to the corresponding sectionKey. Add a `VOICE_CONFIG_TO_SECTION_KEY` map.

### Task 7: Create Migration

**File:** Create migration via `payload migrate:create` (name: `add_brand_voice_global`)

The migration should:
1. Create the `brand_voice` global table in Postgres.
2. Read all existing `voice-configuration` records.
3. Populate BrandVoice Layer 1 (core identity) with the default values specified in the schema above.
4. Populate BrandVoice Layer 2 (content type guidance) with the seed data specified above.
5. Populate BrandVoice Layer 3 (section guidance) by migrating voice-configuration records using the mapping specified above.
6. Add initial evolution log entry: `{ date: now, change: "Initial brand voice configuration", reason: "Migration from fragmented voice-configuration collection", source: "initial_setup" }`.

**IMPORTANT:** Do NOT write the migration as raw SQL. Use Payload's Local API in an up() function:
```typescript
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.updateGlobal({
    slug: 'brand-voice',
    data: { ... }
  })
}
```

### Task 8: Seed Script

**File:** `scripts/seed-brand-voice.ts`

A standalone script that can be run to populate BrandVoice with all default/initial values. This is the fallback if the migration can't read voice-configuration records (e.g., in a fresh environment). It uses Payload Local API.

Include ALL seed data from the schema defaults and content type guidance above.

### Task 9: Verify Build

Run `npm run build`. Fix any TypeScript errors.

---

## Do Not

- Do not delete the `voice-configuration` collection or its data. Deprecate only.
- Do not change the VoiceConfiguration.ts collection schema.
- Do not modify ContentProjects schema.
- Do not create any drafter files — that's Phase 11b.
- Do not create any new API routes — the enhance endpoint already exists.
- Do not install new npm packages.
- Do not modify the ContentEngineDashboard or workspace UI components.

---

## Gate Evidence

```bash
# 1. Build passes
npm run build 2>&1 | tail -20

# 2. BrandVoice global accessible
curl -s https://admin.kiuli.com/api/globals/brand-voice | jq '.voiceSummary' | head -3

# 3. Layer 1 populated (core identity)
curl -s https://admin.kiuli.com/api/globals/brand-voice | jq '.principles | length'
# Should be >= 5

# 4. Layer 2 populated (content type guidance)
curl -s https://admin.kiuli.com/api/globals/brand-voice | jq '.contentTypeGuidance | length'
# Should be 6

# 5. Layer 3 populated (section guidance migrated from voice-configuration)
curl -s https://admin.kiuli.com/api/globals/brand-voice | jq '.sectionGuidance | length'
# Should be >= 6 (migrated) + destination sections + property sections

# 6. Evolution log has initial entry
curl -s https://admin.kiuli.com/api/globals/brand-voice | jq '.evolutionLog | length'
# Should be >= 1

# 7. Enhance endpoint still works (backwards compatible)
# Test with an existing itinerary that has segment descriptions

# 8. Conversation handler loads voice context
# Open a workspace, send a message, verify response quality hasn't degraded

# 9. Voice update via conversation
# In workspace chat, type: "Kiuli should never use the word 'nestled'"
# Verify bannedPhrases in BrandVoice global now includes "nestled"
# Verify evolutionLog has new entry with source: designer_conversation
```

---

## Notes for Claude CLI

- `buildSystemPrompt` in handler.ts becomes async. This cascades: `handleMessage` already awaits everything, so the change is contained.
- The voice loader must handle the case where BrandVoice has no data yet (fresh install). Return sensible defaults matching the seed data.
- The `update_voice` action handler needs to read the current BrandVoice global, append to the appropriate array, and write back. Use `payload.findGlobal` + `payload.updateGlobal`.
- Section guidance `examples` array is structurally identical to the old voice-configuration `examples` array — direct migration is possible.
- The `promptTemplate` field in section guidance serves the same role as `userPromptTemplate` in the old voice-configuration. Rename during migration.
- Anti-patterns from old voice-configuration records should merge into the section guidance's `dontList` field, not into the global `antiPatterns` (which is for writing-pattern-level concerns, not per-section banned words).

---

# Phase 11b: Drafting Pipeline

**Depends on:** Phase 11a (BrandVoice) — must be complete and verified
**Blocks:** Phase 12 (consistency checking)

---

## Outcomes

1. Article drafter generates body + FAQ + meta from brief + research + voice context.
2. Destination page drafter generates all 9 sections in one pass from embedding store + Perplexity context + voice context.
3. Property page drafter generates all sections in one pass.
4. Segment enhancer generates enhanced segment descriptions using embedding store context + voice context.
5. Social summariser generates LinkedIn + Facebook summaries.
6. `/api/content/draft` route dispatches to the correct drafter by contentType.
7. The "Generate Draft" button in the workspace calls this route and shows results.
8. All drafters set `processingStatus` throughout (processing → completed/failed).

---

## Architecture

Every drafter follows the same pattern:

```
1. Load VoiceContext via voice/loader.ts
2. Build voice prompt via voice/prompt-builder.ts
3. Build content-specific prompt (brief, research, section objectives)
4. Call OpenRouter via openrouter-client.ts with purpose: 'drafting'
5. Parse response
6. Write to ContentProject fields
7. Set processingStatus = 'completed' (or 'failed' with error)
```

All drafters use the model configured in ContentSystemSettings.draftingModel (via openrouter-client's `callModel('drafting', ...)`).

Temperature comes from BrandVoice Layer 2 contentTypeGuidance for the relevant content type.

---

## Claude CLI Tasks

### Task 1: Article Drafter

**File:** `content-system/drafting/article-drafter.ts`

```typescript
export async function draftArticle(projectId: number): Promise<void>
```

Steps:
1. Fetch ContentProject (depth 0).
2. Validate: stage must be 'research' or 'draft', contentType must be 'itinerary_cluster' | 'authority' | 'designer_insight'.
3. Set processingStatus = 'processing', processingStartedAt = now.
4. Load voice: `loadVoiceForContentType(project.contentType)`.
5. Build system prompt:
   - Voice prompt (from buildVoicePrompt)
   - "You are drafting an article for Kiuli's website."
   - Brief context (briefSummary, targetAngle, competitiveNotes)
   - Research synthesis (full text)
   - Sources list
   - Proprietary angles
   - Related content from embedding store (query with title + destinations, top 10 results, exclude self)
   - Active editorial directives
6. Build user prompt:
   - "Write a complete article based on the brief and research above."
   - "Return a JSON object with: body (markdown), faqSection (array of {question, answer}), metaTitle (max 60 chars), metaDescription (max 160 chars), answerCapsule (50-70 words)"
   - Structural guidance from content type layer
7. Call model with maxTokens: 8192.
8. Parse JSON response. Validate structure.
9. Convert body markdown to Lexical (use `markdownToLexical` from conversation/lexical-utils.ts).
10. Update ContentProject: body, faqSection, metaTitle, metaDescription, answerCapsule, processingStatus = 'completed'.
11. On error: set processingStatus = 'failed', processingError = error message.

### Task 2: Destination Page Drafter

**File:** `content-system/drafting/destination-page-drafter.ts`

```typescript
export async function draftDestinationPage(projectId: number): Promise<void>
```

Steps:
1. Fetch ContentProject (depth 0).
2. Validate: stage must be 'idea' or 'draft', contentType must be 'destination_page'.
3. Set processingStatus = 'processing'.
4. Load voice: `loadFullVoice('destination_page')` — gets all section guidance.
5. For each section (overview, when_to_visit, why_choose, key_experiences, getting_there, health_safety, investment_expectation, top_lodges, faq):
   a. Find the section guidance from voice.sections (match by sectionKey).
   b. Query embedding store for content about this destination + section topic (e.g., "Masai Mara when to visit best time").
   c. Build section-specific prompt:
      - Voice prompt (core + content type)
      - Section guidance (objective, tone, word count, do/don't lists, examples)
      - Embedding store results (related existing content for consistency)
      - "Write the {sectionLabel} section for the {destination} destination page."
   d. Call model. Parse response as plain text (sections are stored as text in the sections JSON field).
6. Assemble all sections into a JSON object keyed by sectionKey.
7. Also generate: metaTitle, metaDescription, answerCapsule, faqSection (from the faq section content).
8. Update ContentProject: sections (JSON), faqSection, metaTitle, metaDescription, answerCapsule, processingStatus = 'completed'.
9. On error: processingStatus = 'failed', processingError = error message.

**IMPORTANT:** Make 9 separate model calls (one per section), not one giant call. Each section needs its own embedding store query and section-specific guidance. This produces better results than asking for everything at once.

### Task 3: Property Page Drafter

**File:** `content-system/drafting/property-page-drafter.ts`

```typescript
export async function draftPropertyPage(projectId: number): Promise<void>
```

Same compound pattern as destination page drafter, but with fewer sections:
- overview (description)
- faq

Query embedding store for property-specific content. Include any related itinerary segments that feature this property.

### Task 4: Segment Enhancer

**File:** `content-system/drafting/segment-enhancer.ts`

```typescript
export async function enhanceSegment(projectId: number): Promise<void>
```

For itinerary_enhancement projects:
1. Fetch project + target itinerary.
2. Load voice: `loadVoiceForSection('itinerary_enhancement', 'segment_description')`.
3. Query embedding store for content about this property/destination.
4. Build prompt with voice context + segment data + embedding results.
5. Generate enhanced description.
6. Write to ContentProject body field.
7. Set processingStatus.

### Task 5: Social Summariser

**File:** `content-system/drafting/social-summariser.ts`

```typescript
export async function generateSocialSummaries(projectId: number): Promise<void>
```

For article content types only. Runs after body is drafted.
1. Load voice core.
2. Read body text from ContentProject.
3. Generate LinkedIn summary (professional, 150-200 words, includes insight hook).
4. Generate Facebook summary (warmer, 100-150 words, engagement-oriented).
5. Generate Facebook pinned comment (CTA, 1-2 sentences).
6. Write to ContentProject distribution fields.

### Task 6: Drafter Dispatcher

**File:** `content-system/drafting/index.ts`

```typescript
export async function dispatchDraft(projectId: number): Promise<void>
```

Reads ContentProject.contentType and routes:
- `itinerary_cluster` | `authority` | `designer_insight` → `draftArticle`
- `destination_page` → `draftDestinationPage`
- `property_page` → `draftPropertyPage`
- `itinerary_enhancement` → `enhanceSegment`

After the primary drafter completes, if content type is an article type, also run `generateSocialSummaries`.

### Task 7: Draft API Route

**File:** `src/app/(payload)/api/content/draft/route.ts`

POST endpoint. Authenticated (session or CONTENT_SYSTEM_SECRET Bearer token).

Request body: `{ projectId: number }`

1. Validate authentication.
2. Call `dispatchDraft(projectId)`.
3. Return `{ success: true }` or `{ success: false, error: '...' }`.

Set `maxDuration = 300` (5 minutes — compound drafters make multiple LLM calls).

### Task 8: Wire "Generate Draft" Button

**File:** `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`

Replace the `triggerDraft` stub:

```typescript
export async function triggerDraft(projectId: number): Promise<{ success: boolean } | { error: string }> {
  // Set processingStatus = 'processing' immediately (optimistic UI)
  // Call /api/content/draft with projectId
  // Return result
}
```

The server action should call the API route internally (or call `dispatchDraft` directly since it's server-side).

### Task 9: Types

**File:** `content-system/drafting/types.ts`

Export all interfaces used by drafters: DraftResult, SectionDraft, etc.

### Task 10: Verify Build + Test

Run `npm run build`. Fix any TypeScript errors.

---

## Do Not

- Do not modify the BrandVoice global schema (that's Phase 11a).
- Do not create publishing logic (that's Phase 13).
- Do not create consistency checking logic (that's Phase 12).
- Do not modify the workspace UI except to verify the Generate Draft button works.
- Do not call Perplexity API — that was mentioned in V4 plan but we don't have Perplexity integration. Use embedding store results as the research context for compound drafters.
- Do not install new npm packages.

---

## Gate Evidence

```bash
# 1. Build passes
npm run build 2>&1 | tail -20

# 2. Draft an article
# Find an article project at research stage
# Click "Generate Draft" in workspace
# Verify: body populated, faqSection populated, metaTitle populated, metaDescription populated, answerCapsule populated
# Verify: processingStatus shows 'completed'
# Verify: content reflects voice principles (no banned phrases, specific not generic)

# 3. Draft a destination page
# Find a destination_page project
# Click "Generate Draft"
# Verify: sections JSON contains all 9 keys
# Verify: each section is substantive (not placeholder text)
# Verify: faqSection populated

# 4. Draft a property page
# Find a property_page project
# Click "Generate Draft"
# Verify: sections JSON contains expected keys

# 5. Social summaries generated for article
# After article draft completes, verify linkedinSummary and facebookSummary are populated

# 6. Error handling
# Set OPENROUTER_API_KEY to invalid value
# Trigger draft
# Verify: processingStatus = 'failed', processingError contains human-readable message
# Restore API key

# 7. Voice context loaded
# In a drafted article, verify no banned phrases appear
# Verify tone matches content type guidance
```

---

## Summary

| Sub-phase | What | Key deliverables |
|-----------|------|-----------------|
| 11a | BrandVoice infrastructure | Global schema, voice loader, prompt builder, handler integration, enhance endpoint migration |
| 11b | Drafting pipeline | Article drafter, destination page drafter, property page drafter, segment enhancer, social summariser, API route, button wiring |

Phase 11a must be fully verified before 11b begins. 11b's drafters depend on the voice loader and prompt builder from 11a.

---

*Last updated: February 16, 2026*
