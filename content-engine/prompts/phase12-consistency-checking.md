# Phase 12: Consistency Checking

**Context:** Phases 0-11 complete. Phase A/B cleanup done. 5 draft projects have content. This phase implements consistency checking per KIULI_CONTENT_SYSTEM_V6.md Section 8 and KIULI_CONTENT_SYSTEM_DEVELOPMENT_PLAN_V4.md Phase 12.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **Every finding must be raw data** — SQL output, curl responses, file diffs.
3. **If a gate fails, STOP.** Do not attempt repairs.
4. **Write your report as you go** to `content-engine/reports/phase12-consistency-checking.md`.
5. **Do not skip any step.**
6. **Do not modify any files not listed in this prompt.**

---

## Task 1: Fix BUG-1 Third Instance

File: `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`

The `advanceProjectStage` function (around line 320-345) has the same bug fixed in Phase B for the batch route and conversation handler. It sets `stage: nextStage` without resetting `processingStatus`.

Find this code in `advanceProjectStage`:

```typescript
    const updateData: Record<string, unknown> = { stage: nextStage }
    if (nextStage === 'published') {
      updateData.publishedAt = new Date().toISOString()
    }
```

Change it to:

```typescript
    const updateData: Record<string, unknown> = {
      stage: nextStage,
      processingStatus: 'idle',
      processingError: null,
      processingStartedAt: null,
    }
    if (nextStage === 'published') {
      updateData.publishedAt = new Date().toISOString()
    }
```

Read the function back and paste it into the report.

---

## Task 2: Implement consistency-checker.ts

Replace the stub at `content-system/quality/consistency-checker.ts` with a real implementation.

The checker does 4 things in sequence:

### Step 1: Extract text from draft

Extract the draft's plain text content. For articles (contentType in `itinerary_cluster`, `authority`, `designer_insight`), extract from the `body` field (Lexical richText). For compound types (`destination_page`, `property_page`), extract from the `sections` JSON field. Use `extractTextFromLexical` from `content-system/embeddings/lexical-text.ts` for Lexical fields. For sections JSON, concatenate all section values.

If the extracted text is empty or under 100 characters, return early with `{ overallResult: 'pass', issues: [] }` — there's nothing to check.

### Step 2: Extract factual claims via LLM

Call `callModel('editing', ...)` from `content-system/openrouter-client.ts` with:

**System prompt:**
```
You are a fact-checker for a luxury African safari travel company. Extract all factual claims from the following content. A factual claim is any statement that could be verified or contradicted — dates, distances, prices, names, counts, seasonal statements, access routes, lodge/property names, activity descriptions, wildlife behaviour, geographical facts.

Return a JSON array and NOTHING else (no markdown fences, no preamble):
[
  { "claim": "The exact factual claim", "category": "seasonal|geographical|wildlife|access|pricing|activity|property|other" }
]

If there are no factual claims, return an empty array: []
```

**User prompt:** The extracted draft text.

**Options:** `{ maxTokens: 2048, temperature: 0.2 }`

Parse the response as JSON. If parsing fails, log the error and return `{ overallResult: 'pass', issues: [] }` — a parse failure is not a content problem.

If zero claims extracted, return `{ overallResult: 'pass', issues: [] }`.

### Step 3: Search embeddings for related content

For each claim (up to 20 — if more than 20, take the first 20), call `semanticSearch` from `content-system/embeddings/query.ts` with:

```typescript
const results = await semanticSearch(claim.claim, {
  topK: 3,
  minScore: 0.5,
  excludeProjectId: projectId,
})
```

Collect all results into a flat array of `{ claim, relatedChunk }` pairs. Deduplicate by embedding ID.

If zero related chunks found across all claims, return `{ overallResult: 'pass', issues: [] }` — nothing to contradict against.

### Step 4: Detect contradictions via LLM

Build a comparison prompt. Call `callModel('editing', ...)` with:

**System prompt:**
```
You are a fact-checker for a luxury African safari travel company. Compare the NEW CLAIMS against EXISTING CONTENT and identify contradictions.

For each contradiction found, classify it:
- "hard": Directly conflicting facts (e.g., "best visited June-October" vs "November is the best month")
- "soft": Potentially conflicting tone or emphasis (e.g., "family-friendly" vs "adults-only atmosphere")  
- "staleness": New content has more current information than existing (e.g., new content mentions a renovation that existing content doesn't reflect)

Return a JSON array and NOTHING else (no markdown fences, no preamble):
[
  {
    "issueType": "hard" | "soft" | "staleness",
    "newContent": "The specific claim from the new content",
    "existingContent": "The specific text from existing content that contradicts it",
    "sourceRecord": "A brief description of where the existing content comes from"
  }
]

If there are no contradictions, return an empty array: []
Be conservative — only flag genuine contradictions, not mere differences in detail or emphasis.
```

