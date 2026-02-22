# M2: Schema Evolution & Scraper Upgrade

**Date:** 2026-02-22  
**Author:** Claude (Strategic)  
**Recipient:** Claude Code (Tactical)  
**Scope:** Sub-projects A, B, and C

---

## Confirmed Architecture Facts

Read this section before touching any file. These are verified facts, not assumptions.

**Data flow:** The scraper Lambda returns `scraperResult.data`. In the orchestrator,
`rawData = scraperResult.data`. The itinerary is accessed as
`rawData.itinerary?.itineraries?.[0]` — this is the **presentation** itinerary from
the iTrvl presentation API. Its `.segments[]` are **presentation segments**.

**Confirmed field paths on presentation segments:**
- `segment.supplierCode` — present in both raw and presentation. Use this directly.
- `segment.notes?.contactEmail` — this is a raw-only field. Presentation segments may
  not carry it. Try `segment.notes?.contactEmail || null`. If null, accept it. Do not
  restructure the data flow to access raw segments — that is out of scope.
- `segment.airline` — present on flight segments in presentation.
- `segment.departureTime`, `segment.arrivalTime` — present on flight/road segments.
- `segment.from || segment.fromPoint` — transfer origin.
- `segment.to || segment.toPoint` — transfer destination.

**Confirmed pax field paths:**
```javascript
const itinerary = rawData.itinerary?.itineraries?.[0];
const adultsCount = itinerary?.adults ?? null;
const childrenCount = itinerary?.children ?? null;
```
These fields are at the itinerary level, not segment level. Confirmed from the
scraping reference: `presentation: { adults: number, children: number, pax: number }`.

**Payload auth header:** All Payload API calls use `users API-Key ${PAYLOAD_API_KEY}`.
No exceptions.

**Payload PATCH behaviour on groups:** When PATCHing a document with a group field,
Payload replaces all sub-fields of that group with what you provide. If you send
`{ accumulatedData: { pricePositioning: { ... } } }`, the `commonPairings` sub-field
will be wiped unless you include it. Always fetch the existing record first, merge all
group sub-fields, then PATCH the complete merged group.

**`payload.js` shared module methods available in handler.js:**
`payload.findOne(collection, query)`, `payload.create(collection, data)`,
`payload.update(collection, id, data)`, `payload.getById(collection, id, options)`.
Use these. Do not raw-fetch in handler.js when these wrappers exist.

---

## Pre-flight: Required Reads and Verification

Read these files before making any changes. This is mandatory.

```
1. src/collections/Properties.ts
2. src/payload.config.ts
3. lambda/orchestrator/transform.js
4. lambda/orchestrator/handler.js
```

Then run these SQL queries and report every result before proceeding:

```sql
-- 1. What tables currently exist?
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 2. What columns currently exist on properties?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
ORDER BY column_name;

-- 3. Does availability_cache already exist?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'availability_cache'
) AS exists;

-- 4. Current data state
SELECT
  (SELECT count(*) FROM properties) AS property_count,
  (SELECT count(*) FROM itineraries) AS itinerary_count,
  (SELECT count(*) FROM destinations) AS destination_count;
```

**Stop and report all query results before any code changes.**

---

## Sub-project A: Schema Changes

### A1: Extend Properties Collection

Edit `src/collections/Properties.ts`. Add the five field groups below **after the
closing brace of the existing `priceTier` field and before the final `]` of the
`fields` array**. Do not remove, rename, or reorder any existing field.

