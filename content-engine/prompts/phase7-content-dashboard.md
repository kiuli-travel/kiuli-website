# Phase 7: Content Dashboard — CLI Integration

## Context

The Content Dashboard v0 component is in `/mnt/user-data/uploads/content-engine-dashboard.zip`. It's a React component with mock data. Your job is to integrate it into Payload's admin as a custom view, wired to real data from the ContentProjects, ContentJobs, and content_embeddings tables.

## Existing Patterns

- Custom admin pages live at `src/app/(payload)/admin/[name]/page.tsx` (see `scrape/page.tsx` for pattern)
- Payload config is at `src/payload.config.ts` — has `afterNavLinks` for admin navigation
- Kiuli brand colors (kiuli-teal, kiuli-charcoal, kiuli-clay, kiuli-gray, kiuli-ivory) are already in Tailwind config
- Existing UI components in `src/components/ui/`: button, card, checkbox, dialog, input, label, pagination, select, textarea
- Missing UI component needed: tooltip (used by v0 for error messages on failed projects)

## Task 1: Extract v0 Component

Unzip `/mnt/user-data/uploads/content-engine-dashboard.zip`.

Copy these files into the codebase:
- `components/content-engine/content-engine-dashboard.tsx` → `src/components/content-system/ContentEngineDashboard.tsx`
- `components/content-engine/project-list.tsx` → `src/components/content-system/ProjectList.tsx`
- `components/content-engine/batch-action-bar.tsx` → `src/components/content-system/BatchActionBar.tsx`
- `components/content-engine/system-health-view.tsx` → `src/components/content-system/SystemHealthView.tsx`
- `components/ui/tooltip.tsx` → `src/components/ui/tooltip.tsx` (only this UI component — the others already exist)

Do NOT copy the mock data file (`lib/content-engine-data.ts`). The types and labels will be defined inline or in a small types file within `src/components/content-system/`.

## Task 2: Create Types and Constants

Create `src/components/content-system/types.ts` with the type definitions from the v0 data file (ContentType, Stage, Origin, ProcessingStatus, ContentProject interface, JobType, JobStatus, RecentJob, EmbeddingGroup, StaleBreakdown) plus the label/colour maps (contentTypeLabels, contentTypeBadgeColors, originLabels, stageLabels).

Map the DB stage values to display stages:
- DB `idea` → display `ideas`
- DB `brief` → display `briefs`
- DB `research` → display `research`
- DB `draft` → display `drafts`
- DB `review` → display `review`
- DB `published` → display `published`
- DB `filtered` → display `filtered`

## Task 3: Create API Route for Dashboard Data

Create `src/app/(payload)/api/content/dashboard/route.ts`.

This is a GET endpoint that returns all dashboard data in one response. Auth: check `req.user` (Payload session auth — this is an admin view, not a public API).

```typescript
// Response shape
{
  projects: ContentProject[]    // All content projects (or paginated)
  stageCounts: Record<string, number>
  jobs: RecentJob[]             // Last 20 ContentJobs
  metrics: {
    embeddings: {
      total: number
      byType: { type: string, count: number }[]
      lastUpdated: string | null
    }
    staleProjects: {
      total: number
      byStage: { stage: string, count: number }[]
    }
    failedOperations: number
    directives: {
      active: number
      pastReviewDate: number
      zeroFilterHits: number
    }
  }
}
```

Queries needed:
```typescript
// Projects — fetch all, let frontend filter/paginate
const projects = await payload.find({
  collection: 'content-projects',
  limit: 500,
  sort: '-updatedAt',
  depth: 0,
})

// Stage counts
// Count from the projects array, mapping stage field values

// Jobs — last 20
const jobs = await payload.find({
  collection: 'content-jobs',
  limit: 20,
  sort: '-createdAt',
  depth: 0,
})

// Embeddings — raw SQL (no Payload collection for this)
import { query } from '../../../../content-system/db'
const embedResult = await query(
  "SELECT chunk_type, COUNT(*) as count FROM content_embeddings GROUP BY chunk_type"
)
const lastEmbed = await query(
  "SELECT created_at FROM content_embeddings ORDER BY created_at DESC LIMIT 1"
)

// Stale projects — projects not in terminal stages, not updated in 7+ days
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const staleResult = await query(
  `SELECT stage, COUNT(*) as count FROM content_projects
   WHERE stage NOT IN ('published', 'rejected', 'filtered')
   AND updated_at < $1
   GROUP BY stage`,
  [sevenDaysAgo]
)

// Failed operations
const failedResult = await query(
  "SELECT COUNT(*) as count FROM content_projects WHERE processing_status = 'failed'"
)

// Directives
const directives = await payload.find({
  collection: 'editorial-directives',
  where: { active: { equals: true } },
  limit: 200,
  depth: 0,
})
// Count past review date and zero filter hits from the results
```

