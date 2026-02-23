# Kiuli Canonical Schema Specification

**Version:** 1.0  
**Date:** February 2026  
**Status:** AUTHORITATIVE — CLI must implement from this document exactly  
**Owner:** Graham Wallington

---

## Purpose

This document defines the canonical entity hierarchy, all schema changes required, the resolution algorithm for external location strings, and the complete scraper evolution. It supersedes the M2 Phase 2 gaps identified in previous audits.

No code is written before this document is complete. No schema is implemented without every field in this document. No scraper runs before the schema exists.

---

## 1. The Canonical Entity Hierarchy

Five entity types form Kiuli's canonical knowledge base. They are ordered by hierarchy. Nothing can be created out of order.

```
Countries
  └── Destinations
        └── Properties
Airports (in Countries, optionally near Destinations)
ServiceItems (independent, linked to Airports/Destinations)
```

### 1.1 Countries

**Collection:** `destinations` (type = 'country')  
**Rule:** Pre-seeded. The scraper NEVER creates a country. It only links to existing country records.  
**Current records:** Kenya, Tanzania, Uganda, Rwanda, Botswana, South Africa, Zambia, Zimbabwe, Namibia, Mozambique  
**Adding new countries:** Manual only, before scraping itineraries that visit them.

### 1.2 Destinations

**Collection:** `destinations` (type = 'destination')  
**Rule:** A destination is a geographic area within a country that a guest visits and that Kiuli will build a content page for.  
**Examples:** Masai Mara, Serengeti National Park, Ngorongoro, Okavango Delta, Nairobi, Arusha, Sabi Sands, Tarangire National Park, Mwiba Wildlife Reserve, Cape Town.  
**A park is a destination. A city with multiple properties is a destination. A private reserve is a destination.**  
**A destination is NOT:** a property name, a mobile camp concept, an airport, a country.  
**Parent:** Always one country record.  
**Creation:** The scraper auto-creates Destination records when a confirmed destination string has no existing record. Creation is gated by LocationMappings — if the string resolves to a property or airport in LocationMappings, no Destination record is created.  
**Content engine trigger:** Every auto-created Destination generates a `destination_page` ContentProject at `idea` stage.

### 1.3 Properties

**Collection:** `properties`  
**Rule:** A property is an individual lodge, camp, hotel, mobile camp, or villa where a guest sleeps.  
**Examples:** Angama Mara, Nyasi Tented Camp, Mwiba Lodge, Legendary Lodge, Singita Boulders.  
**A property is NOT:** a destination, a park, a city, a mobile camp concept.  
**Parent:** Always one Destination record (never a Country record).  
**Creation:** The scraper auto-creates Property records from stay segments. Creation uses PropertyNameMappings for aliases and LocationMappings to resolve the correct parent Destination.  
**Content engine trigger:** Every auto-created Property generates a `property_page` ContentProject at `idea` stage.

### 1.4 Airports

**Collection:** `airports` (NEW)  
**Rule:** An airport is a physical aviation facility — international airport, domestic airport, or bush airstrip. Airports are NOT properties. Airports are NOT destinations.  
**Examples:** Wilson Airport Nairobi (WIL), Kilimanjaro International Airport (JRO), Mara North Airstrip (MRE), Arusha Airport (ARK).  
**Parent:** Always one Country record. Optionally linked to the nearest Destination.  
**Creation:** The scraper auto-creates Airport records from `point`, `entry`, and `exit` segment types. Uses IATA code (`locationCode`) for deduplication where available.

### 1.5 ServiceItems

**Collection:** `service-items` (NEW)  
**Rule:** A ServiceItem is a billable service or fee observed in an iTrvl itinerary that is NOT an experiential activity. ServiceItems are never displayed on itinerary landing pages. They inform the knowledge base about service level, included costs, and pricing composition.  
**Examples:** Meet and Assist, VIP Lounge, Serengeti Camping Fee, Serengeti National Park Fee, Departure Tax.  
**Parent:** Optionally linked to an Airport (for airport services) or Destination (for park fees). Always linked to observedInItineraries.

---

## 2. LocationMappings Global

### 2.1 Purpose

LocationMappings is the translation layer between external systems' naming and Kiuli's canonical entity hierarchy. It answers the question: "When system X says the location is Y, what canonical Kiuli entity does that refer to, and what type is it?"