#### Field group 1: externalIds

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
      admin: { description: 'supplierCode from iTrvl API — may be the ResRequest property ID' },
    },
    {
      name: 'itrvlPropertyName',
      type: 'text',
      admin: { description: 'Property name as it appears in iTrvl (for dedup detection)' },
    },
    {
      name: 'resRequestPropertyId',
      type: 'text',
      admin: { description: 'ResRequest property ID (Phase 3 — ResConnect integration)' },
    },
    {
      name: 'resRequestPrincipalId',
      type: 'text',
      admin: { description: 'ResRequest principal / lodge group ID (Phase 3)' },
    },
    {
      name: 'resRequestAccommTypes',
      type: 'array',
      admin: { description: 'Accommodation type IDs in ResRequest (Phase 3)' },
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
      admin: { description: 'Wetu content entity ID (Phase 2 — Wetu integration)' },
    },
  ],
},
```

#### Field group 2: canonicalContent

```typescript
{
  name: 'canonicalContent',
  type: 'group',
  admin: {
    description: 'Canonical content — partially from iTrvl, enriched via Wetu in Phase 2',
  },
  fields: [
    {
      name: 'coordinates',
      type: 'group',
      admin: { description: 'GPS coordinates — from iTrvl where available, Wetu sync in Phase 2' },
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'contactEmail',
      type: 'email',
      admin: { description: 'Property contact email from iTrvl notes.contactEmail' },
    },
    {
      name: 'contactPhone',
      type: 'text',
      admin: { description: 'Property contact phone from iTrvl notes.contactNumber' },
    },
  ],
},
```

#### Field group 3: roomTypes

```typescript
{
  name: 'roomTypes',
  type: 'array',
  admin: { description: 'Room types — populated from Wetu in Phase 2, manual entry before that' },
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
      admin: { description: 'Room type image' },
    },
  ],
},
```

#### Field group 4: accumulatedData

```typescript
{
  name: 'accumulatedData',
  type: 'group',
  admin: {
    description: 'Accumulated intelligence from scraped itineraries — grows with each scrape',
  },
  fields: [
    {
      name: 'pricePositioning',
      type: 'group',
      fields: [
        {
          name: 'observations',
          type: 'array',
          admin: { description: 'One entry per scraped itinerary that features this property' },
          fields: [
            {
              name: 'itineraryId',
              type: 'relationship',
              relationTo: 'itineraries',
              admin: { description: 'Source itinerary' },
            },
            {
              name: 'pricePerNight',
              type: 'number',
              admin: { description: 'USD — total itinerary price divided by total nights' },
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
          admin: { readOnly: true, description: 'Total number of price observations' },
        },
      ],
    },
    {
      name: 'commonPairings',
      type: 'array',
      admin: {
        description: 'Properties that appear immediately before or after this one across scraped itineraries',
      },
      fields: [
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          admin: { description: 'The paired property' },
        },
        {
          name: 'position',
          type: 'select',
          options: [
            { label: 'Before', value: 'before' },
            { label: 'After', value: 'after' },
          ],
          admin: {
            description: 'Whether the paired property appears before or after this one in the itinerary',
          },
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

#### Field group 5: availability

```typescript
{
  name: 'availability',
  type: 'group',
  admin: {
    description: 'Availability integration status',
  },
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
      admin: { description: 'Which source provides live availability for this property' },
    },
  ],
},
```

After editing, run `npm run build 2>&1 | tail -40`. Fix any TypeScript errors before
proceeding. **Do not commit a failing build.**

**Gate A1:** `npm run build` exits with zero errors, no warnings about Properties.ts.

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
      admin: { description: 'e.g. "Gorilla Trekking", "Morning Game Drive"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL-friendly slug for deduplication' },
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
      admin: { description: 'Activity category for pattern matching' },
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
      admin: { description: 'Activity description' },
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
        { label: 'Any Time', value: 'any' },
      ],
      admin: { description: 'Optimal time of day for this activity' },
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
      admin: { description: 'Minimum age requirement. Leave empty if no restriction.' },
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
      admin: { description: 'Wetu content entity ID (Phase 2)' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'How many scraped itineraries include this activity',
      },
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
      admin: { description: 'Destination region containing the origin point' },
    },
    {
      name: 'toDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination region containing the arrival point' },
    },
    {
      name: 'fromProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at origin, if applicable' },
    },
    {
      name: 'toProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at destination, if applicable' },
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
      admin: { description: 'Typical journey duration in minutes' },
    },
    {
      name: 'distanceKm',
      type: 'number',
      admin: { description: 'Approximate distance in kilometres' },
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
          admin: { description: 'Available via GO7/AeroCRS network (Phase 4)' },
        },
        {
          name: 'duffelAirline',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Available via Duffel API (Phase 4)' },
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
      admin: { description: 'One entry per scrape that uses this route' },
      fields: [
        {
          name: 'itineraryId',
          type: 'relationship',
          relationTo: 'itineraries',
          admin: { description: 'Source itinerary' },
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
      admin: { readOnly: true, description: 'How many scraped itineraries use this route' },
    },
    {
      name: 'wetuRouteId',
      type: 'text',
      admin: { description: 'Wetu route entity ID (Phase 2)' },
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
      admin: { description: 'Countries covered by this itinerary' },
    },
    {
      name: 'totalNights',
      type: 'number',
      admin: { description: 'Total nights across all stays' },
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
      admin: { description: 'Adult pax count' },
    },
    {
      name: 'children',
      type: 'number',
      admin: { description: 'Child pax count' },
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
          admin: { description: 'Nights at this property' },
        },
        {
          name: 'order',
          type: 'number',
          admin: { description: '1-based position in itinerary sequence' },
        },
        {
          name: 'roomType',
          type: 'text',
          admin: { description: 'Room type booked, if known' },
        },
      ],
    },
    {
      name: 'transferSequence',
      type: 'array',
      admin: { description: 'Ordered list of transfers, each positioned relative to the preceding property' },
      fields: [
        {
          name: 'route',
          type: 'relationship',
          relationTo: 'transfer-routes',
        },
        {
          name: 'afterProperty',
          type: 'number',
          admin: { description: '1-based index of the property this transfer follows' },
        },
        {
          name: 'mode',
          type: 'text',
          admin: { description: 'Segment type from iTrvl: flight, road, boat' },
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
      admin: { description: 'priceTotal divided by totalNights' },
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
      admin: { description: 'From itinerary start date' },
    },
  ],
}
```

---

### A5: Register New Collections

Edit `src/payload.config.ts`:

Add these three import statements alongside the existing collection imports:
```typescript
import { Activities } from './collections/Activities'
import { TransferRoutes } from './collections/TransferRoutes'
import { ItineraryPatterns } from './collections/ItineraryPatterns'
```

Add `Activities`, `TransferRoutes`, `ItineraryPatterns` to the `collections` array.

Run `npm run build 2>&1 | tail -40`. Fix any TypeScript errors before proceeding.

**Gate A5:** Build passes with zero TypeScript errors.

---

### A6: Generate and Run the Payload Migration

```bash
npx payload migrate:create --name m2_schema_evolution
```

Verify the file was created:
```bash
ls -la src/migrations/ | grep m2
```

Report the exact filename. Then run:
```bash
npx payload migrate
```

Report the exact output. If the command fails with a database connection error, verify
`DATABASE_URL_UNPOOLED` is set in `.env.local` and retry.

**Gate A6:** Migration output confirms the migration was applied. Report exact output.

---

### A7: Verify New Schema in Live Database

Run these queries and report every result:

```sql
-- New collection tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('activities', 'transfer_routes', 'itinerary_patterns')
ORDER BY table_name;
-- Expected: 3 rows

-- All columns now on properties (including new ones)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
ORDER BY column_name;
-- Report all columns. Look for external_ids_*, canonical_content_*,
-- accumulated_data_*, availability_source among them.
```

**STOP if the new collection tables do not exist (fewer than 3 rows in first query).**
Report the actual output and the migration file contents so the issue can be diagnosed.

Do not proceed to A8 until the three tables are confirmed in the database.

---

### A8: Create availability_cache Table

This table bypasses Payload entirely. Create it via a hand-written Payload migration
that executes raw SQL.

```bash
npx payload migrate:create --name m2_availability_cache
```

Edit the generated migration file. Replace its entire contents with:

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

Then run:
```bash
npx payload migrate
```

Verify with this SQL query:
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'availability_cache'
) AS table_exists;
```

**Gate A8:** Returns `true`. If false, do not proceed. Report what happened.

---

### A9: Commit Sub-project A

Run the build one final time before committing:
```bash
npm run build 2>&1 | tail -5
```

If the build passes:
```bash
git add \
  src/collections/Activities.ts \
  src/collections/TransferRoutes.ts \
  src/collections/ItineraryPatterns.ts \
  src/collections/Properties.ts \
  src/payload.config.ts \
  src/migrations/
git commit -m "feat(schema): Add Activities, TransferRoutes, ItineraryPatterns collections; extend Properties with externalIds, canonicalContent, accumulatedData, availability; create availability_cache table"
git push
```

**CHECKPOINT: Sub-project A**
```
VERIFICATION
- Build: PASS / FAIL
- activities table in DB: YES / NO
- transfer_routes table in DB: YES / NO
- itinerary_patterns table in DB: YES / NO
- Properties new columns visible: YES / NO (list a sample of what you see)
- availability_cache table: YES / NO
- Migration filenames: [list both]
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project B: Scraper Upgrade

**Do not start Sub-project B until Sub-project A CHECKPOINT shows STATUS: COMPLETE.**

### B0: Current State Verification

Before modifying any file, read `lambda/orchestrator/transform.js` and
`lambda/orchestrator/handler.js` and answer these four questions:

1. Does `linkProperties()` exist in transform.js? Report yes/no and its approximate line range.
2. Does the `generateFaqItems()` function use the fallback chain
   `stay.name || stay.title || stay.supplierName`? Report yes/no.
3. Does handler.js contain a "bidirectional property linking" block that iterates
   `transformedData._propertyIds` and updates `relatedItineraries`? Report yes/no.
4. Are `_propertyIds` deleted from `createData` before `payload.createItinerary()`? Report yes/no.
   Also check the update path — is `_propertyIds` deleted from `updateData` too?

Report all four answers before writing any code.

---

### B1: New Helper Functions in transform.js

Add all helper functions in this section to `transform.js`. Add them after
`linkProperties()` and before the `transform()` function.

#### Helper: lookupDestinationByCountry

This function is used by `linkTransferRoutes()` and `linkActivities()` to resolve
a country name to a destination ID. It is called with a cache Map that accumulates
results across calls, avoiding redundant API requests.

```javascript
/**
 * Resolves a country name to a Destination ID.
 * Results are cached in the provided Map.
 * Returns null if not found or on error.
 * @param {string} countryName
 * @param {Map<string, string|null>} cache - Shared cache Map keyed by countryName
 * @param {object} headers - Auth headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<string|null>}
 */
async function lookupDestinationByCountry(countryName, cache, headers, PAYLOAD_API_URL) {
  if (!countryName) return null;
  if (cache.has(countryName)) return cache.get(countryName);

  try {
    const res = await fetch(
      `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(countryName)}&limit=1`,
      { headers }
    );
    if (!res.ok) {
      cache.set(countryName, null);
      return null;
    }
    const data = await res.json();
    const id = data.docs?.[0]?.id || null;
    cache.set(countryName, id);
    return id;
  } catch (err) {
    console.error(`[lookupDestinationByCountry] Error for ${countryName}:`, err.message);
    cache.set(countryName, null);
    return null;
  }
}
```

#### Helper: classifyActivity

```javascript
/**
 * Maps an activity name to an activity type value.
 * @param {string} name
 * @returns {string} Activity type value
 */
function classifyActivity(name) {
  const n = name.toLowerCase();
  if (n.includes('gorilla')) return 'gorilla_trek';
  if (n.includes('chimp') || n.includes('chimpanzee')) return 'chimpanzee_trek';
  if (n.includes('game drive')) return 'game_drive';
  if (n.includes('balloon')) return 'balloon_flight';
  if (n.includes('walking') || n.includes('bush walk')) return 'walking_safari';
  if (n.includes('boat')) return 'boat_safari';
  if (n.includes('canoe')) return 'canoe_safari';
  if (n.includes('horse')) return 'horseback_safari';
  if (n.includes('sundowner')) return 'sundowner';
  if (n.includes('bush dinner') || (n.includes('dinner') && n.includes('bush'))) return 'bush_dinner';
  if (n.includes('fishing')) return 'fishing';
  if (n.includes('bird') || n.includes('birding')) return 'birding';
  if (n.includes('helicopter')) return 'helicopter_flight';
  if (n.includes('photo') || n.includes('photography')) return 'photography';
  if (n.includes('spa') || n.includes('wellness')) return 'spa';
  if (n.includes('conservation')) return 'conservation_experience';
  if (n.includes('community') || n.includes('village')) return 'community_visit';
  if (n.includes('cultural')) return 'cultural_visit';
  if (n.includes('snorkel')) return 'snorkeling';
  if (n.includes('div')) return 'diving';
  return 'other';
}
```

#### Helper: classifyPriceTier

```javascript
/**
 * Classifies an itinerary into a price tier based on per-night cost.
 * @param {number|null} priceTotal - Total price in USD
 * @param {number} totalNights
 * @returns {string|null}
 */
function classifyPriceTier(priceTotal, totalNights) {
  if (!priceTotal || !totalNights) return null;
  const perNight = priceTotal / totalNights;
  if (perNight >= 3000) return 'ultra_premium';
  if (perNight >= 1500) return 'premium';
  if (perNight >= 800) return 'mid_luxury';
  return 'accessible_luxury';
}
```

#### Helper: determinePaxType

```javascript
/**
 * Classifies pax configuration into a type.
 * @param {number|null} adults
 * @param {number|null} children
 * @returns {string}
 */
function determinePaxType(adults, children) {
  if (children && children > 0) return 'family';
  if (adults === 1) return 'solo';
  if (adults === 2) return 'couple';
  if (adults > 4) return 'group';
  return 'unknown';
}
```

---

### B2: Modify linkProperties() in transform.js

Read the current `linkProperties()` function. Make these changes to it.

**Change 1: Function signature.** Add a `destinationCache` parameter:

```javascript
async function linkProperties(segments, destinationIds, destinationCache)
```

The `destinationCache` is a `Map<string, string|null>` that is pre-populated by
`linkDestinations()`. It will be used here to avoid redundant destination lookups.
The function currently resolves destination by calling the API for each stay's country.
Keep that logic but use `destinationCache` as a cache: check it before calling the API,
and write results into it.

**Change 2: Capture supplierCode and contactEmail on CREATE.**

When creating a new Property record, add to the POST body:

```javascript
externalIds: {
  itrvlSupplierCode: stay.supplierCode || null,
  itrvlPropertyName: accommodationName,
},
canonicalContent: {
  contactEmail: stay.notes?.contactEmail || null,
  contactPhone: stay.notes?.contactNumber || null,
},
```

**Change 3: Backfill supplierCode on EXISTING records without it — merge, don't overwrite.**

After finding an existing property by slug or alias mapping, check whether it already
has `externalIds.itrvlSupplierCode`. If not, and the current segment has a `supplierCode`
or contact info to contribute, PATCH with a merged object.

The PATCH must preserve all existing field values within the groups being updated.
Fetch the existing record at `depth: 0` first, then merge:

```javascript
if (!existing.externalIds?.itrvlSupplierCode && (stay.supplierCode || stay.notes?.contactEmail)) {
  // Merge: do not overwrite fields that already have values
  const mergedExternalIds = {
    ...existing.externalIds,
    ...(stay.supplierCode ? { itrvlSupplierCode: stay.supplierCode, itrvlPropertyName: accommodationName } : {}),
  };
  const mergedCanonicalContent = {
    ...existing.canonicalContent,
    ...(stay.notes?.contactEmail && !existing.canonicalContent?.contactEmail
      ? { contactEmail: stay.notes.contactEmail } : {}),
    ...(stay.notes?.contactNumber && !existing.canonicalContent?.contactPhone
      ? { contactPhone: stay.notes.contactNumber } : {}),
  };
  try {
    await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalIds: mergedExternalIds,
        canonicalContent: mergedCanonicalContent,
      }),
    });
    console.log(`[linkProperties] BACKFILLED externalIds for property ${propertyId}`);
  } catch (err) {
    console.error(`[linkProperties] BACKFILL failed for ${propertyId}: ${err.message}`);
    // Non-fatal — continue
  }
}
```

**Important note on existing.externalIds:** When you fetch an existing property with
`depth: 0`, Payload returns the full document including group fields. The `externalIds`
group will be present as an object. If no values have been set, Payload may return
`{}` or `null` for the group. Handle both: `existing.externalIds || {}`.

---

### B3: Add linkTransferRoutes() to transform.js

Add this function immediately after `linkProperties()`:

```javascript
/**
 * Creates or updates TransferRoutes records for each flight/road/boat segment.
 * Returns a Map of route-slug → routeId and an array of transfer objects
 * in the order they appear in the segment list, each referencing the 1-based
 * index of the property that precedes it.
 *
 * @param {Array} segments - Presentation segments in chronological order
 * @param {Map<string, string|null>} destinationCache - Country → destinationId cache
 * @returns {Promise<{ routeMap: Map<string, string>, transferSequence: Array }>}
 */