Map ContentProjects Payload fields to dashboard ContentProject interface:
- `id` → `id` (as string)
- `title` → `title`
- `contentType` → `contentType` (field name is `contentType` in Payload)
- `stage` → `stage`
- `originPathway` → `origin`
- `processingStatus` → `processingStatus` (default 'idle' if null)
- `processingError` → `errorMessage`
- `filterReason` → `filterReason` (for filtered tab display)
- `destinations` → `destinationNames` (this is a JSON array of strings on ContentProjects)
- `updatedAt` → `createdAt` (for age display — use updatedAt since that's more relevant)

Map ContentJobs Payload fields to RecentJob interface:
- `id` → `id` (as string)
- `jobType` → `type`
- `status` → `status`
- `itineraryId` → look up itinerary title if possible, otherwise use ID
- `progress` → extract duration from step timing data if available
- `error` → `error`

## Task 4: Create Batch Action API Route

Create `src/app/(payload)/api/content/dashboard/batch/route.ts`.

POST endpoint. Auth: `req.user` (Payload session).

```typescript
// Request body
{
  action: 'advance' | 'reject' | 'retry'
  projectIds: number[]
  reason?: string           // For reject
  createDirective?: boolean // For reject
}
```

Logic:
- **advance**: For each project, determine next stage based on contentType:
  - Articles (itinerary_cluster, authority): idea→brief, brief→research, research→draft, draft→review, review→published
  - Destination/property pages: idea→draft, draft→review, review→published
  - Update via `payload.update({ collection: 'content-projects', id, data: { stage: nextStage } })`

- **reject**: Update each project's stage to 'rejected'. If reason provided, store in a rejection reason field (or filterReason). If createDirective is true, create an EditorialDirective with the reason as text.

- **retry**: For failed jobs, reset status to 'pending' and re-trigger (this calls the appropriate endpoint based on jobType).

Return: `{ success: true, updated: number }`

## Task 5: Wire Components to Real Data

Modify `ContentEngineDashboard.tsx`:
- Remove mock data import
- Add `useEffect` to fetch from `/api/content/dashboard` on mount
- Add loading state
- Wire batch action handlers to POST `/api/content/dashboard/batch`
- Wire retry button in SystemHealthView to POST `/api/content/dashboard/batch` with action 'retry'

Modify `ProjectList.tsx`:
- For filtered projects, show `filterReason` below the title in muted/italic text
- Fix `formatAge` to use `Date.now()` instead of hardcoded reference time

Modify `SystemHealthView.tsx`:
- Remove mock data import
- Accept metrics and jobs as props from parent
- Wire retry button to parent callback

Modify `BatchActionBar.tsx`:
- Remove shadcn Checkbox import, use a simple `<input type="checkbox">` or the existing `src/components/ui/checkbox.tsx`

## Task 6: Create Admin Page

Create `src/app/(payload)/admin/content-engine/page.tsx`:

```typescript
import ContentEngineDashboard from '@/components/content-system/ContentEngineDashboard'

export default function ContentEnginePage() {
  return <ContentEngineDashboard />
}
```

## Task 7: Add Navigation Link

Create `src/components/admin/ContentEngineLink.tsx` following the pattern of `ImportItineraryLink`:

```typescript
'use client'
import React from 'react'
import Link from 'next/link'

export const ContentEngineLink: React.FC = () => {
  return (
    <Link href="/admin/content-engine" style={{ /* styling */ }}>
      Content Engine
    </Link>
  )
}
```

Add to `payload.config.ts` afterNavLinks:
```typescript
afterNavLinks: [
  '@/components/admin/ImportItineraryLink#ImportItineraryLink',
  '@/components/admin/ContentEngineLink#ContentEngineLink',
  '@/components/admin/NotificationBell#NotificationBell',
],
```

## Task 8: Fix Import Paths

All v0 components use `@/components/ui/` and `@/lib/` imports. Fix all imports to match the actual project structure:
- `@/components/ui/tooltip` → `@/components/ui/tooltip` (after copying)
- `@/components/ui/checkbox` → `@/components/ui/checkbox` (already exists)
- `@/lib/content-engine-data` → `@/components/content-system/types` (new file)
- Remove any `@/lib/utils` imports — check what's needed and inline or use existing utils

The tooltip component from v0 depends on `@radix-ui/react-tooltip`. Install it:
```bash
npm install @radix-ui/react-tooltip
```

## Testing

After deploy, navigate to `admin.kiuli.com/admin/content-engine`.

Verify:
1. Page loads without errors
2. Ideas tab shows the 20 cascade ContentProjects (destination_page + property_page at idea stage)
3. Briefs tab shows the 39 article briefs (itinerary_cluster + authority)
4. Filtered tab shows filtered projects with filter reasons visible
5. System Health tab shows:
   - Embeddings: 182 total (143 bootstrap + 39 brief)
   - Recent Jobs: cascade and decompose jobs from Phases 5-6
   - Directives: 1 active
6. Batch select: check 2+ projects, batch action bar appears
7. Batch advance: select briefs, click Approve, verify they advance to research stage in DB
8. Navigation link appears in admin sidebar

## Gate Evidence

```sql
-- After batch advance test
SELECT id, title, stage FROM content_projects
WHERE stage = 'research'
ORDER BY id;
-- Should show the projects you advanced

-- Stage counts match dashboard display
SELECT stage, COUNT(*) FROM content_projects GROUP BY stage ORDER BY stage;
```

## Do NOT

- Do NOT copy all 50+ shadcn UI components from the zip — only tooltip
- Do NOT create a separate data fetching library — keep it in the API route
- Do NOT modify any existing collections or their schemas
- Do NOT add new npm dependencies beyond @radix-ui/react-tooltip
- Do NOT modify the existing scrape admin page
- Do NOT create Lambda functions

## Report

Create `content-engine/reports/phase7-content-dashboard.md` with:
1. Files created/modified
2. Screenshot or evidence that the page loads at admin.kiuli.com/admin/content-engine
3. Verification that real data displays (stage counts, job list, embedding stats)
4. Batch action test result (advance 2 projects, show DB evidence)
5. Any issues encountered

Commit and push everything.