It supersedes and replaces the existing `DestinationNameMappings` global. `PropertyNameMappings` is kept — it handles property name aliases within a confirmed property entity. LocationMappings handles the prior question: what entity type is this string?

### 2.2 Schema

**Global slug:** `location-mappings`  
**Admin group:** Configuration  
**Access:** read public, update authenticated

```typescript
fields: [
  {
    name: 'mappings',
    type: 'array',
    fields: [
      {
        name: 'externalString',
        type: 'text',
        required: true,
        // The exact string as it appears in the source system
        // e.g. "Serengeti Mobile", "WIL", "Wilson Airport", "Mara North"
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
        // 'any' = applies regardless of source system
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
          // 'ignore' = this string is noise, discard it silently
        ],
      },
      {
        name: 'destination',
        type: 'relationship',
        relationTo: 'destinations',
        // Required when resolvedAs = 'destination'
      },
      {
        name: 'property',
        type: 'relationship',
        relationTo: 'properties',
        // Required when resolvedAs = 'property'
        // Note: when resolvedAs = 'property', the stay's supplierName
        // is still the canonical property name. This field just confirms
        // which property record to link to.
      },
      {
        name: 'airport',
        type: 'relationship',
        relationTo: 'airports',
        // Required when resolvedAs = 'airport'
      },
      {
        name: 'notes',
        type: 'textarea',
        // Why this mapping exists. e.g. "Serengeti Mobile is the
        // concept name for Nyasi Tented Camp's mobile operation.
        // The actual destination is Serengeti National Park."
      },
    ],
  },
]
```

### 2.3 Initial Seed Data

These mappings must be created as part of the migration, before the next scrape runs:

| externalString | sourceSystem | resolvedAs | resolves to |
|---|---|---|---|
| Serengeti Mobile | itrvl | destination | Serengeti National Park (to be created) |

### 2.4 Resolution Algorithm (used by scraper)

For any location string from an external source:

```
function resolveLocation(externalString, sourceSystem):
  1. Query LocationMappings where externalString matches AND
     (sourceSystem matches OR sourceSystem = 'any')
  2. If found:
     - resolvedAs = 'destination' → return { type: 'destination', id: mapping.destination }
     - resolvedAs = 'property' → return { type: 'property', id: mapping.property }
     - resolvedAs = 'airport' → return { type: 'airport', id: mapping.airport }
     - resolvedAs = 'ignore' → return { type: 'ignore' }
  3. If not found:
     - Query Destinations collection: name = externalString AND type = 'destination'
     - If found → return { type: 'destination', id: destination.id }
  4. If still not found:
     - Auto-create Destination record:
         name: externalString
         slug: slugify(externalString)
         type: 'destination'
         country: resolved country ID
         _status: 'draft'
     - Trigger ContentProject creation: destination_page at idea stage
     - Return { type: 'destination', id: newDestination.id }
  5. Log all resolutions at step 3+ for admin review
```

**Critical rule:** Step 4 (auto-create) only runs for `stay` segment locations. It never runs for `flight`, `road`, `point`, `entry`, or `exit` segment locations. Those go through Airport resolution instead.

---

## 3. New Collection: Airports

**Collection slug:** `airports`  
**Admin group:** Knowledge Base

```typescript
{
  name: text                    // e.g. "Wilson Airport", "Kilimanjaro International Airport"
  slug: text (unique, indexed)  // e.g. "wilson-airport", "kilimanjaro-international-airport"
  iataCode: text                // e.g. "WIL", "JRO" — nullable (bush airstrips may lack IATA)
  icaoCode: text                // e.g. "HKWL" — nullable
  
  type: select (
    international,              // Major international airports
    domestic,                   // Scheduled domestic service
    airstrip                    // Bush airstrips, no scheduled service
  )
  
  city: text                    // e.g. "Nairobi", "Arusha"
  
  country: relationship(destinations, type='country')  // Required
  nearestDestination: relationship(destinations, type='destination')  // Nullable
  // nearestDestination = the primary safari destination this airport serves
  // e.g. Wilson Airport → Masai Mara / Amboseli (serves multiple — leave nullable for now)
  // e.g. Mara North Airstrip → Masai Mara
  
  coordinates: group {
    latitude: number
    longitude: number
  }
  
  observationCount: number (readOnly, default 0)
  // How many scraped itineraries include this airport as a transit point
}
```

