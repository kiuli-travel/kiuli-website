# PHASE 14a — Hotfix: Version Table Columns + imgixUrl

Two bugs found in production after Phase 14a deploy.

---

## BUG 1 — Version table columns missing

The migration `20260219_add_image_generation_fields` added columns to `media` and `content_projects` but NOT to their version tables (`_media_v` and `_content_projects_v`). Both collections have versioning enabled. Any update that triggers a version insert crashes with a SQL error referencing missing columns.

### Fix

Create a new migration: `src/migrations/20260219_fix_version_table_columns.ts`

Add these columns (idempotent, same pattern as the existing migration):

**`_content_projects_v`:**
- `version_article_images` jsonb

**`_media_v`:**
- `version_generation_prompt` text
- `version_generation_model` varchar
- `version_generated_at` timestamp(3) with time zone

Register the migration in `src/migrations/index.ts`.

### Verification

```bash
echo "=== Version table fix ===" > content-engine/evidence/phase14a-hotfix.txt

# Run the migration (it will run on next build or can be triggered)
# Check columns exist after
```

After migration runs, verify with SQL:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = '_content_projects_v' AND column_name = 'version_article_images';
SELECT column_name FROM information_schema.columns WHERE table_name = '_media_v' AND column_name LIKE 'version_generation%';
SELECT column_name FROM information_schema.columns WHERE table_name = '_media_v' AND column_name = 'version_generated_at';
```

All must return rows. Zero rows = FAIL.

---

## BUG 2 — Generated images have no imgixUrl

`upload-pipeline.ts` computes an imgixUrl fallback but never writes it back to the Media record:

```typescript
const imgixUrl = createdDoc.imgixUrl ||
    `https://kiuli.imgix.net/${createdDoc.filename}?auto=format,compress&q=80`
```

This value is returned in `UploadResult` but the Media record's `imgixUrl` field stays null.

### Fix

In `upload-pipeline.ts`, after creating the Media record, if `createdDoc.imgixUrl` is falsy, update the record:

```typescript
if (!createdDoc.imgixUrl && createdDoc.filename) {
  const computedImgixUrl = `https://kiuli.imgix.net/${createdDoc.filename}?auto=format,compress&q=80`
  await payload.update({
    collection: 'media',
    id: mediaId,
    data: { imgixUrl: computedImgixUrl },
  })
}
```

### Backfill existing generated images

Write a one-time script or add to migration: update all 6 existing generated images that have null imgixUrl:

```sql
UPDATE media
SET imgix_url = 'https://kiuli.imgix.net/' || filename || '?auto=format,compress&q=80'
WHERE source_s3_key LIKE 'generated:%' AND imgix_url IS NULL AND filename IS NOT NULL;
```

### Verification

```bash
echo "=== imgixUrl fix ===" >> content-engine/evidence/phase14a-hotfix.txt
```

Query to verify:
```sql
SELECT id, imgix_url IS NOT NULL AS has_url FROM media WHERE source_s3_key LIKE 'generated:%';
```

All rows must show `has_url = true`. Any `false` = FAIL.

---

## Execution order

1. Create the new migration with BOTH the version table fixes AND the imgixUrl backfill SQL
2. Register it in migrations/index.ts
3. Fix upload-pipeline.ts to write imgixUrl on future uploads
4. Run `npm run build` — must be EXIT: 0
5. Commit and push
6. After deploy, verify:
   - Version table columns exist (SQL queries above)
   - Generated images have imgixUrl (SQL query above)
   - Go to Image Library → generated images show previews (not "No preview")
   - Go to a workspace Images tab → click "+ Choose image" on an article image slot → no SQL error

### Evidence file

Write ALL verification results to `content-engine/evidence/phase14a-hotfix.txt`. Show me its contents before and after commit.

---

## Rules

- Do not modify the original migration file. Create a new one.
- Do not skip the backfill. Those 6 images need imgixUrl.
- Do not commit without a passing build.
- Do not declare success without the 4 post-deploy verifications.
