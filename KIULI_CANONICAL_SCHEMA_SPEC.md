# Kiuli Canonical Schema Specification

**Version:** 2.0  
**Date:** February 2026  
**Status:** AUTHORITATIVE — CLI implements exactly from this document. No improvisation.  
**Owner:** Graham Wallington

---

## Purpose

This document defines the canonical entity hierarchy, all schema changes, the LocationMappings resolution algorithm, the complete scraper evolution, and ungameable verification gates. Every field, every dedup key, every algorithm is specified precisely. If something is not specified here, CLI stops and asks — it does not invent.

---

## 1. The Canonical Entity Hierarchy

Five entity types. Each has exactly one definition.

```
Countries
  └── Destinations
        └── Properties
Airports (belong to Countries; optionally near Destinations)
ServiceItems (independent; linked to Airports and/or Destinations)
```

### 1.1 Countries

**Collection:** `destinations` (type = 'country')  
**Scraper rule:** NEVER creates. NEVER updates. Reads only.  
**Current records (confirmed in DB):** Kenya (id=2), Tanzania (id=3), Uganda (id=4), Rwanda (id=5), Botswana (id=6), South Africa (id=7), Zambia (id=8), Zimbabwe (id=9), Namibia (id=10), Mozambique (id=11)  
**Adding new countries:** Manual, by Graham, before scraping itineraries that visit them.

### 1.2 Destinations

**Collection:** `destinations` (type = 'destination')  
**Definition:** A geographic area within a country that guests visit and that Kiuli builds a content page for. National parks, private reserves, cities with multiple properties, coastal areas.  
**Examples:** Masai Mara, Serengeti National Park, Tarangire National Park, Mwiba Wildlife Reserve, Arusha, Nairobi, Sabi Sands, Cape Town.  
**NOT a destination:** A property name, a mobile camp concept, an airport, a country.  
**Parent:** Always one Country record (via `country_id` FK).  
**Dedup key:** `slug` (unique constraint). Lookup: `name` exact match + `type = 'destination'`.  
**Auto-creation:** Scraper creates when `stay.location` resolves to no existing Destination and no LocationMappings entry resolves it as 'property' or 'airport'. Auto-created records are `_status: 'draft'`. ContentProject (`destination_page` at `idea`) is created by the content cascade on its next run — not by the scraper.  
**LocationMappings:** Scraper DOES NOT auto-add LocationMappings entries for auto-created Destinations. A human adds mappings manually after review.

### 1.3 Properties

**Collection:** `properties`  
**Definition:** An individual lodge, camp, hotel, villa, tented camp, or mobile camp where a guest sleeps.  
**Examples:** Angama Mara, Nyasi Tented Camp, Mwiba Lodge, Legendary Lodge.  
**NOT a property:** A destination, a park, a city, a mobile camp concept (e.g. "Serengeti Mobile"), an airport.  
**Parent:** Always one Destination record (type='destination'). NEVER a Country record (type='country').  
**Dedup key:** `slug` (unique constraint). Lookup order: PropertyNameMappings aliases → slug exact match.  
**Type classification:** See Section 9.  
**Auto-creation:** Scraper creates when property name not found in PropertyNameMappings or by slug.

### 1.4 Airports

**Collection:** `airports` (NEW)  
**Definition:** A physical aviation facility — international airport, domestic airport, or bush airstrip — where passengers board or disembark aircraft.  
**Examples:** Wilson Airport Nairobi (WIL), Kilimanjaro International Airport (JRO), Arusha Airport (ARK), Mara North Airstrip (MRE).  
**NOT an airport:** A property, a destination, a country.  
**Parent:** Always one Country record. Optionally linked to the nearest Destination (manually or via LocationMappings).  
**Dedup key (in priority order):**  
  1. `iataCode` (where not null) — query: `WHERE iata_code = ?`  
  2. `slug` — query: `WHERE slug = ?`  
**Auto-creation:** Scraper creates from `point`, `entry`, and `exit` segment types.

### 1.5 ServiceItems

**Collection:** `service-items` (NEW)  
**Definition:** A billable service or fee observed in an iTrvl itinerary that is NOT an experiential activity. Never displayed on itinerary landing pages. Informs the knowledge base about service level, included costs, and pricing composition.  
**Examples:** Meet and Assist, VIP Lounge, Serengeti National Park Fee, Serengeti Camping Fee, Departure Tax.  
**NOT a service item:** A genuine experiential activity (game drive, balloon flight, gorilla trek, etc.).  
**Dedup key:** `slug` (unique constraint, generated from `name`).  
**Auto-creation:** Scraper creates from `service` segments that `classifyActivity()` returns 'other' for.

---

## 2. LocationMappings Global

### 2.1 Purpose

LocationMappings is the translation layer between external system naming and Kiuli's canonical entity hierarchy. When an external system provides a location string, LocationMappings answers: what Kiuli entity type is this, and which specific record does it resolve to?

This global **replaces** `DestinationNameMappings`. The `DestinationNameMappings` and `DestinationNameMappings_mappings` tables are currently empty (confirmed). They remain in the DB as migration artefacts but are deregistered from payload.config.ts.

`PropertyNameMappings` is unchanged. It handles property name aliases within a confirmed property entity.

### 2.2 Schema: `src/globals/LocationMappings.ts`

