# M2: Schema Evolution & Scraper Upgrade

**Date:** 2026-02-22
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)
**Scope:** Sub-projects A (schema), B (scraper), C (content engine alignment)

---

## Before You Start: Required Reads

Read these four files before making any changes. The schema design and scraper logic
depend on what actually exists in the code, not on what documentation says.

```
1. src/collections/Properties.ts
2. src/payload.config.ts
3. lambda/orchestrator/transform.js
4. lambda/orchestrator/handler.js
5. lambda/orchestrator/shared/payload.js
```

Then run these SQL queries and report the output before proceeding. Do not proceed if
any query fails.

```sql
-- 1. All current tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Current Properties columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
ORDER BY column_name;

-- 3. Current data counts
SELECT
  (SELECT count(*) FROM properties) AS property_count,
  (SELECT count(*) FROM itineraries) AS itinerary_count,
  (SELECT count(*) FROM destinations) AS destination_count;
```

---

## Confirmed Facts About the Data Pipeline

These are confirmed from the scraping reference and source code. Do not second-guess them.

**`segment.supplierCode`** — Present on presentation segments. Access directly as
`segment.supplierCode`. No verification step needed.

**`notes.contactEmail`** — Raw API segments only. The transform operates on presentation
segments and does not have access to raw segment `notes`. Do not attempt to access
`segment.notes?.contactEmail`. The `canonicalContent.contactEmail` field on Properties
will be left empty — it is for Phase 2 (Wetu sync) or manual entry.

**`segment.airline`**, **`segment.fromPoint`**, **`segment.toPoint`**, **`segment.departureTime`**,
**`segment.arrivalTime`** — Present on presentation segments for flight/road types.

**Pax data** — At itinerary level. Access via:
```javascript
const adultsCount = itinerary.adults ?? itinerary.travelers?.adults ?? null;
const childrenCount = itinerary.children ?? itinerary.travelers?.children ?? null;
```
If both null, paxType defaults to 'unknown'. Non-fatal.

**`payload.js` module** — Has `create`, `update`, `getById`, `find`, `findOne` generic methods.
Use these in handler.js rather than raw fetch calls. Query format uses bracket notation:
`{ 'where[slug][equals]': 'my-slug' }`.

**Price observations and commonPairings** — These require the Payload itinerary ID which is
only available after `createItinerary()` in handler.js. They must be written in handler.js,
not in transform.js. Transform.js prepares the data; handler.js writes it.

---

## Sub-project A: Schema Changes

### A1: Extend Properties Collection

In `src/collections/Properties.ts`, add the following five field groups **after the closing
brace of the `priceTier` field and before the final closing `]` of the `fields` array**.

Add in this exact order. Do NOT remove, rename, or reorder any existing field.

#### Group 1: externalIds

```typescript
{
  name: 'externalIds',
  type: 'group',
  admin: {
    description: 'External system identifiers — populated progressively as integrations go live',
  },
  fields: [
    {
      name: 'itrvlSupplierCode',
      type: 'text',
      admin: { description: 'supplierCode from iTrvl API — may be ResRequest property ID' },
    },
    {
      name: 'itrvlPropertyName',
      type: 'text',
      admin: { description: 'Property name as it appears in iTrvl raw data' },
    },
    {
      name: 'resRequestPropertyId',
      type: 'text',
      admin: { description: 'ResRequest property ID — Phase 3 ResConnect integration' },
    },
    {
      name: 'resRequestPrincipalId',
      type: 'text',
      admin: { description: 'ResRequest principal / lodge group ID — Phase 3' },
    },
    {
      name: 'resRequestAccommTypes',
      type: 'array',
      admin: { description: 'Accommodation type IDs in ResRequest — Phase 3' },
      fields: [
        {
          name: 'id',
          type: 'text',
          admin: { description: 'Accommodation type ID in ResRequest' },
        },
        {
          name: 'name',
          type: 'text',
          admin: { description: 'e.g. "Bush Suite", "Tent"' },
        },
      ],
    },
    {
      name: 'wetuContentEntityId',
      type: 'number',
      admin: { description: 'Wetu content entity ID — Phase 2' },
    },
  ],
},
```

#### Group 2: canonicalContent

```typescript
{
  name: 'canonicalContent',
  type: 'group',
  admin: {
    description: 'Authoritative data — GPS from iTrvl where available, enriched via Wetu in Phase 2',
  },
  fields: [
    {
      name: 'coordinates',
      type: 'group',
      admin: { description: 'GPS coordinates' },
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'contactEmail',
      type: 'email',
      admin: { description: 'Property contact email — populated in Phase 2 or manually' },
    },
    {
      name: 'contactPhone',
      type: 'text',
      admin: { description: 'Property contact phone — populated in Phase 2 or manually' },
    },
  ],
},
```

#### Group 3: roomTypes array

```typescript
{
  name: 'roomTypes',
  type: 'array',
  admin: { description: 'Room types — from Wetu in Phase 2, manual entry before that' },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'e.g. "Bush Suite", "Family Tent"' },
    },
    {
      name: 'maxPax',
      type: 'number',
      admin: { description: 'Maximum occupancy' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
  ],
},
```

#### Group 4: accumulatedData

```typescript
{
  name: 'accumulatedData',
  type: 'group',
  admin: {
    description: 'Intelligence accumulated from scraped itineraries — grows with every scrape',
  },
  fields: [
    {
      name: 'pricePositioning',
      type: 'group',
      fields: [
        {
          name: 'observations',
          type: 'array',
          admin: { description: 'Price observations, one per scraped itinerary featuring this property' },
          fields: [
            {
              name: 'itineraryId',
              type: 'relationship',
              relationTo: 'itineraries',
            },
            {
              name: 'pricePerNightEstimate',
              type: 'number',
              admin: { description: 'USD. Estimated from total itinerary price ÷ total nights.' },
            },
            {
              name: 'priceTier',
              type: 'select',
              options: [
                { label: 'Ultra Premium', value: 'ultra_premium' },
                { label: 'Premium', value: 'premium' },
                { label: 'Mid Luxury', value: 'mid_luxury' },
                { label: 'Accessible Luxury', value: 'accessible_luxury' },
              ],
            },
            {
              name: 'observedAt',
              type: 'date',
            },
          ],
        },
        {
          name: 'observationCount',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true, description: 'Number of itineraries featuring this property' },
        },
      ],
    },
    {
      name: 'commonPairings',
      type: 'array',
      admin: { description: 'Properties that appear before or after this one across scraped itineraries' },
      fields: [
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
        },
        {
          name: 'position',
          type: 'select',
          options: [
            { label: 'Before', value: 'before' },
            { label: 'After', value: 'after' },
          ],
        },
        {
          name: 'count',
          type: 'number',
          defaultValue: 1,
          admin: { description: 'How many times this pairing has been observed' },
        },
      ],
    },
  ],
},
```

