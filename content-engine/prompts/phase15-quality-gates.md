# Phase 15: Quality Gates — Implementation, Workspace UI, and Publish Blocking

**Context:** Phases 1–14 (including 14a + bugfixes) are complete. The Content Engine can create, research, draft, consistency-check, and assign images to content projects. But there is NO quality gate between draft and publish. Content can ship containing banned phrases, superlatives, missing meta fields, or incomplete FAQ sections. Quality Gates must exist BEFORE any content is published.

**Strategist:** Claude.ai (Graham's project)
**Tactician:** You (Claude CLI)

---

## Rules

1. **No stubs. No skeletons.** Every function must be complete and callable.
2. **Every gate must have a positive test (content that passes) AND a negative test (content that fails).**
3. **Follow the exact patterns established by the consistency checking system** — same field naming conventions, same workspace tab structure, same server action patterns.
4. **Do not modify any existing working functionality.** This is additive only.
5. **Write evidence to `content-engine/evidence/phase15/` as you go.**

---

## Step 0: Investigation

Before writing any code, verify each of these claims. Write findings to `content-engine/evidence/phase15/investigation.txt`.

### Check 1: Stub confirmation
Open `content-system/quality/hard-gates.ts`. Confirm it contains only a type import and a `declare function` stub — no actual implementation. Record the exact file contents.

### Check 2: No API route
Confirm `src/app/(payload)/api/content/quality-gates/route.ts` does NOT exist. Record the result.

### Check 3: No workspace tab
Search for `QualityGatesTab` in the codebase. Confirm zero results. Record the result.

### Check 4: No quality gate fields on schema
Open `src/collections/ContentProjects/index.ts`. Confirm there are no fields named `qualityGatesResult`, `qualityGatesViolations`, `qualityGatesCheckedAt`, or `qualityGatesOverridden`. Record the result.

### Check 5: All publish paths unguarded
There are FOUR code paths that can set a project to `published` status. Verify that NONE of them check quality gates:

**Path A:** `advanceProjectStage` in `src/app/(payload)/admin/content-engine/project/[id]/actions.ts` — find the `if (nextStage === 'published')` block. Record what it checks.

**Path B:** `triggerPublish` in `src/app/(payload)/admin/content-engine/project/[id]/actions.ts` — find the publish-blocking checks. Record what it checks.

**Path C:** POST handler in `src/app/(payload)/api/content/publish/route.ts` — find the publish-blocking checks. Record what it checks.

**Path D:** advance action in `src/app/(payload)/api/content/dashboard/batch/route.ts` — find the `if (nextStage === 'published')` block. Record what it checks.

All four should currently check consistency only — no quality gates. Record the relevant lines from each.

### Check 6: BrandVoice has banned phrases
Run: `SELECT COUNT(*) FROM brand_voice_banned_phrases;`
Confirm count > 0. Record the count.

### Check 7: Test candidate exists
Run: `SELECT id, title, stage FROM content_projects WHERE body IS NOT NULL AND stage = 'draft' LIMIT 3;`
Record the IDs — these will be used for verification tests.

Write all 7 findings to `content-engine/evidence/phase15/investigation.txt`.

**STOP CONDITION:** If Check 6 returns 0, BrandVoice is not populated. STOP and report.

---

## Fix 1: Add Quality Gates fields to ContentProjects schema

**File:** `src/collections/ContentProjects/index.ts`

Add a new tab after the existing "Consistency" tab (Tab 10). Follow the exact pattern used by the consistency fields.

```typescript
// Tab 11: Quality Gates
{
  label: 'Quality Gates',
  fields: [
    {
      name: 'qualityGatesResult',
      type: 'select',
      defaultValue: 'not_checked',
      options: [
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
        { label: 'Not Checked', value: 'not_checked' },
      ],
      admin: {
        description: 'Result of last quality gates check',
      },
    },
    {
      name: 'qualityGatesViolations',
      type: 'json',
      admin: {
        description: 'Array of quality violations from last check',
      },
    },
    {
      name: 'qualityGatesCheckedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When quality gates were last run',
      },
    },
    {
      name: 'qualityGatesOverridden',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether error-level gate violations have been overridden for publishing',
      },
    },
    {
      name: 'qualityGatesOverrideNote',
      type: 'textarea',
      admin: {
        description: 'Mandatory explanation for why gate violations were overridden',
        condition: (data) => data?.qualityGatesOverridden === true,
      },
    },
  ],
},
```

**Insert position:** After the `// Tab 10: Consistency` block and before `// Tab 11: Metadata`. Renumber the remaining comments: Metadata becomes Tab 12, Conversation becomes Tab 13.

**Verification:** Read back the file and confirm the Quality Gates tab is between Consistency and Metadata.

---

## Fix 2: Implement `content-system/quality/hard-gates.ts`

Replace the entire stub with a complete implementation. Do NOT modify `content-system/quality/types.ts` — implement to match the existing types exactly.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadCoreVoice } from '../voice/loader'
import type { HardGatesOptions, HardGateResult, QualityViolation, BannedWordMatch, LengthViolation } from './types'

const ARTICLE_TYPES = new Set(['itinerary_cluster', 'authority', 'designer_insight'])

