# Phase 8: Research Pipeline + Source Monitor Lambda

## Context

Phase 7 complete. 37 article briefs at 'brief' stage need research to advance. The research directory has stub files (type declarations only, no implementations). The source monitor Lambda has a stub handler. Both need full implementation.

Existing infrastructure:
- `content-system/research/types.ts` — interfaces defined
- `content-system/research/perplexity-client.ts` — stub (declare only)
- `content-system/research/research-compiler.ts` — stub (declare only)
- `content-system/signals/source-monitor.ts` — stub (declare only)
- `content-system/embeddings/query.ts` — working semanticSearch function
- `content-system/openrouter-client.ts` — working callModel with purpose-based model selection
- `content-system/db.ts` — working raw SQL query function
- `lambda/content-source-monitor/handler.js` — stub handler
- `src/collections/SourceRegistry/index.ts` — collection with deduplication fields
- `src/collections/ContentProjects/index.ts` — full schema with research tab fields

Environment variable needed: `PERPLEXITY_API_KEY` must be added to Vercel env vars (production + preview). Value: [REDACTED — set in Vercel dashboard]

## Task 1: Perplexity Client

Replace `content-system/research/perplexity-client.ts` stub with full implementation.

Perplexity API: `https://api.perplexity.ai/chat/completions`
Model: `sonar-pro` (real-time web search with citations)
Auth: Bearer token from `PERPLEXITY_API_KEY` env var

```typescript
export async function queryPerplexity(query: ResearchQuery): Promise<PerplexityResponse> {
  // Build system prompt that focuses the search on:
  // - The specific topic and angle
  // - Destinations mentioned
  // - Luxury African safari travel context
  // - Request for authoritative sources (gov sites, park authorities, academic, conservation orgs)
  // - Request for recent information (last 12 months preferred)
  
  // User message: structured query combining topic, angle, destinations
  
  // Parse response:
  // - answer: the synthesis text
  // - citations: Perplexity returns these in the response — extract as sources
  // - followUpQuestions: any suggested follow-ups from the model
  
  // Retry logic: one retry on 429/5xx with 5s backoff (same pattern as openrouter-client.ts)
  // Non-retryable: 400, 401, 403, 404 — throw immediately
}
```

The system prompt for Perplexity should be:
```
You are a research assistant for Kiuli, a luxury African safari travel company targeting high-net-worth US individuals. Research the following topic thoroughly.

Focus on:
- Authoritative sources (national park authorities, government tourism boards, conservation organizations, academic publications)
- Recent information (prefer sources from the last 12 months)
- Specific facts, statistics, and data points that add depth
- Information that would be relevant to luxury travelers spending $25,000-$100,000+ on safari experiences

Provide a comprehensive synthesis with specific citations. Note any conflicting information between sources. Flag time-sensitive information that may change.
```

The user message should combine: `Topic: {query.topic}\nAngle: {query.angle}\nDestinations: {query.destinations.join(', ')}\nContent type: {query.contentType}`

Parse Perplexity response format:
- `choices[0].message.content` — the answer text
- `citations` array in the response — URLs of sources used (Perplexity includes these at the top level of the response)

Map citations to ExternalSource objects. For credibility rating, use a simple heuristic:
- `.gov`, `.org` (known conservation orgs), `.edu` → 'authoritative'
- `.ac.uk`, journals, pubmed → 'peer_reviewed'
- arxiv, biorxiv, preprints → 'preprint'
- skift, travel trade publications → 'trade'
- everything else → 'other'

## Task 2: Research Compiler

Replace `content-system/research/research-compiler.ts` stub with full implementation.

The research compiler has content-type-specific strategies:

### For Articles (itinerary_cluster, authority, designer_insight):
Full research pipeline — this is the only type that has a separate research stage.