### 3.1 Deduplication

Primary: `iataCode` where not null.  
Secondary: `slug` where IATA unavailable.  
The scraper checks IATA code first, then slug.

### 3.2 TransferRoutes additions

Add to `TransferRoutes` collection:

```typescript
{
  fromAirport: relationship(airports)  // Nullable — origin airport if applicable
  toAirport: relationship(airports)    // Nullable — destination airport if applicable
}
```

These are in addition to `fromDestination` and `toDestination`, not replacing them.  
`fromDestination` / `toDestination` describe the geographic region.  
`fromAirport` / `toAirport` describe the specific transit facility.

---

## 4. New Collection: ServiceItems

**Collection slug:** `service-items`  
**Admin group:** Knowledge Base

```typescript
{
  name: text (required)             // e.g. "Meet and Assist - Kilimanjaro Int Airport Arrival"
  slug: text (unique, indexed)      // Auto-generated from name
  
  category: select (required) {
    airport_service,                // Meet & assist, VIP lounge, porter, fast-track
    park_fee,                       // National park fees, camping fees, conservation fees
    conservation_fee,               // Wildlife conservancy fees
    departure_tax,                  // Airport departure taxes
    accommodation_supplement,       // Single supplement, peak supplement
    other                           // Unclassified — for human review
  }
  
  associatedAirport: relationship(airports)      // Nullable — for airport_service category
  associatedDestination: relationship(destinations) // Nullable — for park_fee / conservation_fee
  
  isInclusionIndicator: checkbox (default true)
  // True if presence of this item indicates it is INCLUDED in the itinerary price.
  // Used by agentic builder for price composition and comparability.
  
  serviceLevel: select {
    standard,                        // Basic service inclusion
    premium,                         // e.g. standard meet & assist
    ultra_premium                    // e.g. VIP lounge + fast-track + porter
  }
  // Populated by scraper classification logic
  
  observationCount: number (readOnly, default 0)
  observedInItineraries: relationship(itineraries, hasMany: true, readOnly: true)
}
```

### 4.1 Classification Logic (scraper)

```javascript
function classifyServiceItem(name) {
  const n = name.toLowerCase()
  
  // Airport services
  if (n.includes('meet and assist') || n.includes('meet & assist')) 
    return { category: 'airport_service', serviceLevel: 'premium' }
  if (n.includes('vip lounge') || n.includes('vip fast') || n.includes('fast track'))
    return { category: 'airport_service', serviceLevel: 'ultra_premium' }
  if (n.includes('porter'))
    return { category: 'airport_service', serviceLevel: 'premium' }
  
  // Park and conservation fees
  if (n.includes('national park fee') || n.includes('park fee') || n.includes('park entrance'))
    return { category: 'park_fee', serviceLevel: 'standard' }
  if (n.includes('camping fee'))
    return { category: 'park_fee', serviceLevel: 'standard' }
  if (n.includes('conservation fee') || n.includes('conservancy fee'))
    return { category: 'conservation_fee', serviceLevel: 'standard' }
  
  // Departure taxes
  if (n.includes('departure tax') || n.includes('airport tax'))
    return { category: 'departure_tax', serviceLevel: 'standard' }
  
  // Accommodation supplements
  if (n.includes('single supplement') || n.includes('peak supplement'))
    return { category: 'accommodation_supplement', serviceLevel: 'standard' }
  
  return { category: 'other', serviceLevel: 'standard' }
}
```

### 4.2 Service Segment Routing Logic (scraper)

For every iTrvl `service` segment:

```
1. Run classifyActivity(segment.name)
2. If result is NOT 'other' → create/update Activities record (unchanged)
3. If result IS 'other' → run classifyServiceItem(segment.name)
4. Create/update ServiceItems record using classification result
```

This replaces the current behavior of creating Activity records with type='other'.

---

## 5. Modified Collection: Activities

**Change:** Remove `'other'` from the type select options.

The 'other' option existed because there was no ServiceItems collection to handle non-activity service segments. With ServiceItems in place, any segment that does not classify as a genuine experiential activity goes to ServiceItems.

**Updated type enum** (per KIULI_AGENTIC_VISION.md — unchanged from vision document):

```typescript
options: [
  game_drive, walking_safari, gorilla_trek, chimpanzee_trek,
  balloon_flight, boat_safari, canoe_safari, horseback_safari,
  cultural_visit, bush_dinner, sundowner, fishing,
  snorkeling, diving, spa, photography, birding,
  conservation_experience, community_visit, helicopter_flight
]
```

