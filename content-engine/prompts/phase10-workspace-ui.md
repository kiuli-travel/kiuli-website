# Phase 10: Content Workspace UI

## Context

Phase 9 complete. The conversation handler works end-to-end via server actions (see `src/app/(payload)/admin/conversation-test/actions.ts`). The v0 design components are approved and available in `/home/claude/v0-workspace/components/workspace/`. The Content Dashboard from Phase 7 lives at `src/app/(payload)/admin/content-engine/page.tsx` with components in `src/components/content-system/`.

## What This Phase Does

Replace the temporary conversation-test page with a full Content Workspace. The designer clicks a project in the Dashboard → the Workspace opens. Split layout: content tabs on the left (60%), conversation on the right (40%). Content-type-specific tabs, stage advancement, compound section view for destination/property pages. The conversation panel uses the REAL server action from Phase 9, not mock data.

## Architecture

The workspace lives inside the existing content-engine admin section. Navigation:
- Dashboard list view (existing, Phase 7) — at `/admin/content-engine`
- Workspace view (new, this phase) — at `/admin/content-engine/project/[id]`

NOT a separate admin page. It's a drill-down from the dashboard.

## Source Files

The v0 components are at `/home/claude/v0-workspace/components/workspace/`:
- `project-workspace.tsx` — main split layout with draggable divider
- `workspace-header.tsx` — back arrow, title, badges, advance button, dropdown
- `content-tabs.tsx` — all 7 tab components (Brief, Research, Draft, FAQ, Images, Distribution, Metadata)
- `conversation-panel.tsx` — message thread with action badges (v0 mock version — DO NOT USE for API calls)
- Plus types/data in `/home/claude/v0-workspace/lib/workspace-data.ts`

The working conversation code is at:
- `src/app/(payload)/admin/conversation-test/actions.ts` — server actions (sendConversationMessage, fetchProjectData)
- `src/components/content-system/ConversationPanel.tsx` — Phase 9 panel with real API integration

## Task 1: Create Workspace Page Route

Create `src/app/(payload)/admin/content-engine/project/[id]/page.tsx`

This is a server component that:
1. Reads the `id` param
2. Fetches the full ContentProject from Payload (server-side, no auth issues)
3. Transforms the raw Payload data into the WorkspaceProject shape
4. Renders the WorkspaceLayout client component

The data fetch must include ALL fields the workspace needs:
- Basic: id, title, contentType, stage, processingStatus, processingError
- Brief: briefSummary, targetAngle, targetAudience, competitiveNotes
- Research: synthesis (Lexical → plain text), sources, uncertaintyMap, editorialNotes (Lexical → plain text), existingSiteContent
- Draft: body (Lexical → plain text), sections (JSON), metaTitle, metaDescription, answerCapsule
- FAQ: faqSection array
- Metadata: destinations, properties, species, freshnessCategory, publishedAt, lastReviewedAt, originPathway, originSource
- Distribution: linkedinSummary, facebookSummary, facebookPinnedComment, linkedinPosted, facebookPosted
- Conversation: messages array
- Page update: targetCollection, targetField, targetRecordId, targetCurrentContent

Use `extractTextFromLexical` from `content-system/embeddings/lexical-text.ts` for Lexical → text conversion.

Parse JSON arrays (destinations, properties, species) using the same pattern as context-builder.ts.

## Task 2: Move Server Actions

Move and expand the server actions from `conversation-test/actions.ts` to `content-engine/project/[id]/actions.ts`:

1. `sendConversationMessage(projectId, message)` — keep exactly as-is from Phase 9
2. `fetchProjectData(projectId)` — expand to return ALL workspace fields (same shape as Task 1 data)
3. `advanceProjectStage(projectId)` — new. Reads current stage + contentType, computes next stage using the same maps as batch/route.ts, updates via Payload. Returns new stage or error.
4. `rejectProject(projectId, reason, createDirective)` — new. Sets stage to 'rejected', filterReason. Optionally creates editorial directive (same logic as batch/route.ts).
5. `saveProjectFields(projectId, fields)` — new. Takes a partial record of updatable fields (briefSummary, targetAngle, targetAudience, competitiveNotes, metaTitle, metaDescription, etc.) and updates via Payload.
6. `triggerResearch(projectId)` — new. Calls the research compiler for the project (same as research API route but via server action). Sets processingStatus.
7. `triggerDraft(projectId)` — stub that returns `{ error: 'Draft generation not yet implemented (Phase 11)' }`. Processing status indication only.
8. `saveFaqItems(projectId, items)` — new. Takes FAQ items array and writes to faqSection field.

