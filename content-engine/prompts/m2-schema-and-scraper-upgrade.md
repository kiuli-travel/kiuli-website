# M2: Schema Evolution & Scraper Upgrade

**Date:** 2026-02-22
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)
**Scope:** Sub-projects A, B, and C as defined in the M2 handover document

---

## Before You Start: Required Reads

Read these files in order before making any changes. This is not optional — the schema
design depends on what currently exists.

```
1. src/collections/Properties.ts          — the current Properties schema
2. src/payload.config.ts                   — what collections and globals are registered
3. lambda/orchestrator/transform.js        — the current scraper transform logic
4. lambda/orchestrator/handler.js          — where post-create actions live
```

Then run these SQL queries to verify the actual live database state:

```sql
-- What tables currently exist?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Does availability_cache exist?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'availability_cache'
) AS exists;

-- What columns exist on properties?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
ORDER BY column_name;

-- Confirm current state of the data
SELECT count(*) AS property_count FROM properties;
SELECT count(*) AS itinerary_count FROM itineraries;
```

Report the output of all four queries before proceeding. Do not proceed if any query fails.

---

## Sub-project A: Schema Changes

### A1: Extend the Properties Collection

In `src/collections/Properties.ts`, add the following field groups **after the closing of the
existing `priceTier` field and before the final `]` of the `fields` array**.

Add them in this exact order: externalIds group, canonicalContent group, roomTypes array,
accumulatedData group, availability group.

Do NOT remove, rename, or reorder any existing fields. Add only.

#### externalIds group

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
      admin: { description: 'supplierCode from iTrvl raw API response — may map to ResRequest property ID' },
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
        { name: 'id', type: 'text', admin: { description: 'Accommodation type ID in ResRequest' } },
        { name: 'name', type: 'text', admin: { description: 'e.g. "Bush Suite", "Tent"' } },
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

#### canonicalContent group

```typescript
{
  name: 'canonicalContent',
  type: 'group',
  admin: {
    description: 'Canonical content — authoritative data, partially from iTrvl, enriched via Wetu in Phase 2',
  },
  fields: [
    {
      name: 'coordinates',
      type: 'group',
      admin: { description: 'GPS coordinates — capture from iTrvl where available, else Wetu sync' },
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

#### roomTypes array

```typescript
{
  name: 'roomTypes',
  type: 'array',
  admin: { description: 'Room types — populated from Wetu in Phase 2, manual entry before that' },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Bush Suite", "Family Tent"' } },
    { name: 'maxPax', type: 'number', admin: { description: 'Maximum occupancy' } },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Room type image' },
    },
  ],
},
```

#### accumulatedData group

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
          admin: { description: 'Price observations from scraped itineraries' },
          fields: [
            { name: 'itineraryId', type: 'relationship', relationTo: 'itineraries' },
            { name: 'pricePerNight', type: 'number', admin: { description: 'USD, estimated from total itinerary price' } },
            { name: 'priceTier', type: 'select', options: ['ultra_premium', 'premium', 'mid_luxury', 'accessible_luxury'] },
            { name: 'observedAt', type: 'date' },
          ],
        },
        {
          name: 'observationCount',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'commonPairings',
      type: 'array',
      admin: { description: 'Properties that appear before or after this one across scraped itineraries' },
      fields: [
        { name: 'property', type: 'relationship', relationTo: 'properties' },
        { name: 'position', type: 'select', options: ['before', 'after'] },
        { name: 'count', type: 'number', defaultValue: 1 },
      ],
    },
  ],
},
```

#### availability group

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

After editing the file, run:

```bash
node -e "require('./src/collections/Properties.ts')" 2>&1 || true
npm run build 2>&1 | tail -30
```

If the build fails, fix the TypeScript errors before proceeding. Report the full error output.
Do NOT commit a failing build.

**Gate:** Build passes with zero TypeScript errors related to Properties.ts.

---

### A2: Create Activities Collection

