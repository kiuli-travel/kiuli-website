# Auth Bypass Fix Report

**Date:** February 13, 2026
**Executor:** Claude CLI (Tactician)
**Prompt:** `content-engine/prompts/fix-auth-bypass.md`

---

## 1. API Key Generation

**Method:** Direct SQL + crypto (Option C script hung on `payload.update()`)

Generated a new UUID API key: `fba2a52f-0d62-4acc-bce0-65b42c5bdf51`

Computed HMAC-SHA256 using Payload's derived secret:
- Payload derives its internal secret: `crypto.createHash('sha256').update(config.secret).digest('hex').slice(0, 32)`
- The HMAC is computed with this derived secret, NOT the raw PAYLOAD_SECRET
- Stored the correct HMAC hash in the `api_key_index` column

Database update:
```sql
UPDATE users SET
  enable_a_p_i_key = true,
  api_key_index = '05fb9897802c1c677b3aacec710b75bffc00e21a32207cb44e46b5febf54b191'
WHERE id = 1;
```

---

## 2. req.user Verification

```
GET /api/users/me with Authorization: users API-Key fba2a52f-...
Response: {"user":{"id":1,"name":"Graham Wallington","email":"graham@kiuli.com","collection":"users","_strategy":"api-key"}}
```

`req.user` is populated. Strategy: `api-key` (Payload built-in).

---

## 3. Files Modified (8 collections)

| File | Changes |
|------|---------|
| `src/collections/Destinations.ts` | Removed `authenticatedOrApiKey` function, added `authenticated` import, replaced in create/update |
| `src/collections/TripTypes.ts` | Removed `authenticatedOrApiKey` function, added `authenticated` import, replaced in create/update |
| `src/collections/ImageStatuses.ts` | Removed `authenticatedOrApiKey` function, replaced in read/create/update |
| `src/collections/Properties.ts` | Removed `authenticatedOrApiKey` function, replaced in create/update |
| `src/collections/Media.ts` | Removed `authenticatedOrApiKey` function, replaced in create/update |
| `src/collections/Notifications/index.ts` | Removed `authenticatedOrApiKey` function, replaced in create/read/update |
| `src/collections/ItineraryJobs/index.ts` | Removed `authenticatedOrApiKey` function, replaced in create/read/update |
| `src/collections/Itineraries/index.ts` | Removed both `authenticatedOrApiKey` AND `apiKeyOnlyCreate` functions, replaced in read/create/update |

**Total: -147 lines, +30 lines (8 files)**

Preserved:
- `read: () => true` on Destinations, Properties, TripTypes (public read)
- `read: anyone` on Media (public read)
- `delete: authenticated` on all collections that had it
- `delete: ({ req }) => !!req.user` on Destinations, TripTypes

Zero instances of `authenticatedOrApiKey` or `apiKeyOnlyCreate` remain:
```
grep -rn "authenticatedOrApiKey\|apiKeyOnlyCreate" src/ → No matches
```

---

## 4. Test Results

| # | Test | Expected | Actual | Pass |
|---|------|----------|--------|------|
| 1 | `/api/users/me` with new key | User id=1 | User id=1 | YES |
| 2 | Create itinerary-job with new key | 201 | 201 | YES |
| 3 | Public read `/api/properties` (no auth) | 200 | 200 | YES |
| 4 | Public read `/api/destinations` (no auth) | 200 | 200 | YES |
| 5 | **Fake key rejected** | 403 | 403 | YES |
| 6 | **Old key rejected** | 403 | 403 | YES |
| 7 | No auth header rejected | 403 | 403 | YES |
| 8 | Admin panel | 200 | 200 | YES |

**Tests 5 and 6 are the critical ones** — they prove the vulnerability is closed.

---

## 5. Vercel Env Var Update

```
PAYLOAD_API_KEY removed from production
PAYLOAD_API_KEY added to production (new key)
Verified: PAYLOAD_API_KEY    Encrypted    Production    confirmed
```

---

## 6. Lambda Env Var Update

| Function | Updated | Previous Key Prefix |
|----------|---------|---------------------|
| kiuli-v6-orchestrator | YES (2026-02-13T14:31:06Z) | 3254681a... |
| kiuli-v6-image-processor | YES (2026-02-13T14:31:07Z) | 3254681a... |
| kiuli-v6-labeler | YES (2026-02-13T14:31:09Z) | 3254681a... |
| kiuli-v6-finalizer | YES (2026-02-13T14:31:10Z) | 3254681a... |
| kiuli-v6-video-processor | YES (2026-02-13T14:31:12Z) | 3254681a... |
| kiuli-pipeline-worker | YES (2026-02-13T14:31:13Z) | 4ea3d6c7... |
| kiuli-scraper | SKIPPED (no PAYLOAD_API_KEY env var) | N/A |

---

## 7. Build Output

```
npm run build → PASSED
Sitemap generated: https://kiuli.com/sitemap.xml
```

---

## 8. Git Commit

```
66c4ed3 security: fix authentication bypass in 8 collections
```

Pushed to `origin/main`. Deployed to production via `vercel --prod`.

---

## Key Discovery: Payload Secret Derivation

The initial API key setup failed because Payload does NOT use the raw `PAYLOAD_SECRET` as the HMAC key. Instead:

```javascript
// Payload source: node_modules/payload/dist/index.js:312
this.secret = crypto.createHash('sha256').update(this.config.secret).digest('hex').slice(0, 32);
```

This means:
1. Raw `PAYLOAD_SECRET` from env var (44 chars, base64) → SHA-256 hash → hex → first 32 chars
2. The derived 32-char hex string is used as `payload.secret`
3. HMAC-SHA256 of the API key is computed with this derived secret

This is NOT documented in Payload's official docs. The `api_key_index` must be computed using the derived secret, not the raw env var.

---

## New API Key

**Graham: The new PAYLOAD_API_KEY is `fba2a52f-0d62-4acc-bce0-65b42c5bdf51`**

The old key `3254681a-3967-4c75-a6fb-522c425a5e75` is now dead — it returns 403 on all write endpoints.