**User prompt:**
```
NEW CLAIMS:
[list each claim]

EXISTING CONTENT:
[list each related chunk with its chunk_type and text]
```

**Options:** `{ maxTokens: 2048, temperature: 0.2 }`

Parse the response as JSON. If parsing fails, log the error and return `{ overallResult: 'pass', issues: [] }`.

### Step 5: Determine overall result and return

Map the LLM output to `ConsistencyIssue[]` from `content-system/quality/types.ts`. Set `resolution: 'pending'` for all issues.

Determine `overallResult`:
- If any issue has `issueType: 'hard'` → `'hard_contradiction'`
- Else if any issue has `issueType: 'soft'` → `'soft_contradiction'`
- Else → `'pass'`

Return `{ overallResult, issues }`.

### Function signature

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import type { ConsistencyResult, ConsistencyIssue } from './types'

export async function checkConsistency(projectId: number): Promise<ConsistencyResult> {
  // ... implementation per steps above
}
```

Note the function signature change: the old stub took `ConsistencyCheckOptions`. The new implementation takes `projectId: number` and fetches the project internally. Update the types file to match — remove the `ConsistencyCheckOptions` interface if it's only used by this function, or leave it and just don't use it. The function reads the project from Payload to get contentType, body, sections, etc.

### Logging

Add `console.log` at each step boundary:
```
[consistency-checker] Project {id}: extracting text ({length} chars)
[consistency-checker] Project {id}: extracted {n} claims
[consistency-checker] Project {id}: found {n} related chunks
[consistency-checker] Project {id}: detected {n} issues (result: {overallResult})
```

---

## Task 3: Create API Route

Create `src/app/(payload)/api/content/consistency/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkConsistency } from '../../../../../../content-system/quality/consistency-checker'

export const maxDuration = 120

async function validateAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY ||
      token === process.env.SCRAPER_API_KEY
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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid projectId (must be a number)' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // Set processing status
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const result = await checkConsistency(projectId)

    // Write results to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyCheckResult: result.overallResult,
        consistencyIssues: result.issues.map(issue => ({
          issueType: issue.issueType,
          existingContent: issue.existingContent,
          newContent: issue.newContent,
          sourceRecord: issue.sourceRecord,
          resolution: issue.resolution,
          resolutionNote: issue.resolutionNote || null,
        })),
        processingStatus: 'completed',
        processingError: null,
      },
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[consistency-route] Failed:', message)

    // Try to set failed status
    try {
      const { projectId } = await request.clone().json()
      if (projectId) {
        const payload = await getPayload({ config })
        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: { processingStatus: 'failed', processingError: message },
        })
      }
    } catch {}

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
```

---

## Task 4: Add Server Action for Workspace

In `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`, add a new exported function:

```typescript
// ── Action 9: Trigger Consistency Check ──────────────────────────────────────

export async function triggerConsistencyCheck(
  projectId: number,
): Promise<{ success: true; result: { overallResult: string; issueCount: number } } | { error: string }> {
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
    const { checkConsistency } = await import(
      '../../../../../../../content-system/quality/consistency-checker'
    )

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const result = await checkConsistency(projectId)

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyCheckResult: result.overallResult,
        consistencyIssues: result.issues.map((issue: Record<string, unknown>) => ({
          issueType: issue.issueType,
          existingContent: issue.existingContent,
          newContent: issue.newContent,
          sourceRecord: issue.sourceRecord,
          resolution: issue.resolution,
          resolutionNote: issue.resolutionNote || null,
        })),
        processingStatus: 'completed',
        processingError: null,
      },
    })

    return {
      success: true,
      result: { overallResult: result.overallResult, issueCount: result.issues.length },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}
    return { error: message }
  }
}
```

Add the import for `ConsistencyResult` type at the top if needed by TypeScript.

---

## Task 5: Wire Publish Blocking

In `advanceProjectStage` in actions.ts, add a check before allowing advancement from review to published. After computing `nextStage` and before building `updateData`, add:

```typescript
    // Block publish if unresolved hard contradictions
    if (nextStage === 'published') {
      const consistencyResult = project.consistencyCheckResult as string
      if (consistencyResult === 'hard_contradiction') {
        // Check if any issues are still pending
        const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues : []
        const unresolvedHard = issues.filter(
          (i: Record<string, unknown>) => i.issueType === 'hard' && i.resolution === 'pending'
        )
        if (unresolvedHard.length > 0) {
          return {
            error: `Cannot publish: ${unresolvedHard.length} unresolved hard contradiction(s). Resolve them in the workspace first.`,
          }
        }
      }
    }
