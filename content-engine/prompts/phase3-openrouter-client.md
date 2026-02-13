# Phase 3: OpenRouter Client + Test Endpoint

**Date:** February 13, 2026  
**Author:** Claude (Strategist)  
**Executor:** Claude CLI (Tactician)  
**Depends on:** Phase 2.5 (complete)  
**Specification:** KIULI_CONTENT_SYSTEM_DEVELOPMENT_PLAN_V4.md Phase 3

---

## Problem

`content-system/openrouter-client.ts` is a stub with type declarations only. The content engine needs a real OpenRouter client that reads model identifiers from the ContentSystemSettings global and provides retry logic. A test endpoint is needed to verify connectivity.

---

## Outcomes

1. `content-system/openrouter-client.ts` is a real implementation with `getModel()` and `callModel()`
2. Model identifiers are read from the ContentSystemSettings global via Payload Local API (not hardcoded)
3. Retry logic: 1 retry with 5-second backoff on 429 or 5xx responses
4. Non-retryable errors (400, 401, 403) throw immediately with clear error messages
5. Test endpoint at `src/app/(payload)/api/content/test-connection/route.ts` verifies connectivity
6. Test endpoint is authenticated with CONTENT_SYSTEM_SECRET
7. `npm run build` passes
8. Existing `src/services/enhancer.ts` is NOT modified (separate concern)

---

## Context

### ContentSystemSettings Global

Database: `content_system_settings` table. Payload slug: `content-system-settings`.

Model fields and their purposes:
- `ideationModel` — ideation and filtering (default: `anthropic/claude-sonnet-4-20250514`)
- `researchModel` — research synthesis
- `draftingModel` — content drafting
- `editingModel` — conversation editing
- `imageModel` — image prompt generation
- `embeddingModel` — embeddings (not used by this client, handled by embedder.ts)

Access: `read: () => true` (public read, no auth needed to fetch settings).

### Environment

- `OPENROUTER_API_KEY` — API key for OpenRouter
- `CONTENT_SYSTEM_SECRET` — Bearer token for content engine endpoints

### Existing OpenRouter Usage

`src/services/enhancer.ts` already calls OpenRouter for itinerary content enhancement. It's a separate service for the editorial workflow — do NOT modify it. The content-system client is for the content engine pipeline.

---

## Implementation

### openrouter-client.ts

Replace the stub. Keep the existing exported interfaces (OpenRouterRequest, OpenRouterResponse) but add the new functions.

```typescript
// Purpose-to-model mapping
type ModelPurpose = 'ideation' | 'research' | 'drafting' | 'editing' | 'image'

// getModel(purpose): reads from ContentSystemSettings global
// Uses Payload Local API: getPayload({ config }) then payload.findGlobal({ slug: 'content-system-settings' })
// Returns the model string for the given purpose
// If the global has no value for that purpose, return the default: 'anthropic/claude-sonnet-4-20250514'

// callModel(purpose, messages, options?): 
// 1. Calls getModel(purpose) to get the model identifier
// 2. Calls OpenRouter API at https://openrouter.ai/api/v1/chat/completions
// 3. Headers: Authorization Bearer OPENROUTER_API_KEY, Content-Type application/json, HTTP-Referer https://kiuli.com, X-Title Kiuli Content Engine
// 4. Body: { model, messages, max_tokens: options.maxTokens || 4096, temperature: options.temperature || 0.7 }
// 5. On success: parse response, return OpenRouterResponse
// 6. On 429 or 5xx: wait 5 seconds, retry once. If second attempt fails, throw.
// 7. On 400/401/403/404: throw immediately with status and error body.
// 8. If OPENROUTER_API_KEY is not set: throw immediately with clear message.
```

OpenRouter response format:
```json
{
  "choices": [{ "message": { "content": "..." } }],
  "model": "anthropic/claude-sonnet-4-20250514",
  "usage": { "prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150 }
}
```

Map to OpenRouterResponse:
- `content` = `choices[0].message.content`
- `model` = `response.model`
- `usage.promptTokens` = `usage.prompt_tokens`
- `usage.completionTokens` = `usage.completion_tokens`  
- `usage.totalTokens` = `usage.total_tokens`

### Test Endpoint

Create `src/app/(payload)/api/content/test-connection/route.ts`:

```typescript
// POST /api/content/test-connection
// Authentication: Authorization: Bearer <CONTENT_SYSTEM_SECRET>
// No request body needed
// 
// 1. Validate the Bearer token matches process.env.CONTENT_SYSTEM_SECRET
// 2. If not: return 401
// 3. Call callModel('ideation', [{ role: 'user', content: 'Respond with exactly: "Content engine connected"' }], { maxTokens: 50, temperature: 0 })
// 4. Return: { status: 'connected', model: response.model, response: response.content, usage: response.usage }
// 5. On error: return { status: 'error', error: error.message } with 500

export const maxDuration = 30
export const dynamic = 'force-dynamic'
```

Authentication pattern — simple Bearer token check:
```typescript
const authHeader = request.headers.get('Authorization')
if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Step-by-Step Execution

### Step 1: Implement openrouter-client.ts

Replace the stub at `content-system/openrouter-client.ts`. Keep the existing type exports. Add:
- `getModel(purpose: ModelPurpose): Promise<string>`
- `callModel(purpose: ModelPurpose, messages: Array<{role, content}>, options?): Promise<OpenRouterResponse>`

### Step 2: Test getModel locally

```bash
npx tsx -e "
const { getModel } = require('./content-system/openrouter-client');
async function test() {
  const model = await getModel('ideation');
  console.log('Ideation model:', model);
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
"
```

Must return `anthropic/claude-sonnet-4-20250514` (or whatever is in the global).

### Step 3: Test callModel locally

```bash
npx tsx -e "
const { callModel } = require('./content-system/openrouter-client');
async function test() {
  const result = await callModel('ideation', [
    { role: 'user', content: 'Respond with exactly: \"Content engine connected\"' }
  ], { maxTokens: 50, temperature: 0 });
  console.log('Model:', result.model);
  console.log('Content:', result.content);
  console.log('Usage:', result.usage);
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
"
```

Must return a response with content and usage stats.

### Step 4: Create test endpoint

Create `src/app/(payload)/api/content/test-connection/route.ts`.

### Step 5: Build

```bash
npm run build
```

Must pass.

### Step 6: Deploy and test

```bash
git add -A
git stash
vercel --prod
git stash pop
```

Wait for deploy, then test:

```bash
# Positive test — valid auth
curl -s -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json"
# Must return { status: 'connected', model: '...', response: '...', usage: {...} }

# Negative test — no auth
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/test-connection
# Must return 401

# Negative test — wrong token
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer wrong-token"
# Must return 401
```

### Step 7: Commit

```bash
git add -A
git commit -m "feat(content-engine): Phase 3 — OpenRouter client + test endpoint

Replaced openrouter-client.ts stub with real implementation.
Reads model identifiers from ContentSystemSettings global.
Retry logic: 1 retry with 5s backoff on 429/5xx.
Test endpoint at /api/content/test-connection with CONTENT_SYSTEM_SECRET auth."
git push
```

---

## Do Not

- Do NOT modify `src/services/enhancer.ts` — it's a separate service for editorial enhancement
- Do NOT install npm packages (use fetch directly)
- Do NOT hardcode model identifiers — read from ContentSystemSettings
- Do NOT create Lambda functions
- Do NOT modify collection definitions
- Do NOT cache the ContentSystemSettings global (always read fresh — settings can change)

---

## Gate Evidence

```bash
# 1. Build passes
npm run build 2>&1 | tail -5

# 2. Test endpoint returns connected with valid auth
curl -s -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json"
# Must show status: connected, model name, response text

# 3. Test endpoint rejects invalid auth
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer wrong-token"
# Must return 401

# 4. No hardcoded model strings in openrouter-client.ts (except the default fallback)
grep -n "anthropic\|openai\|claude" content-system/openrouter-client.ts
# Should only appear in the default fallback constant, not in callModel

# 5. Existing enhance endpoint still works (not broken)
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/enhance
# Should return 401 or 400 (not 500 or 404)
```

---

## Report

Write report to `content-engine/reports/phase3-openrouter-client.md` with:

1. Local getModel test output
2. Local callModel test output (model, content, usage)
3. Test endpoint positive result
4. Test endpoint negative results (both)
5. Build output
6. Git commit hash

Then update `content-engine/status.md` — mark Phase 3 as COMPLETED only if every gate passes.