```typescript
export async function compileResearch(options: ResearchOptions): Promise<ResearchCompilation> {
  // 1. Query Perplexity for external research
  const perplexityResult = await queryPerplexity({
    topic: options.query.topic,
    angle: options.query.angle,
    destinations: options.query.destinations,
    contentType: options.query.contentType,
  })
  
  // 2. Query embedding store for existing Kiuli content on this topic
  const existingContent = await semanticSearch(
    `${options.query.topic} ${options.query.angle}`,
    {
      topK: 10,
      minScore: 0.3,
      excludeProjectId: parseInt(options.projectId),
    }
  )
  
  // 3. Format existing content into readable summary
  const existingSiteContent = existingContent
    .map(r => `[${r.chunkType}] ${r.chunkText}`)
    .join('\n\n')
  
  // 4. Compile synthesis
  // Use OpenRouter to synthesize Perplexity findings + existing content into
  // a coherent research brief. The synthesis should:
  // - Summarize key findings
  // - Identify gaps in existing Kiuli coverage
  // - Note contradictions between sources
  // - Highlight proprietary angles Kiuli could take
  // - Flag time-sensitive information
  
  const synthesisResult = await callModel('research', [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    { role: 'user', content: `External research:\n${perplexityResult.answer}\n\nExisting Kiuli content:\n${existingSiteContent}\n\nTopic: ${options.query.topic}\nAngle: ${options.query.angle}` }
  ], { maxTokens: 4096, temperature: 0.3 })
  
  // 5. Build uncertainty map from synthesis
  // Parse the synthesis for claims and assign confidence levels
  
  return {
    synthesis: synthesisResult.content,
    sources: perplexityResult.sources,
    proprietaryAngles: [], // Populated by designer in workspace
    uncertaintyMap: extractUncertainties(synthesisResult.content),
    existingSiteContent,
  }
}
```

The SYNTHESIS_SYSTEM_PROMPT should be:
```
You are a research compiler for Kiuli, a luxury African safari travel company. Your job is to synthesize external research findings and existing site content into a comprehensive research brief.

Structure your synthesis as:

## Key Findings
The most important facts, statistics, and insights from external research.

## Existing Coverage
What Kiuli already has on this topic. Note gaps and opportunities.

## Contradictions
Any conflicting information between sources, or between external sources and existing Kiuli content.

## Proprietary Opportunities
Angles where Kiuli's designer expertise could add unique value that competitors cannot replicate.

## Time-Sensitive Information
Facts that may change — permit prices, visa requirements, seasonal access, conservation status.

## Uncertainty Notes
Claims that could not be verified from multiple sources, or where sources disagree. Mark each as [FACT], [INFERENCE], or [UNCERTAIN].

Write for an expert travel designer who will use this research to produce luxury safari content. Be specific — include numbers, dates, source names. Do not be generic.
```

### extractUncertainties function:
Parse the synthesis text for the `## Uncertainty Notes` section. Extract each claim with its confidence tag ([FACT], [INFERENCE], [UNCERTAIN]) into UncertaintyEntry objects.

### For destination_page, property_page, itinerary_enhancement, page_update:
These types do NOT have a separate research stage. Research happens inline during drafting (Phase 11). But the research-compiler should still export utility functions that the drafters will call:

```typescript
export async function researchForSection(
  sectionName: string,
  destinationOrProperty: string,
  existingContent: string,
): Promise<{ perplexityFindings: string; embeddingContext: string; sources: ExternalSource[] }> {
  // Used by destination-page-drafter and property-page-drafter
  // Queries Perplexity for section-specific facts
  // Queries embedding store for related existing content
  // Returns raw findings (not a full compilation)
}
```

## Task 3: Research API Route

Create `src/app/(payload)/api/content/research/route.ts`

POST endpoint. Auth: Payload session (same pattern as dashboard routes).

Request body:
```typescript
{
  projectId: number
}
```