async function linkTransferRoutes(segments, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const routeMap = new Map();         // slug → routeId
  const slugLookupCache = new Map();  // slug → existing route doc (to avoid re-fetching)
  const transferSequence = [];

  let propertyOrderIndex = 0;  // Tracks how many stay segments we've passed

  const transferTypes = new Set(['flight', 'road', 'boat']);

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();

    // Track property position by counting stay segments
    if (type === 'stay' || type === 'accommodation') {
      propertyOrderIndex++;
      continue;
    }

    // Skip non-transfer segments
    if (!transferTypes.has(type)) continue;

    const from = segment.from || segment.fromPoint || segment.location || null;
    const to = segment.to || segment.toPoint || null;

    // Skip if we can't form a meaningful route
    if (!from || !to || from === to) continue;

    const slug = generateSlug(from + '-to-' + to);

    // Map segment type to mode
    let mode = 'road';
    if (type === 'flight') mode = 'flight';
    if (type === 'boat') mode = 'boat';

    // Resolve fromDestination from segment country
    const fromCountry = segment.country || segment.countryName || null;
    const fromDestinationId = fromCountry
      ? await lookupDestinationByCountry(fromCountry, destinationCache, headers, PAYLOAD_API_URL)
      : null;

    try {
      let routeId = routeMap.get(slug) || null;

      if (!routeId) {
        // Check if route already exists
        let existingRoute = slugLookupCache.get(slug) || null;
        if (!existingRoute) {
          const res = await fetch(
            `${PAYLOAD_API_URL}/api/transfer-routes?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
            { headers }
          );
          if (res.ok) {
            const data = await res.json();
            existingRoute = data.docs?.[0] || null;
            if (existingRoute) slugLookupCache.set(slug, existingRoute);
          }
        }

        if (existingRoute) {
          routeId = existingRoute.id;
          routeMap.set(slug, routeId);

          // Append observation and dedup airline
          const existingObs = existingRoute.observations || [];
          const existingAirlines = existingRoute.airlines || [];
          const airlineName = segment.airline || null;
          const airlineAlreadyPresent = airlineName &&
            existingAirlines.some(a => a.name === airlineName);

          const updatedAirlines = airlineAlreadyPresent
            ? existingAirlines
            : [
                ...existingAirlines,
                ...(airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : []),
              ];

          const newObs = {
            departureTime: segment.departureTime || null,
            arrivalTime: segment.arrivalTime || null,
            airline: airlineName,
            dateObserved: new Date().toISOString().slice(0, 10),
          };

          await fetch(`${PAYLOAD_API_URL}/api/transfer-routes/${routeId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              observations: [...existingObs, newObs],
              observationCount: existingObs.length + 1,
              airlines: updatedAirlines,
              // Update fromDestination if we now have it and previously didn't
              ...(fromDestinationId && !existingRoute.fromDestination
                ? { fromDestination: fromDestinationId }
                : {}),
            }),
          });
          console.log(`[linkTransferRoutes] UPDATED: ${from} → ${to} (${existingObs.length + 1} observations)`);

        } else {
          // Create new route
          const airlineName = segment.airline || null;
          const createRes = await fetch(`${PAYLOAD_API_URL}/api/transfer-routes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              from,
              to,
              slug,
              mode,
              fromDestination: fromDestinationId,
              // toDestination is not available from the segment — leave null for Wetu Phase 2
              airlines: airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : [],
              observations: [{
                departureTime: segment.departureTime || null,
                arrivalTime: segment.arrivalTime || null,
                airline: airlineName,
                dateObserved: new Date().toISOString().slice(0, 10),
              }],
              observationCount: 1,
            }),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            routeId = created.doc?.id || created.id;
            routeMap.set(slug, routeId);
            console.log(`[linkTransferRoutes] CREATED: ${from} → ${to} (${routeId})`);
          } else {
            const errText = await createRes.text();
            // Handle slug conflict — route was created concurrently
            if (createRes.status === 400 && errText.includes('unique')) {
              const retryRes = await fetch(
                `${PAYLOAD_API_URL}/api/transfer-routes?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
                { headers }
              );
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (retryData.docs?.[0]?.id) {
                  routeId = retryData.docs[0].id;
                  routeMap.set(slug, routeId);
                  console.log(`[linkTransferRoutes] LINKED (after conflict): ${from} → ${to}`);
                }
              }
            }
            if (!routeId) {
              console.error(`[linkTransferRoutes] Failed to create ${from} → ${to}: ${createRes.status}`);
            }
          }
        }
      }

      // Record this transfer's position in the sequence (after propertyOrderIndex properties)
      if (routeId) {
        transferSequence.push({
          route: routeId,
          afterProperty: propertyOrderIndex,
          mode,
        });
      }

    } catch (err) {
      console.error(`[linkTransferRoutes] Error for ${from} → ${to}:`, err.message);
      // Non-fatal — continue
    }
  }

  console.log(`[linkTransferRoutes] Total routes: ${routeMap.size}, transfers in sequence: ${transferSequence.length}`);
  return { routeMap, transferSequence };
}
```

---

### B4: Add linkActivities() to transform.js

Add this function immediately after `linkTransferRoutes()`:

```javascript
/**
 * Creates or updates Activity records for each service/activity segment.
 *
 * IMPORTANT: Activities are associated with the property they occur at.
 * iTrvl data does not include a property reference on service segments,
 * so we track the "current property" by watching which stay segment most
 * recently preceded each activity in the chronological segment list.
 *
 * @param {Array} segments - Presentation segments in chronological order
 * @param {Map<string, string>} propertyMap - accommodationName → propertyId
 * @param {Map<string, string|null>} destinationCache - Country → destinationId cache
 * @returns {Promise<Map<string, string>>} Map of activity-slug → activityId
 */