Create `src/collections/Activities.ts`:

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
      admin: { description: 'e.g. "3-4 hours", "Full day"' },
    },
    {
      name: 'bestTimeOfDay',
      type: 'select',
      options: ['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'any'],
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
      admin: { description: 'Minimum age requirement. Null = no restriction.' },
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
      admin: { readOnly: true, description: 'How many scraped itineraries include this activity' },
    },
  ],
}
```

---

### A3: Create TransferRoutes Collection

Create `src/collections/TransferRoutes.ts`:

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
      admin: { description: 'e.g. "Mara North Airstrip"' },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'e.g. "Wilson Airport Nairobi"' },
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
      admin: { description: 'Destination region of the origin point' },
    },
    {
      name: 'toDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination region of the arrival point' },
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
      admin: { description: 'Approximate distance in km' },
    },
    {
      name: 'airlines',
      type: 'array',
      admin: { description: 'Airlines observed on this route' },
      fields: [
        { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Safarilink", "Auric Air"' } },
        { name: 'go7Airline', type: 'checkbox', defaultValue: false, admin: { description: 'Available via GO7/AeroCRS network (Phase 4)' } },
        { name: 'duffelAirline', type: 'checkbox', defaultValue: false, admin: { description: 'Available via Duffel API (Phase 4)' } },
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
      admin: { description: 'Individual observations from scraped itineraries' },
      fields: [
        { name: 'itineraryId', type: 'relationship', relationTo: 'itineraries' },
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
      admin: { description: 'Wetu route entity ID if available (Phase 2)' },
    },
  ],
}
```

---

### A4: Create ItineraryPatterns Collection

Create `src/collections/ItineraryPatterns.ts`:

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
      admin: { description: 'Countries covered (destination records at country level)' },
    },
    {
      name: 'regions',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Regions/parks covered (destination records at region level)' },
    },
    {
      name: 'totalNights',
      type: 'number',
      admin: { description: 'Total nights across all stays' },
    },
    {
      name: 'paxType',
      type: 'select',
      options: [
        { label: 'Family', value: 'family' },
        { label: 'Couple', value: 'couple' },
        { label: 'Group', value: 'group' },
        { label: 'Solo', value: 'solo' },
        { label: 'Unknown', value: 'unknown' },
      ],
      defaultValue: 'unknown',
    },
    {
      name: 'adults',
      type: 'number',
      admin: { description: 'Adult pax count from iTrvl data' },
    },
    {
      name: 'children',
      type: 'number',
      admin: { description: 'Child pax count from iTrvl data' },
    },
    {
      name: 'propertySequence',
      type: 'array',
      admin: { description: 'Ordered list of properties in this itinerary' },
      fields: [
        { name: 'property', type: 'relationship', relationTo: 'properties', required: true },
        { name: 'nights', type: 'number' },
        { name: 'order', type: 'number', admin: { description: '1-based position in itinerary' } },
        { name: 'roomType', type: 'text' },
      ],
    },
    {
      name: 'transferSequence',
      type: 'array',
      admin: { description: 'Ordered list of transfers in this itinerary' },
      fields: [
        { name: 'route', type: 'relationship', relationTo: 'transfer-routes' },
        { name: 'afterProperty', type: 'number', admin: { description: 'Order index of the preceding property (1-based)' } },
        { name: 'mode', type: 'text' },
      ],
    },
    {
      name: 'priceTotal',
      type: 'number',
      admin: { description: 'Total price in USD' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'USD',
    },
    {
      name: 'pricePerNightAvg',
      type: 'number',
      admin: { description: 'priceTotal / totalNights' },
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
      admin: { description: '1-12, extracted from itinerary start date' },
    },
    {
      name: 'travelYear',
      type: 'number',
      admin: { description: 'Extracted from itinerary start date' },
    },
  ],
}
```

---

### A5: Register New Collections in payload.config.ts

Edit `src/payload.config.ts`:

1. Add three import statements alongside the existing collection imports:
```typescript
import { Activities } from './collections/Activities'
import { TransferRoutes } from './collections/TransferRoutes'
import { ItineraryPatterns } from './collections/ItineraryPatterns'
```

2. Add `Activities`, `TransferRoutes`, `ItineraryPatterns` to the `collections` array.

After editing, run:
```bash
npm run build 2>&1 | tail -40
```

**Gate:** Build passes with zero TypeScript errors. If build fails, fix before proceeding. Do not commit.

---

### A6: Generate Payload Migration

```bash
npx payload migrate:create --name m2_schema_evolution
```

This generates a migration file in `src/migrations/`. Verify it was created:
```bash
ls -la src/migrations/ | grep m2
```

Report the migration filename. Then run:
```bash
npx payload migrate
```

If the migrate command fails with a database connection error, check if `DATABASE_URL_UNPOOLED` is set in your local `.env.local`. If not, add it and retry.

**Gate:** Migration completes with `Migrations applied successfully` or similar confirmation. Report the exact output.

---

### A7: Verify Schema in Live Database

After the migration runs, execute these verification queries:

```sql
-- New collections: do their base tables exist?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('activities', 'transfer_routes', 'itinerary_patterns')
ORDER BY table_name;
-- Expected: 3 rows