Logic:
1. Fetch the ContentProject by ID
2. Validate: must be an article type (itinerary_cluster, authority, designer_insight) at 'research' stage
3. Set processingStatus = 'processing', processingStartedAt = now
4. Build ResearchQuery from project fields (title as topic, targetAngle as angle, destinations from metadata)
5. Call compileResearch()
6. Write results to the ContentProject:
   - synthesis → richText conversion of synthesis text
   - existingSiteContent → richText conversion
   - sources → populate sources array
   - uncertaintyMap → populate uncertaintyMap array
7. Set processingStatus = 'completed', clear processingError
8. On failure: set processingStatus = 'failed', set processingError with message

For richText conversion: Perplexity and the synthesis return markdown-ish text. Convert to Payload's Lexical richText format. Use a simple conversion: split by `\n\n` into paragraphs, each paragraph becomes a Lexical paragraph node with text children. Headers (`## `) become heading nodes. This doesn't need to be perfect — the designer can edit in the Payload rich text editor.

Return: `{ success: true, projectId: number }` or `{ error: string }` with appropriate status code.

## Task 4: Source Monitor Implementation

Replace `content-system/signals/source-monitor.ts` stub with full implementation.

```typescript
export async function checkSources(options?: SourceMonitorOptions): Promise<SourceCheckResult[]> {
  // 1. Fetch all active SourceRegistry entries
  const payload = await getPayload({ config: configPromise })
  const sources = await payload.find({
    collection: 'source-registry',
    where: { active: { equals: true } },
    limit: 100,
    depth: 0,
  })
  
  const results: SourceCheckResult[] = []
  
  for (const source of sources.docs) {
    try {
      // 2. Check source based on checkMethod
      let items: FeedItem[]
      if (source.checkMethod === 'rss') {
        items = await parseRSSFeed(source.feedUrl)
      } else {
        items = await checkAPIEndpoint(source.feedUrl)
      }
      
      // 3. Deduplicate — only items newer than lastProcessedItemTimestamp
      // and not in recentProcessedIds
      const recentIds: string[] = Array.isArray(source.recentProcessedIds)
        ? source.recentProcessedIds
        : JSON.parse(source.recentProcessedIds || '[]')
      
      const newItems = items.filter(item => {
        if (recentIds.includes(item.id)) return false
        if (source.lastProcessedItemTimestamp && item.publishedAt) {
          return new Date(item.publishedAt) > new Date(source.lastProcessedItemTimestamp)
        }
        return true
      })
      
      // 4. Limit to 10 items per source per check
      const processItems = newItems.slice(0, 10)
      
      // 5. For each item: generate candidate, filter, shape brief
      for (const item of processItems) {
        // Generate candidate using OpenRouter
        const candidate = await generateCandidateFromSource(item, source)
        
        // Filter against directives and embedding store
        // (reuse candidate-filter from ideation)
        const filterResult = await filterCandidate(candidate)
        
        if (filterResult.passed) {
          // Create ContentProject at 'brief' stage
          await createContentProjectFromSource(candidate, source, item)
        }
      }
      
      // 6. Update source deduplication fields
      const updatedRecentIds = [
        ...processItems.map(i => i.id),
        ...recentIds,
      ].slice(0, 50) // Keep last 50
      
      await payload.update({
        collection: 'source-registry',
        id: source.id,
        data: {
          lastCheckedAt: new Date().toISOString(),
          lastProcessedItemId: processItems[0]?.id ?? source.lastProcessedItemId,
          lastProcessedItemTimestamp: processItems[0]?.publishedAt ?? source.lastProcessedItemTimestamp,
          recentProcessedIds: updatedRecentIds,
        },
      })
      
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsFound: items.length,
        newItems: processItems.length,
        projectsCreated: /* count */,
        error: null,
      })
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsFound: 0,
        newItems: 0,
        projectsCreated: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  
  return results
}
```

### RSS Parser
Use the `rss-parser` npm package (install it). Parse the RSS feed, extract:
- title → item title
- link → item URL (used as id for deduplication)
- pubDate → publishedAt
- contentSnippet or content → description