No 'other'. A helicopter transfer appears in Activities as `helicopter_flight` AND in TransferRoutes as `mode: helicopter`. Both are correct — it is both a transfer and an experiential activity.

---

## 6. Modified Collection: ItineraryPatterns

**Adding two fields:**

```typescript
// Add after 'countries' field:
{
  name: 'regions',
  type: 'relationship',
  relationTo: 'destinations',
  hasMany: true,
  admin: {
    description: 'Specific destinations/parks visited (not countries) — e.g. Serengeti, Masai Mara',
  },
},

// Add after 'transferSequence' field:
{
  name: 'serviceItems',
  type: 'relationship',
  relationTo: 'service-items',
  hasMany: true,
  admin: {
    description: 'Service items observed in this itinerary — fees, airport services, supplements',
  },
},
```

The `serviceLevel` of the overall itinerary pattern can be derived at query time from the linked service items — no need to duplicate it as a separate field.

---

## 7. Modified Collection: Properties

**Adding `seasonalityData`** (per KIULI_AGENTIC_VISION.md — currently missing):

```typescript
// Add inside accumulatedData group, after commonPairings:
{
  name: 'seasonalityData',
  type: 'array',
  admin: {
    description: 'Monthly observation counts — how many itineraries feature this property per month',
  },
  fields: [
    {
      name: 'month',
      type: 'number',
      required: true,
      admin: { description: '1–12' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
    },
  ],
},
```

**Scraper addition:** In handler.js, when updating accumulatedData for a property, also increment the seasonalityData entry for the itinerary's travel month.

---

## 8. Modified Global: LocationMappings (replaces DestinationNameMappings)

The existing `DestinationNameMappings` global is replaced by `LocationMappings`. The content cascade's `destination-resolver.ts` currently reads from `DestinationNameMappings`. It must be updated to read from `LocationMappings` instead, filtering for `resolvedAs = 'destination'`.

The existing `PropertyNameMappings` global is kept unchanged.

---

## 9. Scraper: linkProperties() Fix

**Current behavior:** Calls `lookupDestinationByCountry(stay.country)` → always returns country-level destination.

**Corrected behavior:**

```javascript
async function resolvePropertyDestination(stay, destinationCache, headers, PAYLOAD_API_URL) {
  const locationString = stay.location || stay.locationName
  const countryName = stay.country || stay.countryName
  
  // 1. Try LocationMappings first
  if (locationString) {
    const mapping = await queryLocationMappings(locationString, 'itrvl', headers, PAYLOAD_API_URL)
    
    if (mapping) {
      if (mapping.resolvedAs === 'destination') return mapping.destination
      if (mapping.resolvedAs === 'property') {
        // The location string IS a property name. Fall through to country.
        console.log(`[resolvePropertyDestination] ${locationString} resolves as property via LocationMappings — using country fallback`)
        return await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
      }
      if (mapping.resolvedAs === 'airport' || mapping.resolvedAs === 'ignore') {
        return await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
      }
    }
    
    // 2. Direct name match in Destinations
    const destMatch = await lookupDestinationByName(locationString, headers, PAYLOAD_API_URL)
    if (destMatch) return destMatch
    
    // 3. Auto-create Destination (stay segments only)
    const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
    const newDest = await createDestination(locationString, countryId, headers, PAYLOAD_API_URL)
    if (newDest) {
      // Trigger ContentProject for destination_page — handled by content cascade, not scraper
      console.log(`[resolvePropertyDestination] AUTO-CREATED destination: ${locationString}`)
      return newDest
    }
  }
  
  // 4. Country fallback
  return await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
}
```

---

## 10. Scraper: linkActivities() Fix

**Current behavior:** Resolves destination from `segment.country` → country level.

**Corrected behavior:** Resolve destination from the current stay's already-resolved destination ID, not from the country. The `linkActivities()` loop already tracks `currentPropertyId` from the preceding stay. It must also track `currentDestinationId` (the resolved destination of the preceding stay, not the country).

---

## 11. Scraper: New linkAirports() Function

**For segment types:** `point`, `entry`, `exit`