async function linkActivities(segments, propertyMap, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const activityMap = new Map();     // slug → activityId
  const slugCache = new Map();       // slug → existing activity doc

  let currentPropertyId = null;     // ID of the most recently seen property
  let currentCountry = null;        // Country of the most recently seen stay segment

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();

    // Track current property context as we move through the itinerary chronologically
    if (type === 'stay' || type === 'accommodation') {
      const name = segment.name || segment.title || segment.supplierName;
      currentPropertyId = name ? (propertyMap.get(name) || null) : null;
      currentCountry = segment.country || segment.countryName || null;
      continue;
    }

    // Only process service/activity segments
    if (type !== 'service' && type !== 'activity') continue;

    const activityName = segment.name || segment.title;
    if (!activityName) continue;

    // Use segment's own country if available, fall back to current property's country
    const country = segment.country || segment.countryName || currentCountry;
    const destinationId = country
      ? await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
      : null;

    const slug = generateSlug(activityName);
    const activityType = classifyActivity(activityName);

    try {
      let activityId = activityMap.get(slug) || null;

      if (!activityId) {
        // Check if activity already exists by slug
        let existingActivity = slugCache.get(slug) || null;
        if (!existingActivity) {
          const res = await fetch(
            `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
            { headers }
          );
          if (res.ok) {
            const data = await res.json();
            existingActivity = data.docs?.[0] || null;
            if (existingActivity) slugCache.set(slug, existingActivity);
          }
        }

        if (existingActivity) {
          activityId = existingActivity.id;
          activityMap.set(slug, activityId);

          // Update: increment observationCount, add destination and property if new
          const existingDestinations = (existingActivity.destinations || [])
            .map(d => typeof d === 'object' ? d.id : d);
          const existingProperties = (existingActivity.properties || [])
            .map(p => typeof p === 'object' ? p.id : p);

          const updatedDestinations = destinationId && !existingDestinations.includes(destinationId)
            ? [...existingDestinations, destinationId]
            : existingDestinations;

          const updatedProperties = currentPropertyId && !existingProperties.includes(currentPropertyId)
            ? [...existingProperties, currentPropertyId]
            : existingProperties;

          await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              observationCount: (existingActivity.observationCount || 0) + 1,
              destinations: updatedDestinations,
              properties: updatedProperties,
            }),
          });
          console.log(`[linkActivities] UPDATED: ${activityName} (${(existingActivity.observationCount || 0) + 1} observations)`);

        } else {
          // Create new activity
          const createRes = await fetch(`${PAYLOAD_API_URL}/api/activities`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: activityName,
              slug,
              type: activityType,
              destinations: destinationId ? [destinationId] : [],
              properties: currentPropertyId ? [currentPropertyId] : [],
              observationCount: 1,
            }),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            activityId = created.doc?.id || created.id;
            activityMap.set(slug, activityId);
            console.log(`[linkActivities] CREATED: ${activityName} → ${activityId}`);
          } else {
            const errText = await createRes.text();
            // Handle slug conflict
            if (createRes.status === 400 && errText.includes('unique')) {
              const retryRes = await fetch(
                `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
                { headers }
              );
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (retryData.docs?.[0]?.id) {
                  activityId = retryData.docs[0].id;
                  activityMap.set(slug, activityId);
                  console.log(`[linkActivities] LINKED (after conflict): ${activityName}`);
                }
              }
            }
            if (!activityId) {
              console.error(`[linkActivities] Failed to create ${activityName}: ${createRes.status}`);
            }
          }
        }
      }

    } catch (err) {
      console.error(`[linkActivities] Error for ${activityName}:`, err.message);
      // Non-fatal — continue
    }
  }

  console.log(`[linkActivities] Total activities: ${activityMap.size}`);
  return activityMap;
}
```

---

### B5: Modify linkDestinations() to return a destinationCache Map

Read the current `linkDestinations()` function. It currently returns `string[]`
(an array of destination IDs). Change it to also return a cache Map.

**New return signature:** Return `{ ids: string[], cache: Map<string, string|null> }`
instead of `string[]`.

```javascript
// At the start of linkDestinations(), initialise the cache:
const destinationCache = new Map();