### generateCandidateFromSource
Use OpenRouter (purpose: 'ideation') to evaluate whether a feed item is relevant to Kiuli's content strategy and generate a candidate if so. System prompt should explain Kiuli's content types and target audience. If the item is not relevant (general travel news, not Africa-focused, not safari-relevant), return null.

### filterCandidate
Reuse the filtering logic from `content-system/ideation/candidate-filter.ts`. Import and call the same directive checking and embedding duplicate detection functions.

### createContentProjectFromSource
Create a ContentProject with:
- stage: 'brief'
- contentType: determined by candidate (likely 'authority' for external sources)
- originPathway: 'external'
- originSource: relationship to the SourceRegistry entry
- originUrl: the item URL
- title, briefSummary, targetAngle, competitiveNotes from the candidate
- destinations, properties, species from candidate metadata
- Embed the brief (same as Phase 6 brief embedding)

### Types needed in `content-system/signals/types.ts`:
Add FeedItem, SourceCheckResult interfaces. Update SourceMonitorOptions if needed.

## Task 5: Source Monitor Lambda Handler

Replace `lambda/content-source-monitor/handler.js` with full implementation.

Pattern: same as content-cascade and content-decompose Lambda handlers.

```javascript
// 1. Create a ContentJob (jobType: 'source_monitor')
// 2. Call checkSources()
// 3. Update job with results (step-level progress per source)
// 4. On completion: set job status = 'completed'
// 5. On failure: set job status = 'failed' with error

// IMPORTANT: This Lambda calls the Vercel API endpoint, not the internal functions directly.
// It needs SITE_URL and CONTENT_API_KEY env vars.
```

Wait — the source monitor needs to run the full candidate generation and filtering pipeline. The existing cascade and decompose Lambdas call Vercel API endpoints. But the source monitor has more complex logic (RSS parsing, per-source deduplication, candidate generation per item). 

Two approaches:
A) Lambda calls a single Vercel endpoint `/api/content/source-monitor` that runs the full checkSources() function
B) Lambda implements the logic directly using the shared content-shared package

Use approach A for consistency with the existing Lambda pattern. Create the Vercel endpoint.

Create `src/app/(payload)/api/content/source-monitor/route.ts`:
POST endpoint. Auth: Bearer token (CONTENT_API_KEY). Calls checkSources(). Returns results.

Lambda handler calls this endpoint, creates/updates ContentJob, handles timeout.

## Task 6: Source Monitor Vercel Endpoint

Create `src/app/(payload)/api/content/source-monitor/route.ts`

POST endpoint. Auth: Bearer token (same CONTENT_API_KEY pattern as cascade/decompose endpoints).

Request body: `{}` (no params needed — it processes all active sources)

Logic:
1. Call checkSources()
2. Return results array

## Task 7: CloudWatch EventBridge Schedule

Create the EventBridge rule to trigger the source monitor Lambda daily at 06:00 UTC.

```bash
aws events put-rule \
  --name kiuli-source-monitor-daily \
  --schedule-expression "cron(0 6 * * ? *)" \
  --state ENABLED

aws lambda add-permission \
  --function-name kiuli-content-source-monitor \
  --statement-id eventbridge-daily \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:eu-north-1:ACCOUNT_ID:rule/kiuli-source-monitor-daily

aws events put-targets \
  --rule kiuli-source-monitor-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:eu-north-1:ACCOUNT_ID:function:kiuli-content-source-monitor"
```

Get the actual AWS account ID and Lambda ARN from existing Lambda configuration.

## Task 8: Install Dependencies

```bash
npm install rss-parser
```

## Task 9: Dashboard Integration

The System Health panel in the dashboard already shows ContentJobs. Source monitor jobs (jobType: 'source_monitor') should appear there automatically. Verify that the dashboard types.ts includes 'source_monitor' as a JobType. If not, add it.