-- Properties extended fields: do the new columns exist?
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
AND column_name IN (
  'external_ids_itrvl_supplier_code',
  'external_ids_res_request_property_id',
  'canonical_content_contact_email',
  'accumulated_data_price_positioning_observation_count',
  'availability_source'
)
ORDER BY column_name;
-- Expected: 5 rows (Payload converts camelCase to snake_case)
```

**STOP if either query returns fewer rows than expected.** Do not proceed. Report the actual output and the migration file contents so the issue can be diagnosed.

---

### A8: Create availability_cache SQL Table

This is a direct SQL table, not a Payload collection. Run this SQL directly against the database using the `db_query` tool — but note that db_query is read-only. You need a different approach.

**Method:** Create and run a migration script:

```bash
cat > /tmp/create_availability_cache.sql << 'EOF'
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
);
EOF
```

Then use the Kiuli Files `db_query` tool to verify it exists after the fact. However, since db_query is read-only, you need to create this table via Payload's migration system instead.

**Revised method:** Create a second Payload migration that contains raw SQL:

```bash
npx payload migrate:create --name m2_availability_cache
```

Edit the generated migration file to contain:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
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

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS availability_cache`)
}
```

Then run:
```bash
npx payload migrate
```

**Verification query** (use db_query tool):
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'availability_cache'
) AS table_exists;
```

**Gate:** Returns `true`. If false, do not proceed. Report what happened.

---

### A9: Commit Sub-project A

```bash
npm run build 2>&1 | tail -5
# Must show no errors before committing
git add src/collections/Activities.ts src/collections/TransferRoutes.ts src/collections/ItineraryPatterns.ts src/collections/Properties.ts src/payload.config.ts src/migrations/
git commit -m "feat(schema): Add Activities, TransferRoutes, ItineraryPatterns collections; extend Properties with externalIds, canonicalContent, accumulatedData, availability; create availability_cache table"
git push
```

