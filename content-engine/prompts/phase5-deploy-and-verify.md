# Phase 5: Deploy and Verify Cascade

## Step 1: Deploy

Commit all Phase 5 changes if not already committed:

```bash
git add -A
git status
git commit -m "Phase 5: Itinerary Cascade implementation"
git push origin main
```

Wait for Vercel deployment to complete. Verify by checking the deployment URL responds:

```bash
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com
```

Must return 200 before proceeding.

Then verify the cascade endpoint exists:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Must return 401. If 404, the deployment hasn't propagated or the route isn't registered. Wait and retry. If still 404 after 2 minutes, stop and report.

## Step 2: Record Baselines

Before running any cascade, record current state:

```sql
SELECT COUNT(*) as dest_count FROM destinations WHERE type = 'destination';
SELECT COUNT(*) as prop_count FROM properties;
SELECT COUNT(*) as project_count FROM content_projects WHERE origin_pathway = 'cascade';
SELECT COUNT(*) as job_count FROM content_jobs WHERE job_type = 'cascade';
```

Record these four numbers. They are the baselines.

## Step 3: Dry Run (Itinerary 23)

Read CONTENT_SYSTEM_SECRET from `.env.local` (or from `vercel env pull` if not present locally).

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23, "dryRun": true}'
```

Record the full JSON response. Check:
- Entity extraction returns countries (Rwanda), locations (Kigali, Akagera, Volcans, Nyungwe or similar), properties (4 Rwanda properties)
- No DB changes: re-run the 4 baseline queries — all counts must be identical

If the endpoint returns an error, stop and report the full error response.

## Step 4: Full Cascade (Itinerary 23)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Record the full JSON response. Then run these verification queries and record the output of each:

```sql
-- New park-level destinations
SELECT id, name, slug, type, country_id FROM destinations WHERE type = 'destination' ORDER BY id;

-- Property count unchanged
SELECT COUNT(*) FROM properties;

-- Itinerary → destinations
SELECT destinations_id FROM itineraries_rels WHERE parent_id = 23 AND path = 'destinations' ORDER BY destinations_id;

-- Destinations → relatedItineraries backfilled
SELECT d.name, dr.itineraries_id FROM destinations_rels dr JOIN destinations d ON dr.parent_id = d.id WHERE dr.path = 'relatedItineraries' AND dr.itineraries_id = 23 ORDER BY d.name;

-- Properties → relatedItineraries
SELECT p.name, pr.itineraries_id FROM properties_rels pr JOIN properties p ON pr.parent_id = p.id WHERE pr.path = 'relatedItineraries' AND pr.itineraries_id = 23 ORDER BY p.name;

-- ContentProjects created
SELECT id, title, content_type, stage, target_collection, target_record_id FROM content_projects WHERE origin_pathway = 'cascade' ORDER BY id;

-- Job record
SELECT id, job_type, status, progress, error FROM content_jobs WHERE job_type = 'cascade' ORDER BY id DESC LIMIT 1;
```

## Step 5: Idempotency

Run the same cascade again:

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Verify no duplicates:

```sql
SELECT COUNT(*) FROM destinations WHERE type = 'destination';
-- Must match Step 4 count

SELECT COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade';
-- Must match Step 4 count

SELECT name, COUNT(*) FROM destinations GROUP BY name HAVING COUNT(*) > 1;
-- Must return 0 rows

SELECT target_record_id, target_collection, COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade' GROUP BY target_record_id, target_collection HAVING COUNT(*) > 1;
-- Must return 0 rows
```

## Step 6: Second Itinerary (Itinerary 24 — South Africa & Mozambique)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 24}'
```

Record response. Verify:

```sql
SELECT id, name, slug, type, country_id FROM destinations WHERE type = 'destination' ORDER BY id;
SELECT COUNT(*) FROM properties;
SELECT id, title, content_type, target_record_id FROM content_projects WHERE origin_pathway = 'cascade' ORDER BY id;
SELECT destinations_id FROM itineraries_rels WHERE parent_id = 24 AND path = 'destinations' ORDER BY destinations_id;
```

## Step 7: Jobs API

```bash
curl "https://kiuli.com/api/content/jobs?type=cascade" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET"
```

Should list all cascade jobs. All should show status = 'completed'.

## Report

Create `content-engine/reports/phase5-itinerary-cascade.md` with:

1. Deployment verification (status codes)
2. Baseline counts
3. Dry run response summary
4. Full cascade response summary for itinerary 23
5. All DB query outputs from Step 4 (paste actual results)
6. Idempotency counts and duplicate check results
7. Itinerary 24 results
8. Jobs API response
9. Summary table:

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Auth rejection | 401 | ? | ? |
| Dry run entities | 1 country, ~4 locations, 4 properties | ? | ? |
| Dry run no DB changes | baselines unchanged | ? | ? |
| Destinations created | new park-level with country links | ? | ? |
| Properties unchanged | 33 | ? | ? |
| Relationships populated | bidirectional links present | ? | ? |
| ContentProjects created | destination_page + property_page at idea | ? | ? |
| Job completed | status=completed, 5 steps | ? | ? |
| Idempotency | 0 duplicates | ? | ? |
| Itinerary 24 | new SA/Moz locations + projects | ? | ? |
| Jobs API | all completed | ? | ? |

If ANY step fails, stop immediately. Report the failure with the full error output. Do not continue past a failure.