All server actions: authenticate via `payload.auth({ headers: await headers() })`, return typed responses.

## Task 3: Workspace Types

Create `src/components/content-system/workspace-types.ts`

Adapt the types from v0's `workspace-data.ts` but align field names with real Payload fields. Key differences from v0:
- `id` is `number` not `string`
- Stage values are lowercase singular: 'idea', 'brief', 'research', 'draft', 'review', 'published', 'rejected', 'filtered' (NOT 'ideas', 'briefs', 'drafts')
- FAQ items come from `faqSection` field, structure: `{ question: string, answer: string }`
- Sources come from `sources` array
- UncertaintyMap comes from `uncertaintyMap` array

Include all the helper functions: `getTabsForContentType`, `isArticleType`, `isCompoundType`, `getAdvanceButtonLabel`, `sectionLabels`, badge styles, stage labels.

Fix the stage label mapping to use singular DB values: idea → 'Idea', brief → 'Brief', research → 'Research', draft → 'Draft', review → 'Review', published → 'Published'.

Fix `getAdvanceButtonLabel` to produce singular labels: "Advance to Brief", "Advance to Research", "Advance to Draft", "Advance to Review", "Publish".

## Task 4: Adapt Workspace Components

Copy the v0 components to `src/components/content-system/workspace/` and adapt them:

### 4a. ProjectWorkspace.tsx
Based on v0's `project-workspace.tsx`. Changes:
- Props: `project: WorkspaceProject` + `projectId: number`
- Import the REAL ConversationPanel (adapted in Task 4d), not the v0 mock
- `handleAdvance` calls the `advanceProjectStage` server action and updates local state
- `handleSendMessage` is handled by the ConversationPanel internally (server action)
- `onActionApplied` callback triggers `fetchProjectData` to refresh all fields
- Back navigation: `router.push('/admin/content-engine')`
- Remove the mock data toggle (Article View / Destination View buttons)