```typescript
import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const LocationMappings: GlobalConfig = {
  slug: 'location-mappings',
  admin: {
    group: 'Configuration',
  },
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    {
      name: 'mappings',
      type: 'array',
      admin: {
        description: 'Maps external system location strings to canonical Kiuli entities',
      },
      fields: [
        {
          name: 'externalString',
          type: 'text',
          required: true,
          admin: {
            description: 'Exact string from the source system, e.g. "Serengeti Mobile", "WIL", "Wilson Airport"',
          },
        },
        {
          name: 'sourceSystem',
          type: 'select',
          required: true,
          options: [
            { label: 'iTrvl', value: 'itrvl' },
            { label: 'Wetu', value: 'wetu' },
            { label: 'Expert Africa', value: 'expert_africa' },
            { label: 'Any', value: 'any' },
            { label: 'Manual', value: 'manual' },
          ],
          admin: {
            description: '"any" applies regardless of source system',
          },
        },
        {
          name: 'resolvedAs',
          type: 'select',
          required: true,
          options: [
            { label: 'Destination', value: 'destination' },
            { label: 'Property', value: 'property' },
            { label: 'Airport', value: 'airport' },
            { label: 'Ignore', value: 'ignore' },
          ],
          admin: {
            description: '"ignore" = this string is noise, discard silently',
          },
        },
        {
          name: 'destination',
          type: 'relationship',
          relationTo: 'destinations',
          admin: {
            description: 'Required when resolvedAs = destination',
          },
        },
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          admin: {
            description: 'Required when resolvedAs = property. The stay supplierName is still the canonical property name; this confirms which record to link to.',
          },
        },
        {
          name: 'airport',
          type: 'relationship',
          relationTo: 'airports',
          admin: {
            description: 'Required when resolvedAs = airport',
          },
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: {
            description: 'Why this mapping exists, e.g. "Serengeti Mobile is the operating concept for Nyasi Tented Camp. Destination is Serengeti National Park."',
          },
        },
      ],
    },
  ],
}
```

### 2.3 Resolution Algorithm

Used by the scraper for every `stay` segment location string. Never runs for `flight`, `road`, `point`, `entry`, or `exit` segment locations.

```javascript
async function resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL) {
  // Step 1: Query LocationMappings
  const mappingsRes = await fetch(
    `${PAYLOAD_API_URL}/api/globals/location-mappings`,
    { headers }
  )
  if (mappingsRes.ok) {
    const mappingsData = await mappingsRes.json()
    const mappings = mappingsData.mappings || []
    
    for (const mapping of mappings) {
      if (mapping.externalString.toLowerCase() !== locationString.toLowerCase()) continue
      if (mapping.sourceSystem !== 'itrvl' && mapping.sourceSystem !== 'any') continue
      
      if (mapping.resolvedAs === 'destination') {
        const destId = typeof mapping.destination === 'object' ? mapping.destination.id : mapping.destination
        console.log(`[resolveLocation] MAPPING: "${locationString}" → destination ${destId}`)
        return destId  // Return destination ID
      }
      if (mapping.resolvedAs === 'property' || mapping.resolvedAs === 'airport' || mapping.resolvedAs === 'ignore') {
        console.log(`[resolveLocation] MAPPING: "${locationString}" resolves as ${mapping.resolvedAs} — using country fallback`)
        return countryId  // Fall back to country — property destination is resolved separately
      }
    }
  }
  
  // Step 2: Direct name match in Destinations (type='destination')
  const destRes = await fetch(
    `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(locationString)}&where[type][equals]=destination&limit=1`,
    { headers }
  )
  if (destRes.ok) {
    const destData = await destRes.json()
    if (destData.docs?.[0]?.id) {
      console.log(`[resolveLocation] DIRECT MATCH: "${locationString}" → destination ${destData.docs[0].id}`)
      return destData.docs[0].id
    }
  }
  
  // Step 3: Auto-create Destination
  // Only runs for stay segments (caller responsibility to enforce this)
  const slug = generateSlug(locationString)
  const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: locationString,
      slug,
      type: 'destination',
      country: countryId,  // parent country relationship
      _status: 'draft',
    }),
  })
  if (createRes.ok) {
    const created = await createRes.json()
    const newId = created.doc?.id || created.id
    console.log(`[resolveLocation] AUTO-CREATED destination: "${locationString}" → ${newId}`)
    // ContentProject is created by content cascade on next run — not here
    return newId
  }
  
  // Step 4: Fall back to country
  console.warn(`[resolveLocation] All resolution attempts failed for "${locationString}" — falling back to country ${countryId}`)
  return countryId
}
```

---

