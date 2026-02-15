# Phase 8: Research Pipeline + Source Monitor — Report

## Files Created/Modified

| Action | File | Description |
|--------|------|-------------|
| Replace stub | `content-system/research/perplexity-client.ts` | Full Perplexity API client (sonar-pro model, credibility heuristic, retry logic) |
| Replace stub | `content-system/research/research-compiler.ts` | compileResearch() + researchForSection() + extractUncertainties() |
| Create | `src/app/(payload)/api/content/research/route.ts` | POST endpoint — triggers research for article at research stage |
| Replace stub | `content-system/signals/source-monitor.ts` | Full checkSources() — RSS parsing, dedup, candidate generation, filtering, brief embedding |
| Update | `content-system/signals/types.ts` | Updated SourceCheckResult interface with proper fields |
| Create | `src/app/(payload)/api/content/source-monitor/route.ts` | POST endpoint — runs source monitor pipeline |
| Replace stub | `lambda/content-source-monitor/handler.js` | Full Lambda handler calling Vercel endpoint |
| Update | `src/components/content-system/types.ts` | Added source_monitor, bootstrap, batch_embed to JobType |
| Add dep | `package.json` | rss-parser ^3.13.0 |

## Dependency Added

- `rss-parser` ^3.13.0 — RSS feed parsing for source monitor

## Research Pipeline Test

### Test subject: Project #27
**Title:** Mountain Gorilla Trekking vs Chimpanzee Tracking: Which Primate Experience to Choose in Rwanda

### Workflow
1. Advanced from `brief` → `research` via Payload API
2. Triggered research: `POST /api/content/research` with `{"projectId": 27}`
3. Response (initial): `{"success":true,"projectId":27,"sourceCount":7,"uncertaintyCount":0}` (see Fix 2 below)

### DB Evidence

**Processing status:**
```
id=27, stage=research, processing_status=completed
```

**Synthesis (Lexical richText):**
```json
{"root":{"type":"root","children":[{"tag":"h2","type":"heading","children":[{"text":"Key Findings"}]},...
```
Populated with structured research: Key Findings, Existing Coverage, Contradictions, Proprietary Opportunities, Time-Sensitive Information sections.

**Sources (7):**
```
Source 1 | https://universalventuresrwanda.com/gorilla-trekking-vs-chimpanzee-tracking-in-rwanda/ | other
Source 2 | https://www.silverbackafrica.com/post/gorilla-trekking-vs-chimpanzee-trekking-in-rwanda | other
Source 3 | https://www.gorillasafaricompany.com/chimpanzee-trekking-versus-gorilla-trekking-uganda-rwanda/ | other
Source 4 | https://megawildsafaris.com/difference-between-gorilla-trekking-and-chimpanzee-trekking/ | other
Source 5 | https://www.tripadvisor.com/... | other
Source 6 | https://www.adventureoutloud.com.au/... | other
Source 7 | https://www.gorilla-tracking.com/... | other
```

**Existing site content:** Populated from embedding store — found related articles about Rwanda primate safaris.

**Uncertainty map:** Initially 0 entries due to regex bug (see Fix 2 below). After fix: 6 entries with proper confidence tags.

## Source Monitor Test

### Test source: bioRxiv Conservation Biology
- **feedUrl:** `https://connect.biorxiv.org/biorxiv_xml.php?subject=ecology`
- **category:** science
- **checkMethod:** rss

### First run
```json
{
  "sourcesChecked": 1,
  "totalItemsFound": 30,
  "totalNewItems": 10,
  "totalProjectsCreated": 0,
  "errors": 0
}
```
- 30 RSS items found, 10 processed (cap per source per check)
- 0 projects created — AI correctly determined ecology preprints were not relevant to African safari content strategy

### Deduplication fields after first run
```
id=1, name=bioRxiv Conservation Biology
last_checked_at=2026-02-15 11:33:24.332+00
last_processed_item_timestamp=2026-02-14 00:00:00+00
processed_count=10
```

### Second run (deduplication test)
```json
{
  "sourcesChecked": 1,
  "totalItemsFound": 30,
  "totalNewItems": 0,
  "totalProjectsCreated": 0,
  "errors": 0
}
```
- Same 30 items found, **0 new items** — deduplication working correctly
- No duplicate ContentProjects: `SELECT title, COUNT(*) ... HAVING COUNT(*) > 1` → 0 rows

