# PHASE 3 FIX EVIDENCE REPORT

**Date:** 2026-01-31
**Issue:** HubSpot property internal names mismatch

---

## 1. FILE UPDATED

**Path:** `src/lib/hubspot.ts`

**Property name corrections:**

| Before (incorrect) | After (correct) |
|--------------------|-----------------|
| `traffic_source` | `kiuli_traffic_source` |
| `landing_page_url` | `kiuli_landing_page` |
| `projected_profit` | `kiuli_projected_profit` |
| `inquiry_type` (on Contact) | `kiuli_inquiry_type` (moved to Deal) |

**Verified properties (from grep output):**
```
11:  kiuli_gclid?: string
12:  kiuli_traffic_source?: string
13:  kiuli_landing_page?: string
14:  kiuli_session_id?: string
22:  kiuli_projected_profit?: string
23:  kiuli_inquiry_type?: string
78:  properties: ['email', 'firstname', 'lastname', 'kiuli_gclid', 'kiuli_traffic_source'],
179: kiuli_session_id: data.sessionId || undefined,
183: if (!existingContact.properties.kiuli_gclid && data.gclid) {
184:   updateProps.kiuli_gclid = data.gclid
186: if (!existingContact.properties.kiuli_traffic_source && (data.gclid || data.utmSource)) {
187:   updateProps.kiuli_traffic_source = mapTrafficSource(data.gclid, data.utmSource)
201: kiuli_gclid: data.gclid || undefined,
202: kiuli_traffic_source: mapTrafficSource(data.gclid, data.utmSource),
203: kiuli_landing_page: data.landingPage || undefined,
204: kiuli_session_id: data.sessionId || undefined,
218: kiuli_projected_profit: String(dealAmount),
219: kiuli_inquiry_type: data.inquiryType,
```

---

## 2. BUILD

```
Command: npm run build
Exit code: 0
Status: SUCCESS (warnings only, no errors)
```

---

## 3. GIT

```
Commit hash: 2a17540
Message: Fix HubSpot property internal names to match portal configuration
Push: SUCCESS to origin/main
```

---

## 4. DEPLOY

```
Deployment URL: https://kiuli-website-849dgwq1b-kiuli.vercel.app
Inspect URL: https://vercel.com/kiuli/kiuli-website/Au55R46iTEqWrpZR7RznfLLAsvDi
Production: kiuli.com
```

---

## 5. PRODUCTION TESTS

### Test 1: fixtest-phase3@kiuli.com
```json
{
  "success": true,
  "inquiry_id": 10,
  "message": "Inquiry received"
}
```
**Status code:** 201
**Response time:** ~5 seconds (indicates HubSpot API calls executed)

### Test 2: logtest-phase3@kiuli.com
```json
{
  "success": true,
  "inquiry_id": 11,
  "message": "Inquiry received"
}
```
**Status code:** 201

---

## 6. VERCEL LOGS

**Before fix (errors visible):**
```
HubSpot API error 400: Property "traffic_source" does not exist
Property "inquiry_type" does not exist
Property "landing_page_url" does not exist
```

**After fix:**
- No HubSpot errors in logs
- Only standard Payload warning about email adapter
- Requests complete successfully

---

## AWAITING GRAHAM VERIFICATION

Please check HubSpot for these contacts:

1. **fixtest-phase3@kiuli.com**
   - Contact should exist with:
     - `kiuli_gclid` = "fix-gclid-001"
     - `kiuli_traffic_source` = "google_ads"
     - `kiuli_landing_page` = "https://kiuli.com/safaris/serengeti"
   - Deal should exist with amount = $10,000

2. **logtest-phase3@kiuli.com**
   - Contact should exist with:
     - `kiuli_traffic_source` = "ai_search" (from utm_source=chatgpt)
   - Deal should exist with amount = $6,000

3. **Payload Admin (admin.kiuli.com)**
   - Inquiry ID 10: Should have `hubspotContactId` and `hubspotDealId` populated
   - Inquiry ID 11: Should have `hubspotContactId` and `hubspotDealId` populated

---

## PHASE 3 FIX STATUS: COMPLETE - AWAITING VERIFICATION

The code has been fixed and deployed. HubSpot API calls are no longer returning property errors.
Graham must verify contacts and deals were created in HubSpot.