Also update the dashboard batch action route: when a user clicks "Advance Selected" on briefs, research-stage articles should be advanceable. The batch endpoint already handles this via stage transitions, but verify research → draft transition works.

## Testing

### Research Pipeline Test

1. Pick one article brief (choose one with specific destinations, e.g. from itinerary 23 Rwanda set)
2. Advance it from 'brief' to 'research' stage via the dashboard batch action
3. Trigger research: `curl -X POST http://localhost:3000/api/content/research -H "Content-Type: application/json" -H "Cookie: [session]" -d '{"projectId": [ID]}'`
4. Verify:
   - processingStatus transitions: idle → processing → completed
   - synthesis field is populated with structured research text
   - sources array has entries with URLs and credibility ratings
   - existingSiteContent has relevant embedding store results
   - uncertaintyMap has entries

### Source Monitor Test

1. Add a test RSS source to SourceRegistry via Payload admin:
   - Name: "bioRxiv Conservation Biology"
   - feedUrl: "https://connect.biorxiv.org/biorxiv_xml.php?subject=ecology"
   - category: science
   - checkMethod: rss
   - active: true

2. Trigger source monitor: `curl -X POST http://localhost:3000/api/content/source-monitor -H "Authorization: Bearer [CONTENT_API_KEY]"`

3. Verify:
   - Source was checked (lastCheckedAt updated)
   - New items found and processed
   - recentProcessedIds populated
   - Any relevant candidates created as ContentProjects at 'brief' stage with originPathway = 'external'
   - Any irrelevant items correctly skipped

4. Run source monitor again immediately. Verify:
   - Same items NOT reprocessed (deduplication working)
   - No duplicate ContentProjects created
   - recentProcessedIds unchanged or only new items added

### Lambda Test (after deployment)

Deploy the source monitor Lambda and trigger manually:
```bash
aws lambda invoke \
  --function-name kiuli-content-source-monitor \
  --payload '{}' \
  response.json
cat response.json
```
Verify job created in ContentJobs, results match direct endpoint test.

## Gate Evidence

```sql
-- 1. Research populated on an article
SELECT id, title, stage, "processingStatus",
       LEFT(synthesis::text, 200) as synthesis_preview,
       jsonb_array_length(sources::jsonb) as source_count,
       jsonb_array_length("uncertaintyMap"::jsonb) as uncertainty_count
FROM content_projects
WHERE id = [RESEARCHED_ID];

-- 2. Source monitor ran — deduplication fields updated
SELECT id, name, "lastCheckedAt",
       "lastProcessedItemTimestamp",
       jsonb_array_length("recentProcessedIds"::jsonb) as processed_count
FROM source_registry
WHERE active = true;

-- 3. No duplicates on re-run
SELECT title, COUNT(*) FROM content_projects
WHERE "originPathway" = 'external'
GROUP BY title HAVING COUNT(*) > 1;
-- Should return 0 rows

-- 4. Source monitor job in ContentJobs
SELECT id, "jobType", status, error
FROM content_jobs
WHERE "jobType" = 'source_monitor'
ORDER BY "createdAt" DESC LIMIT 5;
```

## Do NOT

- Do NOT leave any stub/declare-only files — every function must have a real implementation
- Do NOT skip the Perplexity integration — use the real API with the sonar-pro model
- Do NOT skip the EventBridge schedule — set it up fully
- Do NOT create placeholder implementations that return mock data
- Do NOT skip error handling or retry logic
- Do NOT modify existing collections or their schemas
- Do NOT commit the Perplexity API key to any file — it goes in Vercel env vars only

## Report

Create `content-engine/reports/phase8-research-source-monitor.md` with:
1. Files created/modified with descriptions
2. Research test: show the synthesis preview, source count, and uncertainty count for one researched article
3. Source monitor test: show deduplication fields after first and second run
4. Lambda deployment confirmation
5. EventBridge schedule confirmation
6. Any issues encountered

Commit and push everything.
