# Phase C: Quality Gates Implementation

**Context:** Phase B is complete. BUG-1 (status reset) and BUG-2 (drafter validation) are fixed. Ghost completions are resolved. At least one project has been successfully drafted with all required fields. Quality Gates must exist BEFORE publishing — otherwise ungated content can ship.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Implement the full `checkHardGates` function.** Not a stub. Not a skeleton. The complete function.
2. **The API route must be callable and return real results.**
3. **Every gate must have a positive test (content that passes) AND a negative test (content that fails).**
4. **Write your report to `content-engine/reports/phaseC-quality-gates.md` as you go.**

---

## What Quality Gates Do

Quality Gates are a set of automated checks that run on content before it can be published. They catch:
- Banned phrases from BrandVoice configuration
- Superlative/fear-forward language that violates Kiuli's tone
- Meta field length violations
- FAQ count violations
- Missing required fields

Gates return `{ passed: boolean, violations: QualityViolation[] }`. The types are already defined in `content-system/quality/types.ts`. Do NOT modify the types — implement to match them.

---

## Task 1: Implement `content-system/quality/hard-gates.ts`

Replace the stub with a full implementation. The function signature is already defined by the types:

```typescript
export async function checkHardGates(options: HardGatesOptions): Promise<HardGateResult>
```

Where `HardGatesOptions` is `{ projectId: string, body: string, metaTitle?: string, metaDescription?: string }`.

### Gate 1: Banned Phrase Detection

Load banned phrases from BrandVoice global (use `loadCoreVoice()` from `content-system/voice/loader.ts`).

For each banned phrase in `voice.bannedPhrases`:
- Search for the phrase (case-insensitive) in `body`, `metaTitle`, `metaDescription`
- If found, create a violation:
  ```typescript
  {
    gate: 'banned_phrase',
    severity: 'error',
    message: `Banned phrase "${phrase.phrase}" found in ${fieldName}: ${phrase.reason}`,
    field: fieldName,
    details: {
      word: phrase.phrase,
      context: /* 50 chars of surrounding text */,
      position: /* character index */,
    } as BannedWordMatch
  }
  ```

### Gate 2: Superlative and Fear-Forward Language

Check body text for these patterns (case-insensitive):
- "the best" (at word boundary: `\bthe best\b`)
- "the most" (at word boundary: `\bthe most\b`)
- "once in a lifetime" (at word boundary)
- "bucket list" (at word boundary)
- "don't miss" / "don't miss out"
- "you won't believe"
- "limited availability" / "book now before"
- "FOMO" / "fear of missing"

These are severity `'warning'` not `'error'` — they flag for human review but don't block publication.

```typescript
{
  gate: 'superlative_language',
  severity: 'warning',
  message: `Superlative/fear-forward phrase "${matched}" found in body`,
  field: 'body',
}
```

### Gate 3: Meta Field Length Validation

- `metaTitle`: if provided, must be 1-60 characters. Flag as `'error'` if > 60, `'warning'` if empty.
- `metaDescription`: if provided, must be 1-160 characters. Flag as `'error'` if > 160, `'warning'` if empty.

```typescript
{
  gate: 'meta_length',
  severity: 'error',
  message: `metaTitle is ${actual} chars (max 60)`,
  field: 'metaTitle',
  details: { field: 'metaTitle', actual, max: 60 } as LengthViolation
}
```

### Gate 4: FAQ Count Validation

Load the project from the database using `projectId`:

```typescript
const payload = await getPayload({ config: configPromise })
const project = await payload.findByID({
  collection: 'content-projects',
  id: Number(options.projectId),
  depth: 0,
}) as unknown as Record<string, unknown>

const faqSection = Array.isArray(project.faqSection) ? project.faqSection : []
```

- Articles (itinerary_cluster, authority, designer_insight): minimum 5 FAQ items. Flag as `'error'` if fewer.
- Destination pages: minimum 3 FAQ items. Flag as `'warning'` if fewer.
- Property pages: minimum 2 FAQ items. Flag as `'warning'` if fewer.

### Gate 5: Required Fields Check

Based on content type, verify required fields are non-null and non-empty in the project record:

For articles: `body`, `metaTitle`, `metaDescription`, `answerCapsule`
For destination_page: `sections`, `metaTitle`, `metaDescription`
For property_page: `sections`, `metaTitle`, `metaDescription`

Flag as `'error'` for each missing required field.

### Aggregation

`passed` is `true` only if there are ZERO violations with `severity: 'error'`. Warnings do not block.

---

## Task 2: Create API Route `/api/content/quality-gates/route.ts`