```javascript
async function linkAirports(segments, destinationCache, headers, PAYLOAD_API_URL) {
  const airportMap = new Map() // iataCode or slug → airportId
  
  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (!['point', 'entry', 'exit'].includes(type)) continue
    
    const airportName = segment.title || segment.name || segment.supplierName || segment.location
    const iataCode = segment.locationCode || null  // e.g. "JRO", "WIL"
    const countryCode = segment.countryCode
    
    if (!airportName) continue
    
    const lookupKey = iataCode || generateSlug(airportName)
    if (airportMap.has(lookupKey)) continue
    
    // Lookup by IATA code first, then slug
    let airportId = null
    
    if (iataCode) {
      // Query by iataCode
      // If found → airportId
      // If not found → fall through to slug lookup
    }
    
    if (!airportId) {
      // Query by slug
    }
    
    if (!airportId) {
      // Create Airport record
      // country: resolve from countryCode
      // nearestDestination: null (populated manually or via LocationMappings later)
    }
    
    if (airportId) airportMap.set(lookupKey, airportId)
  }
  
  return airportMap
}
```

---

## 12. Scraper: linkTransferRoutes() Fix

**fromDestination and toDestination resolution:**

Currently: both resolved from `segment.country` → country level.

Corrected: For each transfer segment, look at the preceding stay's resolved destination (from/to) and the following stay's resolved destination. If no stays bracket the transfer (entry/exit transfers), use the airport's nearestDestination.

Also add airport linkage: if `fromPoint` or `toPoint` matches an airport in the airportMap returned by `linkAirports()`, populate `fromAirport` / `toAirport`.

---

## 13. Scraper: observationCount Bug Fix

**In `linkActivities()`, when creating a new Activity record:**

```javascript
// Current (wrong):
observationCount: 1

// Corrected:
observationCount: 0
// handler.js increments via (activity.observationCount || 0) + 1 → result is 1
```

Same fix applies to `linkServiceItems()` when creating new ServiceItem records.

---

## 14. Required DB Clean-up (Data Fixes)

These must run as part of the migration, in this order:

1. **Create "Serengeti National Park" Destination record**  
   - name: "Serengeti National Park"  
   - slug: "serengeti-national-park"  
   - type: "destination"  
   - country_id: 3 (Tanzania)  
   - _status: "draft"

2. **Add LocationMappings entry**  
   - externalString: "Serengeti Mobile"  
   - sourceSystem: "itrvl"  
   - resolvedAs: "destination"  
   - destination: new Serengeti National Park record  
   - notes: "Serengeti Mobile is the mobile camp operating concept for Nyasi Tented Camp. The destination is Serengeti National Park."

3. **Delete Destination record id=36** ("Serengeti Mobile") — it is wrong data.

4. **Fix Property destination_id values:**
   - Nyasi Tented Camp (id=39): destination_id = Serengeti National Park (new record)
   - Mwiba Lodge (id=42): destination_id = 37 (Mwiba Wildlife Reserve) ✓ already correct once DB updated
   - Little Chem Chem (id=40): destination_id = 35 (Tarangire National Park) ✓
   - Legendary Lodge (id=39): destination_id = 34 (Arusha) ✓

5. **Migrate Activity records:**
   - id=12 (Serengeti Balloon Safari, type=balloon_flight): Keep in Activities, no change
   - id=8, 13 (Meet and Assist records): Delete from Activities, create ServiceItems (category=airport_service, serviceLevel=premium)
   - id=9, 14 (VIP Lounge records): Delete from Activities, create ServiceItems (category=airport_service, serviceLevel=ultra_premium)
   - id=10 (Serengeti Camping Fee): Delete from Activities, create ServiceItem (category=park_fee)
   - id=11 (Serengeti National Park Fee): Delete from Activities, create ServiceItem (category=park_fee)

6. **Link migrated ServiceItems to the existing itinerary (id=31)** via observedInItineraries.

7. **Update ItineraryPatterns record** to include the new ServiceItems and the `regions` field (Serengeti National Park + Mwiba Wildlife Reserve + Tarangire National Park + Arusha).

---

## 15. Payload Config Updates

After all schema changes, `src/payload.config.ts` must register:
- `Airports` collection
- `ServiceItems` collection
- `LocationMappings` global (replacing `DestinationNameMappings`)

`DestinationNameMappings` is deregistered from payload.config.ts. Its table is not dropped — it remains in the DB as a migration artefact but is no longer used.

