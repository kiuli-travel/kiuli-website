# Phase 12 Completion: Everything That Was Missed

**Context:** Phase 12 partially completed (commit d5c35b5). Core consistency-checker.ts, API route, and publish blocking exist. But the phase is NOT complete. This prompt addresses everything that was left out or done wrong.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **Every finding must be raw data** — SQL output, curl responses, file contents.
3. **If a gate fails, STOP.** Do not attempt repairs.
4. **Append your report to** `content-engine/reports/phase12-consistency-checking.md` under a new heading `## Phase 12 Completion`.
5. **Do not skip any step.**

---

## Task 1: Fix Batch Route Silent Skip

**Problem:** In `src/app/(payload)/api/content/dashboard/batch/route.ts`, the advance action silently `continue`s when a project is blocked by hard contradictions. The response says `{ success: true, updated: 3 }` but doesn't tell the designer that 2 projects were skipped or why. This violates the "visible failure everywhere" principle.

**Fix:** Track skipped projects and return them in the response.

Before the `for` loop in the advance action, add:

```typescript
      const skipped: Array<{ id: number; reason: string }> = []
```

Replace the `continue` inside the hard contradiction check with:

```typescript
              skipped.push({
                id,
                reason: `${unresolvedHard.length} unresolved hard contradiction(s)`,
              })
              continue
```

Change the advance action's contribution to the response from just `updated` to include skipped. After the advance `for` loop closes, the response is already `{ success: true, updated }`. Change the final response (the one at the bottom of the try block) to:

```typescript
    return NextResponse.json({ success: true, updated, skipped })
```

This is a single return at the end of the try block — it already exists. Just add `skipped` to it. The `skipped` variable needs to be declared in the outer scope of the try block so it's available for all action types. Initialise it at the top of the try block:

```typescript
  try {
    const skipped: Array<{ id: number; reason: string }> = []
```

And pass it in the response at the bottom.

**Verification:** Read the full batch route file back and paste it into the report.

---

## Task 2: Staleness → page_update Project Generation

**Problem:** V6 Section 8.2 says staleness signals "generate `page_update` Content Projects." Currently, staleness issues are stored but nothing happens with them.

**Fix:** In `content-system/quality/consistency-checker.ts`, after Step 5 (after building the `issues` array and determining `overallResult`), add Step 5b:

```typescript
  // ── Step 5b: Generate page_update projects for staleness signals ──────

  const stalenessIssues = issues.filter(i => i.issueType === 'staleness')
  if (stalenessIssues.length > 0) {
    console.log(`[consistency-checker] Project ${projectId}: generating ${stalenessIssues.length} page_update project(s) for staleness`)

    for (const stale of stalenessIssues) {
      // Check if a page_update already exists for this specific staleness
      const existing = await payload.find({
        collection: 'content-projects',
        where: {
          contentType: { equals: 'page_update' },
          stage: { not_in: ['published', 'rejected', 'filtered'] },
          // Match by title pattern to avoid duplicates
          title: { contains: stale.sourceRecord.slice(0, 50) },
        },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'content-projects',
          data: {
            title: `Update: ${stale.sourceRecord}`.slice(0, 200),
            contentType: 'page_update',
            stage: 'proposed',
            processingStatus: 'idle',
            originPathway: 'consistency_staleness',
            originSource: `Staleness detected in project ${projectId}`,
            briefSummary: `Existing content may be outdated. New content states: "${stale.newContent}". Existing content: "${stale.existingContent}". Source: ${stale.sourceRecord}.`,
          },
        })
      }
    }
  }
```

**Verification:** Read the full consistency-checker.ts back and paste it into the report.

---

## Task 3: Clean Up types.ts

**Problem:** `ConsistencyCheckOptions` interface in `content-system/quality/types.ts` is dead code — the new `checkConsistency` function takes `projectId: number`, not `ConsistencyCheckOptions`.

**Fix:** Remove the `ConsistencyCheckOptions` interface from `content-system/quality/types.ts`.

**Verification:** Read types.ts back, confirm `ConsistencyCheckOptions` is gone.

---

## Task 4: Add Consistency Fields to WorkspaceProject

**Problem:** `src/components/content-system/workspace-types.ts` has no consistency fields. The workspace cannot display consistency results.

**Fix:** Add to the `WorkspaceProject` interface, after the FAQ section and before Distribution:

```typescript
  // Consistency
  consistencyCheckResult?: 'pass' | 'hard_contradiction' | 'soft_contradiction' | 'not_checked'
  consistencyIssues?: ConsistencyIssueDisplay[]
```

Add a new interface above `WorkspaceProject`:

```typescript
export interface ConsistencyIssueDisplay {
  id: string
  issueType: 'hard' | 'soft' | 'staleness'
  existingContent: string
  newContent: string
  sourceRecord: string
  resolution: 'pending' | 'updated_draft' | 'updated_existing' | 'overridden'
  resolutionNote?: string
}
```

Add 'Consistency' to `getTabsForContentType`:
- For article types: insert 'Consistency' after 'FAQ' → `['Brief', 'Research', 'Draft', 'FAQ', 'Consistency', 'Images', 'Distribution', 'Metadata']`
- For compound types: insert 'Consistency' after 'FAQ' → `['Draft', 'FAQ', 'Consistency', 'Images', 'Metadata']`
- For `itinerary_enhancement`: add it → `['Draft', 'Consistency', 'Metadata']`
- For `page_update`: add it → `['Current vs Proposed', 'Consistency', 'Metadata']`

**Verification:** Read back the full workspace-types.ts.

---

## Task 5: Extract Consistency Data in transformProject

**Problem:** Both `transformProject` functions (in `actions.ts` and `page.tsx`) don't extract consistency fields from the raw project.

**Fix:** In BOTH files, add consistency extraction. After the messages parsing and before the return statement:

```typescript
  // Parse consistency issues
  const rawConsistencyIssues = Array.isArray(raw.consistencyIssues) ? raw.consistencyIssues : []
  const consistencyIssues: ConsistencyIssueDisplay[] = rawConsistencyIssues.map(
    (ci: Record<string, unknown>) => ({
      id: (ci.id as string) || '',
      issueType: (ci.issueType as ConsistencyIssueDisplay['issueType']) || 'soft',
      existingContent: (ci.existingContent as string) || '',
      newContent: (ci.newContent as string) || '',
      sourceRecord: (ci.sourceRecord as string) || '',
      resolution: (ci.resolution as ConsistencyIssueDisplay['resolution']) || 'pending',
      resolutionNote: (ci.resolutionNote as string) || undefined,
    }),
  )
```

Add to the return object:

```typescript
    consistencyCheckResult: (raw.consistencyCheckResult as WorkspaceProject['consistencyCheckResult']) || undefined,
    consistencyIssues: consistencyIssues.length > 0 ? consistencyIssues : undefined,
```

Add the import of `ConsistencyIssueDisplay` at the top of both files (from `workspace-types`).

In `page.tsx`, the import line already imports from `@/components/content-system/workspace-types` — add `ConsistencyIssueDisplay` to it.

In `actions.ts`, the import line already imports from `@/components/content-system/workspace-types` — add `ConsistencyIssueDisplay` to it.

**Verification:** Read both files back. Search for `consistencyCheckResult` in each to confirm the extraction exists.

---

## Task 6: Create ConsistencyTab Component

**Problem:** V4 plan Phase 12 requires "ConsistencyPanel.tsx: Shows results, resolution controls." V6 Section 8.3 defines the resolution workflow.

**Fix:** Add a `ConsistencyTab` to `src/components/content-system/workspace/ContentTabs.tsx`.

The component must:

1. **Show the overall result** as a banner: pass (green), soft_contradiction (amber), hard_contradiction (red), not_checked (gray).

2. **Show each issue** as a card with:
   - Issue type badge (hard = red, soft = amber, staleness = blue)
   - "New content" text (what the draft says)
   - "Existing content" text (what was found in embeddings)
   - Source record description
   - Resolution status badge
   - If resolution is 'pending': three action buttons per V6 Section 8.3:
     - "Update Draft" — sets resolution to 'updated_draft' (designer then manually edits the draft)
     - "Update Existing" — sets resolution to 'updated_existing' (this is a signal; the page_update project handles the actual update)
     - "Override" — requires a mandatory note before setting resolution to 'overridden'

3. **A "Run Consistency Check" button** that calls the `triggerConsistencyCheck` server action and refreshes the project data.

4. **If not_checked or no data:** show an empty state with the run button.

For the resolution actions, add a new server action in Task 7.

The component signature:

```typescript
interface ConsistencyTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}

export function ConsistencyTab({ project, projectId, onDataChanged }: ConsistencyTabProps)
```

Use the same styling patterns as existing tabs (labelClass, btnPrimary, btnSecondary, contentArea, Loader2 spinner).

Import `triggerConsistencyCheck` and `resolveConsistencyIssue` from the actions file.

**Verification:** Read the full ConsistencyTab function back.

---

## Task 7: Add Resolution Server Action

**Problem:** The ConsistencyTab needs to resolve individual issues. No server action exists for this.

**Fix:** Add to `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`:

```typescript
// ── Action 10: Resolve Consistency Issue ─────────────────────────────────────

export async function resolveConsistencyIssue(
  projectId: number,
  issueId: string,
  resolution: 'updated_draft' | 'updated_existing' | 'overridden',
  resolutionNote?: string,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (resolution === 'overridden' && (!resolutionNote || resolutionNote.trim().length === 0)) {
    return { error: 'Override requires a note explaining why.' }
  }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    const issues = Array.isArray(project.consistencyIssues)
      ? (project.consistencyIssues as Record<string, unknown>[])
      : []

    const updatedIssues = issues.map((issue) => {
      if (issue.id === issueId) {
        return {
          ...issue,
          resolution,
          resolutionNote: resolutionNote || null,
        }
      }
      return issue
    })

    // Recalculate overall result
    const unresolvedHard = updatedIssues.filter(
      (i) => i.issueType === 'hard' && i.resolution === 'pending'
    )
    const unresolvedSoft = updatedIssues.filter(
      (i) => i.issueType === 'soft' && i.resolution === 'pending'
    )

    let newOverallResult: string = 'pass'
    if (unresolvedHard.length > 0) {
      newOverallResult = 'hard_contradiction'
    } else if (unresolvedSoft.length > 0) {
      newOverallResult = 'soft_contradiction'
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyIssues: updatedIssues,
        consistencyCheckResult: newOverallResult,
      },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

**Verification:** Read the function back from actions.ts.

---

## Task 8: Wire ConsistencyTab into ProjectWorkspace

**Problem:** `ProjectWorkspace.tsx` doesn't import or render ConsistencyTab. The switch statement in `renderTabContent` has no 'Consistency' case.

**Fix:**

In `ProjectWorkspace.tsx`:

1. Add `ConsistencyTab` to the import from `./ContentTabs`
2. Add a case in `renderTabContent`:

```typescript
      case 'Consistency':
        return (
          <ConsistencyTab
            project={currentProject}
            projectId={projectId}
            onDataChanged={refreshProject}
          />
        )
```

**Verification:** Read back ProjectWorkspace.tsx, confirm the import and case exist.

---

## Task 9: Auto-trigger Consistency Check on Review Advancement

**Problem:** V4 plan says "Wire to review stage: auto-trigger on stage advancement to review." Currently the designer must manually trigger via the ConsistencyTab button or API.

**Fix:** In `advanceProjectStage` in `actions.ts`, after the `await payload.update(...)` that sets the new stage, add:

```typescript
    // Auto-trigger consistency check when entering review stage
    if (nextStage === 'review') {
      // Fire and forget — don't block the stage advance on the check
      // Set processing status so the UI shows the spinner
      try {
        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: { processingStatus: 'processing' },
        })

        const { checkConsistency } = await import(
          '../../../../../../../content-system/quality/consistency-checker'
        )
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[advanceProjectStage] Consistency check failed for project ${projectId}:`, message)
        try {
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { processingStatus: 'failed', processingError: `Consistency check failed: ${message}` },
          })
        } catch {}
      }
    }
```

Place this AFTER the existing `await payload.update(...)` call and BEFORE the `return { success: true, newStage: nextStage }`.

Also apply the same auto-trigger in the batch route's advance action. After the `await payload.update(...)` that advances the stage, add the same pattern but adapted:

```typescript
          // Auto-trigger consistency check when entering review
          if (nextStage === 'review') {
            try {
              await payload.update({
                collection: 'content-projects',
                id,
                data: { processingStatus: 'processing' },
              })
              const { checkConsistency } = await import(
                '../../../../../../content-system/quality/consistency-checker'
              )
              const result = await checkConsistency(id)
              await payload.update({
                collection: 'content-projects',
                id,
                data: {
                  consistencyCheckResult: result.overallResult,
                  consistencyIssues: result.issues.map((issue: any) => ({
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
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error)
              console.error(`[batch-advance] Consistency check failed for project ${id}:`, msg)
              try {
                await payload.update({
                  collection: 'content-projects',
                  id,
                  data: { processingStatus: 'failed', processingError: `Consistency check failed: ${msg}` },
                })
              } catch {}
            }
          }
```

Note: The import path differs between actions.ts (7 levels up) and batch/route.ts (6 levels up). Get this right.

**Verification:** Read back both files. Search for `nextStage === 'review'` in each to confirm the auto-trigger exists.

---

## Task 10: Build Verification

```bash
npm run build 2>&1 | tail -40
```

### Gate 1: Build Passes

```
PASS criteria: Exit code 0.
FAIL action: STOP.
```

---

## Task 11: Commit and Push

Stage ALL modified files:

```bash
git add content-system/quality/consistency-checker.ts
git add content-system/quality/types.ts
git add src/components/content-system/workspace-types.ts
git add src/components/content-system/workspace/ContentTabs.tsx
git add src/components/content-system/workspace/ProjectWorkspace.tsx
git add src/app/(payload)/admin/content-engine/project/[id]/actions.ts
git add src/app/(payload)/admin/content-engine/project/[id]/page.tsx
git add src/app/(payload)/api/content/dashboard/batch/route.ts
```