#### Group 5: availability

```typescript
{
  name: 'availability',
  type: 'group',
  admin: { description: 'Availability integration status' },
  fields: [
    {
      name: 'source',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'ResConnect', value: 'resconnect' },
        { label: 'Direct', value: 'direct' },
      ],
      admin: { description: 'Which system provides live availability for this property' },
    },
  ],
},
```

After editing, run:
```bash
npm run build 2>&1 | tail -30
```

**Gate:** Build passes with zero TypeScript errors. If it fails, fix the errors before continuing.
Do NOT commit a failing build.

---

### A2: Create Activities Collection

Create `src/collections/Activities.ts` with this exact content:

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Activities: CollectionConfig = {
  slug: 'activities',
  admin: {
    useAsTitle: 'name',
    group: 'Knowledge Base',
    defaultColumns: ['name', 'type', 'observationCount', 'updatedAt'],
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'e.g. "Gorilla Trekking", "Morning Game Drive"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Game Drive', value: 'game_drive' },
        { label: 'Walking Safari', value: 'walking_safari' },
        { label: 'Gorilla Trek', value: 'gorilla_trek' },
        { label: 'Chimpanzee Trek', value: 'chimpanzee_trek' },
        { label: 'Balloon Flight', value: 'balloon_flight' },
        { label: 'Boat Safari', value: 'boat_safari' },
        { label: 'Canoe Safari', value: 'canoe_safari' },
        { label: 'Horseback Safari', value: 'horseback_safari' },
        { label: 'Cultural Visit', value: 'cultural_visit' },
        { label: 'Bush Dinner', value: 'bush_dinner' },
        { label: 'Sundowner', value: 'sundowner' },
        { label: 'Fishing', value: 'fishing' },
        { label: 'Snorkeling', value: 'snorkeling' },
        { label: 'Diving', value: 'diving' },
        { label: 'Spa', value: 'spa' },
        { label: 'Photography', value: 'photography' },
        { label: 'Birding', value: 'birding' },
        { label: 'Conservation Experience', value: 'conservation_experience' },
        { label: 'Community Visit', value: 'community_visit' },
        { label: 'Helicopter Flight', value: 'helicopter_flight' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'destinations',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Destinations where this activity is available' },
    },
    {
      name: 'properties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
      admin: { description: 'Properties that offer this activity' },
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'typicalDuration',
      type: 'text',
      admin: { description: 'e.g. "3–4 hours", "Full day"' },
    },
    {
      name: 'bestTimeOfDay',
      type: 'select',
      options: [
        { label: 'Early Morning', value: 'early_morning' },
        { label: 'Morning', value: 'morning' },
        { label: 'Midday', value: 'midday' },
        { label: 'Afternoon', value: 'afternoon' },
        { label: 'Evening', value: 'evening' },
        { label: 'Night', value: 'night' },
        { label: 'Any', value: 'any' },
      ],
    },
    {
      name: 'suitability',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Family', value: 'family' },
        { label: 'Couples', value: 'couples' },
        { label: 'Honeymoon', value: 'honeymoon' },
        { label: 'Group', value: 'group' },
        { label: 'Solo', value: 'solo' },
        { label: 'Accessible', value: 'accessible' },
      ],
    },
    {
      name: 'minimumAge',
      type: 'number',
      admin: { description: 'Minimum age requirement. Leave empty for no restriction.' },
    },
    {
      name: 'fitnessLevel',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Moderate', value: 'moderate' },
        { label: 'High', value: 'high' },
      ],
    },
    {
      name: 'wetuContentEntityId',
      type: 'number',
      admin: { description: 'Wetu content entity ID — Phase 2' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many scraped itineraries include this activity' },
    },
  ],
}
```

---

### A3: Create TransferRoutes Collection

Create `src/collections/TransferRoutes.ts` with this exact content:

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const TransferRoutes: CollectionConfig = {
  slug: 'transfer-routes',
  admin: {
    useAsTitle: 'slug',
    group: 'Knowledge Base',
    defaultColumns: ['from', 'to', 'mode', 'observationCount', 'updatedAt'],
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      admin: { description: 'Origin point name, e.g. "Mara North Airstrip"' },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'Destination point name, e.g. "Wilson Airport Nairobi"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Auto-generated: "mara-north-airstrip-to-wilson-airport-nairobi"' },
    },
    {
      name: 'fromDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination record for origin country/region' },
    },
    {
      name: 'toDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination record for arrival country/region' },
    },
    {
      name: 'fromProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at origin if transfer departs from a property' },
    },
    {
      name: 'toProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at destination if transfer arrives at a property' },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      options: [
        { label: 'Flight', value: 'flight' },
        { label: 'Road', value: 'road' },
        { label: 'Boat', value: 'boat' },
        { label: 'Helicopter', value: 'helicopter' },
        { label: 'Charter', value: 'charter' },
      ],
    },
    {
      name: 'typicalDurationMinutes',
      type: 'number',
    },
    {
      name: 'distanceKm',
      type: 'number',
    },
    {
      name: 'airlines',
      type: 'array',
      admin: { description: 'Airlines observed on this route across all scraped itineraries' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "Safarilink", "Auric Air"' },
        },
        {
          name: 'go7Airline',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Available via GO7/AeroCRS network — Phase 4' },
        },
        {
          name: 'duffelAirline',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Available via Duffel API — Phase 4' },
        },
      ],
    },
    {
      name: 'fromCoordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'toCoordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'observations',
      type: 'array',
      admin: { description: 'One entry per scrape that used this route' },
      fields: [
        {
          name: 'itineraryId',
          type: 'relationship',
          relationTo: 'itineraries',
        },
        { name: 'departureTime', type: 'text' },
        { name: 'arrivalTime', type: 'text' },
        { name: 'airline', type: 'text' },
        { name: 'dateObserved', type: 'date' },
      ],
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Total times this route has been scraped' },
    },
    {
      name: 'wetuRouteId',
      type: 'text',
      admin: { description: 'Wetu route entity ID — Phase 2' },
    },
  ],
}
```

---

### A4: Create ItineraryPatterns Collection