**CHECKPOINT: Sub-project A**
```
VERIFICATION
- Build: PASS / FAIL
- New collections in DB: PASS / FAIL (report row counts from A7)
- Properties extended fields in DB: PASS / FAIL (report row counts from A7)
- availability_cache table: PASS / FAIL
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project B: Scraper Upgrade

Sub-project B cannot start until Sub-project A is COMPLETE with all gates passed.

### Current state check

Before modifying transform.js, read it and confirm the current state of these functions:
- Does `linkProperties()` exist? (It should — it was added in a previous prompt)
- Does the FAQ fix exist (propertyName fallback chain)? (It should)
- What does `transform()` currently do with `rawData`? Does it access `rawData.itinerary` structure?
- Check `lambda/orchestrator/handler.js` — does bidirectional property linking exist?

Report your findings on each of the four points above before making any changes.

---

### B1: Capture supplierCode in linkProperties()

The `supplierCode` from the raw iTrvl API response is the highest-priority field to capture — it may
map to the ResRequest property ID, which would make Phase 3 (ResConnect integration) trivial.

**What currently happens:** `linkProperties()` creates Properties with name, slug, destination, description_itrvl. It does not set `externalIds.itrvlSupplierCode`.

**Required change in `lambda/orchestrator/transform.js`:**

In `linkProperties()`, the function receives `segments`. Each stay segment has a `supplierCode` field. When creating a new Property record, or when patching an existing one that doesn't yet have `itrvlSupplierCode` set, capture it.

**Modify the CREATE path** in `linkProperties()`:

When `propertyId` does not exist and a new Property is being created, add to the POST body:
```javascript
externalIds: {
  itrvlSupplierCode: stay.supplierCode || null,
  itrvlPropertyName: accommodationName,
},
```

**Modify the EXISTING path** in `linkProperties()`:

After finding an existing property by slug (or alias), check if it already has `itrvlSupplierCode`. If not, and the current segment has one, PATCH it:

```javascript
// After finding existing property by slug:
if (slugData.docs?.[0]) {
  const existing = slugData.docs[0];
  propertyId = existing.id;
  // Backfill supplierCode if missing
  if (!existing.externalIds?.itrvlSupplierCode && stay.supplierCode) {
    await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalIds: {
          itrvlSupplierCode: stay.supplierCode,
          itrvlPropertyName: accommodationName,
        }
      }),
    });
    console.log(`[linkProperties] BACKFILLED supplierCode: ${stay.supplierCode} -> ${propertyId}`);
  }
}
```

**Important:** Also capture `notes.contactEmail` and `notes.contactNumber` from the RAW segment
(not the presentation segment). These are in the raw data's `notes` sub-object. Pass the raw segment
data into linkProperties alongside the presentation segment, or access them via `segment.contactEmail`
if the transform already merges raw+presentation fields.

**Check the actual data structure first.** Read the handler.js to understand what is passed to
`transform()` — specifically whether `rawData.itinerary.segments` contains raw or presentation
data, or both. Then check whether `supplierCode` is at `segment.supplierCode` or
`segment.notes?.supplierCode` or another path. This is a "verify before you modify" instruction.
Do not assume the field path. Check the actual raw data by looking at what the scraper produces.

If the structure is unclear from the code, add a temporary `console.log('[DEBUG] Raw segment fields:', Object.keys(rawSegment))` and report what you see. Do not guess field paths.

---

### B2: Add linkTransferRoutes() to transform.js

Add a new async function `linkTransferRoutes(segments, propertyMap, destinationIds)` immediately after `linkProperties()`.

This function processes flight and road segments to build the TransferRoutes knowledge base.

**Logic for each transfer segment (types: 'flight', 'road', 'boat'):**

1. Extract `from` and `to` point names:
   - `from`: `segment.from || segment.fromPoint || segment.startLocation?.name || segment.location || null`
   - `to`: `segment.to || segment.toPoint || segment.endLocation?.name || null`
2. Skip if either `from` or `to` is null or empty
3. Skip entry, exit, and point segment types
4. Generate slug: `generateSlug(from + ' to ' + to)` — e.g., `"mara-north-to-wilson-airport"`
5. Map segment type to mode: `'flight' → 'flight'`, `'road' → 'road'`, `'boat' → 'boat'`
6. Check for existing TransferRoute by slug: `GET /api/transfer-routes?where[slug][equals]=${slug}&limit=1`
7. If not found, create one: POST to `/api/transfer-routes` with:
   ```javascript
   {
     from,
     to,
     slug,
     mode,
     observations: [{
       departureTime: segment.departureTime || null,
       arrivalTime: segment.arrivalTime || null,
       airline: segment.airline || null,
       dateObserved: new Date().toISOString().slice(0, 10),
     }],
     observationCount: 1,
   }
   ```
8. If found, PATCH the existing record to append an observation and increment `observationCount`:
   ```javascript
   // Fetch current observations first, then PATCH
   const existingRoute = slugData.docs[0];
   const existingObs = existingRoute.observations || [];
   await fetch(`${PAYLOAD_API_URL}/api/transfer-routes/${existingRoute.id}`, {
     method: 'PATCH',
     headers: { ...headers, 'Content-Type': 'application/json' },
     body: JSON.stringify({
       observations: [...existingObs, {
         departureTime: segment.departureTime || null,
         arrivalTime: segment.arrivalTime || null,
         airline: segment.airline || null,
         dateObserved: new Date().toISOString().slice(0, 10),
       }],
       observationCount: existingObs.length + 1,
     }),
   });
   ```
9. **Airline dedup:** If `segment.airline` is set, check the existing record's `airlines` array. If the
   airline name is not already in the array, PATCH to append it:
   ```javascript
   // Only if route existed and airline is new
   const existingAirlines = existingRoute.airlines || [];
   if (segment.airline && !existingAirlines.some(a => a.name === segment.airline)) {
     // Include in same PATCH as observation update
   }
   ```
10. Return a Map of `slug → routeId` for use in ItineraryPatterns

**Constraints:**
- Wrap each operation in try/catch. One failure must not fail the pipeline.
- Cache GET lookups by slug (use a local Map) to avoid duplicate queries
- Log: `[linkTransferRoutes] CREATED: Mara North -> Wilson Airport`, `[linkTransferRoutes] UPDATED: 5 observations`

---

### B3: Add linkActivities() to transform.js

Add a new async function `linkActivities(segments, propertyMap)` immediately after `linkTransferRoutes()`.

This function processes service/activity segments to build the Activities knowledge base.

**Logic for each service/activity segment (types: 'service', 'activity'):**

1. Extract activity name: `segment.name || segment.title`
2. Skip if no name
3. Generate slug: `generateSlug(activityName)`
4. Map activity name to type using simple keyword matching:
   ```javascript
   function classifyActivity(name) {
     const n = name.toLowerCase();
     if (n.includes('game drive')) return 'game_drive';
     if (n.includes('gorilla')) return 'gorilla_trek';
     if (n.includes('chimp') || n.includes('chimpanzee')) return 'chimpanzee_trek';
     if (n.includes('balloon')) return 'balloon_flight';
     if (n.includes('walking') || n.includes('bush walk')) return 'walking_safari';
     if (n.includes('boat')) return 'boat_safari';
     if (n.includes('canoe')) return 'canoe_safari';
     if (n.includes('horse')) return 'horseback_safari';
     if (n.includes('cultural') || n.includes('village')) return 'cultural_visit';
     if (n.includes('bush dinner') || n.includes('dinner')) return 'bush_dinner';
     if (n.includes('sundowner')) return 'sundowner';
     if (n.includes('fishing')) return 'fishing';
     if (n.includes('bird') || n.includes('birding')) return 'birding';
     if (n.includes('helicopter')) return 'helicopter_flight';
     if (n.includes('photo') || n.includes('photography')) return 'photography';
     if (n.includes('spa') || n.includes('wellness')) return 'spa';
     if (n.includes('conservation')) return 'conservation_experience';
     if (n.includes('community')) return 'community_visit';
     return 'other';
   }
   ```
5. Check for existing Activity by slug: `GET /api/activities?where[slug][equals]=${slug}&limit=1`
6. If not found, create: POST to `/api/activities` with name, slug, type, observationCount: 1
7. If found, PATCH to increment observationCount: `observationCount: existing.observationCount + 1`
8. If the segment has a linked property (via propertyMap), also PATCH the activity to add the
   property to its `properties` array (dedup by ID)
9. Return a Map of `slug → activityId`

**Constraints:** Same as B2 — try/catch per operation, local Map cache, logs.

---

### B4: Update transform() to call the new functions

In the `transform()` function, after the existing `linkProperties()` call:

```javascript
// Link/create property records for stay segments
const propertyMap = await linkProperties(segments, destinationIds);

