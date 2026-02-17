# Phase 11 — Gap Closure: Conversation Handler update_voice

## Background

Phase 11 verification Gates 1-7 proved:
- Database populated with real seed data
- Voice loader correctly reads and filters from Payload API
- Prompt builder generates real LLM system prompts
- Mutation round-trip works (write → cache invalidate → read)
- All import chains verified
- Drafters reach OpenRouter through voice loader

**Remaining gap:** The conversation handler's `update_voice` action has never been exercised end-to-end. The chain is:

```
designer message → handleMessage() → buildSystemPrompt() → callModel() → parseModelResponse() → validateAction() → validateVoiceAction() → processVoiceActions() → payload.updateGlobal() → invalidateVoiceCache()
```

Gate 4 proved the bottom half (updateGlobal → invalidateVoiceCache → fresh read). This test proves the top half AND the full chain.

**Evidence directory:** `content-engine/evidence/phase11/`

---

## TEST A: Parsing and Validation Chain (Deterministic)

This tests `parseModelResponse`, `validateAction`, and `validateVoiceAction` with synthetic data. These are the functions that sit between the LLM response and the database write.

Create `src/app/(payload)/api/test-phase11-parsing/route.ts`:

```typescript
import { NextResponse } from 'next/server'

// We need to test the PRIVATE functions in handler.ts.
// Since they're not exported, we replicate the exact logic here
// and also test through the public handleMessage interface in Test B.

// --- Replicated from handler.ts (DO NOT MODIFY — these must match exactly) ---

interface ParsedAction {
  type: string
  field?: string
  value?: string
  sectionName?: string
  index?: number
  question?: string
  answer?: string
  newStage?: string
  operation?: string
  phrase?: string
  reason?: string
  alternative?: string
  excerpt?: string
  context?: string
  pattern?: string
  explanation?: string
  principle?: string
  example?: string
}

function parseModelResponse(raw: string): {
  message: string
  actions: ParsedAction[]
  suggestedNextStep?: string
} {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  try {
    const parsed = JSON.parse(text)
    return {
      message: parsed.message || text,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      suggestedNextStep: parsed.suggestedNextStep,
    }
  } catch {
    return { message: raw, actions: [] }
  }
}

function validateAction(action: ParsedAction): boolean {
  if (!action.type) return false
  switch (action.type) {
    case 'edit_field':
      return typeof action.field === 'string' && typeof action.value === 'string'
    case 'edit_body':
      return typeof action.value === 'string'
    case 'edit_section':
      return typeof action.sectionName === 'string' && typeof action.value === 'string'
    case 'edit_faq':
      return typeof action.index === 'number' && typeof action.question === 'string' && typeof action.answer === 'string'
    case 'stage_change':
      return typeof action.newStage === 'string'
    case 'update_voice':
      return typeof action.operation === 'string' && validateVoiceAction(action)
    default:
      return false
  }
}

function validateVoiceAction(action: ParsedAction): boolean {
  switch (action.operation) {
    case 'add_banned_phrase':
      return typeof action.phrase === 'string' && typeof action.reason === 'string'
    case 'add_gold_standard':
      return typeof action.excerpt === 'string' && typeof action.context === 'string'
    case 'add_anti_pattern':
      return typeof action.pattern === 'string' && typeof action.explanation === 'string'
    case 'add_principle':
      return typeof action.principle === 'string' && typeof action.explanation === 'string'
    case 'update_summary':
      return typeof action.value === 'string'
    default:
      return false
  }
}

// --- End replicated functions ---

export async function GET() {
  const evidence: Record<string, unknown> = {}

  // TEST A1: Parse a well-formed LLM response with update_voice action
  const goodResponse = JSON.stringify({
    message: "I've added 'spectacular' to the banned phrases list.",
    actions: [
      {
        type: 'update_voice',
        operation: 'add_banned_phrase',
        phrase: 'spectacular',
        reason: 'Overused in safari writing',
        alternative: 'Describe the specific quality',
      },
    ],
    suggestedNextStep: 'Review the updated voice guidelines',
  })

  const parsed1 = parseModelResponse(goodResponse)
  evidence.parseGoodResponse = {
    message: parsed1.message,
    actionCount: parsed1.actions.length,
    firstActionType: parsed1.actions[0]?.type,
    firstActionOperation: parsed1.actions[0]?.operation,
    suggestedNextStep: parsed1.suggestedNextStep,
  }

  // TEST A2: Validate each update_voice operation type
  const voiceOps: ParsedAction[] = [
    { type: 'update_voice', operation: 'add_banned_phrase', phrase: 'spectacular', reason: 'overused' },
    { type: 'update_voice', operation: 'add_banned_phrase', phrase: 'spectacular', reason: 'overused', alternative: 'be specific' },
    { type: 'update_voice', operation: 'add_gold_standard', excerpt: 'Some great writing here', context: 'Overview section' },
    { type: 'update_voice', operation: 'add_anti_pattern', pattern: 'Starting with numbers', explanation: 'Feels like a listicle' },
    { type: 'update_voice', operation: 'add_principle', principle: 'Lead with experience', explanation: 'First-hand knowledge first' },
    { type: 'update_voice', operation: 'add_principle', principle: 'Lead with experience', explanation: 'First-hand knowledge first', example: 'We walked the crater rim at dawn' },
    { type: 'update_voice', operation: 'update_summary', value: 'New voice summary text' },
  ]

  evidence.validOperations = voiceOps.map((op) => ({
    operation: op.operation,
    valid: validateAction(op),
    phrase: op.phrase,
    principle: op.principle,
  }))

  // TEST A3: Validate INVALID update_voice operations are rejected
  const invalidOps: ParsedAction[] = [
    { type: 'update_voice', operation: 'add_banned_phrase' },                           // missing phrase and reason
    { type: 'update_voice', operation: 'add_banned_phrase', phrase: 'test' },            // missing reason
    { type: 'update_voice', operation: 'add_gold_standard', excerpt: 'text' },           // missing context
    { type: 'update_voice', operation: 'add_anti_pattern', pattern: 'something' },       // missing explanation
    { type: 'update_voice', operation: 'add_principle' },                                // missing everything
    { type: 'update_voice', operation: 'update_summary' },                               // missing value
    { type: 'update_voice', operation: 'nonexistent_operation', value: 'test' },         // unknown operation
    { type: 'update_voice' },                                                             // missing operation entirely
  ]

  evidence.invalidOperations = invalidOps.map((op, i) => ({
    index: i,
    operation: op.operation,
    valid: validateAction(op),
    description: [
      'missing phrase and reason',
      'missing reason',
      'missing context',
      'missing explanation',
      'missing principle fields',
      'missing value',
      'unknown operation type',
      'missing operation field',
    ][i],
  }))

  // TEST A4: Parse malformed LLM responses (non-JSON, markdown fenced, etc.)
  const malformed1 = 'Just a plain text response with no JSON'
  const malformed2 = '```json\n{"message":"fenced","actions":[]}\n```'
  const malformed3 = '{"message":"no actions key"}'
  const malformed4 = '{"message":"actions not array","actions":"string"}'

  evidence.malformedParsing = {
    plainText: {
      result: parseModelResponse(malformed1),
      actionCount: parseModelResponse(malformed1).actions.length,
    },
    markdownFenced: {
      result: parseModelResponse(malformed2),
      message: parseModelResponse(malformed2).message,
      actionCount: parseModelResponse(malformed2).actions.length,
    },
    missingActions: {
      result: parseModelResponse(malformed3),
      actionCount: parseModelResponse(malformed3).actions.length,
    },
    actionsNotArray: {
      result: parseModelResponse(malformed4),
      actionCount: parseModelResponse(malformed4).actions.length,
    },
  }

  // TEST A5: Parse a response with MIXED actions (voice + non-voice)
  const mixedResponse = JSON.stringify({
    message: "Updated the meta title and added a banned phrase.",
    actions: [
      { type: 'edit_field', field: 'metaTitle', value: 'New Safari Title' },
      { type: 'update_voice', operation: 'add_banned_phrase', phrase: 'magical', reason: 'vague and overused' },
      { type: 'edit_faq', index: 0, question: 'Q?', answer: 'A.' },
    ],
  })

  const parsedMixed = parseModelResponse(mixedResponse)
  evidence.mixedActions = {
    totalActions: parsedMixed.actions.length,
    voiceActions: parsedMixed.actions.filter(a => a.type === 'update_voice').length,
    nonVoiceActions: parsedMixed.actions.filter(a => a.type !== 'update_voice').length,
    allValid: parsedMixed.actions.every(a => validateAction(a)),
    actionTypes: parsedMixed.actions.map(a => a.type),
  }

  return NextResponse.json(evidence)
}

export const dynamic = 'force-dynamic'
```