Create `src/collections/ItineraryPatterns.ts` with this exact content:

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const ItineraryPatterns: CollectionConfig = {
  slug: 'itinerary-patterns',
  admin: {
    useAsTitle: 'sourceItinerary',
    group: 'Knowledge Base',
    defaultColumns: ['sourceItinerary', 'totalNights', 'priceTier', 'paxType', 'updatedAt'],
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  fields: [
    {
      name: 'sourceItinerary',
      type: 'relationship',
      relationTo: 'itineraries',
      required: true,
      unique: true,
      admin: { description: 'The scraped itinerary this pattern was extracted from' },
    },
    {
      name: 'extractedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'countries',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Country-level destinations covered' },
    },
    {
      name: 'regions',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Region/park-level destinations covered' },
    },
    {
      name: 'totalNights',
      type: 'number',
    },
    {
      name: 'paxType',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: 'Family', value: 'family' },
        { label: 'Couple', value: 'couple' },
        { label: 'Group', value: 'group' },
        { label: 'Solo', value: 'solo' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'adults',
      type: 'number',
    },
    {
      name: 'children',
      type: 'number',
    },
    {
      name: 'propertySequence',
      type: 'array',
      admin: { description: 'Ordered list of properties in this itinerary' },
      fields: [
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          required: true,
        },
        {
          name: 'nights',
          type: 'number',
        },
        {
          name: 'order',
          type: 'number',
          admin: { description: '1-based position in the itinerary sequence' },
        },
        {
          name: 'roomType',
          type: 'text',
        },
      ],
    },
    {
      name: 'transferSequence',
      type: 'array',
      admin: { description: 'Ordered list of transfers in this itinerary' },
      fields: [
        {
          name: 'route',
          type: 'relationship',
          relationTo: 'transfer-routes',
        },
        {
          name: 'afterProperty',
          type: 'number',
          admin: { description: '1-based order index of the preceding property' },
        },
        {
          name: 'mode',
          type: 'text',
        },
      ],
    },
    {
      name: 'priceTotal',
      type: 'number',
      admin: { description: 'Total itinerary price in USD' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'USD',
    },
    {
      name: 'pricePerNightAvg',
      type: 'number',
      admin: { description: 'priceTotal ÷ totalNights' },
    },
    {
      name: 'priceTier',
      type: 'select',
      options: [
        { label: 'Ultra Premium', value: 'ultra_premium' },
        { label: 'Premium', value: 'premium' },
        { label: 'Mid Luxury', value: 'mid_luxury' },
        { label: 'Accessible Luxury', value: 'accessible_luxury' },
      ],
    },
    {
      name: 'travelMonth',
      type: 'number',
      admin: { description: '1–12, from itinerary start date' },
    },
    {
      name: 'travelYear',
      type: 'number',
    },
  ],
}
```

---

### A5: Register New Collections

Edit `src/payload.config.ts`:

**Add three imports** alongside the existing collection imports:
```typescript
import { Activities } from './collections/Activities'
import { TransferRoutes } from './collections/TransferRoutes'
import { ItineraryPatterns } from './collections/ItineraryPatterns'
```

**Add `Activities`, `TransferRoutes`, `ItineraryPatterns`** to the `collections` array.

Run:
```bash
npm run build 2>&1 | tail -40
```

**Gate:** Build passes. If it fails, fix before committing. Do not commit.

---

### A6: Generate and Run Payload Migration for Schema Changes

```bash
npx payload migrate:create --name m2_schema_evolution
```

Verify it was created:
```bash
ls -la src/migrations/ | grep m2
```

Report the filename. Then run:
```bash
npx payload migrate
```

If the command fails with a database connection error, verify `DATABASE_URL_UNPOOLED` is set
in `.env.local` and retry.

**Gate:** Migration completes successfully. Report the exact terminal output.

---

### A7: Verify Schema in Database

Run these queries and report the full output:

```sql
-- New collection tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('activities', 'transfer_routes', 'itinerary_patterns')
ORDER BY table_name;
-- Expected: 3 rows

-- New Properties columns (Payload converts camelCase groups to snake_case)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
AND column_name LIKE 'external_ids%'
   OR column_name LIKE 'canonical_content%'
   OR column_name LIKE 'accumulated_data%'
   OR column_name LIKE 'availability%'
ORDER BY column_name;
-- Expected: at minimum these columns exist:
--   external_ids_itrvl_supplier_code
--   external_ids_res_request_property_id
--   canonical_content_contact_email
--   accumulated_data_price_positioning_observation_count
--   availability_source
```

**STOP if the tables query returns fewer than 3 rows.** Do not proceed. Report the actual output
and the migration file contents.

**STOP if fewer than 5 Properties columns are found.** Report the actual column names returned.
The exact names depend on how Payload serialises nested group fields and may differ from the
expected values — report what you actually see so this can be diagnosed if needed.

---

### A8: Create availability_cache Table via Payload Migration

This is a direct SQL table — it is not managed by Payload's schema system. Create it through
a hand-written Payload migration containing raw SQL.

```bash
npx payload migrate:create --name m2_availability_cache
```

Open the generated migration file. Replace its entire content with:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS availability_cache (
      id SERIAL PRIMARY KEY,
      property_id TEXT NOT NULL,
      res_request_property_id TEXT NOT NULL,
      room_type_id TEXT,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      adults INTEGER DEFAULT 2,
      children INTEGER DEFAULT 0,
      available BOOLEAN,
      units_available INTEGER,
      rate_per_night NUMERIC(10,2),
      rate_total NUMERIC(10,2),
      currency TEXT DEFAULT 'USD',
      rate_type TEXT,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      ttl_minutes INTEGER DEFAULT 60,
      UNIQUE(property_id, room_type_id, check_in, check_out, adults, children)
    )
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS availability_cache`)
}
```

Run:
```bash
npx payload migrate
```

Verify using the db_query tool:
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'availability_cache'
) AS table_exists;
```

**Gate:** Returns `true`. If false, report what happened.

---

### A9: Commit Sub-project A

```bash
npm run build 2>&1 | tail -5
```

Build must pass before committing.

```bash
git add src/collections/Activities.ts \
        src/collections/TransferRoutes.ts \
        src/collections/ItineraryPatterns.ts \
        src/collections/Properties.ts \
        src/payload.config.ts \
        src/migrations/
git commit -m "feat(schema): Add Activities, TransferRoutes, ItineraryPatterns; extend Properties with externalIds, canonicalContent, accumulatedData, availability; create availability_cache"
git push
```