Create `src/app/(payload)/api/content/quality-gates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkHardGates } from '../../../../../../content-system/quality/hard-gates'
import { extractTextFromLexical } from '../../../../../../content-system/embeddings/lexical-text'

export const dynamic = 'force-dynamic'

async function validateAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY
    ) {
      return true
    }
  }
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) return true
  } catch {}
  return false
}

export async function POST(request: NextRequest) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Load project to extract body text
    const payload = await getPayload({ config })
    const project = await payload.findByID({
      collection: 'content-projects',
      id: Number(projectId),
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Extract body text (Lexical → plain text)
    let bodyText = ''
    if (project.body) {
      bodyText = extractTextFromLexical(project.body)
    } else if (project.sections) {
      // For compound types, concatenate all section text
      const sections = typeof project.sections === 'string'
        ? JSON.parse(project.sections)
        : project.sections
      bodyText = Object.values(sections || {}).map(v => String(v || '')).join('\n\n')
    }

    const result = await checkHardGates({
      projectId: String(projectId),
      body: bodyText,
      metaTitle: (project.metaTitle as string) || undefined,
      metaDescription: (project.metaDescription as string) || undefined,
    })

    // Write result back to project
    const errorCount = result.violations.filter(v => v.severity === 'error').length
    const warningCount = result.violations.filter(v => v.severity === 'warning').length

    await payload.update({
      collection: 'content-projects',
      id: Number(projectId),
      data: {
        // Store in consistency tab's fields — or use a new field. 
        // For now, store gates result in processingError as JSON if failed.
        // The actual pass/fail is used by the publish route later.
      },
    })

    return NextResponse.json({
      success: true,
      passed: result.passed,
      errorCount,
      warningCount,
      violations: result.violations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Adjust the import paths to match the actual directory depth from the route file to `content-system/`.

---

## Task 3: Verification

### Test 3a: Negative Test — Banned Phrase

First, find a banned phrase in BrandVoice:

```sql
SELECT phrase, reason FROM brand_voice_banned_phrases LIMIT 3;
```

Then test the quality gates API with content containing that phrase:

Pick a project that has a draft body. If none exist yet, use project 27 (or whichever has a body from Phase B's re-drafting).

If the project's body does NOT contain a banned phrase, temporarily use the conversation handler or direct Payload update to insert one. Then call:

```bash
curl -X POST https://kiuli.com/api/content/quality-gates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

Expected: `passed: false`, violations array contains a `banned_phrase` violation.

### Test 3b: Positive Test — Clean Content

Use a project with a clean draft (no banned phrases, valid meta lengths). Call the same endpoint.

Expected: `passed: true`, zero error-severity violations. May have warnings (superlatives).

### Test 3c: Negative Test — Meta Title Too Long

Create or update a project to have a metaTitle of 65 characters. Call quality gates.

Expected: `passed: false`, violation with gate `meta_length` and field `metaTitle`.

### Gate C1: Quality Gates Work

```
PASS criteria:
1. Test 3a returns passed=false with a banned_phrase violation (paste full response)
2. Test 3b returns passed=true with zero error violations (paste full response)
3. Test 3c returns passed=false with a meta_length violation (paste full response)
4. Build passes
5. Route returns non-404 on production
```

---

## Commit

```bash
git add -A
git commit -m "feat: Phase C — quality gates implementation with banned phrase, superlative, meta length, FAQ count, and required field checks"
git push
```

---

## Report Format

Write to `content-engine/reports/phaseC-quality-gates.md`:

```markdown
# Phase C: Quality Gates — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Implementation
### Files Created/Modified
[list of files with sizes]

### hard-gates.ts
[brief summary of what each gate checks — not the full code, just the logic]

### API Route
[file path and HTTP method]

## Verification
### Test 3a: Banned Phrase Detection
**Banned phrase used:** [phrase]
**Project ID:** [id]
**Request:** [curl command]
**Response:** [full JSON response]
**Result:** [PASS/FAIL]

### Test 3b: Clean Content
**Project ID:** [id]
**Response:** [full JSON response]
**Result:** [PASS/FAIL]

### Test 3c: Meta Length Violation
**metaTitle length:** [chars]
**Response:** [full JSON response]
**Result:** [PASS/FAIL]

### Gate C1: [PASS/FAIL]

## Git
- Committed: [YES/NO]
- Pushed: [YES/NO]

## Overall: [PASS / BLOCKED AT GATE]
```

---

## STOP CONDITIONS

- If `loadCoreVoice()` returns empty or throws → the BrandVoice global may not be populated. STOP and report.
- If any test produces unexpected results → STOP and report the full response.
- If the build fails → STOP and report the error.