// When a destination ID is found, write it to the cache:
destinationCache.set(country, data.docs[0].id);
destinationIds.push(data.docs[0].id);

// When a destination is NOT found, write null:
destinationCache.set(country, null);

// Return both at the end:
return { ids: destinationIds, cache: destinationCache };
```

**Update the call site in `transform()`:**

```javascript
// Old:
const destinationIds = await linkDestinations(countriesForLinking);

// New:
const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking);
```

Then pass `destinationCache` to `linkProperties()`, `linkTransferRoutes()`, and
`linkActivities()`.

---

### B6: Modify the transform() Function

In the `transform()` function, after the existing `linkDestinations()` call, update
the sequence of knowledge base calls and build the knowledge base payload:

```javascript
// Existing:
const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking);

// NEW sequence:
const propertyMap = await linkProperties(segments, destinationIds, destinationCache);
const { routeMap: transferRouteMap, transferSequence } = await linkTransferRoutes(segments, destinationCache);
const activityMap = await linkActivities(segments, propertyMap, destinationCache);

// Extract pax counts from the itinerary-level data
const adultsCount = itinerary.adults ?? null;
const childrenCount = itinerary.children ?? null;

// Build propertySequence in chronological order from segments
const propertySequence = [];
let stayOrder = 0;
for (const segment of segments) {
  const type = segment.type?.toLowerCase();
  if (type === 'stay' || type === 'accommodation') {
    stayOrder++;
    const name = segment.name || segment.title || segment.supplierName;
    const propertyId = name ? (propertyMap.get(name) || null) : null;
    if (propertyId) {
      propertySequence.push({
        property: propertyId,
        nights: segment.nights || 1,
        order: stayOrder,
        roomType: segment.roomType || null,
      });
    }
  }
}

