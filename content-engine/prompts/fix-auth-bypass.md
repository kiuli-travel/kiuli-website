# Fix: Authentication Bypass Vulnerability

**Date:** February 13, 2026  
**Author:** Claude (Strategist)  
**Executor:** Claude CLI (Tactician)  
**Priority:** Security fix — must complete before any other work

---

## Problem

8 collections have a fake auth function called `authenticatedOrApiKey` that does not actually validate credentials. It checks if the Authorization header **starts with** `Bearer ` or `users API-Key ` and grants full write access regardless of the actual value. Any request with `Authorization: users API-Key anything-at-all` gets create/update access to Itineraries, Destinations, Properties, Media, ItineraryJobs, ImageStatuses, Notifications, and TripTypes.

Root cause: The Users collection has `auth: { useAPIKey: true }` but Graham's user record (id=1) has `enable_a_p_i_key` = null and `api_key` = null. The API key was never enabled on the user. So Payload's built-in API key auth can't match any incoming key, `req.user` stays null, and the proper `authenticated` function returns false. The bypass was created to paper over this.

---

## Outcomes

1. Graham's user record has a real API key enabled and stored (hashed) by Payload
2. PAYLOAD_API_KEY env var on Vercel matches the new real key
3. Lambda env vars for PAYLOAD_API_KEY match the new real key
4. Every instance of `authenticatedOrApiKey` is removed from every collection file
5. All collections that had `authenticatedOrApiKey` now use the proper `authenticated` import from `src/access/authenticated.ts`
6. Lambda payload client works with the real key (req.user is populated, `authenticated` returns true)
7. All existing functionality (scraper pipeline, admin panel, API reads) continues to work

---

## Step 1: Enable API Key on User Record

Use Payload's admin panel or REST API to enable the API key on Graham's user.

