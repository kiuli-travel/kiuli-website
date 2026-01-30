# PHASE 1: DATABASE SCHEMA — OUTCOMES

**Document Type:** Outcomes Specification  
**Phase:** 1 of 11  
**Objective:** Create the Inquiries collection in Payload CMS to store form submissions

---

## Context

Claude CLI discovery confirmed:
- No `kiuli_inquiries` table exists
- No Inquiries collection exists in Payload CMS
- Payload CMS version: 3.63.0
- Database adapter: vercelPostgresAdapter (Vercel Postgres)
- Existing collections: Pages, Posts, Media, Categories, Users, Itineraries, ItineraryJobs, ImageStatuses, Notifications, VoiceConfiguration, Destinations, TripTypes

---

## Objective

Create a Payload CMS collection called `Inquiries` that stores all data captured by the inquiry form, including:
- Form responses (destinations, timing, travelers, priority, investment, contact)
- Attribution data (session, GCLID, UTM parameters)
- Integration IDs (HubSpot contact/deal)
- Metadata (timestamps, status)

---

## Required Fields

### Contact Information
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `firstName` | text | Yes | Customer first name |
| `lastName` | text | Yes | Customer last name |
| `email` | email | Yes | Customer email address |
| `phone` | text | Yes | Phone number in E.164 format |
| `phoneCountryCode` | text | Yes | ISO country code (e.g., 'US', 'GB') |

### Form Responses
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `destinations` | array of text | Yes | Country codes or ['UNDECIDED'] |
| `timingType` | select | Yes | 'specific', 'flexible', 'exploring' |
| `travelDateStart` | date | No | If timingType='specific' |
| `travelDateEnd` | date | No | If timingType='specific' |
| `travelWindowEarliest` | text | No | Month/year '2026-06' if timingType='flexible' |
| `travelWindowLatest` | text | No | Month/year '2026-12' if timingType='flexible' |
| `partyType` | select | Yes | 'solo', 'couple', 'family', 'multigenerational', 'friends', 'multiple_families', 'other' |
| `totalTravelers` | number | Yes | 1-21 (21 = "more than 20") |
| `childrenCount` | number | Yes | 0-11 (11 = "10+") |
| `primaryInterest` | select | Yes | 'migration', 'gorillas', 'luxury_camp', 'big_cats', 'walking', 'celebration', 'ultimate', 'other' |
| `budgetRange` | select | Yes | '15k-25k', '25k-40k', '40k-60k', '60k-80k', '80k-100k', '100k+', 'unsure' |
| `statedBudgetCents` | number | Yes | Midpoint budget in cents |
| `projectedProfitCents` | number | Yes | 20% of stated budget in cents |
| `howHeard` | select | Yes | 'google', 'ai', 'referral', 'advisor', 'press', 'social', 'podcast', 'returning', 'other' |
| `message` | textarea | No | Optional message (max 500 chars) |
| `marketingConsent` | checkbox | No | Opted into marketing emails |

### Attribution Data
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `sessionId` | text | No | Kiuli session identifier |
| `gclid` | text | No | Google Click ID |
| `utmSource` | text | No | UTM source parameter |
| `utmMedium` | text | No | UTM medium parameter |
| `utmCampaign` | text | No | UTM campaign parameter |
| `utmContent` | text | No | UTM content parameter |
| `utmTerm` | text | No | UTM term parameter |
| `referrer` | text | No | HTTP referrer |
| `landingPage` | text | No | First page visited |
| `pageUrl` | text | No | Page where form was submitted |
| `itinerarySlug` | text | No | If submitted from itinerary page |

### Integration IDs
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `hubspotContactId` | text | No | HubSpot contact record ID |
| `hubspotDealId` | text | No | HubSpot deal record ID |

### Metadata
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `inquiryType` | select | Yes | 'form', 'phone', 'email', 'chat' (default: 'form') |
| `status` | select | Yes | 'new', 'contacted', 'qualified', 'converted', 'lost' (default: 'new') |
| `assignedDesigner` | text | No | Designer email for round-robin |
| `formStartedAt` | date | No | When user started the form |
| `timeToCompleteSeconds` | number | No | Seconds to complete form |

### Automatic Fields (Payload provides)
- `id` — Auto-generated unique ID
- `createdAt` — Timestamp when created
- `updatedAt` — Timestamp when last updated