// Build _knowledgeBase payload for handler.js to use after payloadItinerary.id is known
const _knowledgeBase = {
  orderedPropertyIds: propertySequence.map(p => p.property),
  propertySequence,
  transferSequence,
  activityIds: [...activityMap.values()],
  adultsCount,
  childrenCount,
};
```

Add `_knowledgeBase` and `startDate` to the returned `transformed` object:

```javascript
const transformed = {
  // ... all existing fields unchanged ...

  startDate: itinerary.startDate || null,   // ADD THIS — handler.js needs it

  // Internal fields for handler.js — stripped before Payload save
  _propertyIds: [...new Set(propertyMap.values())],
  _knowledgeBase,
};
```

**Do not remove any existing fields from the returned object.**

---

### B7: Modify handler.js

#### Change 1: Strip all internal fields before Payload save

Replace the existing `delete createData._propertyIds` and `delete updateData._propertyIds`
(wherever they appear) with a single helper function that strips ALL `_`-prefixed fields.
Add this function near the top of the handler file, before `exports.handler`:

```javascript
/**
 * Strip all internal fields (prefixed with _) before saving to Payload.
 * These fields carry pipeline state and must not reach the database.
 */
function stripInternalFields(data) {
  const stripped = { ...data };
  Object.keys(stripped)
    .filter(k => k.startsWith('_'))
    .forEach(k => delete stripped[k]);
  return stripped;
}
```

Then in the create path:
```javascript
// Replace: delete createData._propertyIds; payloadItinerary = await payload.createItinerary(createData);
// With:
const createData = stripInternalFields({ ...transformedData, version: 1, videoScrapedFromSource, publishChecklist: { ... } });
payloadItinerary = await payload.createItinerary(createData);
```

And in the update path:
```javascript
// Replace: delete updateData._propertyIds;
// With:
const updateData = stripInternalFields({ ...transformedData, version: ..., previousVersions: ..., ... });
payloadItinerary = await payload.updateItinerary(existingItinerary.id, updateData);
```

Make sure `stripInternalFields` is applied to both paths. Verify by inspecting the
code after your edit — the string `_propertyIds` should no longer appear in either path.

#### Change 2: Add accumulatedData updates after bidirectional property linking

In handler.js, find the block that iterates `transformedData._propertyIds` and updates
`relatedItineraries` (the existing bidirectional linking block). **After that entire
block completes**, add the following accumulatedData update block.

This block:
1. Reads the price from `transformedData.investmentLevel.fromPrice` and nights from
   `transformedData.overview.nights`
2. For each property in the ordered sequence, fetches the existing property, merges
   the new price observation and updates common pairings, then PATCHes once

```javascript
// ============================================================
// KNOWLEDGE BASE: accumulatedData updates
// ============================================================
const kb = transformedData._knowledgeBase || {};
const orderedPropertyIds = kb.orderedPropertyIds || [];
const priceTotal = transformedData.investmentLevel?.fromPrice || null;
const totalNights = transformedData.overview?.nights || 0;
const priceTierValue = classifyPriceTier(priceTotal, totalNights);
const pricePerNight = (priceTotal && totalNights) ? Math.round(priceTotal / totalNights) : null;