```bash
curl -s "http://localhost:3000/api/test-phase11-parsing" > content-engine/evidence/phase11/gapA-parsing-validation.json
```

**REQUIREMENT:**
- All 7 valid operations must return `valid: true`
- All 8 invalid operations must return `valid: false`
- Plain text returns 0 actions
- Markdown-fenced JSON is correctly unwrapped
- Mixed actions: 3 total, 1 voice, 2 non-voice, allValid true

If ANY of these fail, STOP.

---

## TEST B: Full handleMessage End-to-End (Live LLM)

This is the real test. It calls `handleMessage` with a message designed to trigger an `update_voice` action, then verifies the BrandVoice global was actually mutated.

Create `src/app/(payload)/api/test-phase11-voice-e2e/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST() {
  const payload = await getPayload({ config })
  const { loadCoreVoice, invalidateVoiceCache } = await import('../../../../../../content-system/voice/loader')
  const { handleMessage } = await import('../../../../../../content-system/conversation/handler')

  const evidence: Record<string, unknown> = {}
  const CANARY = 'spectacular'

  // Step 1: Read BrandVoice BEFORE — confirm canary is NOT present
  invalidateVoiceCache()
  const before = await loadCoreVoice()
  evidence.before = {
    bannedPhraseCount: before.bannedPhrases.length,
    bannedPhrases: before.bannedPhrases.map(b => b.phrase),
    containsCanary: before.bannedPhrases.some(b => b.phrase === CANARY),
  }

  if (before.bannedPhrases.some(b => b.phrase === CANARY)) {
    evidence.error = `Canary phrase "${CANARY}" already exists in banned phrases — cannot run test`
    return NextResponse.json(evidence)
  }

  // Step 2: Create a temporary content project for the conversation
  let projectId: number | null = null
  try {
    const project = await payload.create({
      collection: 'content-projects',
      data: {
        title: 'PHASE11_VOICE_E2E_TEST_' + Date.now(),
        contentType: 'authority',
        stage: 'draft',
        status: 'active',
        briefSummary: 'Test project for voice update verification',
      } as any,
    })
    projectId = project.id as number
    evidence.projectCreated = { id: projectId }
  } catch (err) {
    evidence.projectCreated = { error: err instanceof Error ? err.message : String(err) }
    return NextResponse.json(evidence)
  }

  // Step 3: Send a message that should trigger update_voice
  // The message is explicit and unambiguous — if the LLM follows the system prompt,
  // it MUST produce an add_banned_phrase action
  const testMessage = `Add the word "spectacular" to Kiuli's banned phrases list. The reason is "Vague superlative that tells rather than shows". The alternative should be "Describe what specifically impresses".`

  try {
    const response = await handleMessage({
      projectId,
      message: testMessage,
    })

    evidence.handleMessageResponse = {
      message: response.message,
      actionCount: response.actions.length,
      actionTypes: response.actions.map(a => a.type),
      actionDetails: response.actions.map(a => a.details),
      hasVoiceAction: response.actions.some(a => a.type === 'update_voice'),
      suggestedNextStep: response.suggestedNextStep,
    }
  } catch (err) {
    evidence.handleMessageResponse = {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.substring(0, 500) : undefined,
    }
    // Don't return early — still check DB state and clean up
  }

  // Step 4: Read BrandVoice AFTER — check if canary appeared
  invalidateVoiceCache()
  const after = await loadCoreVoice()
  evidence.after = {
    bannedPhraseCount: after.bannedPhrases.length,
    bannedPhrases: after.bannedPhrases.map(b => b.phrase),
    containsCanary: after.bannedPhrases.some(b => b.phrase === CANARY),
    canaryEntry: after.bannedPhrases.find(b => b.phrase === CANARY) || null,
    countIncreased: after.bannedPhrases.length > before.bannedPhrases.length,
  }

  // Step 5: Check evolution log for the voice change
  try {
    const brandVoice = await (payload.findGlobal as any)({ slug: 'brand-voice' })
    const log = Array.isArray(brandVoice.evolutionLog) ? brandVoice.evolutionLog : []
    const canaryLogEntry = log.find((e: any) =>
      String(e.change || '').toLowerCase().includes(CANARY)
    )
    evidence.evolutionLog = {
      totalEntries: log.length,
      canaryLogFound: !!canaryLogEntry,
      canaryLogEntry: canaryLogEntry || null,
    }
  } catch (err) {
    evidence.evolutionLog = { error: err instanceof Error ? err.message : String(err) }
  }

  // Step 6: Clean up — remove canary from banned phrases and evolution log
  try {
    const brandVoice = await (payload.findGlobal as any)({ slug: 'brand-voice' })
    const cleanedBanned = (brandVoice.bannedPhrases || []).filter(
      (b: any) => String(b.phrase || '').toLowerCase() !== CANARY
    )
    const cleanedLog = (brandVoice.evolutionLog || []).filter(
      (e: any) => !String(e.change || '').toLowerCase().includes(CANARY)
    )

    await (payload.updateGlobal as any)({
      slug: 'brand-voice',
      data: { bannedPhrases: cleanedBanned, evolutionLog: cleanedLog },
    })

    invalidateVoiceCache()
    const cleanup = await loadCoreVoice()
    evidence.cleanup = {
      bannedPhraseCount: cleanup.bannedPhrases.length,
      containsCanary: cleanup.bannedPhrases.some(b => b.phrase === CANARY),
      restoredToOriginalCount: cleanup.bannedPhrases.length === before.bannedPhrases.length,
    }
  } catch (err) {
    evidence.cleanup = { error: err instanceof Error ? err.message : String(err) }
  }

  // Step 7: Delete test project
  if (projectId) {
    try {
      await payload.delete({ collection: 'content-projects', id: projectId })
      evidence.projectDeleted = true
    } catch {
      evidence.projectDeleted = false
    }
  }

  // Step 8: Final verdict
  const handleResult = evidence.handleMessageResponse as Record<string, unknown> | undefined
  const afterResult = evidence.after as Record<string, unknown> | undefined

  evidence.verdict = {
    llmResponded: !handleResult?.error,
    llmProducedVoiceAction: !!handleResult?.hasVoiceAction,
    canaryAppearedInDB: !!afterResult?.containsCanary,
    evolutionLogUpdated: !!(evidence.evolutionLog as any)?.canaryLogFound,
    cleanupSuccessful: !!(evidence.cleanup as any)?.restoredToOriginalCount,
    fullChainWorked:
      !!handleResult?.hasVoiceAction &&
      !!afterResult?.containsCanary &&
      !!(evidence.evolutionLog as any)?.canaryLogFound &&
      !!(evidence.cleanup as any)?.restoredToOriginalCount,
  }

  return NextResponse.json(evidence)
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60
```

```bash
curl -s --max-time 55 -X POST "http://localhost:3000/api/test-phase11-voice-e2e" > content-engine/evidence/phase11/gapB-voice-e2e.json
```

**REQUIREMENT:**
- `verdict.fullChainWorked` must be `true`
- This means: LLM responded → produced update_voice action → canary appeared in database → evolution log updated → cleanup restored original state
- If `verdict.llmProducedVoiceAction` is `false` but no error occurred, the LLM understood the message but chose not to produce the action — that's a prompt quality issue to document

---

## Cleanup

After both tests complete:

1. Delete test routes:
   - `src/app/(payload)/api/test-phase11-parsing/route.ts`
   - `src/app/(payload)/api/test-phase11-voice-e2e/route.ts`
   - Delete containing directories if empty

2. Keep evidence files.

3. Verify clean git state — no test routes should remain.

---

## Rules

- Test A must pass before running Test B.
- Do NOT modify any existing source code.
- Evidence files are the ONLY output that matters.
- If Test B's LLM call fails or times out, save whatever evidence you have — partial evidence is still evidence.