// NEW: Link/create transfer route records
const transferRouteMap = await linkTransferRoutes(segments, propertyMap, destinationIds);

// NEW: Link/create activity records
const activityMap = await linkActivities(segments, propertyMap);
```

Also capture pax data from the raw itinerary:
```javascript
// Extract pax data (available in iTrvl raw data at itinerary level)
const adultsCount = rawData.pax?.adults || itinerary.pax?.adults || itinerary.adults || null;
const childrenCount = rawData.pax?.children || itinerary.pax?.children || itinerary.children || null;
```

**STOP before implementing pax capture.** First check the actual raw iTrvl data structure to determine
where pax counts live. Look at any existing scraper output JSON file if available, or add temporary
logging to see the structure. Do not guess the field path.

Add `transferRouteMap` and `activityMap` to the transformed output so handler.js can use them:
```javascript
_transferRouteMap: Object.fromEntries(transferRouteMap), // Convert Map to object for JSON serialization
_activityMap: Object.fromEntries(activityMap),
_adultsCount: adultsCount,
_childrenCount: childrenCount,
```

---

### B5: Create ItineraryPatterns Record in handler.js

In `lambda/orchestrator/handler.js`, AFTER the itinerary is created and AFTER the existing
bidirectional property linking code, add an ItineraryPatterns creation step.

**Note:** Read handler.js first to understand its current structure. Find where `payloadItinerary.id`
is available. Add the ItineraryPatterns creation AFTER that point.

**Create the ItineraryPatterns record:**

```javascript
// Create ItineraryPatterns record for knowledge base
try {
  const propertyIds = transformedData._propertyIds || [];
  const totalNights = transformedData.overview?.nights || 0;
  const priceTotal = transformedData.investmentLevel?.fromPrice || null;
  const priceTier = classifyPriceTier(priceTotal, totalNights);

  const startDate = itinerary.startDate || null;
  const travelMonth = startDate ? parseInt(startDate.slice(5, 7)) : null;
  const travelYear = startDate ? parseInt(startDate.slice(0, 4)) : null;

  // Build propertySequence from stay segments in order
  const stays = (transformedData.days || [])
    .flatMap(d => (d.segments || []).filter(s => s.blockType === 'stay'))
    .filter(s => s.property);

  const propertySequence = stays.map((stay, index) => ({
    property: stay.property,
    nights: stay.nights || 1,
    order: index + 1,
    roomType: stay.roomType || null,
  }));

  // Build transferSequence from the transferRouteMap
  const transferRouteEntries = Object.entries(transformedData._transferRouteMap || {});
  const transferSequence = transferRouteEntries.map(([slug, routeId], index) => ({
    route: routeId,
    afterProperty: index, // Approximate — transfer comes after property at this position
    mode: null, // Route record has the mode
  }));

  await fetch(`${PAYLOAD_API_URL}/api/itinerary-patterns`, {
    method: 'POST',
    headers: { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceItinerary: payloadItinerary.id,
      extractedAt: new Date().toISOString(),
      countries: transformedData.destinations || [],
      totalNights,
      paxType: determinePaxType(transformedData._adultsCount, transformedData._childrenCount),
      adults: transformedData._adultsCount,
      children: transformedData._childrenCount,
      propertySequence,
      transferSequence,
      priceTotal,
      currency: transformedData.investmentLevel?.currency || 'USD',
      pricePerNightAvg: totalNights > 0 && priceTotal ? Math.round(priceTotal / totalNights) : null,
      priceTier,
      travelMonth,
      travelYear,
    }),
  });
  console.log(`[Orchestrator] Created ItineraryPattern for itinerary ${payloadItinerary.id}`);
} catch (err) {
  console.error(`[Orchestrator] Failed to create ItineraryPattern: ${err.message}`);
  // Non-fatal — log and continue
}
```

Add helper functions in handler.js:

```javascript
function classifyPriceTier(priceTotal, nights) {
  if (!priceTotal || !nights) return null;
  const perNight = priceTotal / nights;
  if (perNight >= 3000) return 'ultra_premium';
  if (perNight >= 1500) return 'premium';
  if (perNight >= 800) return 'mid_luxury';
  return 'accessible_luxury';
}

