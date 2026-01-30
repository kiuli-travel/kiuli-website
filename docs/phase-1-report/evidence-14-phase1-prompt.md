# PHASE 1: DATABASE SCHEMA — CLAUDE CLI PROMPT

**Document Type:** Implementation Prompt  
**Phase:** 1 of 11  
**Mode:** Implementation (changes permitted)

---

## Instructions

You are implementing the Inquiries collection for Kiuli's inquiry form. Read this entire document before taking any action.

**YOUR TASK:** Create a Payload CMS collection to store inquiry form submissions.

---

## Step 1: Examine Existing Patterns

Before writing any code, examine an existing collection to understand the codebase patterns:

```bash
cat src/collections/Itineraries.ts
```

Note:
- Import style
- Field definition patterns
- Access control patterns
- Export style

Also check the payload config to see how collections are registered:

```bash
cat src/payload.config.ts
```

---

## Step 2: Create the Inquiries Collection

Create the file `src/collections/Inquiries.ts` with the following structure:

```typescript
import type { CollectionConfig } from 'payload'

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  labels: {
    singular: 'Inquiry',
    plural: 'Inquiries',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'budgetRange', 'status', 'createdAt'],
    listSearchableFields: ['firstName', 'lastName', 'email'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Public - API will create inquiries
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    // Contact Information Group
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'phone',
          type: 'text',
          required: true,
          admin: { width: '70%' },
        },
        {
          name: 'phoneCountryCode',
          type: 'text',
          required: true,
          admin: { width: '30%' },
        },
      ],
    },

    // Destinations
    {
      name: 'destinations',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
        },
      ],
    },

    // Timing
    {
      name: 'timingType',
      type: 'select',
      required: true,
      options: [
        { label: 'Specific dates', value: 'specific' },
        { label: 'Flexible window', value: 'flexible' },
        { label: 'Just exploring', value: 'exploring' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'travelDateStart',
          type: 'date',
          admin: {
            width: '50%',
            condition: (data) => data?.timingType === 'specific',
          },
        },
        {
          name: 'travelDateEnd',
          type: 'date',
          admin: {
            width: '50%',
            condition: (data) => data?.timingType === 'specific',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'travelWindowEarliest',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Format: YYYY-MM',
            condition: (data) => data?.timingType === 'flexible',
          },
        },
        {
          name: 'travelWindowLatest',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Format: YYYY-MM',
            condition: (data) => data?.timingType === 'flexible',
          },
        },
      ],
    },

    // Travelers
    {
      name: 'partyType',
      type: 'select',
      required: true,
      options: [
        { label: 'Solo', value: 'solo' },
        { label: 'Couple', value: 'couple' },
        { label: 'Family', value: 'family' },
        { label: 'Multi-generational', value: 'multigenerational' },
        { label: 'Friends', value: 'friends' },
        { label: 'Multiple families', value: 'multiple_families' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalTravelers',
          type: 'number',
          required: true,
          min: 1,
          max: 21,
          admin: { width: '50%' },
        },
        {
          name: 'childrenCount',
          type: 'number',
          required: true,
          min: 0,
          max: 11,
          admin: { width: '50%' },
        },
      ],
    },

    // Interest
    {
      name: 'primaryInterest',
      type: 'select',
      required: true,
      options: [
        { label: 'Great Migration', value: 'migration' },
        { label: 'Mountain Gorillas', value: 'gorillas' },
        { label: 'Luxury Camp Experience', value: 'luxury_camp' },
        { label: 'Big Cats', value: 'big_cats' },
        { label: 'Walking Safari', value: 'walking' },
        { label: 'Special Celebration', value: 'celebration' },
        { label: 'Ultimate Safari', value: 'ultimate' },
        { label: 'Other', value: 'other' },
      ],
    },

    // Budget
    {
      name: 'budgetRange',
      type: 'select',
      required: true,
      options: [
        { label: '$15,000 - $25,000', value: '15k-25k' },
        { label: '$25,000 - $40,000', value: '25k-40k' },
        { label: '$40,000 - $60,000', value: '40k-60k' },
        { label: '$60,000 - $80,000', value: '60k-80k' },
        { label: '$80,000 - $100,000', value: '80k-100k' },
        { label: '$100,000+', value: '100k+' },
        { label: 'Help me understand', value: 'unsure' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'statedBudgetCents',
          type: 'number',
          required: true,
          admin: { width: '50%', description: 'Budget midpoint in cents' },
        },
        {
          name: 'projectedProfitCents',
          type: 'number',
          required: true,
          admin: { width: '50%', description: '20% of stated budget' },
        },
      ],
    },

    // How Heard & Message
    {
      name: 'howHeard',
      type: 'select',
      required: true,
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
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
    },

    // Attribution - Collapsible Group
    {
      type: 'collapsible',
      label: 'Attribution Data',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'sessionId',
          type: 'text',
        },
        {
          name: 'gclid',
          type: 'text',
          admin: { description: 'Google Click ID' },
        },
        {
          type: 'row',
          fields: [
            { name: 'utmSource', type: 'text', admin: { width: '33%' } },
            { name: 'utmMedium', type: 'text', admin: { width: '33%' } },
            { name: 'utmCampaign', type: 'text', admin: { width: '34%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'utmContent', type: 'text', admin: { width: '50%' } },
            { name: 'utmTerm', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          name: 'referrer',
          type: 'text',
        },
        {
          name: 'landingPage',
          type: 'text',
        },
        {
          name: 'pageUrl',
          type: 'text',
        },
        {
          name: 'itinerarySlug',
          type: 'text',
          admin: { description: 'If submitted from an itinerary page' },
        },
      ],
    },

    // Integration IDs - Collapsible Group
    {
      type: 'collapsible',
      label: 'Integration IDs',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'hubspotContactId',
              type: 'text',
              admin: { width: '50%', readOnly: true },
            },
            {
              name: 'hubspotDealId',
              type: 'text',
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
      ],
    },

    // Status & Assignment
    {
      type: 'row',
      fields: [
        {
          name: 'inquiryType',
          type: 'select',
          required: true,
          defaultValue: 'form',
          options: [
            { label: 'Form', value: 'form' },
            { label: 'Phone', value: 'phone' },
            { label: 'Email', value: 'email' },
            { label: 'Chat', value: 'chat' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'new',
          options: [
            { label: 'New', value: 'new' },
            { label: 'Contacted', value: 'contacted' },
            { label: 'Qualified', value: 'qualified' },
            { label: 'Converted', value: 'converted' },
            { label: 'Lost', value: 'lost' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'assignedDesigner',
          type: 'text',
          admin: { width: '34%' },
        },
      ],
    },

    // Form Metadata
    {
      type: 'row',
      fields: [
        {
          name: 'formStartedAt',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'timeToCompleteSeconds',
          type: 'number',
          admin: { width: '50%' },
        },
      ],
    },
  ],
  timestamps: true,
}
```