## 3. New Collection: `src/collections/Airports.ts`

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Airports: CollectionConfig = {
  slug: 'airports',
  admin: {
    useAsTitle: 'name',
    group: 'Knowledge Base',
    defaultColumns: ['name', 'iataCode', 'type', 'country', 'observationCount', 'updatedAt'],
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
      admin: { description: 'e.g. "Wilson Airport", "Kilimanjaro International Airport", "Mara North Airstrip"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'e.g. "wilson-airport", "kilimanjaro-international-airport"' },
    },
    {
      name: 'iataCode',
      type: 'text',
      index: true,
      admin: { description: 'e.g. "WIL", "JRO", "MRE" — nullable for bush airstrips without scheduled service' },
    },
    {
      name: 'icaoCode',
      type: 'text',
      admin: { description: 'e.g. "HKWL" — nullable' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'International', value: 'international' },
        { label: 'Domestic', value: 'domestic' },
        { label: 'Airstrip', value: 'airstrip' },
      ],
      admin: { description: 'international = major international gateway; domestic = scheduled domestic service; airstrip = bush airstrip, no scheduled service' },
    },
    {
      name: 'city',
      type: 'text',
      admin: { description: 'e.g. "Nairobi", "Arusha"' },
    },
    {
      name: 'country',
      type: 'relationship',
      relationTo: 'destinations',
      required: true,
      admin: { description: 'Parent country — must be a Destination record with type="country"' },
    },
    {
      name: 'nearestDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Primary safari destination this airport serves — nullable; populated manually or via LocationMappings' },
    },
    {
      name: 'coordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many scraped itineraries transit this airport' },
    },
  ],
}
```

### 3.1 Airport Type Classification (scraper)

```javascript
function classifyAirportType(name, iataCode) {
  const n = name.toLowerCase()
  // International airports typically have 'international' in name or 3-letter IATA
  if (n.includes('international')) return 'international'
  // Bush airstrips typically have 'airstrip' or 'strip' in name, or are small known strips
  if (n.includes('airstrip') || n.includes('strip') || n.includes('mara north') || n.includes('mara keekorok')) return 'airstrip'
  // Default to domestic
  return 'domestic'
}
```

### 3.2 Airport Country Resolution (scraper)

Airport segments provide `countryCode` (e.g. "KE", "TZ"). Scraper must map ISO code to destination record ID. Use a hardcoded lookup map (not a DB query) since countries are pre-seeded and fixed:

```javascript
const COUNTRY_CODE_TO_ID = {
  'KE': 2,   // Kenya
  'TZ': 3,   // Tanzania
  'UG': 4,   // Uganda
  'RW': 5,   // Rwanda
  'BW': 6,   // Botswana
  'ZA': 7,   // South Africa
  'ZM': 8,   // Zambia
  'ZW': 9,   // Zimbabwe
  'NA': 10,  // Namibia
  'MZ': 11,  // Mozambique
}
```

If `countryCode` is not in this map, log a warning and leave country null. Do not create a new country record.

---

## 4. New Collection: `src/collections/ServiceItems.ts`

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const ServiceItems: CollectionConfig = {
  slug: 'service-items',
  admin: {
    useAsTitle: 'name',
    group: 'Knowledge Base',
    defaultColumns: ['name', 'category', 'serviceLevel', 'observationCount', 'updatedAt'],
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
      admin: { description: 'e.g. "Meet and Assist - Kilimanjaro Int Airport Arrival"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Generated from name — deduplication key' },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Airport Service', value: 'airport_service' },
        { label: 'Park Fee', value: 'park_fee' },
        { label: 'Conservation Fee', value: 'conservation_fee' },
        { label: 'Departure Tax', value: 'departure_tax' },
        { label: 'Accommodation Supplement', value: 'accommodation_supplement' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Service item category — determines display and agentic builder logic' },
    },
    {
      name: 'serviceLevel',
      type: 'select',
      required: true,
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Premium', value: 'premium' },
        { label: 'Ultra Premium', value: 'ultra_premium' },
      ],
      admin: { description: 'Service tier indicator — used by agentic builder for itinerary quality scoring' },
    },
    {
      name: 'associatedAirport',
      type: 'relationship',
      relationTo: 'airports',
      admin: { description: 'Nullable — for airport_service category' },
    },
    {
      name: 'associatedDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Nullable — for park_fee and conservation_fee categories' },
    },
    {
      name: 'isInclusionIndicator',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'True if presence indicates cost is included in the itinerary price' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many scraped itineraries include this service item' },
    },
    {
      name: 'observedInItineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      admin: { readOnly: true, description: 'Which itineraries include this service item' },
    },
  ],
}
```

### 4.1 Service Segment Classification (scraper)

```javascript
function classifyServiceItem(name) {
  const n = name.toLowerCase()
  
  if (n.includes('meet and assist') || n.includes('meet & assist'))
    return { category: 'airport_service', serviceLevel: 'premium' }
  if (n.includes('vip lounge') || n.includes('vip fast') || n.includes('fast track') || n.includes('fast-track'))
    return { category: 'airport_service', serviceLevel: 'ultra_premium' }
  if (n.includes('porter'))
    return { category: 'airport_service', serviceLevel: 'premium' }
  if (n.includes('national park fee') || n.includes('park fee') || n.includes('park entrance'))
    return { category: 'park_fee', serviceLevel: 'standard' }
  if (n.includes('camping fee'))
    return { category: 'park_fee', serviceLevel: 'standard' }
  if (n.includes('conservation fee') || n.includes('conservancy fee'))
    return { category: 'conservation_fee', serviceLevel: 'standard' }
  if (n.includes('departure tax') || n.includes('airport tax'))
    return { category: 'departure_tax', serviceLevel: 'standard' }
  if (n.includes('single supplement') || n.includes('peak supplement'))
    return { category: 'accommodation_supplement', serviceLevel: 'standard' }
  
  return { category: 'other', serviceLevel: 'standard' }
}
```

### 4.2 Service Segment Routing Logic (scraper)

For every iTrvl `service` segment:

```javascript
const activityType = classifyActivity(segment.name)

if (activityType !== 'other') {
  // → create/update Activities record (existing logic, unchanged)
} else {
  const { category, serviceLevel } = classifyServiceItem(segment.name)
  // → create/update ServiceItems record (new logic)
}
```

### 4.3 ServiceItem Airport Association (scraper)

After `linkAirports()` runs and returns an `airportMap`, when creating/updating a ServiceItem:

```javascript
// Extract airport name from service item name
// Pattern: "Meet and Assist - [Airport Name] Arrival/Departure"
function extractAirportFromServiceName(name, airportMap) {
  // Try to match airport name from the service item name
  for (const [key, airportId] of airportMap.entries()) {
    // airportMap keys are IATA codes or slugs
    // Check if the service item name contains any airport name
    // Use the airports loaded during linkAirports() for name matching
  }
  return null // nullable — not all service items are airport-specific
}
```

For the current test data, the airport associations are:
- "Meet and Assist - Kilimanjaro Int Airport Arrival" → associatedAirport = Kilimanjaro International Airport (JRO)
- "VIP Lounge - Kilimanjaro International Airport Arrival" → associatedAirport = Kilimanjaro International Airport (JRO)
- "Serengeti Camping Fee" → associatedDestination = Serengeti National Park
- "Serengeti National Park Fee" → associatedDestination = Serengeti National Park