// Superlative and fear-forward patterns (word-boundary, case-insensitive)
const SUPERLATIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bthe best\b/i, label: 'the best' },
  { pattern: /\bthe most\b/i, label: 'the most' },
  { pattern: /\bonce in a lifetime\b/i, label: 'once in a lifetime' },
  { pattern: /\bbucket list\b/i, label: 'bucket list' },
  { pattern: /\bdon't miss\b/i, label: "don't miss" },
  { pattern: /\byou won't believe\b/i, label: "you won't believe" },
  { pattern: /\blimited availability\b/i, label: 'limited availability' },
  { pattern: /\bbook now before\b/i, label: 'book now before' },
  { pattern: /\bfomo\b/i, label: 'FOMO' },
  { pattern: /\bfear of missing\b/i, label: 'fear of missing' },
]

export async function checkHardGates(options: HardGatesOptions): Promise<HardGateResult> {
  const violations: QualityViolation[] = []

  // ── Gate 1: Banned Phrase Detection ──────────────────────────────────
  const voice = await loadCoreVoice()

  for (const banned of voice.bannedPhrases) {
    if (!banned.phrase) continue
    const regex = new RegExp(escapeRegex(banned.phrase), 'gi')

    for (const [fieldName, fieldValue] of fieldsToCheck(options)) {
      let match: RegExpExecArray | null
      while ((match = regex.exec(fieldValue)) !== null) {
        const start = Math.max(0, match.index - 25)
        const end = Math.min(fieldValue.length, match.index + match[0].length + 25)
        const context = fieldValue.slice(start, end)

        violations.push({
          gate: 'banned_phrase',
          severity: 'error',
          message: `Banned phrase "${banned.phrase}" found in ${fieldName}: ${banned.reason}`,
          field: fieldName,
          details: {
            word: banned.phrase,
            context,
            position: match.index,
          } as BannedWordMatch,
        })
      }
    }
  }

  // ── Gate 2: Superlative and Fear-Forward Language ────────────────────
  for (const { pattern, label } of SUPERLATIVE_PATTERNS) {
    if (pattern.test(options.body)) {
      violations.push({
        gate: 'superlative_language',
        severity: 'warning',
        message: `Superlative/fear-forward phrase "${label}" found in body`,
        field: 'body',
      })
    }
  }

  // ── Gate 3: Meta Field Length Validation ─────────────────────────────
  if (options.metaTitle) {
    if (options.metaTitle.length > 60) {
      violations.push({
        gate: 'meta_length',
        severity: 'error',
        message: `metaTitle is ${options.metaTitle.length} chars (max 60)`,
        field: 'metaTitle',
        details: { field: 'metaTitle', actual: options.metaTitle.length, max: 60 } as LengthViolation,
      })
    }
  } else {
    violations.push({
      gate: 'meta_length',
      severity: 'warning',
      message: 'metaTitle is empty',
      field: 'metaTitle',
    })
  }

  if (options.metaDescription) {
    if (options.metaDescription.length > 160) {
      violations.push({
        gate: 'meta_length',
        severity: 'error',
        message: `metaDescription is ${options.metaDescription.length} chars (max 160)`,
        field: 'metaDescription',
        details: { field: 'metaDescription', actual: options.metaDescription.length, max: 160 } as LengthViolation,
      })
    }
  } else {
    violations.push({
      gate: 'meta_length',
      severity: 'warning',
      message: 'metaDescription is empty',
      field: 'metaDescription',
    })
  }

  // ── Gate 4: FAQ Count Validation ────────────────────────────────────
  const payload = await getPayload({ config: configPromise })
  const project = await payload.findByID({
    collection: 'content-projects',
    id: Number(options.projectId),
    depth: 0,
  }) as unknown as Record<string, unknown>

  const contentType = project.contentType as string
  const faqSection = Array.isArray(project.faqSection) ? project.faqSection : []
  const faqCount = faqSection.filter((f: Record<string, unknown>) => f.question && f.answer).length

  if (ARTICLE_TYPES.has(contentType) && faqCount < 5) {
    violations.push({
      gate: 'faq_count',
      severity: 'error',
      message: `Articles require at least 5 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  } else if (contentType === 'destination_page' && faqCount < 3) {
    violations.push({
      gate: 'faq_count',
      severity: 'warning',
      message: `Destination pages should have at least 3 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  } else if (contentType === 'property_page' && faqCount < 2) {
    violations.push({
      gate: 'faq_count',
      severity: 'warning',
      message: `Property pages should have at least 2 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  }

  // ── Gate 5: Required Fields Check ───────────────────────────────────
  if (ARTICLE_TYPES.has(contentType)) {
    if (!project.body) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "body" is empty', field: 'body' })
    if (!project.metaTitle) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaTitle" is empty', field: 'metaTitle' })
    if (!project.metaDescription) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaDescription" is empty', field: 'metaDescription' })
    if (!project.answerCapsule) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "answerCapsule" is empty', field: 'answerCapsule' })
  } else if (contentType === 'destination_page' || contentType === 'property_page') {
    if (!project.sections) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "sections" is empty', field: 'sections' })
    if (!project.metaTitle) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaTitle" is empty', field: 'metaTitle' })
    if (!project.metaDescription) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaDescription" is empty', field: 'metaDescription' })
  }

  // ── Aggregation ─────────────────────────────────────────────────────
  const hasErrors = violations.some((v) => v.severity === 'error')

  return {
    passed: !hasErrors,
    violations,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function* fieldsToCheck(options: HardGatesOptions): Generator<[string, string]> {
  if (options.body) yield ['body', options.body]
  if (options.metaTitle) yield ['metaTitle', options.metaTitle]
  if (options.metaDescription) yield ['metaDescription', options.metaDescription]
}
```

**Verification:** Read back `content-system/quality/hard-gates.ts` and confirm:
- It imports `loadCoreVoice` from `../voice/loader`
- It imports types from `./types`
- `checkHardGates` is an async function (not a `declare`)
- All 5 gates are implemented (banned_phrase, superlative_language, meta_length, faq_count, required_field)
- `passed` is `true` only when zero error-severity violations exist

---

## Fix 3: Create API route `/api/content/quality-gates/route.ts`

**File:** `src/app/(payload)/api/content/quality-gates/route.ts`

Follow the exact auth pattern from `/api/content/consistency/route.ts`.

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

    const payload = await getPayload({ config })
    const project = await payload.findByID({
      collection: 'content-projects',
      id: Number(projectId),
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Extract body text
    let bodyText = ''
    if (project.body) {
      bodyText = extractTextFromLexical(project.body)
    } else if (project.sections) {
      const sections = typeof project.sections === 'string'
        ? JSON.parse(project.sections as string)
        : project.sections
      bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
    }

    const result = await checkHardGates({
      projectId: String(projectId),
      body: bodyText,
      metaTitle: (project.metaTitle as string) || undefined,
      metaDescription: (project.metaDescription as string) || undefined,
    })

    const now = new Date().toISOString()

    // Persist result on the project
    await payload.update({
      collection: 'content-projects',
      id: Number(projectId),
      data: {
        qualityGatesResult: result.passed ? 'pass' : 'fail',
        qualityGatesViolations: result.violations,
        qualityGatesCheckedAt: now,
        // Reset override when re-checking
        qualityGatesOverridden: false,
        qualityGatesOverrideNote: null,
      },
    })

    return NextResponse.json({
      success: true,
      passed: result.passed,
      errorCount: result.violations.filter((v) => v.severity === 'error').length,
      warningCount: result.violations.filter((v) => v.severity === 'warning').length,
      violations: result.violations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Verification:** Read back the file and confirm POST handler, auth, body extraction, checkHardGates call, and result persistence.

---

## Fix 4: Add workspace types and transform mapping

### 4a: Update `src/components/content-system/workspace-types.ts`

Add a `QualityViolationDisplay` interface and quality gate fields to `WorkspaceProject`.

After the existing `ConsistencyIssueDisplay` interface (around line 100), add:

```typescript
export interface QualityViolationDisplay {
  gate: string
  severity: 'error' | 'warning'
  message: string
  field?: string
  details?: Record<string, unknown>
}
```

Inside the `WorkspaceProject` interface, after the consistency fields block (after `consistencyIssues`), add:

```typescript
  // Quality Gates
  qualityGatesResult?: 'pass' | 'fail' | 'not_checked'
  qualityGatesViolations?: QualityViolationDisplay[]
  qualityGatesCheckedAt?: string | null
  qualityGatesOverridden?: boolean
  qualityGatesOverrideNote?: string
```

### 4b: Update `src/lib/transform-project.ts`

**First**, add `QualityViolationDisplay` to the existing import from workspace-types. The current import is:

```typescript
import type {
  WorkspaceProject,
  WorkspaceStage,
  WorkspaceContentType,
  WorkspaceProcessingStatus,
  ResearchSource,
  UncertaintyItem,
  FAQItem,
  ConversationMessage,
  ConsistencyIssueDisplay,
  ArticleImage,
} from '@/components/content-system/workspace-types'
```

Change it to:

```typescript
import type {
  WorkspaceProject,
  WorkspaceStage,
  WorkspaceContentType,
  WorkspaceProcessingStatus,
  ResearchSource,
  UncertaintyItem,
  FAQItem,
  ConversationMessage,
  ConsistencyIssueDisplay,
  QualityViolationDisplay,
  ArticleImage,
} from '@/components/content-system/workspace-types'
```

**Then**, inside the `transformProject` function's return object, after the consistency block (after `consistencyIssues: consistencyIssues.length > 0 ? consistencyIssues : undefined,`), add:

```typescript
    // Quality Gates
    qualityGatesResult: (raw.qualityGatesResult as WorkspaceProject['qualityGatesResult']) || undefined,
    qualityGatesViolations: Array.isArray(raw.qualityGatesViolations)
      ? (raw.qualityGatesViolations as QualityViolationDisplay[])
      : undefined,
    qualityGatesCheckedAt: (raw.qualityGatesCheckedAt as string) || undefined,
    qualityGatesOverridden: (raw.qualityGatesOverridden as boolean) || false,
    qualityGatesOverrideNote: (raw.qualityGatesOverrideNote as string) || undefined,
```

**Verification:** Read back both files. Confirm:
- `QualityViolationDisplay` interface exists in workspace-types.ts
- Quality gate fields exist on `WorkspaceProject` interface
- `QualityViolationDisplay` is imported in transform-project.ts
- Quality gate fields are mapped in `transformProject` return object

---

## Fix 5: Add `triggerQualityGates` and `overrideQualityGates` server actions

**File:** `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`

Add two new server actions after the existing `resolveConsistencyIssue` (Action 10) and before `triggerPublish` (Action 11).

**Note on imports:** These server actions use dynamic imports for content-system modules (`checkHardGates`, `extractTextFromLexical`). This is the established pattern in this file — see how `triggerConsistencyCheck` dynamically imports `checkConsistency`, and how `advanceProjectStage` dynamically imports the consistency checker. Dynamic imports are correct here because these are server-side content-system modules loaded on demand.

### Action: triggerQualityGates

```typescript
// ── Action: Trigger Quality Gates ────────────────────────────────────────────

export async function triggerQualityGates(
  projectId: number,
): Promise<{ success: true; result: { passed: boolean; errorCount: number; warningCount: number } } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    await payload.findByID({ collection: 'content-projects', id: projectId, depth: 0 })
  } catch {
    return { error: 'Project not found' }
  }

  try {
    const { checkHardGates } = await import(
      '../../../../../../../content-system/quality/hard-gates'
    )
    const { extractTextFromLexical } = await import(
      '../../../../../../../content-system/embeddings/lexical-text'
    )

    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Extract body text
    let bodyText = ''
    if (project.body) {
      bodyText = extractTextFromLexical(project.body)
    } else if (project.sections) {
      const sections = typeof project.sections === 'string'
        ? JSON.parse(project.sections as string)
        : project.sections
      bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
    }

    const result = await checkHardGates({
      projectId: String(projectId),
      body: bodyText,
      metaTitle: (project.metaTitle as string) || undefined,
      metaDescription: (project.metaDescription as string) || undefined,
    })

    const now = new Date().toISOString()

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        qualityGatesResult: result.passed ? 'pass' : 'fail',
        qualityGatesViolations: result.violations,
        qualityGatesCheckedAt: now,
        qualityGatesOverridden: false,
        qualityGatesOverrideNote: null,
      },
    })

    return {
      success: true,
      result: {
        passed: result.passed,
        errorCount: result.violations.filter((v: { severity: string }) => v.severity === 'error').length,
        warningCount: result.violations.filter((v: { severity: string }) => v.severity === 'warning').length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: message }
  }
}
```

### Action: overrideQualityGates

```typescript
// ── Action: Override Quality Gates ───────────────────────────────────────────

export async function overrideQualityGates(
  projectId: number,
  note: string,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!note || note.trim().length === 0) {
    return { error: 'Override requires a note explaining why.' }
  }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((project.qualityGatesResult as string) !== 'fail') {
      return { error: 'Nothing to override — gates did not fail.' }
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        qualityGatesOverridden: true,
        qualityGatesOverrideNote: note.trim(),
      },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

**Verification:** Search for `triggerQualityGates` and `overrideQualityGates` in actions.ts. Confirm both exist as exported async functions.

---

## Fix 6: Wire quality gates into ALL publish paths

There are FOUR code paths that can set a project to `published`. ALL FOUR must block on quality gates. There are also TWO code paths that auto-trigger checks on advance to `review`. BOTH must trigger quality gates.

### 6a: `advanceProjectStage` in actions.ts — publish blocking

Find the `if (nextStage === 'published')` block in `advanceProjectStage`. It currently checks for unresolved hard contradictions only. Add quality gates checks AFTER the existing consistency check, still INSIDE the same `if (nextStage === 'published')` block (before the closing `}`):

```typescript
      // Block publish if quality gates failed and not overridden
      const gatesResult = project.qualityGatesResult as string
      const gatesOverridden = project.qualityGatesOverridden as boolean

      if (gatesResult === 'not_checked' || !gatesResult) {
        return {
          error: 'Cannot publish: quality gates have not been run. Run them in the Quality Gates tab first.',
        }
      }

      if (gatesResult === 'fail' && !gatesOverridden) {
        return {
          error: 'Cannot publish: quality gates failed with error-level violations. Fix violations or override in the Quality Gates tab.',
        }
      }
```

### 6b: `triggerPublish` in actions.ts — publish blocking

Find the `triggerPublish` function. After the existing consistency check block (`if ((project.consistencyCheckResult as string) === 'hard_contradiction') { ... }`), add:

```typescript
    // Block if quality gates failed and not overridden
    const gatesResult = project.qualityGatesResult as string
    const gatesOverridden = project.qualityGatesOverridden as boolean

    if (gatesResult === 'not_checked' || !gatesResult) {
      return { error: 'Cannot publish: quality gates have not been run.' }
    }

    if (gatesResult === 'fail' && !gatesOverridden) {
      return { error: 'Cannot publish: quality gates failed. Fix violations or override first.' }
    }
```

### 6c: `advanceProjectStage` in actions.ts — review auto-trigger

In `advanceProjectStage`, find the `if (nextStage === 'review')` block. It currently contains a single try/catch that runs the consistency check. Add a SECOND, SEPARATE try/catch for quality gates AFTER the first one. The resulting structure must be:

```
    if (nextStage === 'review') {
      try {
        // EXISTING consistency check — do not modify
      } catch (error) {
        // EXISTING consistency error handling — do not modify
      }

      // ADD THIS — quality gates auto-trigger (separate try/catch)
      try {
        ...quality gates code...
      } catch (gateError) {
        ...quality gates error handling...
      }
    }
```

Here is the quality gates try/catch to add:

```typescript
      // Auto-trigger quality gates (separate from consistency — non-fatal)
      try {
        const { checkHardGates } = await import(
          '../../../../../../../content-system/quality/hard-gates'
        )
        const { extractTextFromLexical } = await import(
          '../../../../../../../content-system/embeddings/lexical-text'
        )

        const freshProject = await payload.findByID({
          collection: 'content-projects',
          id: projectId,
          depth: 0,
        }) as unknown as Record<string, unknown>

        let bodyText = ''
        if (freshProject.body) {
          bodyText = extractTextFromLexical(freshProject.body)
        } else if (freshProject.sections) {
          const sections = typeof freshProject.sections === 'string'
            ? JSON.parse(freshProject.sections as string)
            : freshProject.sections
          bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
        }

        const gateResult = await checkHardGates({
          projectId: String(projectId),
          body: bodyText,
          metaTitle: (freshProject.metaTitle as string) || undefined,
          metaDescription: (freshProject.metaDescription as string) || undefined,
        })

        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: {
            qualityGatesResult: gateResult.passed ? 'pass' : 'fail',
            qualityGatesViolations: gateResult.violations,
            qualityGatesCheckedAt: new Date().toISOString(),
            qualityGatesOverridden: false,
            qualityGatesOverrideNote: null,
          },
        })
      } catch (gateError) {
        console.error(`[advanceProjectStage] Quality gates failed for project ${projectId}:`,
          gateError instanceof Error ? gateError.message : gateError)
        // Non-fatal — don't block stage advance, just leave as not_checked
      }
```

### 6d: `/api/content/publish/route.ts` — publish blocking

**File:** `src/app/(payload)/api/content/publish/route.ts`

Find the block that checks `consistencyCheckResult` for hard contradictions (the `if (consistencyResult === 'hard_contradiction')` block). After it (after its closing `}`), add:

```typescript
  // Block if quality gates failed and not overridden
  const gatesResult = project.qualityGatesResult as string
  const gatesOverridden = project.qualityGatesOverridden as boolean

  if (gatesResult === 'not_checked' || !gatesResult) {
    return NextResponse.json({
      error: 'Cannot publish: quality gates have not been run.',
    }, { status: 409 })
  }

  if (gatesResult === 'fail' && !gatesOverridden) {
    return NextResponse.json({
      error: 'Cannot publish: quality gates failed. Fix violations or override first.',
    }, { status: 409 })
  }
```

### 6e: `/api/content/dashboard/batch/route.ts` — publish blocking AND review auto-trigger

**File:** `src/app/(payload)/api/content/dashboard/batch/route.ts`

**Publish blocking:** Inside the `if (action === 'advance')` for-loop, find the `if (nextStage === 'published')` block. After the existing consistency check (which adds to `skipped` and calls `continue`), add:

```typescript
            // Block if quality gates failed and not overridden
            const gatesResult = (project as Record<string, unknown>).qualityGatesResult as string
            const gatesOverridden = (project as Record<string, unknown>).qualityGatesOverridden as boolean

            if (gatesResult === 'not_checked' || !gatesResult) {
              skipped.push({ id, reason: 'Quality gates have not been run' })
              continue
            }

            if (gatesResult === 'fail' && !gatesOverridden) {
              skipped.push({ id, reason: 'Quality gates failed — not overridden' })
              continue
            }
```

**Review auto-trigger:** Inside the `if (nextStage === 'review')` block, there is already a try/catch that runs the consistency check. Add a SECOND, SEPARATE try/catch for quality gates AFTER the first one (same pattern as Fix 6c). The resulting structure must be:

```
          if (nextStage === 'review') {
            try {
              // EXISTING consistency check — do not modify
            } catch (error) {
              // EXISTING consistency error handling — do not modify
            }

            // ADD THIS — quality gates auto-trigger
            try {
              ...quality gates code...
            } catch (gateError) {
              ...quality gates error handling...
            }
          }
```

Here is the quality gates try/catch for the batch route:

```typescript
          // Auto-trigger quality gates (separate from consistency — non-fatal)
          try {
            const { checkHardGates } = await import(
              '../../../../../../../content-system/quality/hard-gates'
            )
            const { extractTextFromLexical } = await import(
              '../../../../../../../content-system/embeddings/lexical-text'
            )

            const freshProject = await payload.findByID({
              collection: 'content-projects',
              id,
              depth: 0,
            }) as unknown as Record<string, unknown>

            let bodyText = ''
            if (freshProject.body) {
              bodyText = extractTextFromLexical(freshProject.body)
            } else if (freshProject.sections) {
              const sections = typeof freshProject.sections === 'string'
                ? JSON.parse(freshProject.sections as string)
                : freshProject.sections
              bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
            }

            const gateResult = await checkHardGates({
              projectId: String(id),
              body: bodyText,
              metaTitle: (freshProject.metaTitle as string) || undefined,
              metaDescription: (freshProject.metaDescription as string) || undefined,
            })

            await payload.update({
              collection: 'content-projects',
              id,
              data: {
                qualityGatesResult: gateResult.passed ? 'pass' : 'fail',
                qualityGatesViolations: gateResult.violations,
                qualityGatesCheckedAt: new Date().toISOString(),
                qualityGatesOverridden: false,
                qualityGatesOverrideNote: null,
              },
            })
          } catch (gateError) {
            console.error(`[batch-advance] Quality gates failed for project ${id}:`,
              gateError instanceof Error ? gateError.message : gateError)
            // Non-fatal — don't block stage advance
          }
```

### Fix 6 Verification

Search for `qualityGatesResult` across the ENTIRE codebase. It must appear in ALL of these locations:

| File | Location | Purpose |
|------|----------|---------|
| `actions.ts` | `advanceProjectStage` — `nextStage === 'published'` block | Publish blocking |
| `actions.ts` | `advanceProjectStage` — `nextStage === 'review'` block | Review auto-trigger |
| `actions.ts` | `triggerPublish` | Publish blocking |
| `actions.ts` | `triggerQualityGates` | Gate execution + persistence |
| `actions.ts` | `overrideQualityGates` | Override check |
| `publish/route.ts` | POST handler | Publish blocking |
| `batch/route.ts` | `nextStage === 'published'` block | Publish blocking |
| `batch/route.ts` | `nextStage === 'review'` block | Review auto-trigger |

If `qualityGatesResult` is missing from ANY of these 8 locations, the phase is incomplete.

---

## Fix 7: Add `QualityGatesTab` to workspace

### 7a: Update imports in ContentTabs.tsx

**File:** `src/components/content-system/workspace/ContentTabs.tsx`

The existing static import block for server actions at the top of the file is:

```typescript
import {
  saveProjectFields,
  triggerResearch,
  triggerDraft,
  saveFaqItems,
  triggerConsistencyCheck,
  resolveConsistencyIssue,
  saveArticleImages,
} from '@/app/(payload)/admin/content-engine/project/[id]/actions'
```

Add the two new actions to this EXISTING static import block:

```typescript
import {
  saveProjectFields,
  triggerResearch,
  triggerDraft,
  saveFaqItems,
  triggerConsistencyCheck,
  resolveConsistencyIssue,
  saveArticleImages,
  triggerQualityGates,
  overrideQualityGates,
} from '@/app/(payload)/admin/content-engine/project/[id]/actions'
```

Also add `QualityViolationDisplay` to the existing workspace-types import. The current import is:

```typescript
import {
  isArticleType,
  isCompoundType,
  sectionLabels,
  type WorkspaceProject,
  type ConsistencyIssueDisplay,
  type ArticleImage,
} from '../workspace-types'
```

Change it to:

```typescript
import {
  isArticleType,
  isCompoundType,
  sectionLabels,
  type WorkspaceProject,
  type ConsistencyIssueDisplay,
  type QualityViolationDisplay,
  type ArticleImage,
} from '../workspace-types'
```

### 7b: Add the tab component

**File:** `src/components/content-system/workspace/ContentTabs.tsx`

Add a new exported `QualityGatesTab` component. Place it AFTER the `ConsistencyTab` export and BEFORE the `DistributionTab` export.

This component uses `btnSecondary`, `textareaClass`, `Loader2`, `useState`, and `useCallback` which are all already imported/defined at the top of ContentTabs.tsx. Do NOT add duplicate imports. Do NOT add duplicate style constants.

The server actions `triggerQualityGates` and `overrideQualityGates` are already statically imported (from Fix 7a above). Reference them DIRECTLY — do NOT use dynamic `await import(...)` for them.

```typescript
// ── Quality Gates Tab ────────────────────────────────────────────────────────

interface QualityGatesTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

const gatesResultStyles: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'All quality gates passed' },
  fail: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Quality gates failed' },
  not_checked: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Quality gates not yet run' },
}

const violationSeverityBadge: Record<string, { bg: string; text: string }> = {
  error: { bg: 'bg-red-100', text: 'text-red-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

export function QualityGatesTab({ project, projectId, onDataChanged }: QualityGatesTabProps) {
  const [running, setRunning] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideNote, setOverrideNote] = useState('')
  const [overriding, setOverriding] = useState(false)

  const result = project.qualityGatesResult || 'not_checked'
  const violations = project.qualityGatesViolations || []
  const banner = gatesResultStyles[result] || gatesResultStyles.not_checked
  const errorViolations = violations.filter((v: QualityViolationDisplay) => v.severity === 'error')
  const warningViolations = violations.filter((v: QualityViolationDisplay) => v.severity === 'warning')

  const handleRunGates = useCallback(async () => {
    setRunning(true)
    const res = await triggerQualityGates(projectId)
    setRunning(false)
    if ('error' in res) {
      alert(res.error)
    } else if (onDataChanged) {
      onDataChanged()
    }
  }, [projectId, onDataChanged])

  const handleOverride = useCallback(async () => {
    if (!overrideNote.trim()) return
    setOverriding(true)
    const res = await overrideQualityGates(projectId, overrideNote)
    setOverriding(false)
    if ('error' in res) {
      alert(res.error)
    } else {
      setShowOverride(false)
      setOverrideNote('')
      if (onDataChanged) onDataChanged()
    }
  }, [projectId, overrideNote, onDataChanged])

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header + Run button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Quality Gates</h3>
        <button onClick={handleRunGates} disabled={running} className={btnSecondary}>
          {running ? (
            <>
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Checking...
            </>
          ) : (
            'Run Quality Gates'
          )}
        </button>
      </div>

      {/* Result banner */}
      <div className={`rounded border p-3 ${banner.bg}`}>
        <span className={`text-sm font-medium ${banner.text}`}>{banner.label}</span>
        {violations.length > 0 && (
          <span className={`ml-2 text-xs ${banner.text}`}>
            ({errorViolations.length} error{errorViolations.length !== 1 ? 's' : ''}, {warningViolations.length} warning{warningViolations.length !== 1 ? 's' : ''})
          </span>
        )}
        {project.qualityGatesCheckedAt && (
          <p className={`mt-1 text-[10px] ${banner.text}`}>
            Last checked: {new Date(project.qualityGatesCheckedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Override banner (if overridden) */}
      {project.qualityGatesOverridden && (
        <div className="rounded border border-purple-200 bg-purple-50 p-3">
          <p className="text-sm font-medium text-purple-700">Gates overridden for publishing</p>
          {project.qualityGatesOverrideNote && (
            <p className="mt-1 text-xs text-purple-600">Reason: {project.qualityGatesOverrideNote}</p>
          )}
        </div>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Errors first, then warnings */}
          {[...errorViolations, ...warningViolations].map((violation: QualityViolationDisplay, i: number) => {
            const badge = violationSeverityBadge[violation.severity] || violationSeverityBadge.warning
            return (
              <div key={i} className="rounded border border-kiuli-gray/60 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${badge.bg} ${badge.text}`}>
                    {violation.severity}
                  </span>
                  <span className="rounded-full bg-kiuli-gray/20 px-2 py-0.5 text-[10px] font-medium text-kiuli-charcoal/60">
                    {violation.gate.replace(/_/g, ' ')}
                  </span>
                  {violation.field && (
                    <span className="text-[10px] text-kiuli-charcoal/40">
                      Field: {violation.field}
                    </span>
                  )}
                </div>
                <p className="text-sm text-kiuli-charcoal">{violation.message}</p>
                {violation.details && 'context' in violation.details && (
                  <p className="mt-1 rounded bg-kiuli-gray/10 p-2 font-mono text-[11px] text-kiuli-charcoal/70">
                    ...{String(violation.details.context)}...
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Override mechanism (only when failed and not already overridden) */}
      {result === 'fail' && !project.qualityGatesOverridden && errorViolations.length > 0 && (
        <div className="border-t border-kiuli-gray/30 pt-4">
          {showOverride ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-kiuli-charcoal">
                Override {errorViolations.length} error-level violation{errorViolations.length !== 1 ? 's' : ''}?
                This allows publishing despite gate failures.
              </p>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="Why are you overriding these violations? (required)"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOverride}
                  disabled={!overrideNote.trim() || overriding}
                  className="rounded bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-600 transition-colors hover:bg-purple-100 disabled:opacity-40"
                >
                  {overriding ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Confirm Override'}
                </button>
                <button
                  onClick={() => { setShowOverride(false); setOverrideNote('') }}
                  className="text-[11px] text-kiuli-charcoal/50 hover:text-kiuli-charcoal"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowOverride(true)}
              className="rounded bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-600 transition-colors hover:bg-purple-100"
            >
              Override Gate Failures
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {result === 'not_checked' && violations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-sm text-kiuli-charcoal/40">
          <p>No quality gates check has been run yet.</p>
          <p className="mt-1 text-xs">Quality gates auto-run when advancing to review, or click &quot;Run Quality Gates&quot; manually.</p>
        </div>
      )}
    </div>
  )
}
```

### 7c: Wire the tab into ProjectWorkspace

**File:** `src/components/content-system/workspace/ProjectWorkspace.tsx`

Add `QualityGatesTab` to the existing import from `./ContentTabs`. The current import is:

```typescript
import {
  BriefTab,
  ResearchTab,
  DraftTab,
  FAQTab,
  ConsistencyTab,
  ImagesTab,
  DistributionTab,
  MetadataTab,
} from './ContentTabs'
```

Change it to:

```typescript
import {
  BriefTab,
  ResearchTab,
  DraftTab,
  FAQTab,
  ConsistencyTab,
  QualityGatesTab,
  ImagesTab,
  DistributionTab,
  MetadataTab,
} from './ContentTabs'
```

Then add a case to `renderTabContent()`, between the `Consistency` case and the `Images` case:

```typescript
      case 'Quality Gates':
        return (
          <QualityGatesTab
            project={currentProject}
            projectId={projectId}
            onDataChanged={refreshProject}
          />
        )
```

### 7d: Add 'Quality Gates' tab to tab lists

**File:** `src/components/content-system/workspace-types.ts`

Update `getTabsForContentType` to include `'Quality Gates'` immediately after `'Consistency'` in every array that contains `'Consistency'`.

Current article tabs → change to:
```typescript
return ['Brief', 'Research', 'Draft', 'FAQ', 'Consistency', 'Quality Gates', 'Images', 'Distribution', 'Metadata']
```

Current compound tabs → change to:
```typescript
return ['Draft', 'FAQ', 'Consistency', 'Quality Gates', 'Images', 'Metadata']
```

Current itinerary_enhancement tabs → change to:
```typescript
return ['Draft', 'Consistency', 'Quality Gates', 'Metadata']
```

Current page_update tabs → change to:
```typescript
return ['Current vs Proposed', 'Consistency', 'Quality Gates', 'Metadata']
```

### Fix 7 Verification

- Search for `QualityGatesTab` — must appear in ContentTabs.tsx (export) and ProjectWorkspace.tsx (import + case) only.
- Search for `'Quality Gates'` — must appear in workspace-types.ts (4 tab arrays) and ProjectWorkspace.tsx (case statement).
- Confirm `triggerQualityGates` and `overrideQualityGates` appear in the STATIC import block at the top of ContentTabs.tsx. They must NOT appear inside any `await import(...)` call in that file.
- Confirm `QualityViolationDisplay` is imported in both ContentTabs.tsx and transform-project.ts.

---

## Fix 8: Run migration

After all schema changes are in place, generate the Payload import map and verify the build compiles with the new fields.

```bash
npx payload generate:importmap
```

Then run the build to trigger Payload's automatic migration.

**Verification:** Build must pass (EXIT: 0). If it fails due to migration issues, record the exact error.

---

## Verification Gates

### Gate 1: Investigation complete
All 7 checks documented in `content-engine/evidence/phase15/investigation.txt`.

### Gate 2: Schema fields exist
Read `src/collections/ContentProjects/index.ts` and confirm the Quality Gates tab exists with all 5 fields: `qualityGatesResult`, `qualityGatesViolations`, `qualityGatesCheckedAt`, `qualityGatesOverridden`, `qualityGatesOverrideNote`.

### Gate 3: hard-gates.ts is a real implementation
Read `content-system/quality/hard-gates.ts`. Confirm it's NOT a `declare function` stub. Confirm it exports `checkHardGates` as an async function with all 5 gates implemented.

### Gate 4: API route exists
Read `src/app/(payload)/api/content/quality-gates/route.ts`. Confirm POST handler, auth, body extraction, checkHardGates call, result persistence.

### Gate 5: Server actions exist
Search for `triggerQualityGates` and `overrideQualityGates` in actions.ts. Confirm both are exported async functions.

### Gate 6: ALL publish paths guarded — zero bypass routes
Search for `qualityGatesResult` across the entire codebase. Confirm it appears in ALL 8 of these locations:

| # | File | Function/Block | Purpose |
|---|------|----------------|---------|
| 1 | `actions.ts` | `advanceProjectStage` → `nextStage === 'published'` | Publish blocking |
| 2 | `actions.ts` | `advanceProjectStage` → `nextStage === 'review'` | Review auto-trigger |
| 3 | `actions.ts` | `triggerPublish` | Publish blocking |
| 4 | `actions.ts` | `triggerQualityGates` | Gate execution |
| 5 | `actions.ts` | `overrideQualityGates` | Override check |
| 6 | `publish/route.ts` | POST handler | Publish blocking |
| 7 | `batch/route.ts` | `nextStage === 'published'` block | Publish blocking |
| 8 | `batch/route.ts` | `nextStage === 'review'` block | Review auto-trigger |

Report the count of `qualityGatesResult` matches per file. If ANY of the 3 files has zero matches, the phase is INCOMPLETE.

### Gate 7: Workspace UI complete
Verify ALL of these:
- `QualityGatesTab` exported from ContentTabs.tsx
- `QualityGatesTab` imported and rendered in ProjectWorkspace.tsx
- `'Quality Gates'` appears in all 4 tab arrays in workspace-types.ts
- `QualityViolationDisplay` interface exists in workspace-types.ts
- Quality gate fields exist on `WorkspaceProject` interface in workspace-types.ts
- `QualityViolationDisplay` is imported in transform-project.ts
- Quality gate fields are mapped in `transformProject` return object
- `triggerQualityGates` and `overrideQualityGates` are in the STATIC import block at the top of ContentTabs.tsx (NOT inside `await import(...)`)

### Gate 8: Build passes
Run `npm run build`. Must exit 0.

### Gate 9: ★ STOP GATE
Present ALL evidence from gates 1–8. Wait for confirmation before committing.

### Gate 10: Commit and push
```bash
git add -A
git commit -m "feat: Phase 15 — quality gates with banned phrase detection, publish blocking on all 4 paths, workspace UI, and override mechanism"
git push
```

---

## STOP CONDITIONS

- If `loadCoreVoice()` throws or returns empty bannedPhrases → STOP. BrandVoice global not populated.
- If build fails → STOP and report the exact error.
- If migration errors → STOP and report.
- If any unexpected result during implementation → STOP and report.
