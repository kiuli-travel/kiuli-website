# Production Scrape: All 6 Remaining iTrvl Itineraries
## For Claude Code (CLI)

**Context:** The pipeline is verified clean. One Tanzania test itinerary is already
in the database (Job 99, itinerary 32). Do NOT clean the database. Scrape the 6
remaining itineraries sequentially — one at a time, poll until complete before
starting the next.

**Why sequential:** Knowledge base writes (properties, transfer routes, activity
observations) are not safe for concurrent execution. Two jobs writing to the same
property simultaneously will corrupt observation counts.

---

## The 6 URLs to scrape

```
URL_1: https://itrvl.com/client/portal/sDafv7StYWDPEpQdzRZz4FB9ibXs803AxtuQ48eH15ixoHKVg3R5YvxOFCUZMzFa/680dff493cf205005cf76e8f
URL_2: https://itrvl.com/client/portal/Ir0nIrtJMhtj3RUzrj8Qyqw7XTIyA4NGk22g52ZHTmhD6IcgxNcRUNwhXTKXbgKa/680df70720a6c6005b2bfc34
URL_3: https://itrvl.com/client/portal/Op4IPe4KvCsHC7QuCxjWLQEa0JlM5eVGE0vAGUD9yRnUmAIwpwstlE85upkxlfTJ/680dfc35819f37005c255a29
URL_4: https://itrvl.com/client/portal/GCDp9oahYn8nuuwhp8b3JvnUWpO51RUTAcHT6w5fL8WvhDVbCq5bhceamIcQGBQV/680df9b0819f37005c255a1c
URL_5: https://itrvl.com/client/portal/RySYf1f1xoKGC2UaZGLIuS9GT8Qb3vTmcSBfGGN94rUciM7xo09kEW07FGI3I8h3/680df1803cf205005cf76e37
URL_6: https://itrvl.com/client/portal/SJK1xYm749VERKthohc6iSVAHZY5mZdBFIDkxcdiZIuK4O554kXRCEvNum9yVpFm/680df8bb3cf205005cf76e57
```

---

## Process for each URL

### Step 1: Trigger scrape

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "URL_N", "mode": "create"}'
```

Note the job ID from the response.

### Step 2: Poll until complete

Poll every 30 seconds. Stop when status is `complete` or `failed`.

```bash
curl -s "https://admin.kiuli.com/api/itinerary-jobs/JOB_ID" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('currentPhase'), d.get('status'))"
```

### Step 3: If failed — stop immediately

If any job returns `status: failed`, stop and report:
- Which URL failed
- The full error message from the job record
- Do not proceed to the next URL

### Step 4: Report and continue

If `status: complete`, record the job ID and itinerary ID, then proceed to the next URL.

---

## Execute all 6 in order

Work through URL_1 → URL_2 → URL_3 → URL_4 → URL_5 → URL_6 sequentially.

For each, report when triggering and when complete:

```
[URL_1] Triggered — Job ID: XXX
[URL_1] Complete — Itinerary ID: XXX
[URL_2] Triggered — Job ID: XXX
...
```

---

## Final verification

After all 6 complete successfully, run this query and paste the full output:

```bash
psql $DATABASE_URL_UNPOOLED -c "
SELECT
  i.id AS itinerary_id,
  i.title,
  i.slug,
  i._status
FROM itineraries i
ORDER BY i.id;
"
```

Then:

```bash
psql $DATABASE_URL_UNPOOLED -c "
SELECT
  p.name,
  p.accumulated_data_observation_count AS obs_count,
  d.name AS destination,
  d.type AS dest_type
FROM properties p
JOIN destinations d ON d.id = p.destination_id
ORDER BY p.accumulated_data_observation_count DESC, p.name;
"
```

Then:

```bash
psql $DATABASE_URL_UNPOOLED -c "
SELECT COUNT(*) AS total_transfer_routes FROM transfer_routes;
SELECT COUNT(*) AS total_airports FROM airports;
SELECT COUNT(*) AS total_activities FROM activities;
SELECT COUNT(*) AS total_service_items FROM service_items;
SELECT COUNT(*) AS total_itinerary_patterns FROM itinerary_patterns;
"
```

Paste all output untruncated. If any query output is cut off, write to file and cat:

```bash
psql $DATABASE_URL_UNPOOLED > /tmp/final_verification.txt 2>&1 <<'SQL'
-- [paste queries here]
SQL
cat /tmp/final_verification.txt
```

---

## Report back with

1. Job ID and itinerary ID for each of the 6 scrapes
2. Any failures — full error, stop immediately
3. Full untruncated output of the three final verification queries