**CHECKPOINT: Sub-project A**
```
VERIFICATION
- Build: PASS / FAIL
- activities table in DB: YES / NO
- transfer_routes table in DB: YES / NO
- itinerary_patterns table in DB: YES / NO
- Properties extended columns found: list the actual column names returned
- availability_cache table: YES / NO
- Migration filenames: [list both]
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project B: Scraper Upgrade

**Do not start Sub-project B until Sub-project A is COMPLETE with all gates passed.**

### B0: Current State Verification

Read `lambda/orchestrator/transform.js` and `lambda/orchestrator/handler.js` and confirm:

1. Does `linkProperties()` exist in transform.js?
2. Does the FAQ fix exist — does `generateFaqItems()` use `stay.name || stay.title || stay.supplierName`?
3. Does handler.js have bidirectional property linking code (the section that updates `relatedItineraries`)?
4. What internal `_` fields does transform.js currently return in the `transformed` object?

Report your findings before making any changes.

---

### B1: Update linkProperties() to Capture supplierCode and externalIds

`supplierCode` is confirmed present on presentation segments as `segment.supplierCode`.

**Three changes to `linkProperties()` in transform.js:**

#### Change 1: Update the CREATE path

When creating a new Property (the `POST` to `/api/properties`), add `externalIds` to the body:

```javascript
body: JSON.stringify({
  name: accommodationName,
  slug,
  destination: destinationId,
  description_itrvl: descriptionText,
  externalIds: {
    itrvlSupplierCode: stay.supplierCode || null,
    itrvlPropertyName: accommodationName,
  },
  _status: 'draft',
}),
```

#### Change 2: Update the EXISTING path (slug lookup) to backfill supplierCode

After finding an existing property by slug, if it does not yet have `itrvlSupplierCode` set and
the current segment has one, PATCH it. This must **merge** with existing externalIds data, not
overwrite it.

Replace the existing block that sets `propertyId = slugData.docs[0].id` with:

```javascript
const existingDoc = slugData.docs[0];
propertyId = existingDoc.id;
// Backfill supplierCode if missing — merge with existing externalIds, never overwrite
if (!existingDoc.externalIds?.itrvlSupplierCode && stay.supplierCode) {
  try {
    const mergedExternalIds = {
      ...(existingDoc.externalIds || {}),
      itrvlSupplierCode: stay.supplierCode,
      itrvlPropertyName: existingDoc.externalIds?.itrvlPropertyName || accommodationName,
    };
    await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalIds: mergedExternalIds }),
    });
    console.log(`[linkProperties] BACKFILLED supplierCode: ${stay.supplierCode} -> ${propertyId}`);
  } catch (err) {
    console.error(`[linkProperties] Failed to backfill supplierCode for ${propertyId}: ${err.message}`);
    // Non-fatal
  }
}
```

#### Change 3: Update the ALIAS MATCH path

When a property is found via alias mapping, apply the same backfill logic as Change 2 — fetch
the existing property, check if `itrvlSupplierCode` is absent, and PATCH with merged externalIds
if needed. The pattern is identical to Change 2.

---

### B2: Add linkTransferRoutes() to transform.js

Add this function immediately after `linkProperties()`. It processes flight and road segments to
build the TransferRoutes knowledge base. Note: `itineraryId` is not known at transform time —
observations will have `itineraryId: null` initially. Handler.js will not backfill this. It
is acceptable; the relationship field is nullable.

```javascript
/**
 * Links itinerary transfer segments to TransferRoute records.
 * Creates new records or appends observations to existing ones.
 * @param {Array} segments - Presentation segments from iTrvl
 * @returns {Promise<Map<string, string>>} Map of route slug → TransferRoute Payload ID
 */
async function linkTransferRoutes(segments) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const routeMap = new Map(); // slug → routeId
  const slugCache = new Map(); // slug → fetched route doc (avoid re-fetching)

  if (!PAYLOAD_API_KEY) {
    console.error('[linkTransferRoutes] PAYLOAD_API_KEY not set');
    return routeMap;
  }

  // Only process transfer-type segments; skip entry, exit, point
  const transferTypes = new Set(['flight', 'road', 'boat']);
  const transferSegments = segments.filter(s => transferTypes.has(s.type?.toLowerCase()));

  console.log(`[linkTransferRoutes] Processing ${transferSegments.length} transfer segments`);

  // Pre-fetch destination records by country name (same pattern as linkDestinations)
  const destinationCache = new Map(); // countryName → destinationId
  async function resolveDestination(country) {
    if (!country) return null;
    if (destinationCache.has(country)) return destinationCache.get(country);
    try {
      const res = await fetch(
        `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(country)}&limit=1`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const id = data.docs?.[0]?.id || null;
        destinationCache.set(country, id);
        return id;
      }
    } catch (err) {
      console.error(`[linkTransferRoutes] Destination lookup failed for ${country}: ${err.message}`);
    }
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const segment of transferSegments) {
    const from = segment.fromPoint || segment.from || null;
    const to = segment.toPoint || segment.to || null;

    if (!from || !to) {
      console.log(`[linkTransferRoutes] Skipping segment — missing from/to: ${segment.type} ${segment.title || ''}`);
      continue;
    }

    const mode = segment.type?.toLowerCase() || 'road';
    const slug = generateSlug(from + ' to ' + to);
    const airline = segment.airline || null;
    const departureTime = segment.departureTime || null;
    const arrivalTime = segment.arrivalTime || null;

    const newObservation = {
      departureTime,
      arrivalTime,
      airline,
      dateObserved: today,
    };

    try {
      let existingRoute = slugCache.get(slug) || null;

      if (!existingRoute) {
        const lookupRes = await fetch(
          `${PAYLOAD_API_URL}/api/transfer-routes?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        );
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          existingRoute = lookupData.docs?.[0] || null;
          slugCache.set(slug, existingRoute);
        }
      }

      if (!existingRoute) {
        // Create new TransferRoute
        const fromDestId = await resolveDestination(segment.country);
        const toDestId = null; // Only source country available from segment; toDestination populated manually

        const createBody = {
          from,
          to,
          slug,
          mode,
          fromDestination: fromDestId,
          observations: [newObservation],
          observationCount: 1,
        };

        // Only include airlines array if airline data exists
        if (airline) {
          createBody.airlines = [{ name: airline, go7Airline: false, duffelAirline: false }];
        }

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/transfer-routes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(createBody),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          const routeId = created.doc?.id || created.id;
          routeMap.set(slug, routeId);
          // Update cache with created doc (for dedup within same run)
          slugCache.set(slug, { id: routeId, slug, observations: [newObservation], airlines: createBody.airlines || [], observationCount: 1 });
          console.log(`[linkTransferRoutes] CREATED: ${from} -> ${to} (${mode}) [${routeId}]`);
        } else {
          // Handle slug uniqueness conflict — created concurrently
          if (createRes.status === 400) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/transfer-routes?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
              { headers }
            );
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              existingRoute = retryData.docs?.[0] || null;
              slugCache.set(slug, existingRoute);
            }
          }
          if (!existingRoute) {
            const errText = await createRes.text().catch(() => '');
            console.error(`[linkTransferRoutes] Failed to create ${slug}: ${createRes.status} - ${errText}`);
            continue;
          }
        }
      }

      if (existingRoute) {
        // Append observation and merge airlines array
        const existingObs = existingRoute.observations || [];
        const existingAirlines = existingRoute.airlines || [];

        // Merge airline: add only if not already present by name (case-insensitive)
        let updatedAirlines = existingAirlines;
        if (airline && !existingAirlines.some(a => a.name?.toLowerCase() === airline.toLowerCase())) {
          updatedAirlines = [
            ...existingAirlines,
            { name: airline, go7Airline: false, duffelAirline: false },
          ];
        }

        const patchRes = await fetch(`${PAYLOAD_API_URL}/api/transfer-routes/${existingRoute.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            observations: [...existingObs, newObservation],
            airlines: updatedAirlines,
            observationCount: existingObs.length + 1,
          }),
        });

        if (patchRes.ok) {
          routeMap.set(slug, existingRoute.id);
          console.log(`[linkTransferRoutes] UPDATED: ${from} -> ${to} (${existingObs.length + 1} observations) [${existingRoute.id}]`);
        } else {
          const errText = await patchRes.text().catch(() => '');
          console.error(`[linkTransferRoutes] Failed to update ${existingRoute.id}: ${patchRes.status} - ${errText}`);
        }
      }

    } catch (err) {
      console.error(`[linkTransferRoutes] Error for ${from} -> ${to}: ${err.message}`);
      // Non-fatal — continue to next segment
    }
  }

  console.log(`[linkTransferRoutes] Complete: ${routeMap.size} routes linked`);
  return routeMap;
}
```

---

### B3: Add linkActivities() to transform.js

Add this function immediately after `linkTransferRoutes()`.

**Design decision on deduplication:** Activities deduplicate by slug (name-level). "Morning Game
Drive" appearing across 30 itineraries is ONE Activity record with `observationCount: 30` and
up to 30 properties linked. This is correct — it means the activity name is the canonical
identifier, and one record accumulates all intelligence across scrapes.

**Design decision on property association:** A service segment in iTrvl does not contain a
property reference. The only way to associate an activity with the property that offers it is
to track the "current property" as segments are iterated chronologically. The last stay segment
seen before a service segment is the associated property. This function receives the full ordered
segments array, not just the activity segments, to enable this tracking.

**Design decision on destination:** Resolved from the service segment's own `country` field,
same as how destinations are resolved elsewhere.

```javascript
/**
 * Helper: classify an activity name into a type enum value.
 */
