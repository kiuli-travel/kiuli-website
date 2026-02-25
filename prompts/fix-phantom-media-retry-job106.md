# Fix Phantom Media IDs + Retry Job 106 + Complete Production Scrape
## For Claude Code (CLI)

**Context:** Root cause of the Job 106 finalizer 500 is confirmed.
`disableLocalStorage` was not set in the S3 plugin. Payload wrote to both the local
filesystem and S3 on every media creation. On Vercel serverless the local write fails
intermittently, Payload cleans up by deleting the just-committed DB row, but the 200
response with the media ID has already been sent. The image processor trusted the
response and wrote the phantom ID into ImageStatus as complete.

Two fixes are required:
1. `src/plugins/s3Storage.ts` — already written and committed by strategic Claude
2. `lambda/image-processor/processImage.js` — read-back verification (CLI to apply)

---

## Phase A: Apply read-back verification to processImage.js

Open `lambda/image-processor/processImage.js`. Find this exact block at the end of
`createMediaRecord()`:

```javascript
  const media = await response.json();
  return media.doc?.id || media.id;
}
```

Replace it with:

```javascript
  const media = await response.json();
  const mediaId = media.doc?.id || media.id;

  // Verify the record actually exists before returning the ID.
  // Payload can return a 200 with an ID and then delete the record if the storage
  // backend persistence fails (e.g. local filesystem write on Vercel serverless).
  // Without this check, phantom IDs propagate into ImageStatus and cause the
  // finalizer's PATCH to fail with a 500 on relationship validation.
  const verifyRes = await fetch(
    `${payload.PAYLOAD_API_URL}/api/media/${mediaId}?depth=0`,
    { headers: { 'Authorization': `users API-Key ${payload.PAYLOAD_API_KEY}` } }
  );
  if (!verifyRes.ok) {
    throw new Error(
      `[createMediaRecord] Phantom ID detected: media ${mediaId} was not persisted ` +
      `(verification GET returned ${verifyRes.status}). Storage backend likely failed.`
    );
  }

  console.log(`[createMediaRecord] Verified: media ${mediaId} exists`);
  return mediaId;
}
```

After the edit, verify:

```bash
grep -n "Verified: media\|Phantom ID detected" lambda/image-processor/processImage.js
node --check lambda/image-processor/processImage.js
```

Expected: 2 matches, exit 0.

---

## Phase B: Deploy both fixes

### B1: Deploy s3Storage change to Vercel

The `src/plugins/s3Storage.ts` change must be built and deployed:

```bash
cd /Users/grahamwallington/Projects/kiuli-website
npm run build 2>&1 | tail -20
```

If build passes:

```bash
vercel --prod 2>&1 | tail -10
```

Report full output. Stop if build fails.

### B2: Deploy image-processor Lambda

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./deploy.sh image-processor
```

Report full output. Stop if deploy fails.

---

## Phase C: Commit

After both deploys succeed:

```bash
git add src/plugins/s3Storage.ts lambda/image-processor/processImage.js
```

Commit message:
```
fix(media): disable local storage + add read-back verification

Root cause: disableLocalStorage was not set in the S3 plugin. Payload
attempted to write uploaded files to both the local filesystem and S3.
On Vercel serverless the local write fails intermittently, triggering
Payload's internal cleanup which deletes the just-committed media row
after the 200 response has already been sent. The image processor
received a valid ID, stored it in ImageStatus as complete, and the
finalizer later failed with a 500 when validating the phantom relationship.

Fix 1: disableLocalStorage: true in s3Storage plugin — eliminates the
local filesystem write entirely, preventing the cleanup deletion.

Fix 2: Read-back GET verification in createMediaRecord — throws
immediately if the media row does not exist after creation, so the image
is marked failed rather than propagating a phantom ID downstream.
```

Push.

---

## Phase D: Retry finalizer for Job 106 / itinerary 39

Invoke the finalizer Lambda directly for Job 106:

```bash
aws lambda invoke \
  --function-name kiuli-v6-finalizer \
  --region eu-north-1 \
  --payload '{"jobId": "106", "itineraryId": "39"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/finalizer_106_retry.json \
  && cat /tmp/finalizer_106_retry.json
```

Then check itinerary 39 state:

```bash
psql $DATABASE_URL_UNPOOLED -c "
SELECT id, title, _status,
  publish_checklist_all_images_processed,
  publish_checklist_hero_image_selected,
  publish_checklist_schema_generated
FROM itineraries WHERE id = 39;
"
```

Report both outputs. If the finalizer returns an error, stop and report — do not
proceed to Phase E.

---

## Phase E: Complete the production scrape — URL_5 and URL_6

Only after Phase D confirms itinerary 39 is recovered.

```
URL_5: https://itrvl.com/client/portal/RySYf1f1xoKGC2UaZGLIuS9GT8Qb3vTmcSBfGGN94rUciM7xo09kEW07FGI3I8h3/680df1803cf205005cf76e37
URL_6: https://itrvl.com/client/portal/SJK1xYm749VERKthohc6iSVAHZY5mZdBFIDkxcdiZIuK4O554kXRCEvNum9yVpFm/680df8bb3cf205005cf76e57
```

Scrape sequentially. Trigger URL_5, poll until complete, then trigger URL_6.

For each:

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "URL_N", "mode": "create"}'
```

Poll every 30 seconds. If either job fails, stop immediately and report the full error.

---

## Phase F: Final verification

After all jobs complete, run to file and cat:

```bash
psql $DATABASE_URL_UNPOOLED > /tmp/final_state.txt 2>&1 <<'SQL'
SELECT id, title, slug FROM itineraries ORDER BY id;

SELECT
  p.name,
  p.accumulated_data_observation_count AS obs_count,
  d.name AS destination,
  d.type AS dest_type
FROM properties p
JOIN destinations d ON d.id = p.destination_id
ORDER BY p.accumulated_data_observation_count DESC, p.name;

SELECT COUNT(*) AS transfer_routes FROM transfer_routes;
SELECT COUNT(*) AS airports FROM airports;
SELECT COUNT(*) AS activities FROM activities;
SELECT COUNT(*) AS service_items FROM service_items;
SELECT COUNT(*) AS itinerary_patterns FROM itinerary_patterns;
SQL
cat /tmp/final_state.txt
```

Paste the full output.

---

## Report back with

1. grep + node --check output (Phase A)
2. Full build + Vercel deploy output (Phase B1)
3. Full Lambda deploy output (Phase B2)
4. Git commit hash (Phase C)
5. Finalizer Lambda response + itinerary 39 SQL (Phase D)
6. Job IDs and completion status for URL_5 and URL_6 (Phase E)
7. Full untruncated Phase F output