### 4b. WorkspaceHeader.tsx
Based on v0's `workspace-header.tsx`. Changes:
- Import types from workspace-types.ts
- `onAdvance` is async, shows loading state on the advance button while processing
- "Reject" dropdown item calls `rejectProject` server action (prompt for reason)
- "View in Payload Admin" links to `/admin/collections/content-projects/${project.id}`
- "View Versions" links to `/admin/collections/content-projects/${project.id}/versions`
- No shadcn/ui imports — use plain HTML/Tailwind for dropdown and tooltip (Payload admin doesn't have shadcn installed). Implement a simple dropdown with useState toggle + click-outside close. Implement tooltip with CSS :hover + absolute positioned div.

### 4c. ContentTabs.tsx
Based on v0's `content-tabs.tsx`. Changes:
- Import types from workspace-types.ts
- BriefTab: "Save Brief" button calls `saveProjectFields` server action
- ResearchTab: "Run Research" button calls `triggerResearch` server action
- DraftTab: "Generate Draft" button calls `triggerDraft` server action (stub for Phase 11)
- FAQTab: save changes via `saveFaqItems` server action
- All Lexical rich text fields: render as plain text (they've already been converted server-side in Task 1)
- No shadcn/ui imports — use plain HTML/Tailwind for all UI elements
- Remove lucide-react icons that aren't available in the Payload admin context — check what's importable. If lucide-react is available in the project deps, use it. If not, use simple text/emoji alternatives.

### 4d. ConversationPanel.tsx (merge)
This is the critical merge. Take the v0 visual design (Tailwind classes, message bubbles with proper border-radius, action badges, suggested next step, typing indicator, auto-scroll) but keep the Phase 9 API integration (server action call, optimistic message addition, error handling, loading state).

Specifically:
- Replace all inline `style={{}}` from Phase 9 panel with Tailwind classes from v0 panel
- Keep the `sendConversationMessage` server action import and call
- Keep optimistic designer message addition
- Keep error display
- Keep loading/typing indicator
- Add suggested next step display from v0
- Add the "Conversation" header from v0
- The `inputValue` and `onInputChange` props from v0 are needed for the Focus button feature (parent sets input text). Add these as optional props — if provided, use them; if not, use internal state.
- Props: `projectId: number`, `initialMessages`, `onActionApplied`, `inputValue?`, `onInputChange?`

## Task 5: Dashboard → Workspace Navigation

Update the existing dashboard at `src/app/(payload)/admin/content-engine/page.tsx`:

Currently, project cards in the dashboard are just display. Make each project card clickable — clicking navigates to `/admin/content-engine/project/${project.id}`.

Use Next.js `Link` component or `router.push`.

## Task 6: Remove Conversation Test Page

Delete:
- `src/app/(payload)/admin/conversation-test/` (entire directory)
- `src/components/content-system/ConversationTestLink.tsx`

Remove the ConversationTestLink from the Payload admin nav config (wherever it was added in Phase 9).

Keep the server action code — it's been moved to the workspace in Task 2.

## Task 7: Tailwind in Payload Admin Context

The dashboard from Phase 7 uses `custom.scss` for Payload admin styling. The v0 components use Tailwind utility classes. Verify that Tailwind classes work in Payload admin context. The Phase 7 dashboard already uses some Tailwind-like patterns in custom.scss — check if actual Tailwind utilities are available or if we need to use the custom.scss approach.

If Tailwind utilities DON'T work in Payload admin (the classes aren't processed), then the workspace components need to use inline styles or extend custom.scss. Check the Phase 7 dashboard implementation to see what styling approach actually works.

If Tailwind DOES work, proceed with the v0 Tailwind classes.

This is a blocking decision — verify FIRST before styling all components.

## Testing

### Test 1: Dashboard Navigation
Click a project card in the dashboard → workspace opens for that project. Back arrow → returns to dashboard.

### Test 2: Article Workspace
Open project 27 (article at research stage). Verify:
- Brief tab shows briefSummary, targetAngle, competitiveNotes
- Research tab shows synthesis, sources table, uncertainty map
- Draft tab shows "Generate Draft" button (no body yet)
- FAQ tab shows any existing FAQ items
- Metadata tab shows destinations, species
- Stage badge shows "Research"
- Advance button shows "Advance to Draft"
- Conversation panel loads with stored messages from Phase 9 tests

### Test 3: Conversation Works
Send a message in the workspace conversation panel. Verify Kiuli responds. Verify action badges appear if actions were applied.

### Test 4: Stage Advancement
Click "Advance to Draft" on project 27. Verify stage changes. Verify button label updates.

### Test 5: Brief Save
Edit the brief summary in the Brief tab. Click Save. Refresh page. Verify the change persisted.

### Test 6: Focus Button (compound type)
If a destination_page project exists at draft stage with sections, verify Focus buttons pre-fill the conversation input. If no such project exists, note as known gap for Phase 11.

## Gate Evidence

```sql
-- Project workspace loads with real data
SELECT id, title, stage, "contentType", "processingStatus"
FROM content_projects WHERE id = 27;

-- Messages persist after workspace conversation
SELECT jsonb_array_length(messages::jsonb) FROM content_projects WHERE id = 27;

-- Stage advancement works
SELECT stage FROM content_projects WHERE id = 27;
```

Screenshot of workspace with real project data loaded.

## Do NOT

- Do NOT use shadcn/ui components — they're not available in Payload admin context
- Do NOT use mock data — all data comes from Payload
- Do NOT break the existing dashboard — it stays at `/admin/content-engine`
- Do NOT skip the server action auth — every action must verify the user is logged in
- Do NOT leave the conversation-test page in place — it must be removed
- Do NOT use the v0 conversation panel for API calls — merge the visual design with the Phase 9 server action logic
- Do NOT assume Tailwind works in Payload admin — verify first (Task 7)

## Report

Create `content-engine/reports/phase10-workspace-ui.md` with:
1. Files created/modified
2. Tailwind verification result (works or doesn't work in Payload admin)
3. Test results for all 6 tests
4. Screenshots of workspace with real data
5. Any known gaps

Commit and push.