function classifyActivity(name) {
  if (!name) return 'other';
  const n = name.toLowerCase();
  if (n.includes('game drive')) return 'game_drive';
  if (n.includes('gorilla')) return 'gorilla_trek';
  if (n.includes('chimp')) return 'chimpanzee_trek';
  if (n.includes('balloon')) return 'balloon_flight';
  if (n.includes('walking') || n.includes('bush walk')) return 'walking_safari';
  if (n.includes('boat')) return 'boat_safari';
  if (n.includes('canoe')) return 'canoe_safari';
  if (n.includes('horse')) return 'horseback_safari';
  if (n.includes('bush dinner')) return 'bush_dinner';
  if (n.includes('sundowner')) return 'sundowner';
  if (n.includes('fishing')) return 'fishing';
  if (n.includes('bird') || n.includes('birding')) return 'birding';
  if (n.includes('helicopter')) return 'helicopter_flight';
  if (n.includes('photography') || n.includes('photo safari')) return 'photography';
  if (n.includes('spa') || n.includes('wellness')) return 'spa';
  if (n.includes('conservation')) return 'conservation_experience';
  if (n.includes('community') || n.includes('village')) return 'community_visit';
  if (n.includes('cultural')) return 'cultural_visit';
  if (n.includes('diving') || n.includes('scuba')) return 'diving';
  if (n.includes('snorkel')) return 'snorkeling';
  return 'other';
}

/**
 * Links activity segments to Activity records.
 * Uses chronological segment order to infer which property offers each activity.
 * @param {Array} segments - Full ordered presentation segments (all types)
 * @param {Map<string, string>} propertyMap - accommodationName → propertyId from linkProperties()
 * @returns {Promise<Map<string, string>>} Map of activity slug → Activity Payload ID
 */
async function linkActivities(segments, propertyMap) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const activityMap = new Map(); // slug → activityId
  const slugCache = new Map();   // slug → fetched activity doc

  if (!PAYLOAD_API_KEY) {
    console.error('[linkActivities] PAYLOAD_API_KEY not set');
    return activityMap;
  }

  // Destination cache: country → destinationId
  const destinationCache = new Map();
  async function resolveDestination(country) {
    if (!country) return null;
    if (destinationCache.has(country)) return destinationCache.get(country);
    try {
      const res = await fetch(
        `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(country)}&limit=1`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const id = data.docs?.[0]?.id || null;
        destinationCache.set(country, id);
        return id;
      }
    } catch (err) { /* non-fatal */ }
    return null;
  }

  // Track current property context as segments are iterated in order
  let currentPropertyId = null;

  for (const segment of segments) {
    const segType = segment.type?.toLowerCase();

    // Update current property context when a stay segment is encountered
    if (segType === 'stay' || segType === 'accommodation') {
      const name = segment.name || segment.title || segment.supplierName;
      if (name && propertyMap.has(name)) {
        currentPropertyId = propertyMap.get(name);
      }
      continue; // Stay segments are not activities
    }

    // Process service/activity segments only
    if (segType !== 'service' && segType !== 'activity') {
      // For non-stay, non-activity segments (transfers etc), reset current context if
      // we cross into a different country — transfers mark the boundary between properties
      // Do NOT reset currentPropertyId here — activities at a destination may appear
      // after an entry segment but before the first stay record in the segment list.
      continue;
    }

    const activityName = segment.name || segment.title;
    if (!activityName) continue;

    const slug = generateSlug(activityName);
    const activityType = classifyActivity(activityName);

    try {
      let existingDoc = slugCache.get(slug) || null;

      if (!existingDoc) {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          existingDoc = data.docs?.[0] || null;
          slugCache.set(slug, existingDoc);
        }
      }

      let activityId;

      if (!existingDoc) {
        // Create new Activity
        const destId = await resolveDestination(segment.country);

        const createBody = {
          name: activityName,
          slug,
          type: activityType,
          destinations: destId ? [destId] : [],
          properties: currentPropertyId ? [currentPropertyId] : [],
          observationCount: 1,
        };

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/activities`, {
          method: 'POST',
          headers,
          body: JSON.stringify(createBody),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          activityId = created.doc?.id || created.id;
          slugCache.set(slug, { id: activityId, slug, destinations: createBody.destinations, properties: createBody.properties, observationCount: 1 });
          console.log(`[linkActivities] CREATED: ${activityName} (${activityType}) [${activityId}]`);
        } else {
          // Conflict — fetch and use existing
          const retryRes = await fetch(
            `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
            { headers }
          );
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            existingDoc = retryData.docs?.[0] || null;
            slugCache.set(slug, existingDoc);
            activityId = existingDoc?.id || null;
          }
          if (!activityId) {
            const errText = await createRes.text().catch(() => '');
            console.error(`[linkActivities] Failed to create ${activityName}: ${createRes.status} - ${errText}`);
            continue;
          }
        }
      }

      if (existingDoc) {
        activityId = existingDoc.id;

        // Build updated destinations array (dedup by ID)
        const existingDests = (existingDoc.destinations || []).map(d => typeof d === 'object' ? d.id : d);
        const destId = await resolveDestination(segment.country);
        const updatedDests = destId && !existingDests.includes(destId)
          ? [...existingDests, destId]
          : existingDests;

        // Build updated properties array (dedup by ID)
        const existingProps = (existingDoc.properties || []).map(p => typeof p === 'object' ? p.id : p);
        const updatedProps = currentPropertyId && !existingProps.includes(currentPropertyId)
          ? [...existingProps, currentPropertyId]
          : existingProps;

        const patchRes = await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            destinations: updatedDests,
            properties: updatedProps,
            observationCount: (existingDoc.observationCount || 0) + 1,
          }),
        });

        if (patchRes.ok) {
          console.log(`[linkActivities] UPDATED: ${activityName} [${activityId}]`);
          // Update cache with new counts to avoid stale reads
          slugCache.set(slug, {
            ...existingDoc,
            destinations: updatedDests,
            properties: updatedProps,
            observationCount: (existingDoc.observationCount || 0) + 1,
          });
        } else {
          const errText = await patchRes.text().catch(() => '');
          console.error(`[linkActivities] Failed to update ${activityId}: ${patchRes.status} - ${errText}`);
        }
      }

      if (activityId) {
        activityMap.set(slug, activityId);
      }

    } catch (err) {
      console.error(`[linkActivities] Error for ${activityName}: ${err.message}`);
      // Non-fatal
    }
  }

  console.log(`[linkActivities] Complete: ${activityMap.size} activities linked`);
  return activityMap;
}
```

---

### B4: Update transform() Function

In the `transform()` function, make the following changes.

#### 4A: Call the new functions and build internal data structures

After the existing `linkDestinations()` and `linkProperties()` calls, add:

```javascript
// Link/create transfer route records
const transferRouteMap = await linkTransferRoutes(segments);