**Option A — Via Payload Admin UI:**
1. Go to https://admin.kiuli.com/admin/collections/users/1
2. Scroll to API Key section
3. Check "Enable API Key"
4. Save
5. Copy the generated API key (it's shown once)

**Option B — Via REST API (if you have a valid session cookie):**
```bash
# First, log in to get a session token
curl -s -X POST https://admin.kiuli.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "graham@kiuli.com", "password": "PASSWORD_HERE"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','FAILED'))"

# Then enable API key
curl -s -X PATCH https://admin.kiuli.com/api/users/1 \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enableAPIKey": true}'
```

**Option C — Via Payload Local API script:**
Create a one-time script:

```typescript
// scripts/enable-api-key.ts
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function enableApiKey() {
  const payload = await getPayload({ config })
  const result = await payload.update({
    collection: 'users',
    id: 1,
    data: { enableAPIKey: true },
  })
  console.log('API Key enabled. Key:', result.apiKey)
  console.log('IMPORTANT: Save this key. It is shown once and stored hashed.')
  process.exit(0)
}

enableApiKey().catch(e => { console.error(e); process.exit(1) })
```

Run with: `npx tsx scripts/enable-api-key.ts`

**Whichever option you use, save the returned API key.** It is shown once. Payload stores only the hash.

---

## Step 2: Verify the New Key Works with Payload Auth

Test that the new key populates `req.user`:

```bash
# Use the NEW key (not the old one)
NEW_KEY="<the key from Step 1>"

# This should return user data (because req.user is now populated)
curl -s https://admin.kiuli.com/api/users/me \
  -H "Authorization: users API-Key $NEW_KEY"
```

This MUST return Graham's user record (id, name, email). If it returns 401 or null user, stop — the key isn't working.

---

## Step 3: Replace authenticatedOrApiKey in All Collections

These 8 files need fixing:

1. `src/collections/Destinations.ts`
2. `src/collections/ImageStatuses.ts`
3. `src/collections/Itineraries/index.ts`
4. `src/collections/ItineraryJobs/index.ts`
5. `src/collections/Media.ts`
6. `src/collections/Notifications/index.ts`
7. `src/collections/Properties.ts`
8. `src/collections/TripTypes.ts`

For each file:

1. **Remove** the `authenticatedOrApiKey` function definition entirely
2. **Add** the import: `import { authenticated } from '../access/authenticated'` (or `'../../access/authenticated'` for files in subdirectories)
3. **Replace** every usage of `authenticatedOrApiKey` in the `access` object with `authenticated`
4. **Exception:** If a collection has `read: () => true`, keep that — public read is intentional. Only replace `create`, `update`, and `delete` references.

**Verify** after each file that no reference to `authenticatedOrApiKey` remains:

```bash
grep -rn "authenticatedOrApiKey" src/collections/
```

Must return zero results.

---

## Step 4: Update PAYLOAD_API_KEY in Vercel

```bash
# Remove the old key
vercel env rm PAYLOAD_API_KEY production

# Add the new key
echo "$NEW_KEY" | vercel env add PAYLOAD_API_KEY production
```

Verify:
```bash
vercel env ls | grep PAYLOAD_API_KEY
```

---

## Step 5: Update Lambda Environment Variables

The Lambda functions use PAYLOAD_API_KEY from their environment. Update all deployed Lambda functions:

```bash
# List all kiuli Lambda functions
aws lambda list-functions --region eu-north-1 --query "Functions[?starts_with(FunctionName, 'kiuli')].FunctionName" --output text

# For each function, update the env var
for FUNC in kiuli-v6-orchestrator kiuli-v6-image-processor kiuli-v6-labeler kiuli-v6-finalizer kiuli-v6-video-processor; do
  echo "Updating $FUNC..."
  # Get current env vars
  CURRENT_ENV=$(aws lambda get-function-configuration --function-name $FUNC --region eu-north-1 --query 'Environment.Variables' --output json)
  
  # Update PAYLOAD_API_KEY (merge with existing vars)
  UPDATED_ENV=$(echo "$CURRENT_ENV" | python3 -c "
import sys, json
env = json.load(sys.stdin)
env['PAYLOAD_API_KEY'] = '$NEW_KEY'
print(json.dumps({'Variables': env}))
")
  
  aws lambda update-function-configuration \
    --function-name $FUNC \
    --region eu-north-1 \
    --environment "$UPDATED_ENV" \
    --query '{FunctionName: FunctionName, LastModified: LastModified}' \
    --output table
done
```

If any function doesn't exist or fails, report which one and the error.

---

## Step 6: Build and Test

```bash
npm run build
```

Must pass.

Then test the full auth chain:

```bash
NEW_KEY="<the key from Step 1>"

# 1. User lookup works (proves req.user is populated)
curl -s https://admin.kiuli.com/api/users/me \
  -H "Authorization: users API-Key $NEW_KEY"
# Must return user with id=1

# 2. Create itinerary job (was using authenticatedOrApiKey, now uses authenticated)
curl -s -X POST https://admin.kiuli.com/api/itinerary-jobs \
  -H "Authorization: users API-Key $NEW_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "pending", "itineraryId": "auth-test"}'
# Must return 201 (or 200) with created record — NOT 403

# 3. Read itineraries (public read — should still work without auth)
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/api/itineraries
# Must return 200

# 4. Read properties (public read)
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/api/properties
# Must return 200

# 5. Create a content project (uses authenticated — should now work)
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $NEW_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Auth Test", "stage": "idea", "contentType": "authority", "processingStatus": "idle"}'
# Must return created record — NOT 403

# 6. Negative test — invalid key must be rejected
curl -s -o /dev/null -w "%{http_code}" -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key totally-fake-key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Should Fail"}'
# MUST return 403 (not 200/201). This is the whole point.

# 7. Negative test — old key must be rejected
curl -s -o /dev/null -w "%{http_code}" -X POST https://admin.kiuli.com/api/itinerary-jobs \
  -H "Authorization: users API-Key 3254681a-3967-4c75-a6fb-522c425a5e75" \
  -H "Content-Type: application/json" \
  -d '{"status": "pending"}'
# MUST return 403

# 8. Admin panel still works
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/admin
# Must return 200

# Clean up test records
# Delete the itinerary job and content project created above
```

**Tests 6 and 7 are the critical ones.** If fake keys still get through, the fix is incomplete.

---

## Step 7: Delete One-Time Script

If you created `scripts/enable-api-key.ts`, delete it after use. It served its purpose.

---

## Step 8: Commit

```bash
git add -A
git commit -m "security: fix authentication bypass in 8 collections

Replaced authenticatedOrApiKey (which only checked header format, not
actual credentials) with proper authenticated function across all
collections. Enabled real API key on user record so Payload's built-in
API key auth populates req.user correctly.

Affected collections: Itineraries, Destinations, Properties, Media,
ItineraryJobs, ImageStatuses, Notifications, TripTypes."
git push
```

---

## Do Not

- Do NOT leave any instance of `authenticatedOrApiKey` in the codebase
- Do NOT skip the negative tests (6 and 7) — they prove the vulnerability is closed
- Do NOT change the `read: () => true` access on collections that have public read
- Do NOT modify content_embeddings
- Do NOT modify collection field definitions — only the access control
- Do NOT proceed if the new key doesn't populate `req.user` in Step 2

---

## Gate Evidence

Every one of these must pass:

```bash
# 1. Zero instances of authenticatedOrApiKey remain
grep -rn "authenticatedOrApiKey" src/
# Must return nothing

# 2. req.user populated with new key
curl -s https://admin.kiuli.com/api/users/me -H "Authorization: users API-Key $NEW_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('User:', d.get('user',{}).get('id','MISSING'))"
# Must print User: 1

# 3. Write access works with new key (test 5 above)
# Must return created record

# 4. Fake key rejected (test 6 above)  
# Must return 403

# 5. Old key rejected (test 7 above)
# Must return 403

# 6. Build passes
npm run build 2>&1 | tail -5

# 7. Public reads still work without auth
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/api/itineraries
# Must return 200
```

---

## Report

Write report to `content-engine/reports/auth-bypass-fix.md` with:

1. The new API key generation method used (UI, REST, or Local API)
2. Verification that req.user is populated
3. List of all 8 files modified with diff summary
4. All test results including negative tests
5. Vercel env var update confirmation
6. Lambda env var update confirmation (per function)
7. Build output
8. Git commit hash

**Graham will need to know the new PAYLOAD_API_KEY value** — include it in the report or communicate it separately. The old key `3254681a-3967-4c75-a6fb-522c425a5e75` is now dead.