Note: The scraper resolves these associations when it has the airport and destination IDs available from earlier pipeline steps. Airport association is a best-effort match — if not matched, leave null. Do not fail the pipeline.

---

## 5. Modified Collection: `src/collections/Activities.ts`

**One change only:** Remove `'other'` from the type select options.

The other option previously existed because there was no ServiceItems collection. With ServiceItems, 'other' service segments route there. After migration, no Activity record should have type='other'.

Updated type options:

```typescript
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
],
```

**CRITICAL:** The 'other' option must be removed from schema AFTER the data migration in Section 14 converts all existing type='other' Activity records to ServiceItems. If removed before, Payload will throw a validation error on existing records. Migration sequence in Section 14 enforces this order.

---

## 6. Modified Collection: `src/collections/ItineraryPatterns.ts`

Add two fields:

```typescript
// After the 'countries' field, add:
{
  name: 'regions',
  type: 'relationship',
  relationTo: 'destinations',
  hasMany: true,
  admin: {
    description: 'Specific destinations visited (not countries) — e.g. Serengeti National Park, Masai Mara',
  },
},

// After the 'transferSequence' field, add:
{
  name: 'serviceItems',
  type: 'relationship',
  relationTo: 'service-items',
  hasMany: true,
  admin: {
    description: 'Service items observed in this itinerary — park fees, airport services, supplements',
  },
},
```

---

## 7. Modified Collection: `src/collections/Properties.ts`

Add `seasonalityData` inside the `accumulatedData` group, after `commonPairings`:

```typescript
{
  name: 'seasonalityData',
  type: 'array',
  admin: {
    description: 'Monthly observation counts — how many scraped itineraries feature this property per month',
  },
  fields: [
    {
      name: 'month',
      type: 'number',
      required: true,
      admin: { description: '1 = January, 12 = December' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
    },
  ],
},
```

---

## 8. Modified Collection: `src/collections/TransferRoutes.ts`

Add two fields after `toDestination`:

```typescript
{
  name: 'fromAirport',
  type: 'relationship',
  relationTo: 'airports',
  admin: { description: 'Origin airport if applicable — in addition to fromDestination' },
},
{
  name: 'toAirport',
  type: 'relationship',
  relationTo: 'airports',
  admin: { description: 'Destination airport if applicable — in addition to toDestination' },
},
```

---

## 9. Property Type Classification (new function in transform.js)

When auto-creating a Property record, the `type` field must be populated from the `supplierName`:

```javascript
function classifyPropertyType(name) {
  const n = name.toLowerCase()
  if (n.includes('tented camp') || n.includes('tented-camp')) return 'tented_camp'
  if (n.includes('mobile camp') || n.includes('mobile-camp') || n.includes('mobile')) return 'mobile_camp'
  if (n.includes(' camp') || n.endsWith('camp')) return 'camp'
  if (n.includes('lodge')) return 'lodge'
  if (n.includes('hotel') || n.includes('manor') || n.includes('house') || n.includes('retreat')) return 'hotel'
  if (n.includes('villa') || n.includes('private')) return 'villa'
  return 'lodge'  // default — most luxury properties in the Kiuli universe are lodges
}
```

This function is called when creating a new Property record. It is NOT called when updating existing records.

---

## 10. Scraper: linkProperties() Rewrite

Replace the destination resolution block inside `linkProperties()` with `resolveLocationToDestination()`. The key change is in step 3 (Create new Property if not found):

```javascript
// BEFORE (wrong — uses country only):
let destinationId = null;
const country = stay.country || stay.countryName;
if (country && destinationCache) {
  destinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
}

// AFTER (correct — tries location first):
let destinationId = null;
const locationString = stay.location || stay.locationName || null;
const country = stay.country || stay.countryName || null;

if (locationString) {
  const countryId = country ? await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL) : null;
  if (countryId) {
    destinationId = await resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL);
  }
}

// Fallback to country if location resolution failed
if (!destinationId && country) {
  destinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
}
// Fallback to first itinerary destination
if (!destinationId && destinationIds.length > 0) {
  destinationId = destinationIds[0];
}
```

Also add `type` to the Property creation body:

```javascript
body: JSON.stringify({
  name: accommodationName,
  slug,
  type: classifyPropertyType(accommodationName),  // ADD THIS
  destination: destinationId,
  // ... rest unchanged
})
```

**IMPORTANT:** `resolveLocationToDestination()` must be defined in transform.js as a standalone async function (see Section 2.3). `lookupDestinationByCountry()` already exists and is unchanged.

---

## 11. Scraper: linkActivities() Fix

Two changes:

**Change 1: Destination resolution**

Replace:
```javascript
const country = segment.country || segment.countryName || currentCountry;
const destinationId = country
  ? await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
  : null;
```

With:
```javascript
// Use the current stay's resolved destination, not the country
// currentDestinationId is tracked alongside currentPropertyId (see below)
const destinationId = currentDestinationId || null;
```

Add `currentDestinationId` tracking alongside `currentPropertyId`:

```javascript
// In the segment loop, before the loop starts:
let currentPropertyId = null;
let currentDestinationId = null;  // ADD THIS
let currentCountry = null;

// In the stay block handler:
if (type === 'stay' || type === 'accommodation') {
  const name = segment.name || segment.title || segment.supplierName;
  currentPropertyId = name ? (propertyMap.get(name) || null) : null;
  currentCountry = segment.country || segment.countryName || null;
  // ADD THIS: resolve destination for the current stay
  const locationString = segment.location || segment.locationName || null;
  const country = segment.country || segment.countryName || null;
  if (locationString && country) {
    const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
    currentDestinationId = countryId ? await resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL) : null;
  } else if (country) {
    currentDestinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
  } else {
    currentDestinationId = null;
  }
  continue;
}
```