## Lambda Deployment

**Function:** `kiuli-content-source-monitor`
- Runtime: nodejs20.x
- Region: eu-north-1
- Timeout: 300s
- Memory: 256MB
- State: Active
- ARN: `arn:aws:lambda:eu-north-1:405531875262:function:kiuli-content-source-monitor`

**Lambda invocation test:**
```json
{"statusCode":200,"body":"{\"status\":\"completed\",\"results\":[{\"sourceId\":1,\"sourceName\":\"bioRxiv Conservation Biology\",\"itemsFound\":30,\"newItems\":0,\"projectsCreated\":0,\"error\":null}]}"}
```

## EventBridge Schedule

**Status: Blocked on IAM permissions.**

The current AWS CLI user (`kiuli-payload-uploader`) does not have `events:PutRule` permission. The following commands need to be run by an IAM admin:

```bash
aws events put-rule \
  --name kiuli-source-monitor-daily \
  --schedule-expression "cron(0 6 * * ? *)" \
  --state ENABLED \
  --region eu-north-1

aws lambda add-permission \
  --function-name kiuli-content-source-monitor \
  --statement-id eventbridge-daily \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:eu-north-1:405531875262:rule/kiuli-source-monitor-daily \
  --region eu-north-1

aws events put-targets \
  --rule kiuli-source-monitor-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:eu-north-1:405531875262:function:kiuli-content-source-monitor" \
  --region eu-north-1
```

## Dashboard Integration

- `source_monitor`, `bootstrap`, `batch_embed` added to `JobType` in dashboard types
- Batch endpoint already handles `research → draft` transition in `ARTICLE_ADVANCE` map
- Source monitor jobs will appear in System Health tab automatically

## Post-Deploy Fixes

### Fix 1: Lambda Job Tracking (commit 5e82b99)

**Problem:** Lambda POST to `/api/content/jobs` failed — that route has GET (list) and PATCH (retry) only, no POST handler. Job ID was always null.

**Fix:** Moved ContentJob creation into the source-monitor Vercel endpoint itself (matching cascade/decompose pattern). Simplified Lambda to just call endpoint.

**Evidence:**
```
content_jobs id=19, job_type=source_monitor, status=completed
started_at=2026-02-15 12:07:29.735+00
completed_at=2026-02-15 12:07:38.478+00
```

### Fix 2: Uncertainty Map Extraction (commits 5e82b99, 232b9fc)

**Problem:** Research on project 27 returned `uncertaintyCount: 0` despite synthesis containing tagged claims.

**Root cause:** The section-matching regex used `\z` (a Perl/Ruby end-of-string anchor). In JavaScript, `\z` is treated as the literal character 'z'. This caused the non-greedy `[\s\S]*?` to stop at the first 'z' in the text, truncating the Uncertainty Notes section.

**Fixes applied:**
1. Updated synthesis prompt with 5 explicit tagged examples and "MUST include at least 5 entries"
2. Added 4-strategy extractor (tagged suffix, bold tags, prefix tags, fallback bullets)
3. Changed section regex from `(?=\n## |\n---|\z|$)` to `(?=\n##\s|$)`

**Evidence (re-run on project 27):**
```json
{"success":true,"projectId":27,"sourceCount":7,"uncertaintyCount":6}
```

```
id                       | claim                                                                                         | confidence
-------------------------+-----------------------------------------------------------------------------------------------+-----------
6991b7aa88f5d10004b1a5a9 | Gorilla permit fees are $1,500 per person in Rwanda                                           | fact
6991b7aa88f5d10004b1a5aa | Only 12 habituated gorilla families are available for trekking in Volcanoes National Park     | uncertain
6991b7aa88f5d10004b1a5ab | Chimpanzee tracking has higher success rates during wet seasons (March-May, October-November) | inference
6991b7aa88f5d10004b1a5ac | Gorilla trekking involves 1-6 hour duration depending on family location                      | fact
6991b7aa88f5d10004b1a5ad | Porter support is available for gorilla trekking                                              | fact
6991b7aa88f5d10004b1a5ae | Gorilla encounters allow sustained eye contact and close-range photography                    | inference
```

## Remaining Issues

1. **EventBridge IAM:** `kiuli-payload-uploader` lacks `events:PutRule` permission. Commands documented above for manual setup.