// Link/create activity records (passes full segments for context tracking)
const activityMap = await linkActivities(segments, propertyMap);
```

#### 4B: Extract pax data

Immediately after extracting `nights` and `countries`, add:

```javascript
const adultsCount = itinerary.adults ?? itinerary.travelers?.adults ?? null;
const childrenCount = itinerary.children ?? itinerary.travelers?.children ?? null;
```

#### 4C: Build _stayData for handler.js price observations

After `propertyMap` is built and before building the `days` array, add:

```javascript
// Build ordered stay data for accumulatedData population in handler.js
// This must use the same fallback chain as mapSegmentToBlock to match propertyMap keys
const _stayData = segments
  .filter(s => s.type === 'stay' || s.type === 'accommodation')
  .map(s => {
    const accommodationName = s.name || s.title || s.supplierName;
    const propertyId = accommodationName ? propertyMap.get(accommodationName) : null;
    return {
      propertyId: propertyId || null,
      propertyName: accommodationName || null,
      nights: s.nights || 1,
    };
  })
  .filter(s => s.propertyId); // Only include stays that have a linked property
```

#### 4D: Build _transferSequenceData

After `_stayData` is built, add:

```javascript
// Build transfer sequence with correct afterProperty index
// Iterate segments chronologically, tracking property counter
// This produces the correct afterProperty values for ItineraryPatterns.transferSequence
let _propertyCounter = 0;
const _transferSequenceData = [];

for (const segment of segments) {
  const segType = segment.type?.toLowerCase();

  if (segType === 'stay' || segType === 'accommodation') {
    const name = segment.name || segment.title || segment.supplierName;
    if (name && propertyMap.has(name)) {
      _propertyCounter++;
    }
    continue;
  }

  if (['flight', 'road', 'boat'].includes(segType)) {
    const from = segment.fromPoint || segment.from || null;
    const to = segment.toPoint || segment.to || null;
    if (from && to) {
      const routeSlug = generateSlug(from + ' to ' + to);
      const routeId = transferRouteMap.get(routeSlug) || null;
      if (routeId) {
        _transferSequenceData.push({
          routeId,
          afterProperty: _propertyCounter, // 0 = before any property, 1 = after first property, etc.
          mode: segType,
        });
      }
    }
  }
}
```

#### 4E: Add new fields to the returned transformed object

In the `transformed` object literal at the end of `transform()`, add these fields alongside the
existing `_propertyIds` field:

```javascript
// Existing:
_propertyIds: [...new Set(propertyMap.values())],

// Add:
_stayData,                                      // Ordered stay data for price observations
_transferSequenceData,                          // Transfer sequence with correct afterProperty
_adultsCount: adultsCount,
_childrenCount: childrenCount,
_priceTotal: Math.round(priceInCents / 100),    // Total price in USD
_totalNights: nights,
itineraryStartDate: itinerary.startDate || null, // Needed by handler.js for ItineraryPatterns
```

---

### B5: Update handler.js

Read handler.js before making any changes. Make the following additions and modifications.

#### 5A: Strip all internal _ fields before Payload saves

Find the block where `createData` is constructed and where `updateData` is constructed.
Both currently have `delete createData._propertyIds` and `delete updateData._propertyIds`.

Add deletion of all internal fields for both paths:

```javascript
// In the create path, after: delete createData._propertyIds
delete createData._stayData;
delete createData._transferSequenceData;
delete createData._adultsCount;
delete createData._childrenCount;
delete createData._priceTotal;
delete createData._totalNights;
delete createData.itineraryStartDate;
```

Apply the same deletions to the update path.

#### 5B: Add helper functions

Add these helper functions at the top of handler.js (before `exports.handler`):

```javascript
/**
 * Classify price tier from per-night rate in USD
 */
function classifyPriceTier(priceTotal, nights) {
  if (!priceTotal || !nights || nights === 0) return null;
  const perNight = priceTotal / nights;
  if (perNight >= 3000) return 'ultra_premium';
  if (perNight >= 1500) return 'premium';
  if (perNight >= 800) return 'mid_luxury';
  return 'accessible_luxury';
}

/**
 * Classify pax type from adults and children counts
 */
function determinePaxType(adults, children) {
  if (children != null && children > 0) return 'family';
  if (adults === 1) return 'solo';
  if (adults === 2) return 'couple';
  if (adults > 4) return 'group';
  return 'unknown';
}
```

#### 5C: Add accumulatedData population

The existing bidirectional property linking code in handler.js loops through `propertyIds` and
updates `relatedItineraries` on each property. **Immediately after that loop** (after all
`relatedItineraries` updates are complete), add:

```javascript
// === PRICE OBSERVATIONS ===
// Write price observations to each property's accumulatedData.pricePositioning
const stayData = transformedData._stayData || [];
const priceTotal = transformedData._priceTotal || 0;
const totalNights = transformedData._totalNights || 0;
const pricePerNightEstimate = totalNights > 0 ? Math.round(priceTotal / totalNights) : null;
const priceTier = classifyPriceTier(priceTotal, totalNights);