The content cascade's `destination-resolver.ts` is updated to read from `location-mappings` instead of `destination-name-mappings`, filtering for `resolvedAs = 'destination'`.

---

## 16. Migration Sequence

This is the order in which the CLI must implement changes. No step starts before the prior step is verified.

**Step 1: Schema files**  
Create `src/collections/Airports.ts`  
Create `src/collections/ServiceItems.ts`  
Create `src/globals/LocationMappings.ts`  
Modify `src/collections/Activities.ts` — remove 'other' type option  
Modify `src/collections/ItineraryPatterns.ts` — add regions, serviceItems fields  
Modify `src/collections/Properties.ts` — add seasonalityData inside accumulatedData  
Modify `src/collections/TransferRoutes.ts` — add fromAirport, toAirport fields  
Update `src/payload.config.ts` — register Airports, ServiceItems, LocationMappings  

**Step 2: Generate and run migration**  
`npm run payload migrate:create`  
`npm run payload migrate` (or deploy to trigger auto-migration on Vercel)  
Verify all new tables exist in DB  

**Step 3: Data fixes**  
Run the DB clean-up sequence from Section 14  
Verify via DB queries  

**Step 4: Seed LocationMappings**  
Via Payload admin or API: create the "Serengeti Mobile" mapping  

**Step 5: Update content cascade**  
Modify `content-system/cascade/destination-resolver.ts` to read from `location-mappings`  

**Step 6: Update scraper**  
Implement `resolveLocation()` using LocationMappings  
Fix `linkProperties()` to use `resolvePropertyDestination()`  
Fix `linkActivities()` to use resolved destination from current stay  
Implement `linkServiceItems()` — new function  
Implement `linkAirports()` — new function  
Fix `linkTransferRoutes()` to populate fromDestination/toDestination correctly  
Fix `linkTransferRoutes()` to populate fromAirport/toAirport  
Fix observationCount bug in `linkActivities()` and `linkServiceItems()`  
Update handler.js to populate ItineraryPatterns.regions and ItineraryPatterns.serviceItems  
Update handler.js to update Properties.accumulatedData.seasonalityData  

**Step 7: Deploy and test**  
Deploy updated Lambdas  
Scrape 1 test itinerary  
Verify all entities created at correct hierarchy level  
Verify no 'other' Activity records created  
Verify ServiceItems created for fees and airport services  
Verify Airport records created  
Verify Property.destination points to Destination (not Country)  

---

## 17. Verification Queries

After Step 7, these DB queries must all pass:

```sql
-- No properties linked directly to a country record
SELECT p.name, d.type FROM properties p 
JOIN destinations d ON p.destination_id = d.id 
WHERE d.type = 'country';
-- Expected: 0 rows

-- No Activity records with type = 'other'
SELECT id, name, type FROM activities WHERE type = 'other';
-- Expected: 0 rows (after migration — 'other' is no longer a valid type)

-- ServiceItems exist
SELECT id, name, category FROM service_items ORDER BY id;
-- Expected: 6 rows from the test itinerary data

-- Airports exist
SELECT id, name, iata_code FROM airports ORDER BY id;
-- Expected: at least Kilimanjaro International Airport

-- ItineraryPatterns has regions
SELECT ip.id, COUNT(r.destinations_id) AS region_count 
FROM itinerary_patterns ip
LEFT JOIN itinerary_patterns_rels r ON r.parent_id = ip.id AND r.path = 'regions'
GROUP BY ip.id;
-- Expected: region_count > 0

-- Properties have correct destination depth
SELECT p.name, d.name AS destination, d.type 
FROM properties p JOIN destinations d ON p.destination_id = d.id;
-- Expected: all type = 'destination', none type = 'country'
```

---

## 18. What This Document Does NOT Change

- The V7 two-field editorial pattern on Itineraries — unchanged
- The existing Destinations collection structure (countries and destinations in same table with type discriminator) — unchanged, correct
- PropertyNameMappings global — unchanged
- The content cascade's overall orchestration logic — unchanged; only the destination resolver lookup source changes
- The agentic vision in KIULI_AGENTIC_VISION.md — this document implements what that vision specifies; it does not override it

---

*KIULI CANONICAL SCHEMA SPECIFICATION — Version 1.0*  
*"The canonical hierarchy is the foundation. Get it wrong once and everything built on it is wrong forever."*