if (orderedPropertyIds.length > 0) {
  console.log(`[Orchestrator] Updating accumulatedData for ${orderedPropertyIds.length} properties`);

  for (let i = 0; i < orderedPropertyIds.length; i++) {
    const propertyId = orderedPropertyIds[i];
    try {
      // Fetch existing property (depth 0 — we only need its own fields)
      const existingProperty = await payload.getById('properties', propertyId, { depth: 0 });

      // === Price observation ===
      const existingObs = existingProperty.accumulatedData?.pricePositioning?.observations || [];
      const newObs = {
        itineraryId: payloadItinerary.id,
        pricePerNight,
        priceTier: priceTierValue,
        observedAt: new Date().toISOString(),
      };
      const updatedObs = [...existingObs, newObs];

      // === Common pairings ===
      // For property at index i:
      //   - The property at i-1 appears BEFORE this one
      //   - The property at i+1 appears AFTER this one
      const existingPairings = existingProperty.accumulatedData?.commonPairings || [];
      const newPairings = [];
      if (i > 0) {
        newPairings.push({ property: orderedPropertyIds[i - 1], position: 'before', count: 1 });
      }
      if (i < orderedPropertyIds.length - 1) {
        newPairings.push({ property: orderedPropertyIds[i + 1], position: 'after', count: 1 });
      }

      // Merge: increment count if pairing already exists, otherwise add
      const mergedPairings = [...existingPairings];
      for (const newPairing of newPairings) {
        const existingIdx = mergedPairings.findIndex(p => {
          const pId = typeof p.property === 'object' ? p.property?.id : p.property;
          return pId === newPairing.property && p.position === newPairing.position;
        });
        if (existingIdx >= 0) {
          mergedPairings[existingIdx] = {
            ...mergedPairings[existingIdx],
            count: (mergedPairings[existingIdx].count || 1) + 1,
          };
        } else {
          mergedPairings.push(newPairing);
        }
      }

      // PATCH — send complete accumulatedData group to avoid partial overwrite
      await payload.update('properties', propertyId, {
        accumulatedData: {
          pricePositioning: {
            observations: updatedObs,
            observationCount: updatedObs.length,
          },
          commonPairings: mergedPairings,
        },
      });
      console.log(`[Orchestrator] Updated accumulatedData for property ${propertyId} (${updatedObs.length} obs)`);

    } catch (err) {
      console.error(`[Orchestrator] accumulatedData update failed for property ${propertyId}: ${err.message}`);
      // Non-fatal — continue to next property
    }
  }
}
```

Add the `classifyPriceTier` and `determinePaxType` helper functions to handler.js near
the top, before `exports.handler`:

```javascript
function classifyPriceTier(priceTotal, totalNights) {
  if (!priceTotal || !totalNights) return null;
  const perNight = priceTotal / totalNights;
  if (perNight >= 3000) return 'ultra_premium';
  if (perNight >= 1500) return 'premium';
  if (perNight >= 800) return 'mid_luxury';
  return 'accessible_luxury';
}

function determinePaxType(adults, children) {
  if (children && children > 0) return 'family';
  if (adults === 1) return 'solo';
  if (adults === 2) return 'couple';
  if (adults > 4) return 'group';
  return 'unknown';
}
```

#### Change 3: Add ItineraryPatterns upsert after accumulatedData block

After the accumulatedData block completes, add:

```javascript
// ============================================================
// KNOWLEDGE BASE: ItineraryPatterns upsert
// ============================================================
try {
  const kb = transformedData._knowledgeBase || {};
  const startDate = transformedData.startDate || null;

  const patternData = {
    sourceItinerary: payloadItinerary.id,
    extractedAt: new Date().toISOString(),
    countries: transformedData.destinations || [],
    totalNights,
    paxType: determinePaxType(kb.adultsCount, kb.childrenCount),
    adults: kb.adultsCount,
    children: kb.childrenCount,
    propertySequence: kb.propertySequence || [],
    transferSequence: kb.transferSequence || [],
    priceTotal,
    currency: transformedData.investmentLevel?.currency || 'USD',
    pricePerNightAvg: (totalNights > 0 && priceTotal) ? Math.round(priceTotal / totalNights) : null,
    priceTier: priceTierValue,
    travelMonth: startDate ? parseInt(startDate.slice(5, 7)) : null,
    travelYear: startDate ? parseInt(startDate.slice(0, 4)) : null,
  };

  // Upsert: check if a pattern already exists for this itinerary (handles re-scrape)
  const existingPattern = await payload.findOne('itinerary-patterns', {
    'where[sourceItinerary][equals]': String(payloadItinerary.id),
  });

  if (existingPattern) {
    await payload.update('itinerary-patterns', existingPattern.id, patternData);
    console.log(`[Orchestrator] Updated ItineraryPattern ${existingPattern.id} for itinerary ${payloadItinerary.id}`);
  } else {
    const created = await payload.create('itinerary-patterns', patternData);
    console.log(`[Orchestrator] Created ItineraryPattern ${created.doc?.id || created.id} for itinerary ${payloadItinerary.id}`);
  }

} catch (err) {
  console.error(`[Orchestrator] ItineraryPattern upsert failed: ${err.message}`);
  // Non-fatal — log and continue
}
```

---

### B8: Verify Syntax and Build

```bash
node -c lambda/orchestrator/transform.js
node -c lambda/orchestrator/handler.js
cd lambda && ./sync-shared.sh && cd ..
npm run build 2>&1 | tail -20
```

All four commands must complete without errors.

**Gate B8:** All syntax checks clean. Build passes. Fix any errors before committing.
Do not commit if build fails.

---

### B9: Commit Sub-project B

```bash
git add lambda/orchestrator/transform.js lambda/orchestrator/handler.js
git commit -m "feat(scraper): Knowledge base extraction — TransferRoutes, Activities, ItineraryPatterns, accumulatedData accumulation, supplierCode capture"
git push
```

**CHECKPOINT: Sub-project B**
```
VERIFICATION
- transform.js syntax: PASS / FAIL
- handler.js syntax: PASS / FAIL
- Build: PASS / FAIL
- linkDestinations() returns { ids, cache }: YES / NO
- linkProperties() captures supplierCode: YES / NO
- linkProperties() backfill merges, not overwrites: YES / NO
- linkTransferRoutes() exists with correct transferSequence logic: YES / NO
- linkActivities() exists with currentPropertyId tracking: YES / NO
- accumulatedData update block in handler.js: YES / NO
- ItineraryPatterns upsert in handler.js: YES / NO
- stripInternalFields() applied to both create and update paths: YES / NO
- startDate included in transformed output: YES / NO
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project C: Content Engine Alignment