**Change 2: observationCount initialization**

When creating a new Activity record, change:
```javascript
observationCount: 1,   // WRONG — handler increments from 0, result should be 1 not 2
```
To:
```javascript
observationCount: 0,   // handler.js increments: (activity.observationCount || 0) + 1 → 1
```

---

## 12. Scraper: New linkAirports() Function

Add to transform.js. Returns a Map of `iataCode|slug → airportId`. Called after linkDestinations(), before linkTransferRoutes().

```javascript
async function linkAirports(segments, headers, PAYLOAD_API_URL) {
  const airportMap = new Map()  // iataCode or slug → airportId
  const processedKeys = new Set()

  const airportSegmentTypes = new Set(['point', 'entry', 'exit'])

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (!airportSegmentTypes.has(type)) continue

    const airportName = segment.title || segment.name || segment.supplierName || segment.location
    const iataCode = segment.locationCode || null  // e.g. "JRO", "WIL", "ARK"
    const countryCode = segment.countryCode || null

    if (!airportName) continue

    const lookupKey = iataCode ? iataCode.toUpperCase() : generateSlug(airportName)
    if (processedKeys.has(lookupKey)) continue
    processedKeys.add(lookupKey)

    let airportId = null

    // Lookup by IATA code (most reliable dedup)
    if (iataCode) {
      const res = await fetch(
        `${PAYLOAD_API_URL}/api/airports?where[iataCode][equals]=${encodeURIComponent(iataCode.toUpperCase())}&limit=1`,
        { headers }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.docs?.[0]?.id) {
          airportId = data.docs[0].id
          airportMap.set(lookupKey, airportId)
          // Update observationCount
          await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
          })
          console.log(`[linkAirports] FOUND by IATA: ${iataCode} → ${airportId}`)
          continue
        }
      }
    }

    // Lookup by slug
    if (!airportId) {
      const slug = generateSlug(airportName)
      const res = await fetch(
        `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
        { headers }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.docs?.[0]?.id) {
          airportId = data.docs[0].id
          airportMap.set(lookupKey, airportId)
          await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
          })
          console.log(`[linkAirports] FOUND by slug: ${slug} → ${airportId}`)
          continue
        }
      }
    }

    // Create airport
    if (!airportId) {
      const countryId = countryCode ? COUNTRY_CODE_TO_ID[countryCode.toUpperCase()] || null : null
      const slug = generateSlug(airportName)
      const createRes = await fetch(`${PAYLOAD_API_URL}/api/airports`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: airportName,
          slug,
          iataCode: iataCode ? iataCode.toUpperCase() : null,
          type: classifyAirportType(airportName, iataCode),
          city: segment.location || null,
          country: countryId,
          nearestDestination: null,  // populated manually via Payload admin
          observationCount: 1,
        }),
      })
      if (createRes.ok) {
        const created = await createRes.json()
        airportId = created.doc?.id || created.id
        airportMap.set(lookupKey, airportId)
        console.log(`[linkAirports] CREATED: ${airportName} (${iataCode || 'no IATA'}) → ${airportId}`)
      } else {
        const errText = await createRes.text()
        // Handle slug conflict
        if (createRes.status === 400 && errText.includes('unique')) {
          const slug = generateSlug(airportName)
          const retryRes = await fetch(
            `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
            { headers }
          )
          if (retryRes.ok) {
            const retryData = await retryRes.json()
            if (retryData.docs?.[0]?.id) {
              airportId = retryData.docs[0].id
              airportMap.set(lookupKey, airportId)
              console.log(`[linkAirports] LINKED (after conflict): ${airportName} → ${airportId}`)
            }
          }
        }
        if (!airportId) console.error(`[linkAirports] Failed to create ${airportName}: ${createRes.status}`)
      }
    }
  }

  console.log(`[linkAirports] Total airports: ${airportMap.size}`)
  return airportMap
}
```

---

## 13. Scraper: linkTransferRoutes() Fix

**fromDestination and toDestination resolution — precise algorithm:**

For each transfer segment, the endpoints (from/to) can be:
- A Property name (in the propertyMap) → use that property's destination
- An Airport name (in the airportMap) → use that airport's nearestDestination (nullable)
- An unknown string → use the country-level destination as fallback

The current `linkTransferRoutes()` passes `destinationCache` (country → id). This must be extended to also accept `propertyMap` and `airportMap` so it can resolve endpoints correctly.

Add a helper function:

```javascript
async function resolveEndpointDestination(endpointName, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL) {
  if (!endpointName) return null

  // Check if endpoint is a known property
  const propertyId = propertyMap.get(endpointName)
  if (propertyId) {
    // Fetch property to get its destination
    const res = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=1`, { headers })
    if (res.ok) {
      const prop = await res.json()
      const destId = typeof prop.destination === 'object' ? prop.destination.id : prop.destination
      if (destId) return destId
    }
  }

  // Check if endpoint is a known airport (by name)
  for (const [key, airportId] of airportMap.entries()) {
    // airportMap keys are IATA codes or slugs — check if endpoint name generates the same slug
    if (generateSlug(endpointName) === key || endpointName.toUpperCase() === key) {
      // Fetch airport to get nearestDestination
      const res = await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}?depth=1`, { headers })
      if (res.ok) {
        const airport = await res.json()
        const destId = typeof airport.nearestDestination === 'object'
          ? airport.nearestDestination?.id
          : airport.nearestDestination
        if (destId) return destId
        // Airport has no nearestDestination yet — use airport's country as fallback
        const countryId = typeof airport.country === 'object' ? airport.country?.id : airport.country
        return countryId || null
      }
    }
  }

  // Unknown endpoint — fall back to country from destinationCache
  // Use the segment's country field (passed in caller)
  return null
}
```

Update `linkTransferRoutes()` signature to accept `propertyMap` and `airportMap`:

```javascript
async function linkTransferRoutes(segments, destinationCache, propertyMap, airportMap) {
```

When creating/updating a TransferRoute, resolve fromDestination and toDestination:

```javascript
const from = segment.from || segment.fromPoint || segment.location || null
const to = segment.to || segment.toPoint || null

const fromDestinationId = await resolveEndpointDestination(from, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)
const toDestinationId = await resolveEndpointDestination(to, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)

// Also resolve airport links
const fromAirportKey = from ? from.toUpperCase() : null
const toAirportKey = to ? to.toUpperCase() : null
const fromAirportId = fromAirportKey && airportMap.has(fromAirportKey) ? airportMap.get(fromAirportKey) : null
const toAirportId = toAirportKey && airportMap.has(toAirportKey) ? airportMap.get(toAirportKey) : null
```

Use `fromDestinationId`, `toDestinationId`, `fromAirportId`, `toAirportId` when creating/patching TransferRoute records.

---

## 14. Scraper: handler.js — ItineraryPatterns regions and serviceItems

After creating/updating the ItineraryPatterns record, populate:

**regions:** Collect the unique destination IDs from `propertySequence`. For each property in the sequence, fetch its `destination` field. Deduplicate. These are the specific Destination records (parks, reserves, cities), not countries. Only add destination-type records (type='destination'), exclude country-type records.

```javascript
// Collect region IDs from property sequence
const regionIds = []
for (const seq of _knowledgeBase.propertySequence) {
  if (!seq.property) continue
  const propRes = await payload.getById('properties', seq.property, { depth: 1 })
  const destId = typeof propRes.destination === 'object' ? propRes.destination?.id : propRes.destination
  if (destId && !regionIds.includes(destId)) {
    // Verify it's a destination-type record, not a country
    // If depth=1, propRes.destination.type is available
    const destType = typeof propRes.destination === 'object' ? propRes.destination?.type : null
    if (!destType || destType === 'destination') {
      regionIds.push(destId)
    }
  }
}
// Update ItineraryPatterns with regions
await payload.update('itinerary-patterns', patternId, { regions: regionIds })
```

**serviceItems:** Pass `serviceItemIds` from `linkServiceItems()` (new function in transform.js, analogous to `linkActivities()` but for ServiceItems). Update ItineraryPatterns with those IDs.

---

## 15. Scraper: transform() Function — Call Sequence Update

The `transform()` function currently calls:
1. `linkDestinations()`
2. `linkProperties()`
3. `linkTransferRoutes(segments, destinationCache)`
4. `linkActivities(segments, propertyMap, destinationCache)`

New call sequence:
1. `linkDestinations()`
2. `linkProperties()` ← now uses `resolveLocationToDestination()`
3. `linkAirports(segments, headers, PAYLOAD_API_URL)` ← NEW
4. `linkTransferRoutes(segments, destinationCache, propertyMap, airportMap)` ← signature updated
5. `linkActivities(segments, propertyMap, destinationCache)` ← destination resolution fixed
6. `linkServiceItems(segments, propertyMap, airportMap, destinationCache)` ← NEW (analogous to linkActivities)

Add to `_knowledgeBase` in `transform()`:
```javascript
serviceItemIds: [...serviceItemMap.values()],
airportIds: [...airportMap.values()],
```

---

## 16. payload.config.ts Updates

Add imports and register:
```typescript
import { Airports } from './collections/Airports'
import { ServiceItems } from './collections/ServiceItems'
import { LocationMappings } from './globals/LocationMappings'
```

In `collections` array: add `Airports`, `ServiceItems`  
In `globals` array: add `LocationMappings`, remove `DestinationNameMappings`

---

## 17. content-system/cascade/destination-resolver.ts Update

Change the global it reads from:

```typescript
// BEFORE:
const mappingsData = await payload.findGlobal({ slug: 'destination-name-mappings' })
// AFTER:
const mappingsData = await payload.findGlobal({ slug: 'location-mappings' })

// BEFORE: search mappings[].aliases for match
// AFTER: search mappings[] where resolvedAs === 'destination', match on externalString
for (const mapping of mappings) {
  if (mapping.resolvedAs !== 'destination') continue
  if (mapping.externalString.toLowerCase() === locationName.toLowerCase()) {
    const destId = typeof mapping.destination === 'object' ? mapping.destination.id : mapping.destination
    return { action: 'found', payloadId: destId, ... }
  }
}
```

---

## 18. Required Data Fixes (exact SQL and Payload operations)

These run in this exact sequence. Each step is verified before the next starts.

### Step A: Create Serengeti National Park destination

Via Payload API (not direct SQL — Payload must process it for draft status and version history):

```
POST /api/destinations
{
  name: "Serengeti National Park",
  slug: "serengeti-national-park",
  type: "destination",
  country: 3,   // Tanzania
  _status: "draft"
}
```

Record the new ID returned. Call it `SERENGETI_ID`.

**Verification:** `SELECT id, name, type, country_id FROM destinations WHERE slug = 'serengeti-national-park';` → must return exactly 1 row with type='destination', country_id=3.

### Step B: Fix Nyasi Tented Camp destination

```
PATCH /api/properties/41
{ destination: SERENGETI_ID }
```

**Verification:** `SELECT destination_id FROM properties WHERE id = 41;` → must equal SERENGETI_ID.

### Step C: Fix remaining property destinations (confirm they're correct)

```
PATCH /api/properties/42   { destination: 37 }  // Mwiba Lodge → Mwiba Wildlife Reserve
PATCH /api/properties/40   { destination: 35 }  // Little Chem Chem → Tarangire National Park
PATCH /api/properties/39   { destination: 34 }  // Legendary Lodge → Arusha
```

**Verification:** 
```sql
SELECT p.name, d.name AS destination, d.type 
FROM properties p JOIN destinations d ON p.destination_id = d.id 
ORDER BY p.id;
```
Expected result:
```
Legendary Lodge   | Arusha                  | destination
Little Chem Chem  | Tarangire National Park | destination
Nyasi Tented Camp | Serengeti National Park | destination
Mwiba Lodge       | Mwiba Wildlife Reserve  | destination
```
Any other result = FAIL.

### Step D: Create ServiceItems for the 6 misclassified Activity records

Create the following ServiceItem records via Payload API:

1. name: "Meet and Assist - Kilimanjaro Int Airport Arrival", slug: "meet-and-assist-kilimanjaro-int-airport-arrival", category: "airport_service", serviceLevel: "premium", isInclusionIndicator: true, observationCount: 1
2. name: "VIP Lounge - Kilimanjaro International Airport Arrival", slug: "vip-lounge-kilimanjaro-international-airport-arrival", category: "airport_service", serviceLevel: "ultra_premium", isInclusionIndicator: true, observationCount: 1
3. name: "Serengeti Camping Fee", slug: "serengeti-camping-fee", category: "park_fee", serviceLevel: "standard", isInclusionIndicator: true, observationCount: 1
4. name: " Serengeti National Park Fee", slug: "serengeti-national-park-fee", category: "park_fee", serviceLevel: "standard", isInclusionIndicator: true, observationCount: 1

Note: The leading space in " Serengeti National Park Fee" is the actual name as stored in the Activities table. The slug strips it. Use the trimmed name "Serengeti National Park Fee" when creating the ServiceItem.

5. name: "Meet and Assist - Kilimanjaro Int Airport Departure", slug: "meet-and-assist-kilimanjaro-int-airport-departure", category: "airport_service", serviceLevel: "premium", isInclusionIndicator: true, observationCount: 1
6. name: "VIP Lounge - Kilimanjaro International Airport Departure", slug: "vip-lounge-kilimanjaro-international-airport-departure", category: "airport_service", serviceLevel: "ultra_premium", isInclusionIndicator: true, observationCount: 1

**Verification:** `SELECT id, name, category, service_level FROM service_items ORDER BY id;` → must return exactly 6 rows with categories matching the above.

### Step E: Delete Activity records 8, 9, 10, 11, 13, 14 (but NOT 12)

These are the 6 misclassified records. Activity id=12 (Serengeti Balloon Safari, type=balloon_flight) is correct and must remain.

Deletion must handle the `activities_rels` table. Delete child rows first, then the parent:

```sql
DELETE FROM activities_rels WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM activities WHERE id IN (8, 9, 10, 11, 13, 14);
```

Note: Payload versioning may also have rows in `_activities_v` and `_activities_v_rels`. Check and delete:

```sql
SELECT id FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14);
-- If rows exist:
DELETE FROM _activities_v_rels WHERE parent_id IN (SELECT id FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14));
DELETE FROM activities_suitability WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14);
```

**Verification:** 
```sql
SELECT id, name, type FROM activities;
```
Expected: exactly 1 row — id=12, name="Serengeti Balloon Safari", type="balloon_flight".

### Step F: Fix Activity id=12 destination

Serengeti Balloon Safari currently has destinations=[Tanzania/id=3]. Update to point to Serengeti National Park:

```
PATCH /api/activities/12
{ destinations: [SERENGETI_ID] }
```

**Verification:** 
```sql
SELECT a.name, d.name AS destination, d.type 
FROM activities a 
JOIN activities_rels r ON r.parent_id = a.id AND r.path = 'destinations'
JOIN destinations d ON d.id = r.destinations_id
WHERE a.id = 12;
```
Expected: "Serengeti Balloon Safari" | "Serengeti National Park" | "destination"

### Step G: Delete wrong Destination record (id=36)

First verify no FK references remain:
```sql
SELECT COUNT(*) FROM properties WHERE destination_id = 36;
-- Expected: 0
SELECT COUNT(*) FROM activities_rels WHERE destinations_id = 36;
-- Expected: 0 (after Step E+F)
SELECT COUNT(*) FROM itinerary_patterns_rels WHERE destinations_id = 36;
-- Expected: 0 or fix first
```

Then delete:
```sql
DELETE FROM destinations WHERE id = 36 AND name = 'Serengeti Mobile';
```

**Verification:** `SELECT id FROM destinations WHERE id = 36;` → 0 rows.

### Step H: Add LocationMappings entry

Via Payload admin UI (not API — first entry in a new global):
- externalString: "Serengeti Mobile"
- sourceSystem: "itrvl"
- resolvedAs: "destination"
- destination: SERENGETI_ID (Serengeti National Park)
- notes: "Serengeti Mobile is the mobile camp operating concept for Nyasi Tented Camp. The actual destination is Serengeti National Park."

### Step I: Update ItineraryPatterns record (id=2)

The existing ItineraryPatterns record has `countries=[Tanzania/id=3]` only. After schema migration adds the `regions` field, populate it:

```
PATCH /api/itinerary-patterns/2
{
  regions: [SERENGETI_ID, 37, 35, 34],  // Serengeti NP, Mwiba Wildlife Reserve, Tarangire NP, Arusha
  serviceItems: [IDs of the 6 ServiceItems created in Step D]
}
```

---

## 19. Implementation Sequence

Steps must be executed in this exact order. No step starts before the previous is verified with the specified query.

```
Step 1: Schema files (Sections 2–8, 16)
  ↓ verified: all .ts files exist and compile without errors
Step 2: Payload migration
  ↓ verified: new tables exist in DB (Section 20, Gate 1)
Step 3: Data fixes A–I (Section 18)
  ↓ verified: each step's verification query passes before next step
Step 4: Remove 'other' from Activities type enum (now safe — no records have type='other')
  ↓ verified: schema compiles, Payload admin loads Activities without error
Step 5: Update content cascade (Section 17)
  ↓ verified: cascade reads from location-mappings global without error
Step 6: Update scraper (Sections 10–15)
  ↓ verified: transform.js compiles, no undefined function references
Step 7: Deploy and test scrape (Section 20, Gates 2–4)
```

---

## 20. Ungameable Verification Gates

These gates verify data content, not just structure. A gate fails if any expected value is wrong — even if the structure is correct.

### Gate 1: Schema migration complete

Run after Step 2.

```sql
-- New tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('airports', 'service_items', 'location_mappings', 'location_mappings_mappings')
ORDER BY table_name;
-- Expected: 4 rows

-- airports columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'airports' 
AND column_name IN ('id', 'name', 'slug', 'iata_code', 'type', 'country_id', 'nearest_destination_id', 'observation_count')
ORDER BY column_name;
-- Expected: 8 rows (exact column names depend on Payload naming convention — adjust if needed)

-- ItineraryPatterns has regions path in rels table (will exist after first record update, not immediately)
-- Skip this check until after Step I

-- activities table no longer has type='other' as a valid stored value 
-- (cannot check schema constraint directly — check via Gate 3 Step E verification instead)
```

### Gate 2: Data fixes complete

Run after Step 3 (all sub-steps A–I complete).

```sql
-- Gate 2A: Serengeti National Park exists as destination
SELECT id, name, type, country_id FROM destinations 
WHERE slug = 'serengeti-national-park';
-- Expected: 1 row, type='destination', country_id=3

-- Gate 2B: Serengeti Mobile is gone
SELECT id FROM destinations WHERE name = 'Serengeti Mobile';
-- Expected: 0 rows

-- Gate 2C: All 4 properties point to destination-type records (not country-type)
SELECT p.name, d.name AS destination, d.type 
FROM properties p JOIN destinations d ON p.destination_id = d.id 
ORDER BY p.id;
-- Expected exactly:
-- Legendary Lodge   | Arusha                  | destination
-- Little Chem Chem  | Tarangire National Park | destination
-- Nyasi Tented Camp | Serengeti National Park | destination
-- Mwiba Lodge       | Mwiba Wildlife Reserve  | destination

-- Gate 2D: Activities table has exactly 1 record
SELECT id, name, type FROM activities;
-- Expected: exactly 1 row — id=12, name='Serengeti Balloon Safari', type='balloon_flight'

-- Gate 2E: Balloon Safari points to Serengeti National Park (not Tanzania)
SELECT d.name, d.type FROM activities_rels r 
JOIN destinations d ON d.id = r.destinations_id
WHERE r.parent_id = 12 AND r.path = 'destinations';
-- Expected: 1 row, name='Serengeti National Park', type='destination'

-- Gate 2F: Service items exist with correct categories
SELECT name, category, service_level FROM service_items ORDER BY id;
-- Expected: 6 rows
-- 2 with category='airport_service', service_level='ultra_premium' (VIP Lounges)
-- 2 with category='airport_service', service_level='premium' (Meet and Assist)
-- 2 with category='park_fee', service_level='standard' (fees)

-- Gate 2G: No activity records with wrong category still exist
SELECT COUNT(*) FROM activities WHERE type = 'other';
-- Expected: 0
```

### Gate 3: Scraper test — after scraping 1 new itinerary

Run after Step 7. Use the same Tanzania itinerary (same URL) to test idempotency, OR use a Kenya itinerary to test new-country handling.

```sql
-- Gate 3A: No properties linked to country-type destinations
SELECT p.name, d.name, d.type 
FROM properties p JOIN destinations d ON p.destination_id = d.id 
WHERE d.type = 'country';
-- Expected: 0 rows

-- Gate 3B: No activity records with type='other'
SELECT id, name, type FROM activities WHERE type = 'other';
-- Expected: 0 rows

-- Gate 3C: Airports table populated (at minimum KIA exists)
SELECT id, name, iata_code, type FROM airports ORDER BY id;
-- Expected: at minimum 1 row containing 'Kilimanjaro' with iata_code='JRO'

-- Gate 3D: ServiceItems populated (at minimum the 6 migrated records still exist)
SELECT COUNT(*) FROM service_items;
-- Expected: >= 6

-- Gate 3E: ItineraryPatterns has regions (not just countries)
SELECT path, COUNT(*) FROM itinerary_patterns_rels 
GROUP BY path ORDER BY path;
-- Expected: path='countries' AND path='regions' both present
-- regions must have >= 1 row referencing a destination-type record

-- Gate 3F: TransferRoutes have fromDestination pointing to destination-type records (not country)
SELECT tr.from, tr.to, d.name, d.type 
FROM transfer_routes tr 
JOIN destinations d ON d.id = tr.from_destination_id
ORDER BY tr.id;
-- Expected: all rows show d.type='destination', not 'country'
-- If this is a re-scrape of the Tanzania itinerary, from_destination should be
-- 'Arusha', 'Tarangire National Park', 'Serengeti National Park', or 'Mwiba Wildlife Reserve'
-- NOT 'Tanzania'
```

---

## 21. What This Document Does Not Change

- V7 two-field editorial pattern on Itineraries — unchanged
- Destinations collection structure (country/destination in same table with type discriminator) — unchanged
- PropertyNameMappings global — unchanged
- Content cascade orchestration logic — unchanged; only destination resolver source changes
- ItineraryPatterns `countries` field — unchanged; `regions` is additive
- KIULI_AGENTIC_VISION.md — this document implements it; does not override it

---

*KIULI CANONICAL SCHEMA SPECIFICATION — Version 2.0*  
*"Verify data content, not structure. Structure can be faked. Data cannot."*