function determinePaxType(adults, children) {
  if (children && children > 0) return 'family';
  if (adults === 2) return 'couple';
  if (adults === 1) return 'solo';
  if (adults > 4) return 'group';
  return 'unknown';
}
```

**Strip internal fields before Payload save.** Before `payload.createItinerary(createData)`, ensure
these are removed: `_propertyIds`, `_transferRouteMap`, `_activityMap`, `_adultsCount`, `_childrenCount`.

---

### B6: Verify syntax and build

```bash
node -c lambda/orchestrator/transform.js
node -c lambda/orchestrator/handler.js
cd lambda && ./sync-shared.sh
npm run build 2>&1 | tail -20
```

**Gate:** All syntax checks pass. Build passes. If build fails, fix before committing.

---

### B7: Commit Sub-project B

```bash
git add lambda/orchestrator/transform.js lambda/orchestrator/handler.js
git commit -m "feat(scraper): Capture supplierCode, extract TransferRoutes, Activities, ItineraryPatterns from scraped itineraries"
git push
```

**CHECKPOINT: Sub-project B**
```
VERIFICATION
- transform.js syntax: PASS / FAIL
- handler.js syntax: PASS / FAIL
- Build: PASS / FAIL
- supplierCode capture: confirmed in code / NOT CONFIRMED
- linkTransferRoutes() function: exists / MISSING
- linkActivities() function: exists / MISSING
- ItineraryPatterns creation in handler.js: exists / MISSING
GIT: Committed [hash] / NOT COMMITTED
STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Sub-project C: Content Engine Alignment