**Do not start Sub-project C until Sub-project B CHECKPOINT shows STATUS: COMPLETE.**

### C1: Check Cascade for Entity Extraction Conflicts

List the contents of the cascade directory:
```bash
ls -la lambda/content-cascade/
```

If the directory does not exist, report that and proceed to C2.

If it exists, read every `.js` or `.ts` file within it. For each file, answer:
- Does it create, query, or update Properties records?
- Does it create, query, or update any of the new collections
  (Activities, TransferRoutes, ItineraryPatterns)?
- Does it do anything that would now conflict with or duplicate what the scraper does?

Do not attempt to resolve any conflicts you find. Report them and stop. The strategy
for resolving conflicts must come from the strategist before CLI acts.

If no conflicts are found, report which files you read and confirm they are clean.

---

### C2: Verify Content Engine Health

Check that the production Content Engine endpoint is still healthy after the schema
changes:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-content-system-secret: ${CONTENT_SYSTEM_SECRET}" \
  https://kiuli.com/api/content-system/health
```

Report the HTTP status code returned.

**Gate C2:** Returns 200. If anything else, this is a regression caused by the schema
changes. Do not proceed. Report the full response body.

---

### C3: Final State Check

```bash
git status
npm run build 2>&1 | tail -5
```

Both must be clean. If anything is uncommitted or the build is broken, fix it before
reporting completion.

---

## Final Report

Report in this exact format when all sub-projects are complete:

```
M2 COMPLETION REPORT
Date: [ISO timestamp]

SUB-PROJECT A: Schema
- activities table in DB: YES/NO
- transfer_routes table in DB: YES/NO
- itinerary_patterns table in DB: YES/NO
- availability_cache table in DB: YES/NO
- Properties new columns present: YES/NO
  Sample of new column names found: [list 3–5 actual column names from SQL output]
- Migration filenames: [list both]
- Final build: PASS/FAIL

SUB-PROJECT B: Scraper
- linkDestinations() returns { ids, cache }: YES/NO
- linkProperties() captures supplierCode: YES/NO
- linkProperties() backfill merges existing externalIds: YES/NO
- linkTransferRoutes() built with propertyOrderIndex tracking: YES/NO
- linkActivities() built with currentPropertyId context tracking: YES/NO
- accumulatedData (price obs + commonPairings) updates in handler.js: YES/NO
- ItineraryPatterns upsert in handler.js: YES/NO
- stripInternalFields() applied to both create and update paths: YES/NO
- startDate in transformed output: YES/NO
- Lambdas deployed to AWS: NO — code change only, deployment is a separate step
- Final build: PASS/FAIL

SUB-PROJECT C: Content Engine
- Cascade conflicts found: YES/NO (describe if yes)
- Content Engine health check: [HTTP status]

GIT
- Repository clean: YES/NO
- All commits pushed: YES/NO

BLOCKERS
[List anything that could not be completed and the exact reason]
```

---

## Constraints — Apply Without Exception

1. **Build must pass before every commit.** Zero exceptions. A build that fails is not
   done, regardless of what the logic looks like.

2. **Verify schema with SQL.** "Migration ran" is not evidence. The column existence
   query result is evidence. Report it.

3. **Read before modifying.** Confirm the current content of every file you are about
   to change. If the code does not match what this prompt expects, stop and report it.

4. **One failure must not cascade.** Every new function in the scraper
   (`linkTransferRoutes`, `linkActivities`) and every new block in handler.js
   (accumulatedData updates, ItineraryPatterns upsert) is wrapped in try/catch.
   A failure logs to CloudWatch and continues. It never throws up to the orchestrator.

5. **Do not deploy Lambdas.** This prompt covers code changes and schema migrations
   only. Lambda deployment to AWS is a separate instruction that comes after this
   prompt is complete and verified.

6. **Do not re-scrape itineraries.** Schema and code changes only. Re-scraping is a
   separate step that follows deployment.

7. **No placeholders.** Every function must be complete and functional. No TODOs,
   no "implement later", no stub returns.

8. **Strip internal fields.** The `_propertyIds`, `_knowledgeBase`, `startDate`
   (wait — `startDate` IS a real field that should be saved to Payload if the
   Itineraries collection has it; check before stripping). The `stripInternalFields`
   function strips only `_`-prefixed fields. `startDate` does not start with `_` so
   it will not be stripped. Confirm that the Itineraries collection schema includes
   a `startDate` field before adding it to the transformed output. If it does not,
   do not add `startDate` to the returned object — instead pass it only inside
   `_knowledgeBase`.