```

Apply the same publish-blocking logic in the batch route's advance action (`src/app/(payload)/api/content/dashboard/batch/route.ts`). In that file, after fetching the project and computing `nextStage`, add:

```typescript
        if (nextStage === 'published') {
          const consistencyResult = (project as Record<string, unknown>).consistencyCheckResult as string
          if (consistencyResult === 'hard_contradiction') {
            const issues = Array.isArray((project as Record<string, unknown>).consistencyIssues)
              ? (project as Record<string, unknown>).consistencyIssues as Record<string, unknown>[]
              : []
            const unresolvedHard = issues.filter(
              (i) => i.issueType === 'hard' && i.resolution === 'pending'
            )
            if (unresolvedHard.length > 0) {
              // Skip this project — do not advance
              continue
            }
          }
        }
```

Place this check BEFORE the `updateData` assignment, AFTER the `if (nextStage)` check.

---

## Task 6: Build Verification

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -40
```

### Gate 1: Build Passes

```
PASS criteria: Exit code 0, no errors.
FAIL action: STOP.
```

---

## Task 7: Commit and Push

Stage these files only:

```bash
git add content-system/quality/consistency-checker.ts
git add content-system/quality/types.ts
git add src/app/(payload)/api/content/consistency/route.ts
git add src/app/(payload)/api/content/dashboard/batch/route.ts
git add src/app/(payload)/admin/content-engine/project/[id]/actions.ts
```

If any other files were modified (e.g. auto-generated types), add those too. Do NOT add test files, reports, or prompts.

```bash
git commit -m "feat: Phase 12 — consistency checking with claim extraction, contradiction detection, publish blocking"
git push
```

### Gate 2: Committed and Pushed

```
PASS criteria: Push succeeded.
FAIL action: STOP.
```

---

## Task 8: Deploy Verification and Functional Test

Wait 60+ seconds for Vercel deploy, then verify the new route exists:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/consistency -H "Content-Type: application/json" -d '{"projectId":999999}'
```

Expected: 401 (auth required) — NOT 404.

### Run consistency check on a real project

Pick one of the 5 draft projects that has content (27, 53, 79, 87, or 89). Use the Bearer token:

```bash
export CONTENT_SYSTEM_SECRET=$(grep CONTENT_SYSTEM_SECRET .env | cut -d= -f2-)
```

If that doesn't work, try `.env.local`. If neither has it, STOP.

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/consistency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 27}'
```

Record the full response and status code.

Then verify the database was updated:

```sql
SELECT id, consistency_check_result, processing_status FROM content_projects WHERE id = 27;
```

```sql
SELECT issue_type, resolution, LEFT(existing_content, 80) AS existing, LEFT(new_content, 80) AS new FROM content_projects_consistency_issues WHERE _parent_id = 27;
```

### Run on a second project

Pick a different project and repeat the curl + SQL verification. Record both.

### Gate 3: Consistency Check Operational

```
PASS criteria:
1. Route returns non-404 without auth
2. Both projects have consistency_check_result set (any value — pass, hard_contradiction, or soft_contradiction)
3. processing_status is 'completed' for both
4. No 500 errors in the curl responses

FAIL action: STOP. Record the error response.
```

---

## Task 9: Final State Summary

```sql
SELECT id, stage, consistency_check_result, processing_status FROM content_projects WHERE stage IN ('draft', 'review', 'published') ORDER BY id;
```

```sql
SELECT ci._parent_id AS project_id, ci.issue_type, ci.resolution FROM content_projects_consistency_issues ci JOIN content_projects cp ON cp.id = ci._parent_id WHERE cp.stage IN ('draft', 'review', 'published') ORDER BY ci._parent_id, ci.issue_type;
```

Record both outputs.

---

## Report Format

Write to `content-engine/reports/phase12-consistency-checking.md`:

```markdown
# Phase 12: Consistency Checking — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Task 1: BUG-1 Third Instance Fix
[advanceProjectStage function after edit]

## Task 2: consistency-checker.ts
[file contents or summary of implementation]

## Task 3: API Route
[file created]

## Task 4: Server Action
[function added]

## Task 5: Publish Blocking
[code added to actions.ts and batch/route.ts]

## Task 6: Build
[output, exit code]

### Gate 1: [PASS/FAIL]

---

## Task 7: Commit
[hash, git status]

### Gate 2: [PASS/FAIL]

---

## Task 8: Functional Test

### Route reachability
[curl response]

### Project [ID] consistency check
[curl response]
[DB verification]

### Project [ID] consistency check
[curl response]
[DB verification]

### Gate 3: [PASS/FAIL]

---

## Task 9: Final State
[query outputs]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not create ConsistencyPanel.tsx in this phase (UI is separate work, not on the critical path to publishing)
- Do not implement auto-trigger on review advancement (the manual trigger via API and server action is sufficient — auto-trigger can be wired later)
- Do not modify the conversation handler
- Do not run database migrations
- Do not modify collection schemas
- Do not skip any verification query

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.**
