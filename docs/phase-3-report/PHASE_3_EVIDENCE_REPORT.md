# PHASE 3 EVIDENCE REPORT

**Date:** 2026-01-31
**Phase:** 3 of 11 — HubSpot Integration
**Status:** DEPLOYED - AWAITING GRAHAM VERIFICATION

---

## 1. FILES CREATED/MODIFIED

| File | Action | Lines |
|------|--------|-------|
| `src/lib/hubspot.ts` | CREATE | 239 |
| `src/app/(payload)/api/inquiry/route.ts` | MODIFY | +36 |

### src/lib/hubspot.ts (New File)
- `hubspotRequest()` - Base API caller with Bearer auth
- `searchContactByEmail()` - Search for existing contact by email
- `createContact()` - Create new HubSpot contact
- `updateContact()` - Update existing contact (PATCH)
- `createDeal()` - Create deal with contact association
- `mapTrafficSource()` - Map GCLID/UTM to traffic_source dropdown
- `createOrUpdateContactAndDeal()` - Main orchestration function

### src/app/(payload)/api/inquiry/route.ts (Modified)
- Added import: `import { createOrUpdateContactAndDeal } from '@/lib/hubspot'`
- Added HubSpot integration block after Payload create (lines 251-290)
- Non-blocking: HubSpot errors logged but don't fail request

---

## 2. BUILD

```
Command: npm run build
Exit code: 0
Build time: ~45 seconds
```

TypeScript compilation successful with no errors.

---

## 3. GIT

```
Commit hash: 5e9eabfa85c5dfd5e89478d572cc26b85bf6c2da
Message: Add HubSpot contact and deal creation to inquiry endpoint
Branch: main
Push: SUCCESS to origin/main
```

---

## 4. DEPLOY

```
URL: https://kiuli-website-hxd70d8ja-kiuli.vercel.app
Inspect: https://vercel.com/kiuli/kiuli-website/FgRbdvwVwDyb5f7QticBQ4EzYGhH
Production: kiuli.com
```

---

## 5. PRODUCTION TESTS

### Test A: New Contact with Full Attribution

**Request:**
```json
{
  "destinations": ["TZ"],
  "timing_type": "exploring",
  "party_type": "couple",
  "total_travelers": 2,
  "children_count": 0,
  "primary_interest": "migration",
  "budget_range": "40k-60k",
  "stated_budget_cents": 5000000,
  "projected_profit_cents": 1000000,
  "first_name": "HubSpot",
  "last_name": "TestOne",
  "email": "hubspot-test1@kiuli.com",
  "phone": "+12025551111",
  "phone_country_code": "US",
  "how_heard": "google",
  "marketing_consent": true,
  "session_id": "session-hs-001",
  "gclid": "test-gclid-phase3",
  "utm_source": "google",
  "landing_page": "https://kiuli.com/safaris/serengeti",
  "page_url": "https://kiuli.com/contact"
}
```

**Response:**
```json
{"success":true,"inquiry_id":7,"message":"Inquiry received"}
```

**Status:** 201 Created

**Expected HubSpot State:**
- Contact created with email `hubspot-test1@kiuli.com`
- `kiuli_gclid` = `test-gclid-phase3`
- `traffic_source` = `google_ads`
- Deal created with amount = $10,000 (1000000 cents / 100)

---

### Test B: Duplicate Contact (Same Email, Different Details)

**Request:**
```json
{
  "destinations": ["KE", "TZ"],
  "timing_type": "flexible",
  "travel_window_earliest": "2026-08",
  "travel_window_latest": "2026-10",
  "party_type": "family",
  "total_travelers": 4,
  "children_count": 2,
  "primary_interest": "big_cats",
  "budget_range": "60k-80k",
  "stated_budget_cents": 7000000,
  "projected_profit_cents": 1400000,
  "first_name": "HubSpot",
  "last_name": "TestOne",
  "email": "hubspot-test1@kiuli.com",
  "phone": "+12025552222",
  "phone_country_code": "US",
  "how_heard": "referral",
  "marketing_consent": true,
  "session_id": "session-hs-002",
  "gclid": "different-gclid-should-not-overwrite",
  "utm_source": "referral"
}
```

**Response:**
```json
{"success":true,"inquiry_id":8,"message":"Inquiry received"}
```

**Status:** 201 Created

**Expected HubSpot State:**
- Same contact updated (NOT duplicated)
- `kiuli_gclid` = `test-gclid-phase3` (ORIGINAL preserved, not overwritten)
- `traffic_source` = `google_ads` (ORIGINAL preserved)
- NEW deal created with amount = $14,000 (1400000 cents / 100)

---

## 6. AWAITING GRAHAM VERIFICATION

### HubSpot UI Verification Required

1. **Contact exists:**
   - Go to HubSpot > Contacts
   - Search for `hubspot-test1@kiuli.com`
   - Verify properties:
     - `firstname` = "HubSpot"
     - `lastname` = "TestOne"
     - `phone` = "+12025552222" (updated to latest)
     - `kiuli_gclid` = "test-gclid-phase3" (original, NOT "different-gclid-should-not-overwrite")
     - `traffic_source` = "google_ads" (original preserved)
     - `kiuli_session_id` = "session-hs-002" (updated to latest)
   - **Paste contact URL here:** _______________

2. **Two deals associated:**
   - Contact should have 2 deals
   - Deal 1: Amount = $10,000 (from Test A)
   - Deal 2: Amount = $14,000 (from Test B)
   - Both in "Kiuli Funnel" pipeline, "First Contact" stage
   - **Paste deal 1 URL here:** _______________
   - **Paste deal 2 URL here:** _______________

### Payload Admin Verification Required

3. **Inquiries have HubSpot IDs:**
   - Go to admin.kiuli.com/admin/collections/inquiries
   - Find inquiry ID 7
     - `hubspotContactId` should be populated
     - `hubspotDealId` should be populated
   - Find inquiry ID 8
     - `hubspotContactId` should be SAME as inquiry 7
     - `hubspotDealId` should be DIFFERENT from inquiry 7
   - **Confirmation:** _______________

---

## 7. TECHNICAL DETAILS

### HubSpot Configuration

| Setting | Value |
|---------|-------|
| API Base | https://api.hubapi.com |
| Pipeline ID | 3425899755 (Kiuli Funnel) |
| Deal Stage ID | 4690609358 (First Contact) |
| Association Type ID | 3 (Contact to Deal) |

### Traffic Source Mapping

| Input | HubSpot Value |
|-------|---------------|
| gclid exists | google_ads |
| utmSource = 'google' | organic_search |
| utmSource in [chatgpt, perplexity, claude, ai] | ai_search |
| utmSource = 'partner' | partner_referral |
| other/empty | direct |

### Attribution Preservation Logic

When updating existing contact:
- `kiuli_gclid`: Only set if existing value is null/empty
- `traffic_source`: Only set if existing value is null/empty
- `kiuli_session_id`: Always update to latest
- `inquiry_type`: Always update to latest

---

## 8. ERROR HANDLING

HubSpot integration is **non-blocking**:
- If HubSpot API fails, error is logged to console
- Inquiry is still created in Payload and returned as success
- Admin can manually link HubSpot later if needed

Verified locally: When HUBSPOT_ACCESS_TOKEN was not configured, inquiry creation succeeded with status 201.

---

## PHASE 3 STATUS: DEPLOYED - AWAITING VERIFICATION

All code deployed and production tests return 201 success.
Graham must verify HubSpot UI and Payload admin to confirm full integration.