---

## Select Field Options

### timingType
```typescript
options: [
  { label: 'Specific dates', value: 'specific' },
  { label: 'Flexible window', value: 'flexible' },
  { label: 'Just exploring', value: 'exploring' },
]
```

### partyType
```typescript
options: [
  { label: 'Solo', value: 'solo' },
  { label: 'Couple', value: 'couple' },
  { label: 'Family', value: 'family' },
  { label: 'Multi-generational', value: 'multigenerational' },
  { label: 'Friends', value: 'friends' },
  { label: 'Multiple families', value: 'multiple_families' },
  { label: 'Other', value: 'other' },
]
```

### primaryInterest
```typescript
options: [
  { label: 'Great Migration', value: 'migration' },
  { label: 'Mountain Gorillas', value: 'gorillas' },
  { label: 'Luxury Camp Experience', value: 'luxury_camp' },
  { label: 'Big Cats', value: 'big_cats' },
  { label: 'Walking Safari', value: 'walking' },
  { label: 'Special Celebration', value: 'celebration' },
  { label: 'Ultimate Safari', value: 'ultimate' },
  { label: 'Other', value: 'other' },
]
```

### budgetRange
```typescript
options: [
  { label: '$15,000 - $25,000', value: '15k-25k' },
  { label: '$25,000 - $40,000', value: '25k-40k' },
  { label: '$40,000 - $60,000', value: '40k-60k' },
  { label: '$60,000 - $80,000', value: '60k-80k' },
  { label: '$80,000 - $100,000', value: '80k-100k' },
  { label: '$100,000+', value: '100k+' },
  { label: 'Help me understand', value: 'unsure' },
]
```

### howHeard
```typescript
options: [
  { label: 'Google search', value: 'google' },
  { label: 'ChatGPT / AI assistant', value: 'ai' },
  { label: 'Friend or family', value: 'referral' },
  { label: 'Travel advisor', value: 'advisor' },
  { label: 'Magazine or publication', value: 'press' },
  { label: 'Social media', value: 'social' },
  { label: 'Podcast', value: 'podcast' },
  { label: 'Returning customer', value: 'returning' },
  { label: 'Other', value: 'other' },
]
```

### inquiryType
```typescript
options: [
  { label: 'Form', value: 'form' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Chat', value: 'chat' },
]
defaultValue: 'form'
```

### status
```typescript
options: [
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Converted', value: 'converted' },
  { label: 'Lost', value: 'lost' },
]
defaultValue: 'new'
```

---

## Collection Configuration Requirements

### Access Control
- **Read:** Authenticated users only (admin)
- **Create:** Public (API endpoint will create inquiries)
- **Update:** Authenticated users only (admin)
- **Delete:** Authenticated users only (admin)

### Admin UI
- List view should show: firstName, lastName, email, budgetRange, status, createdAt
- Sort by createdAt descending (newest first)
- Searchable by: firstName, lastName, email

### Hooks
- None required in Phase 1 (HubSpot integration is Phase 3)

---

## File Location

Create the collection at:
```
src/collections/Inquiries.ts
```

Register in:
```
src/payload.config.ts
```

---

## Success Criteria

Phase 1 is complete when:

1. **Collection file exists** at `src/collections/Inquiries.ts`
2. **Collection is registered** in `src/payload.config.ts`
3. **Build succeeds** with no TypeScript errors
4. **Database table created** — `inquiries` table exists in Postgres
5. **All fields present** — Every field listed above exists with correct type
6. **Admin UI works** — Collection visible and functional at admin.kiuli.com
7. **API accessible** — POST to collection endpoint returns expected response

---

## Gate Evidence Required

Claude CLI must provide:

1. **File contents** of `src/collections/Inquiries.ts`
2. **Diff showing** registration in `src/payload.config.ts`
3. **Build output** showing successful compilation
4. **Database verification** — Query showing table structure
5. **Admin screenshot or confirmation** — Collection visible in Payload admin
6. **API test** — curl command creating a test inquiry and response

---

## Constraints

- Do NOT modify any existing collections
- Do NOT add hooks or external integrations (that's Phase 3)
- Do NOT create API routes (that's Phase 2)
- Use Payload's built-in field types only
- Follow existing collection patterns in the codebase

---

**END OF OUTCOMES DOCUMENT**