Sub-project C cannot start until Sub-project B is COMPLETE.

### C1: Check cascade for conflicts

Read these files:
```
content-engine/cascade/                — any .js or .ts files in this directory
```

Specifically check: does the cascade currently do any entity extraction that would
conflict with or duplicate what the scraper now does? The scraper now creates Properties,
TransferRoutes, Activities, and ItineraryPatterns. The cascade was designed to extract
entities from itineraries too. If there is overlap, report it — do not attempt to resolve
it without strategic review.

**If the cascade directory does not exist or contains no relevant entity extraction code:**
report that and skip to C2.

---

### C2: Verify Content Engine still works

Run a content project publish and confirm it succeeds:

```sql
-- Find a published content project to use as a reference
SELECT id, title, status FROM content_projects WHERE status = 'published' LIMIT 3;
```

Check the Content Engine endpoint directly to verify it is still healthy after the schema changes:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-content-system-secret: ${CONTENT_SYSTEM_SECRET}" \
  https://kiuli.com/api/content-system/health
```

**Gate:** Returns 200. If it returns anything else, report it — the schema changes should be additive
and should not have broken the Content Engine. If it did break, this is a regression that must be
diagnosed before proceeding.

---

### C3: Final commit

If C2 passes and no cascade conflicts were found:

```bash
git status
# Should be clean after A9 and B7 commits
```

If anything is uncommitted, commit it now with an appropriate message.

---

## Final Report Format

When all three sub-projects are complete, report in this exact format:

```
M2 COMPLETION REPORT
Date: [timestamp]

SUB-PROJECT A: Schema
- Activities collection in DB: YES/NO (verified by SQL)
- TransferRoutes collection in DB: YES/NO (verified by SQL)
- ItineraryPatterns collection in DB: YES/NO (verified by SQL)
- Properties externalIds columns: YES/NO (verified by SQL — list columns found)
- availability_cache table: YES/NO (verified by SQL)
- Migration files created: [list filenames]
- Build status: PASS/FAIL

SUB-PROJECT B: Scraper
- supplierCode capture: YES/NO (describe implementation)
- linkTransferRoutes() exists: YES/NO
- linkActivities() exists: YES/NO
- ItineraryPatterns creation in handler.js: YES/NO
- Lambdas deployed: YES/NO (note: deployment is a SEPARATE STEP, do not deploy without instruction)
- Build status: PASS/FAIL

SUB-PROJECT C: Content Engine
- Cascade conflict check: CLEAN/CONFLICTS FOUND (describe)
- Content Engine health: 200/[other] (report actual HTTP status)

GIT: Clean/Dirty
All commits pushed: YES/NO

BLOCKERS (if any):
[List anything that prevented completion or requires strategic decision]
```

---

## Critical Constraints Across All Sub-projects

1. **Build must pass before every commit.** Zero exceptions.
2. **Verify with SQL after every migration.** "Migration ran" is not evidence. Column existence is evidence.
3. **Read before you modify.** Check the actual current file contents before making changes. The code
   and the documentation have disagreed before.
4. **One failure must not cascade.** All new scraper functions (linkTransferRoutes, linkActivities,
   ItineraryPatterns creation) are non-fatal. Wrap in try/catch. Log and continue.
5. **Do not deploy Lambdas.** Code changes only in this prompt. Lambda deployment to AWS is a
   separate step requiring a separate instruction.
6. **Do not re-scrape itineraries.** Schema and code changes only. Re-scraping is a separate step.
7. **No placeholders.** All code must be complete and functional. No TODOs, no "implement later".