if (pricePerNightEstimate && stayData.length > 0) {
  console.log(`[Orchestrator] Writing price observations for ${stayData.length} properties`);
  for (const stay of stayData) {
    try {
      const existingProp = await payload.getById('properties', stay.propertyId, { depth: 0 });
      const existingObs = existingProp.accumulatedData?.pricePositioning?.observations || [];
      const updatedObs = [
        ...existingObs,
        {
          itineraryId: payloadItinerary.id,
          pricePerNightEstimate,
          priceTier,
          observedAt: new Date().toISOString().slice(0, 10),
        },
      ];
      await payload.update('properties', stay.propertyId, {
        accumulatedData: {
          ...(existingProp.accumulatedData || {}),
          pricePositioning: {
            observations: updatedObs,
            observationCount: updatedObs.length,
          },
        },
      });
      console.log(`[Orchestrator] Price observation written: ${stay.propertyName} -> £${pricePerNightEstimate}/night`);
    } catch (err) {
      console.error(`[Orchestrator] Failed to write price observation for ${stay.propertyId}: ${err.message}`);
      // Non-fatal
    }
  }
}
```

#### 5D: Add commonPairings population

Immediately after the price observations block, add:

```javascript
// === COMMON PAIRINGS ===
// For each property in sequence, record what comes before and after it
// Example: [PropA, PropB, PropC] → PropA gets PropB as "after", PropB gets PropA as "before" AND PropC as "after"
const orderedPropertyIds = stayData.map(s => s.propertyId).filter(Boolean);

if (orderedPropertyIds.length >= 2) {
  console.log(`[Orchestrator] Updating commonPairings for ${orderedPropertyIds.length} properties`);

  for (let i = 0; i < orderedPropertyIds.length; i++) {
    const currentPropId = orderedPropertyIds[i];
    const pairingUpdates = []; // [{ propertyId, position }] to add

    if (i > 0) {
      pairingUpdates.push({ propertyId: orderedPropertyIds[i - 1], position: 'before' });
    }
    if (i < orderedPropertyIds.length - 1) {
      pairingUpdates.push({ propertyId: orderedPropertyIds[i + 1], position: 'after' });
    }

    try {
      const existingProp = await payload.getById('properties', currentPropId, { depth: 0 });
      const existingPairings = existingProp.accumulatedData?.commonPairings || [];

      let updatedPairings = [...existingPairings];
      let changed = false;

      for (const { propertyId: pairedId, position } of pairingUpdates) {
        // Find existing pairing entry for this property+position combination
        const existingIndex = updatedPairings.findIndex(p => {
          const pId = typeof p.property === 'object' ? p.property.id : p.property;
          return String(pId) === String(pairedId) && p.position === position;
        });

        if (existingIndex >= 0) {
          // Increment count
          updatedPairings[existingIndex] = {
            ...updatedPairings[existingIndex],
            count: (updatedPairings[existingIndex].count || 1) + 1,
          };
        } else {
          // Add new pairing
          updatedPairings.push({ property: pairedId, position, count: 1 });
        }
        changed = true;
      }

      if (changed) {
        await payload.update('properties', currentPropId, {
          accumulatedData: {
            ...(existingProp.accumulatedData || {}),
            commonPairings: updatedPairings,
          },
        });
        console.log(`[Orchestrator] CommonPairings updated for property ${currentPropId}`);
      }
    } catch (err) {
      console.error(`[Orchestrator] Failed to update commonPairings for ${currentPropId}: ${err.message}`);
      // Non-fatal
    }
  }
}
```

#### 5E: Add ItineraryPatterns creation

Immediately after the commonPairings block, add:

```javascript
// === ITINERARY PATTERNS ===
// Upsert: if a pattern already exists for this itinerary, delete it first, then create fresh.
// (sourceItinerary is unique — a blind POST would fail on re-scrape.)
try {
  // Check for existing pattern
  const existingPatterns = await payload.find('itinerary-patterns', {
    'where[sourceItinerary][equals]': String(payloadItinerary.id),
    limit: 1,
  });
  if (existingPatterns.docs?.length > 0) {
    await payload.update('itinerary-patterns', existingPatterns.docs[0].id, {
      // Mark as deleted by setting a flag would require schema change.
      // Simpler: Payload does not have a delete method in payload.js.
      // We will PATCH the existing record with fresh data instead.
    });
    // Payload.js does not expose a delete method — PATCH the existing record instead.
    const existingPatternId = existingPatterns.docs[0].id;
    console.log(`[Orchestrator] Existing ItineraryPattern found (${existingPatternId}) — will overwrite`);

    const startDate = transformedData.itineraryStartDate;
    const travelMonth = startDate ? parseInt(startDate.slice(5, 7)) : null;
    const travelYear = startDate ? parseInt(startDate.slice(0, 4)) : null;

    const stayDataForPattern = (transformedData._stayData || []).filter(s => s.propertyId);
    const propertySequence = stayDataForPattern.map((stay, index) => ({
      property: stay.propertyId,
      nights: stay.nights,
      order: index + 1,
      roomType: null,
    }));

    const transferSequence = (transformedData._transferSequenceData || []).map(t => ({
      route: t.routeId,
      afterProperty: t.afterProperty,
      mode: t.mode,
    }));

    const patternData = {
      extractedAt: new Date().toISOString(),
      countries: transformedData.destinations || [],
      totalNights: transformedData._totalNights || 0,
      paxType: determinePaxType(transformedData._adultsCount, transformedData._childrenCount),
      adults: transformedData._adultsCount,
      children: transformedData._childrenCount,
      propertySequence,
      transferSequence,
      priceTotal: transformedData._priceTotal || null,
      currency: transformedData.investmentLevel?.currency || 'USD',
      pricePerNightAvg: totalNights > 0 && transformedData._priceTotal
        ? Math.round(transformedData._priceTotal / totalNights)
        : null,
      priceTier: classifyPriceTier(transformedData._priceTotal, totalNights),
      travelMonth,
      travelYear,
    };

    await payload.update('itinerary-patterns', existingPatternId, patternData);
    console.log(`[Orchestrator] ItineraryPattern updated: ${existingPatternId}`);

  } else {
    // No existing pattern — create fresh
    const startDate = transformedData.itineraryStartDate;
    const travelMonth = startDate ? parseInt(startDate.slice(5, 7)) : null;
    const travelYear = startDate ? parseInt(startDate.slice(0, 4)) : null;

    const stayDataForPattern = (transformedData._stayData || []).filter(s => s.propertyId);
    const propertySequence = stayDataForPattern.map((stay, index) => ({
      property: stay.propertyId,
      nights: stay.nights,
      order: index + 1,
      roomType: null,
    }));

    const transferSequence = (transformedData._transferSequenceData || []).map(t => ({
      route: t.routeId,
      afterProperty: t.afterProperty,
      mode: t.mode,
    }));

    await payload.create('itinerary-patterns', {
      sourceItinerary: payloadItinerary.id,
      extractedAt: new Date().toISOString(),
      countries: transformedData.destinations || [],
      totalNights: transformedData._totalNights || 0,
      paxType: determinePaxType(transformedData._adultsCount, transformedData._childrenCount),
      adults: transformedData._adultsCount,
      children: transformedData._childrenCount,
      propertySequence,
      transferSequence,
      priceTotal: transformedData._priceTotal || null,
      currency: transformedData.investmentLevel?.currency || 'USD',
      pricePerNightAvg: totalNights > 0 && transformedData._priceTotal
        ? Math.round(transformedData._priceTotal / totalNights)
        : null,
      priceTier: classifyPriceTier(transformedData._priceTotal, totalNights),
      travelMonth,
      travelYear,
    });
    console.log(`[Orchestrator] ItineraryPattern created for itinerary ${payloadItinerary.id}`);
  }
} catch (err) {
  console.error(`[Orchestrator] Failed to upsert ItineraryPattern: ${err.message}`);
  // Non-fatal
}
```

**Note:** The ItineraryPatterns block references `totalNights` from the outer scope. Ensure it is
accessible at the point where this code runs. If not, use `transformedData._totalNights || 0`.

---

### B6: Verify Syntax and Build

```bash
node -c lambda/orchestrator/transform.js
node -c lambda/orchestrator/handler.js
```

Fix any syntax errors before proceeding.

```bash
cd lambda && ./sync-shared.sh && cd ..
npm run build 2>&1 | tail -20
```

**Gate:** Both syntax checks pass. Build passes. If either fails, fix before committing.

---

### B7: Commit Sub-project B

```bash
git add lambda/orchestrator/transform.js lambda/orchestrator/handler.js
git commit -m "feat(scraper): Add linkTransferRoutes, linkActivities; populate accumulatedData and commonPairings; create ItineraryPatterns on each scrape; capture supplierCode"
git push
```

**CHECKPOINT: Sub-project B**
```
VERIFICATION
- transform.js syntax: PASS / FAIL
- handler.js syntax: PASS / FAIL
- Build: PASS / FAIL
- linkTransferRoutes() exists in transform.js: YES / NO
- linkActivities() with context tracking exists in transform.js: YES / NO
- classifyActivity() helper exists in transform.js: YES / NO
- _stayData built in transform(): YES / NO
- _transferSequenceData built in transform(): YES / NO
- itineraryStartDate in transformed output: YES / NO
- All _ fields stripped before Payload save in handler.js: YES / NO (list which are stripped)
- classifyPriceTier() and determinePaxType() helpers in handler.js: YES / NO
- accumulatedData price observations block in handler.js: YES / NO
- commonPairings block in handler.js: YES / NO
- ItineraryPatterns upsert block in handler.js: YES / NO
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project C: Content Engine Alignment