---

## Step 3: Register the Collection

Edit `src/payload.config.ts` to:

1. Add the import at the top with other collection imports:
```typescript
import { Inquiries } from './collections/Inquiries'
```

2. Add `Inquiries` to the collections array (add it near the end, before any closing brackets):
```typescript
collections: [
  // ... existing collections
  Inquiries,
],
```

---

## Step 4: Build and Verify

Run the build to check for TypeScript errors:

```bash
npm run build
```

If the build fails, read the error carefully and fix it. Common issues:
- Import path incorrect
- Field type mismatch
- Missing comma in collections array

---

## Step 5: Generate Database Migration

Payload should automatically handle the migration, but verify:

```bash
npm run dev
```

Wait for the server to start. Payload will create the database table on startup.

Then check the database table exists. You can do this by:

1. Looking at the Payload admin (if accessible locally)
2. Or using the Payload CLI/API to verify the collection

---

## Step 6: Test API Access

With the dev server running, test that the collection API works:

```bash
curl -X POST http://localhost:3000/api/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "+12025551234",
    "phoneCountryCode": "US",
    "destinations": [{"code": "TZ"}],
    "timingType": "exploring",
    "partyType": "couple",
    "totalTravelers": 2,
    "childrenCount": 0,
    "primaryInterest": "migration",
    "budgetRange": "25k-40k",
    "statedBudgetCents": 3250000,
    "projectedProfitCents": 650000,
    "howHeard": "google",
    "inquiryType": "form",
    "status": "new"
  }'
```