If payload-types.ts was regenerated, add it too. Do NOT add reports or prompts.

```bash
git commit -m "feat: Phase 12 completion — ConsistencyTab, resolution workflow, auto-trigger, staleness→page_update, batch skip reporting"
git push
```

### Gate 2: Committed and Pushed

```
PASS criteria: Push succeeded.
FAIL action: STOP.
```

---

## Task 12: Functional Verification

Wait 60+ seconds for Vercel deploy.

### 12a: Run consistency checks on remaining projects

```bash
export CONTENT_SYSTEM_SECRET=$(grep CONTENT_SYSTEM_SECRET .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
```

If .env.local doesn't have it, try .env. If neither has it, STOP.

```bash
for ID in 79 87 89; do
  echo "=== Project $ID ==="
  curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/consistency \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
    -d "{\"projectId\": $ID}"
  echo ""
done
```

Record all responses.

### 12b: Verify all 5 projects have consistency results

```sql
SELECT id, stage, consistency_check_result, processing_status
FROM content_projects
WHERE id IN (27, 53, 79, 87, 89)
ORDER BY id;
```

```sql
SELECT ci._parent_id AS project_id, ci.issue_type, ci.resolution,
       LEFT(ci.new_content, 60) AS new_claim
FROM content_projects_consistency_issues ci
WHERE ci._parent_id IN (27, 53, 79, 87, 89)
ORDER BY ci._parent_id, ci.issue_type;
```

### 12c: Verify staleness projects were created

```sql
SELECT id, title, content_type, stage, origin_pathway
FROM content_projects
WHERE origin_pathway = 'consistency_staleness'
ORDER BY id;
```

### 12d: Verify workspace loads with Consistency tab

Open https://admin.kiuli.com/admin/content-engine/project/27 in a browser. Take note of whether:
- The Consistency tab appears in the tab bar
- Clicking it shows the consistency result and issues

(If you cannot access a browser, verify by checking that the build passed and the component code is correct — but note this limitation in the report.)

### Gate 3: All Projects Checked, Staleness Projects Created

```
PASS criteria:
1. All 5 projects (27, 53, 79, 87, 89) have consistency_check_result != 'not_checked'
2. All 5 have processing_status = 'completed'
3. Staleness issues from project 53 generated page_update project(s)
4. No 500 errors

FAIL action: STOP.
```

---

## Task 13: Final State Summary

```sql
SELECT id, stage, content_type, consistency_check_result, processing_status
FROM content_projects
WHERE stage IN ('draft', 'review', 'published', 'proposed')
ORDER BY stage, id;
```

```sql
SELECT
  consistency_check_result,
  COUNT(*) as count
FROM content_projects
WHERE stage IN ('draft', 'review')
GROUP BY consistency_check_result;
```

```sql
SELECT ci._parent_id AS project_id, ci.issue_type, ci.resolution
FROM content_projects_consistency_issues ci
JOIN content_projects cp ON cp.id = ci._parent_id
ORDER BY ci._parent_id, ci.issue_type;
```

Record all outputs.

---

## Report Format

Append to `content-engine/reports/phase12-consistency-checking.md`:

```markdown
## Phase 12 Completion

**Date:** [timestamp]

### Task 1: Batch Route Fix
[Full file or relevant diff]

### Task 2: Staleness → page_update
[Full consistency-checker.ts]

### Task 3: types.ts Cleanup
[Confirmed ConsistencyCheckOptions removed]

### Task 4: WorkspaceProject Consistency Fields
[Relevant sections of workspace-types.ts]

### Task 5: transformProject Extraction
[Confirmation from both files]

### Task 6: ConsistencyTab
[Full component code]

### Task 7: Resolution Server Action
[Full function]

### Task 8: ProjectWorkspace Wiring
[Import + case statement]

### Task 9: Auto-trigger
[Code from both files]

### Task 10: Build
[Output, exit code]

#### Gate 1: [PASS/FAIL]

### Task 11: Commit
[Hash, files]

#### Gate 2: [PASS/FAIL]

### Task 12: Functional Verification
[All curl responses, SQL outputs, staleness project check]

#### Gate 3: [PASS/FAIL]

### Task 13: Final State
[Query outputs]

### Overall Phase 12 Completion: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not skip any verification query
- Do not create new files beyond what's specified (no new components, no new routes)
- Do not modify the consistency-checker.ts core logic (Steps 1-4) — only add Step 5b
- Do not modify collection schemas or run migrations
- Do not remove existing functionality

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.**