**Do not start Sub-project C until Sub-project B is COMPLETE.**

### C1: Check Cascade for Conflicts

Read all files in `content-engine/cascade/` and report:

1. Does the cascade do any entity extraction that duplicates what the scraper now does?
   Specifically: does it create Properties, TransferRoutes, Activities, or ItineraryPatterns records?
2. List every file in the cascade directory and one-line summary of what each does.

Do not attempt to resolve conflicts yourself. Report them.

If the cascade directory does not exist or contains no entity extraction, state that explicitly.

---

### C2: Verify Content Engine Health

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-content-system-secret: ${CONTENT_SYSTEM_SECRET}" \
  https://kiuli.com/api/content-system/health
```

**Gate:** Returns 200. If it returns anything else, this is a regression from the schema changes.
Report the full curl output including response body. Do not proceed past this point if it fails.
The schema changes are additive and should not have broken anything — a failure here requires
strategic review before continuing.

---

### C3: Final git state

```bash
git status
```

If anything is uncommitted, commit with an appropriate message. Report the final git log:

```bash
git log --oneline -5
```

---

## Final Report

When all three sub-projects are complete, report in this exact format:

```
M2 COMPLETION REPORT
Date: [timestamp]

SUB-PROJECT A: Schema
- activities table: YES/NO (verified by SQL)
- transfer_routes table: YES/NO (verified by SQL)
- itinerary_patterns table: YES/NO (verified by SQL)
- availability_cache table: YES/NO (verified by SQL)
- Properties new columns found: [list the actual column names returned by A7 query]
- Migration files created: [list all filenames]
- Build: PASS/FAIL

SUB-PROJECT B: Scraper
- supplierCode captured on CREATE path: YES/NO
- supplierCode backfill on EXISTING path (with merge): YES/NO
- linkTransferRoutes() implemented: YES/NO
- linkActivities() implemented with property context tracking: YES/NO
- _stayData in transform() output: YES/NO
- _transferSequenceData with correct afterProperty: YES/NO
- itineraryStartDate in transform() output: YES/NO
- All _ fields stripped before Payload save: YES/NO
- accumulatedData price observations in handler.js: YES/NO
- commonPairings in handler.js: YES/NO
- ItineraryPatterns upsert in handler.js: YES/NO
- Lambdas deployed to AWS: NO (deployment is a separate step)
- Build: PASS/FAIL

SUB-PROJECT C: Content Engine
- Cascade files checked: [list files found]
- Cascade conflicts: NONE / [describe any found]
- Content Engine health endpoint: [HTTP status code]

GIT
- All commits pushed: YES/NO
- Final 5 commits: [paste git log --oneline -5 output]

BLOCKERS
[List anything that prevented completion or requires strategic decision before proceeding]
```

---

## Critical Constraints Across All Sub-projects

1. **Build must pass before every commit.** No exceptions.
2. **Verify schema with SQL after every migration.** The migration running without error is not
   evidence. Column existence in the database is evidence.
3. **Read before you modify.** Check the actual file contents before making changes.
4. **One failure must not cascade.** All new scraper functions and all handler.js additions are
   non-fatal. Wrap everything in try/catch. Log and continue.
5. **Do not deploy Lambdas.** Code changes only. Lambda deployment to AWS is a separate step
   requiring a separate instruction.
6. **Do not re-scrape itineraries.** Schema and code changes only. Re-scraping is a separate step.
7. **No placeholders, no TODOs, no "implement later".** All code must be complete and functional.
8. **Do not invent field paths.** The scraping reference confirms `segment.supplierCode`,
   `segment.airline`, `segment.fromPoint`, `segment.toPoint`, `segment.departureTime`,
   `segment.arrivalTime` are all on presentation segments. Use them directly.
