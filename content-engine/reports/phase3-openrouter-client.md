# Phase 3: OpenRouter Client + Test Endpoint Report

**Date:** February 13, 2026
**Executor:** Claude CLI (Tactician)
**Prompt:** `content-engine/prompts/phase3-openrouter-client.md`

---

## 1. getModel Test

ContentSystemSettings table has 0 rows — defaults apply for all purposes.

```
Default model: anthropic/claude-sonnet-4
```

**Note:** The prompt specified `anthropic/claude-sonnet-4-20250514` as the default, but this is not a valid OpenRouter model ID. Updated to `anthropic/claude-sonnet-4` (confirmed via OpenRouter `/v1/models` endpoint). Updated both `openrouter-client.ts` and `ContentSystemSettings.ts` global definition.

---

## 2. callModel Test (Local)

```
Status: 200
Model: anthropic/claude-sonnet-4
Content: Content engine connected
Usage: {"promptTokens":17,"completionTokens":6,"totalTokens":23}
```

---

## 3. Test Endpoint — Positive (Valid Auth)

```bash
curl -s -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json"
```

```json
{
  "status": "connected",
  "model": "anthropic/claude-sonnet-4",
  "response": "Content engine connected",
  "usage": {
    "promptTokens": 17,
    "completionTokens": 6,
    "totalTokens": 23
  }
}
```

---

## 4. Test Endpoint — Negative (No Auth)

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/test-connection
# 401
```

---

## 5. Test Endpoint — Negative (Wrong Token)

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/test-connection \
  -H "Authorization: Bearer wrong-token"
# 401
```

---

## 6. Build Output

```
npm run build → PASSED
Route: ƒ /api/content/test-connection (190 B, 102 kB)
Sitemap generated: https://kiuli.com/sitemap.xml
```

---

## 7. Files Created/Modified

**New files:**
- `src/app/(payload)/api/content/test-connection/route.ts` — Test endpoint

**Modified files:**
- `content-system/openrouter-client.ts` — Replaced stub with real implementation
- `src/globals/ContentSystemSettings.ts` — Fixed model IDs to valid OpenRouter IDs

---

## 8. Implementation Details

### openrouter-client.ts

- **`getModel(purpose)`**: Reads from ContentSystemSettings global via Payload Local API. Falls back to `anthropic/claude-sonnet-4` if field is empty or null.
- **`callModel(purpose, messages, options)`**: Resolves model via `getModel()`, calls OpenRouter API. Retry logic: 1 retry with 5s backoff on 429/5xx. Non-retryable errors (400/401/403/404) throw immediately.
- **`callOpenRouter(request)`**: Legacy export wrapping `callModel` for type compatibility.
- Headers: `HTTP-Referer: https://kiuli.com`, `X-Title: Kiuli Content Engine`

### test-connection endpoint

- `POST /api/content/test-connection`
- Auth: Bearer token matching `CONTENT_SYSTEM_SECRET`
- Calls `callModel('ideation', ...)` and returns connection status
- `maxDuration = 30`, `dynamic = 'force-dynamic'`

---

## 9. Model ID Correction

OpenRouter valid Claude models (as of Feb 13, 2026):
```
anthropic/claude-opus-4.6
anthropic/claude-opus-4.5
anthropic/claude-haiku-4.5
anthropic/claude-sonnet-4.5
anthropic/claude-opus-4.1
anthropic/claude-opus-4
anthropic/claude-sonnet-4
anthropic/claude-3.7-sonnet
anthropic/claude-3.5-sonnet
anthropic/claude-3.5-haiku
anthropic/claude-3-haiku
```

The prompt's default `anthropic/claude-sonnet-4-20250514` is not valid. Corrected to `anthropic/claude-sonnet-4`.

---

## 10. Gate Evidence

| Gate | Result |
|------|--------|
| Build passes | Yes |
| Test endpoint returns connected with valid auth | `{"status":"connected","model":"anthropic/claude-sonnet-4","response":"Content engine connected"}` |
| Test endpoint rejects no auth | 401 |
| Test endpoint rejects wrong token | 401 |
| No hardcoded model strings (except default constant) | Only `DEFAULT_MODEL = 'anthropic/claude-sonnet-4'` on line 20 |
| Existing enhance endpoint not broken | 405 (Method Not Allowed on GET — expected) |

All gates PASS.