Expected response: 201 Created with the created inquiry object including an `id`.

---

## Step 7: Clean Up Test Data

If the test inquiry was created successfully, delete it:

```bash
# Get the ID from the previous response, then:
curl -X DELETE http://localhost:3000/api/inquiries/{ID}
```

Or leave it for now — it can be deleted from the admin UI later.

---

## Evidence Report Format

After completing all steps, provide this exact format:

```
================================================================================
PHASE 1: DATABASE SCHEMA — EVIDENCE REPORT
================================================================================

STEP 1: EXISTING PATTERNS EXAMINED
----------------------------------
Examined: src/collections/Itineraries.ts
Patterns noted: [brief description of patterns found]

STEP 2: COLLECTION FILE CREATED
-------------------------------
File: src/collections/Inquiries.ts
Created: YES / NO
Line count: [number]

[Paste the first 50 lines of the file here]

STEP 3: COLLECTION REGISTERED
-----------------------------
File: src/payload.config.ts
Import added: YES / NO
Collection added to array: YES / NO

Diff:
[Show the git diff or the specific lines changed]

STEP 4: BUILD VERIFICATION
--------------------------
Command: npm run build
Exit code: [0 or error code]
Output (last 20 lines):
[paste output]

Build successful: YES / NO

STEP 5: DATABASE TABLE CREATED
------------------------------
Dev server started: YES / NO
Table created: YES / NO

Verification method: [how you verified]
Evidence: [output or screenshot description]

STEP 6: API TEST
----------------
Command: curl -X POST http://localhost:3000/api/inquiries ...
Response code: [code]
Response body:
[paste response]

Inquiry created successfully: YES / NO
Inquiry ID: [id if created]

STEP 7: CLEANUP
---------------
Test inquiry deleted: YES / NO / SKIPPED

================================================================================
SUMMARY
================================================================================

All steps completed: YES / NO

If NO, which step failed:
- Step [N]: [description of failure]

Files changed:
- src/collections/Inquiries.ts (created)
- src/payload.config.ts (modified)

Ready for commit: YES / NO

================================================================================
END OF EVIDENCE REPORT
================================================================================
```

---

## Error Handling

If you encounter errors:

1. **TypeScript errors during build:** Read the full error message, identify the line number, and fix the specific issue. Do not guess.

2. **Collection not appearing:** Check that the import path is correct and the collection is added to the array (not outside it).

3. **Database migration fails:** Check Payload logs for specific error. May need to check database connection.

4. **API returns 403/401:** The create access is set to public, so this shouldn't happen. If it does, check the access control configuration.

5. **Unexpected field type errors:** Ensure you're using Payload 3.x field types, not Payload 2.x patterns.

---

## Constraints — Do NOT Do These Things

- Do NOT modify any existing collections
- Do NOT add hooks or integrations
- Do NOT create new API routes
- Do NOT install new packages
- Do NOT modify the database directly
- Do NOT commit changes (Graham will review first)

---

## After Completion

1. STOP after producing the evidence report
2. Do NOT proceed to Phase 2
3. Do NOT commit changes
4. Wait for Graham to review and approve

---

**END OF PROMPT**
