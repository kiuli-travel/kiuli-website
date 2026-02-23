# Kiuli Canonical Schema Specification

**Version:** 3.0  
**Date:** February 2026  
**Status:** AUTHORITATIVE — CLI implements exactly from this document. No improvisation.  
**Owner:** Graham Wallington

---

## What Changed from v2.0

**Added to Activities (Section 5):** `bookingBehaviour` group — the distinction between a daily game drive (included, no booking required) and a balloon safari (advance booking, fixed departure, additional cost) is essential for the itinerary builder. The scraper sets type-specific defaults; designers override.

**Added to Airports (Section 3):** `services` group encoding international vs domestic vs charter-only capability, and `relatedAirports` self-relationship encoding the Wilson/JKIA relationship. Both airports are in Nairobi. Without explicit schema, Kiuli cannot distinguish them.

**Added to ServiceItems (Section 4):** `serviceDirection` field (arrival | departure | both | na) — the agentic builder needs to know which Meet & Assist service to book when planning an arrival vs a departure.

**Added to TransferRoutes scraper (Section 13):** `fromProperty`/`toProperty` population — these fields exist in the schema but the scraper never sets them. Required for property-to-property routing intelligence.

**Added Section 2:** Journey Intelligence Model — how all entities fit together for the agentic builder. Establishes the conceptual framework before the schema details.

---

## 1. The Canonical Entity Hierarchy

Five entity types. Each has exactly one definition.

```
Countries
  └── Destinations
        └── Properties
Airports (belong to Countries; optionally near Destinations; related to other Airports)
ServiceItems (independent; linked to Airports and/or Destinations)
```

### 1.1 Countries

**Collection:** `destinations` (type = 'country')  
**Scraper rule:** NEVER creates. NEVER updates. Reads only.  
**Current records (confirmed in DB):** Kenya (id=2), Tanzania (id=3), Uganda (id=4), Rwanda (id=5), Botswana (id=6), South Africa (id=7), Zambia (id=8), Zimbabwe (id=9), Namibia (id=10), Mozambique (id=11)  
**Adding new countries:** Manual only.

### 1.2 Destinations

**Collection:** `destinations` (type = 'destination')  
**Definition:** A geographic area within a country that guests visit. National parks, private reserves, cities with multiple properties, coastal areas.  
**Examples:** Masai Mara, Serengeti National Park, Tarangire National Park, Mwiba Wildlife Reserve, Arusha, Nairobi, Sabi Sands.  
**NOT a destination:** A property name, a mobile camp concept, an airport, a country.  
**Parent:** Always one Country record (via `country_id` FK).  
**Dedup key:** `slug`. Lookup: `name` exact match + `type = 'destination'`.  
**Auto-creation:** Scraper creates from `stay.location` when LocationMappings and direct lookup both fail. Auto-created records are `_status: 'draft'`.  
**LocationMappings:** Scraper does NOT auto-add LocationMappings entries. Humans add mappings manually after review.

### 1.3 Properties

**Collection:** `properties`  
**Definition:** An individual lodge, camp, hotel, villa, or tented camp where a guest sleeps.  
**Parent:** Always one Destination record (type='destination'). NEVER a Country record.  
**Dedup key:** `slug`. Lookup order: PropertyNameMappings aliases → slug exact match.  
**Type classification:** See Section 9.  
**Auto-creation:** Scraper creates when property not found in PropertyNameMappings or by slug.

### 1.4 Airports

**Collection:** `airports` (NEW)  
**Definition:** A physical aviation facility where passengers board or disembark aircraft. International airports, domestic airports, and bush airstrips are all Airports.  
**NOT an airport:** A property, a destination, a country.  
**Parent:** Always one Country record.  
**Dedup key (in priority order):** IATA code first (where not null), slug second.  
**Auto-creation:** Scraper creates from `point`, `entry`, and `exit` segment types.

### 1.5 ServiceItems

**Collection:** `service-items` (NEW)  
**Definition:** A billable service observed in an iTrvl itinerary that is NOT an experiential activity. Meet & Assist, VIP Lounge, park fees, departure taxes, accommodation supplements.  
**NOT a service item:** A genuine experiential activity.  
**Dedup key:** `slug`.  
**Auto-creation:** Scraper creates from `service` segments where `classifyActivity()` returns 'other'.

---

## 2. Journey Intelligence Model

This section establishes the conceptual framework before the schema details. Read this before reading the collection definitions.

### 2.1 The Problem: Wilson vs JKIA

Wilson Airport (WIL) and Jomo Kenyatta International Airport (NBO/JKIA) are both in Nairobi. They are completely different facilities serving completely different purposes:

- **JKIA**: International arrivals from London, New York, Dubai. No safari flights depart from here.
- **Wilson**: Domestic charter flights to Masai Mara (MRE), Amboseli, Samburu. International guests transfer from JKIA to Wilson for domestic legs.

A naive schema that only records "Nairobi" as a location cannot distinguish these. An agent trying to build an itinerary that starts in London, visits Masai Mara, and continues to Tanzania would make routing errors without knowing this distinction.

**How the schema solves it:**
1. Both are Airport records with different IATA codes (NBO vs WIL) and different `services.hasInternationalFlights` flags.
2. The `relatedAirports` field on each Airport record cross-references the other: Wilson.relatedAirports = [JKIA], JKIA.relatedAirports = [Wilson].
3. TransferRoute "JKIA → Wilson Airport" is a road transfer (or shuttle), capturing that guests must move between airports within Nairobi.

### 2.2 The Journey Structure: Property to Property

A complete journey between two properties consists of ordered segments. Example: Legendary Lodge (Arusha) → Little Chem Chem (Tarangire):

```
[stay: Legendary Lodge]
road transfer: Legendary Lodge → Arusha Airport          ← road leg
point: Arusha Airport (ARK)                              ← airport node
flight: Arusha Airport → Little Chem Chem area           ← air leg
[stay: Little Chem Chem]
```

Arriving at the start of the trip from an international flight introduces airport services:

```
[international flight arrives]
point: Kilimanjaro International Airport (JRO)           ← airport node
service: Meet and Assist - Kilimanjaro Int Arrival       ← airport service (arrival)
service: VIP Lounge - Kilimanjaro Int Arrival            ← airport service (arrival)
road transfer: KIA → Legendary Lodge                     ← road leg
[stay: Legendary Lodge]
```

**How Kiuli learns this:** Each scraped itinerary deposits:
- TransferRoute records for each leg (road: LLodge→ARK, flight: ARK→LCC)
- ServiceItem records linked to the airport where services occur (JRO: Meet & Assist arrival, VIP Lounge arrival)
- ItineraryPatterns.transferSequence recording the ordered leg sequence between properties

After 100 itineraries, Kiuli knows:
- The typical legs between any two properties, in order
- Which airports have Meet & Assist services (and whether arrival or departure)
- Which airports have VIP Lounges
- Which airlines fly between which airstrips
- Which properties require a road transfer from the nearest airstrip vs have a private airstrip

### 2.3 How Activities Fit

Activities observed in `service` segments appear in two states:

**Scheduled activities** (balloon safaris, gorilla trekking, helicopter flights): have fixed departure times, require advance booking, are often at additional cost, have group size limits. The agent builder must pre-book these.

**On-demand/included activities** (game drives, walking safaris, sundowners): included in the lodge tariff, available daily, decided on the day by guides and guests. The agent builder describes these as "included" and does not need to book them.

The `bookingBehaviour` group on each Activity record captures this distinction with type-specific defaults set at scrape time and overridden by travel designers.

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
    // === IDENTITY ===
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

    // === HIERARCHY ===
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
      admin: { description: 'Primary safari destination this airport primarily serves — nullable; e.g. Mara North Airstrip → Masai Mara' },
    },

    // === RELATED AIRPORTS ===
    {
      name: 'relatedAirports',
      type: 'relationship',
      relationTo: 'airports',
      hasMany: true,
      admin: {
        description: 'Other airports in the same city or area serving different purposes. Critical for routing intelligence. Example: Wilson Airport (WIL) and JKIA (NBO) are both Nairobi — international guests arrive at JKIA then transfer to Wilson for domestic safari flights. Set this relationship on both airports bidirectionally.',
      },
    },

    // === SERVICES ===
    // These flags encode what type of aviation service this airport provides.
    // They are NOT derived from observations — they reflect the real-world capability of the airport.
    // Set manually when creating or reviewing Airport records. Defaults reflect the most common case for each airport type.
    {
      name: 'services',
      type: 'group',
      admin: {
        description: 'Aviation capabilities of this airport — set manually, not derived from observations',
      },
      fields: [
        {
          name: 'hasInternationalFlights',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Handles international scheduled airline arrivals and departures. True for: JKIA (NBO), Kilimanjaro (JRO), Entebbe (EBB), Kigali (KGL), OR Tambo (JNB), Cape Town (CPT). False for: Wilson (WIL), Arusha (ARK), all bush airstrips.',
          },
        },
        {
          name: 'hasDomesticScheduledFlights',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Has scheduled domestic commercial flights (Safarilink, AirKenya, Coastal, Auric Air type services). True for: Wilson (WIL), Arusha (ARK), many domestic airports. False for: pure bush airstrips (charter-only).',
          },
        },
        {
          name: 'charterOnly',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Charter and private flights only — no scheduled commercial service. True for most bush airstrips: Mara North (MRE), Keekorok, most camp-adjacent airstrips.',
          },
        },
      ],
    },

    // === GEOGRAPHY ===
    {
      name: 'coordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },

    // === KNOWLEDGE BASE ===
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many scraped itineraries transit this airport' },
    },
  ],
}
```

### 3.1 Airport Type Classification (scraper function, transform.js)

```javascript
function classifyAirportType(name, iataCode) {
  const n = name.toLowerCase()
  if (n.includes('international')) return 'international'
  if (n.includes('airstrip') || n.includes('strip')) return 'airstrip'
  // Known bush airstrips that may not have 'airstrip' in their name
  const knownAirstrips = ['mara north', 'mara keekorok', 'kichwa tembo', 'ol kiombo',
    'amboseli', 'samburu', 'lewa', 'nanyuki', 'laikipia', 'loisaba',
    'manyara', 'lake manyara', 'seronera', 'grumeti', 'migration']
  if (knownAirstrips.some(a => n.includes(a))) return 'airstrip'
  return 'domestic'
}
```

### 3.2 Airport Country Resolution

Use hardcoded lookup. Countries are pre-seeded and fixed.

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

If `countryCode` is not in this map: log a warning, leave country null. Do not create a country record.

### 3.3 Airport services defaults (scraper — applied at creation only)

When auto-creating an Airport from a `point`/`entry`/`exit` segment, set `services` based on the classified type:

```javascript
function getAirportServicesDefaults(type) {
  if (type === 'international') {
    return { hasInternationalFlights: true, hasDomesticScheduledFlights: false, charterOnly: false }
  }
  if (type === 'domestic') {
    return { hasInternationalFlights: false, hasDomesticScheduledFlights: true, charterOnly: false }
  }
  if (type === 'airstrip') {
    return { hasInternationalFlights: false, hasDomesticScheduledFlights: false, charterOnly: true }
  }
  return { hasInternationalFlights: false, hasDomesticScheduledFlights: false, charterOnly: false }
}
```

These are defaults. Travel designers update via Payload admin to reflect reality (e.g., Wilson WIL has both scheduled domestic AND some international general aviation — the defaults are a starting point, not ground truth).

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
    defaultColumns: ['name', 'category', 'serviceDirection', 'serviceLevel', 'observationCount', 'updatedAt'],
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
      admin: { description: 'Deduplication key — generated from name' },
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
    },
    // serviceDirection encodes whether a service is provided at arrival, departure, or both.
    // Critical for the agentic builder: when planning a departure from JRO, book the
    // "departure" Meet & Assist, not the "arrival" one.
    {
      name: 'serviceDirection',
      type: 'select',
      required: true,
      defaultValue: 'na',
      options: [
        { label: 'Arrival', value: 'arrival' },
        { label: 'Departure', value: 'departure' },
        { label: 'Both / Any', value: 'both' },
        { label: 'Not Applicable', value: 'na' },
      ],
      admin: {
        description: 'For airport_service category: whether this service is for arriving or departing guests. Not applicable for park fees, taxes, etc.',
      },
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
    },
    {
      name: 'associatedAirport',
      type: 'relationship',
      relationTo: 'airports',
      admin: { description: 'Required for airport_service category — which airport provides this service' },
    },
    {
      name: 'associatedDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'For park_fee and conservation_fee categories — which destination charges this fee' },
    },
    {
      name: 'isInclusionIndicator',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'True if presence of this item in an itinerary indicates it is included in the price' },
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
      admin: { readOnly: true },
    },
  ],
}
```

### 4.1 Service Segment Classification

```javascript
function classifyServiceItem(name) {
  const n = name.toLowerCase()

  // Determine direction for airport services
  const direction = n.includes('arrival') ? 'arrival'
    : n.includes('departure') ? 'departure'
    : 'both'

  if (n.includes('meet and assist') || n.includes('meet & assist'))
    return { category: 'airport_service', serviceLevel: 'premium', serviceDirection: direction }
  if (n.includes('vip lounge') || n.includes('fast track') || n.includes('fast-track'))
    return { category: 'airport_service', serviceLevel: 'ultra_premium', serviceDirection: direction }
  if (n.includes('porter'))
    return { category: 'airport_service', serviceLevel: 'premium', serviceDirection: direction }
  if (n.includes('national park fee') || n.includes('park fee') || n.includes('park entrance'))
    return { category: 'park_fee', serviceLevel: 'standard', serviceDirection: 'na' }
  if (n.includes('camping fee'))
    return { category: 'park_fee', serviceLevel: 'standard', serviceDirection: 'na' }
  if (n.includes('conservation fee') || n.includes('conservancy fee'))
    return { category: 'conservation_fee', serviceLevel: 'standard', serviceDirection: 'na' }
  if (n.includes('departure tax') || n.includes('airport tax'))
    return { category: 'departure_tax', serviceLevel: 'standard', serviceDirection: 'departure' }
  if (n.includes('single supplement') || n.includes('peak supplement'))
    return { category: 'accommodation_supplement', serviceLevel: 'standard', serviceDirection: 'na' }

  return { category: 'other', serviceLevel: 'standard', serviceDirection: 'na' }
}
```

### 4.2 Service Segment Routing Logic

For every iTrvl `service` segment:

```javascript
const activityType = classifyActivity(segment.name)

if (activityType !== 'other') {
  // → create/update Activities record
} else {
  const classification = classifyServiceItem(segment.name)
  // → create/update ServiceItems record using classification.category,
  //    classification.serviceLevel, classification.serviceDirection
}
```

---

## 5. Modified Collection: `src/collections/Activities.ts`

**Two changes from current schema:**

1. Remove `'other'` from the type select options (see data migration Section 18, Step E).
2. Add `bookingBehaviour` group.

### 5.1 Updated type enum

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

Remove 'other'. No 'other'. A helicopter transfer appears in Activities as `helicopter_flight` AND in TransferRoutes as `mode: helicopter`. Both are correct.

**CRITICAL order dependency:** Remove 'other' from the schema AFTER the data migration converts all existing type='other' Activity records to ServiceItems. If removed first, Payload throws a validation error on existing records. The migration sequence in Section 18 enforces this.

### 5.2 New bookingBehaviour group

Add after `fitnessLevel` field:

```typescript
{
  name: 'bookingBehaviour',
  type: 'group',
  admin: {
    description: 'Booking and availability characteristics — defines how the agentic builder treats this activity',
  },
  fields: [
    {
      name: 'requiresAdvanceBooking',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Must be reserved in advance. True for: gorilla trekking, balloon safaris, helicopter flights, chimp trekking, white water rafting. False for: game drives, walking safaris, sundowners.',
      },
    },
    {
      name: 'availability',
      type: 'select',
      defaultValue: 'always_included',
      options: [
        {
          label: 'Always Included',
          value: 'always_included',
          // Provided daily as part of the stay. No booking needed. Guest decides on the day.
          // Examples: game drives, walking safaris, sundowners, bush dinners.
        },
        {
          label: 'On Demand',
          value: 'on_demand',
          // Available at the property but must be requested. May need same-day notice.
          // Usually included in tariff. Examples: birding walks, fishing, spa, village visit.
        },
        {
          label: 'Scheduled',
          value: 'scheduled',
          // Fixed departure time, advance booking required. Often at additional cost.
          // Examples: balloon safaris (dawn departure), gorilla trekking (permit-based),
          // helicopter flights (fixed slot), white water rafting.
        },
        {
          label: 'Seasonal',
          value: 'seasonal',
          // Only available in specific months. Examples: calving season walks, specific migrations.
        },
        {
          label: 'Optional Extra',
          value: 'optional_extra',
          // Not included in lodge tariff. Must be booked and paid separately.
          // Examples: balloon safaris at non-inclusive lodges, gorilla permits.
        },
      ],
      admin: {
        description: 'How this activity is structured at the property. Determines how the agentic builder includes it in itineraries.',
      },
    },
    {
      name: 'minimumLeadDays',
      type: 'number',
      admin: {
        description: 'Minimum days advance booking required. 0 = same day. Null = not applicable. Examples: gorilla permit = typically 1 (minimum) but recommend 90+; balloon = 1 day minimum, recommend weeks ahead.',
      },
    },
    {
      name: 'maximumGroupSize',
      type: 'number',
      admin: {
        description: 'Maximum group size for this activity. Null = no practical limit. Examples: gorilla trekking = 8 (government regulation); some helicopter flights = 3–4.',
      },
    },
    {
      name: 'isIncludedInTariff',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this activity typically included in the standard property tariff? False for: gorilla permits, balloon safaris at most properties, helicopter excursions.',
      },
    },
    {
      name: 'typicalAdditionalCost',
      type: 'text',
      admin: {
        description: 'Human-readable additional cost estimate if not included. Examples: "~$600pp gorilla permit", "~$750pp balloon flight (Serengeti)", "~$450pp helicopter excursion". Leave empty if included in tariff.',
      },
    },
  ],
},
```

### 5.3 Activity booking defaults (scraper function, transform.js)

When creating a new Activity record, the scraper calls this function to set initial `bookingBehaviour` values. These are starting points — travel designers override via Payload admin.

```javascript
function getActivityBookingDefaults(type) {
  const defaults = {
    requiresAdvanceBooking: false,
    availability: 'always_included',
    minimumLeadDays: null,
    maximumGroupSize: null,
    isIncludedInTariff: true,
    typicalAdditionalCost: null,
  }

  switch (type) {
    case 'game_drive':
      return { ...defaults, availability: 'always_included', requiresAdvanceBooking: false }

    case 'walking_safari':
      return { ...defaults, availability: 'always_included', requiresAdvanceBooking: false }

    case 'gorilla_trek':
      return {
        requiresAdvanceBooking: true,
        availability: 'scheduled',
        minimumLeadDays: 1,        // Legal minimum; in practice book months ahead
        maximumGroupSize: 8,       // Ugandan and Rwandan government regulation
        isIncludedInTariff: false,
        typicalAdditionalCost: '~$800pp permit (Rwanda) / ~$700pp permit (Uganda)',
      }

    case 'chimpanzee_trek':
      return {
        requiresAdvanceBooking: true,
        availability: 'scheduled',
        minimumLeadDays: 1,
        maximumGroupSize: 6,
        isIncludedInTariff: false,
        typicalAdditionalCost: '~$200pp permit (Uganda)',
      }

    case 'balloon_flight':
      return {
        requiresAdvanceBooking: true,
        availability: 'scheduled',
        minimumLeadDays: 1,        // Minimum; recommend weeks ahead in peak season
        maximumGroupSize: 16,      // Typical balloon capacity
        isIncludedInTariff: false,
        typicalAdditionalCost: '~$700–800pp (Serengeti / Mara)',
      }

    case 'helicopter_flight':
      return {
        requiresAdvanceBooking: true,
        availability: 'scheduled',
        minimumLeadDays: 1,
        maximumGroupSize: 4,       // Typical helicopter capacity for excursion
        isIncludedInTariff: false,
        typicalAdditionalCost: null,  // Varies widely — leave for designer
      }

    case 'boat_safari':
    case 'canoe_safari':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'horseback_safari':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'fishing':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'birding':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'sundowner':
      return { ...defaults, availability: 'always_included', requiresAdvanceBooking: false }

    case 'bush_dinner':
      return { ...defaults, availability: 'always_included', requiresAdvanceBooking: false }

    case 'spa':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'photography':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'conservation_experience':
      return { ...defaults, availability: 'scheduled', requiresAdvanceBooking: true, minimumLeadDays: 7 }

    case 'cultural_visit':
    case 'community_visit':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'snorkeling':
    case 'diving':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    default:
      return defaults
  }
}
```

This function is called ONLY when creating a new Activity. Never called when updating an existing record (would overwrite designer corrections).

Usage in linkActivities():
```javascript
// When creating:
const bookingDefaults = getActivityBookingDefaults(activityType)
body: JSON.stringify({
  name: activityName,
  slug,
  type: activityType,
  destinations: destinationId ? [destinationId] : [],
  properties: currentPropertyId ? [currentPropertyId] : [],
  observationCount: 0,
  bookingBehaviour: bookingDefaults,
})
```

---

## 6. Modified Collection: `src/collections/ItineraryPatterns.ts`

Add two fields:

```typescript
// After the 'countries' field:
{
  name: 'regions',
  type: 'relationship',
  relationTo: 'destinations',
  hasMany: true,
  admin: {
    description: 'Specific destinations visited (not countries) — e.g. Serengeti National Park, Masai Mara. Derived from property destinations.',
  },
},

// After the 'transferSequence' field:
{
  name: 'serviceItems',
  type: 'relationship',
  relationTo: 'service-items',
  hasMany: true,
  admin: {
    description: 'Service items observed in this itinerary — park fees, airport services, supplements. Accumulated from service segments.',
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
    description: 'Monthly observation counts — how many itineraries feature this property per month',
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
  admin: { description: 'Origin airport — if origin point is an Airport record. In addition to fromDestination.' },
},
{
  name: 'toAirport',
  type: 'relationship',
  relationTo: 'airports',
  admin: { description: 'Destination airport — if destination point is an Airport record. In addition to toDestination.' },
},
```

`fromDestination`/`toDestination` describe the geographic region. `fromAirport`/`toAirport` describe the specific transit node. Both can be set simultaneously on the same record.

---

## 9. New Global: `src/globals/LocationMappings.ts`

Replaces `DestinationNameMappings`. The translation layer between external system naming and Kiuli's canonical entities.

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
      fields: [
        {
          name: 'externalString',
          type: 'text',
          required: true,
          admin: { description: 'Exact string from the source system, e.g. "Serengeti Mobile"' },
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
        },
        {
          name: 'destination',
          type: 'relationship',
          relationTo: 'destinations',
          admin: { description: 'Required when resolvedAs = destination' },
        },
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          admin: { description: 'Required when resolvedAs = property' },
        },
        {
          name: 'airport',
          type: 'relationship',
          relationTo: 'airports',
          admin: { description: 'Required when resolvedAs = airport' },
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: { description: 'Why this mapping exists' },
        },
      ],
    },
  ],
}
```

`DestinationNameMappings` global is deregistered from payload.config.ts. Its DB tables remain as migration artefacts (confirmed empty — no data to migrate).

---

## 10. payload.config.ts Updates

Add imports:
```typescript
import { Airports } from './collections/Airports'
import { ServiceItems } from './collections/ServiceItems'
import { LocationMappings } from './globals/LocationMappings'
```

In `collections` array: add `Airports`, `ServiceItems`.  
In `globals` array: add `LocationMappings`, remove `DestinationNameMappings`.

---

## 11. content-system/cascade/destination-resolver.ts Update

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
    const destId = typeof mapping.destination === 'object'
      ? mapping.destination.id
      : mapping.destination
    return { action: 'found', payloadId: destId, ... }
  }
}
```

---

## 12. Scraper: Property Type Classification

Add to transform.js:

```javascript
function classifyPropertyType(name) {
  const n = name.toLowerCase()
  if (n.includes('tented camp') || n.includes('tented-camp')) return 'tented_camp'
  if (n.includes('mobile camp') || n.includes('mobile-camp')) return 'mobile_camp'
  if (n.includes(' camp') || n.endsWith('camp')) return 'camp'
  if (n.includes('lodge')) return 'lodge'
  if (n.includes('hotel') || n.includes('manor') || n.includes('house') || n.includes('retreat')) return 'hotel'
  if (n.includes('villa') || n.includes('private')) return 'villa'
  return 'lodge'  // default
}
```

Called only when creating a new Property. Never called when updating existing records.

---

## 13. Scraper: Location Resolution

Add `resolveLocationToDestination()` to transform.js:

```javascript
async function resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL) {
  // Step 1: LocationMappings lookup
  const mappingsRes = await fetch(`${PAYLOAD_API_URL}/api/globals/location-mappings`, { headers })
  if (mappingsRes.ok) {
    const mappingsData = await mappingsRes.json()
    const mappings = mappingsData.mappings || []
    for (const mapping of mappings) {
      if (mapping.externalString.toLowerCase() !== locationString.toLowerCase()) continue
      if (mapping.sourceSystem !== 'itrvl' && mapping.sourceSystem !== 'any') continue
      if (mapping.resolvedAs === 'destination') {
        const destId = typeof mapping.destination === 'object' ? mapping.destination.id : mapping.destination
        console.log(`[resolveLocation] MAPPING: "${locationString}" → destination ${destId}`)
        return destId
      }
      // property/airport/ignore: use country fallback
      console.log(`[resolveLocation] MAPPING: "${locationString}" resolves as ${mapping.resolvedAs} — country fallback`)
      return countryId
    }
  }

  // Step 2: Direct Destinations name match
  const destRes = await fetch(
    `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(locationString)}&where[type][equals]=destination&limit=1`,
    { headers }
  )
  if (destRes.ok) {
    const destData = await destRes.json()
    if (destData.docs?.[0]?.id) {
      console.log(`[resolveLocation] DIRECT MATCH: "${locationString}" → ${destData.docs[0].id}`)
      return destData.docs[0].id
    }
  }

  // Step 3: Auto-create Destination (stay segments only — caller responsibility)
  const slug = generateSlug(locationString)
  const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: locationString, slug, type: 'destination', country: countryId, _status: 'draft' }),
  })
  if (createRes.ok) {
    const created = await createRes.json()
    const newId = created.doc?.id || created.id
    console.log(`[resolveLocation] AUTO-CREATED: "${locationString}" → ${newId}`)
    return newId
  }

  // Step 4: Country fallback
  console.warn(`[resolveLocation] ALL RESOLUTION FAILED for "${locationString}" — country fallback ${countryId}`)
  return countryId
}
```

---

## 14. Scraper: linkProperties() Rewrite

Replace the destination resolution block when creating a new Property:

```javascript
// BEFORE:
const country = stay.country || stay.countryName;
if (country && destinationCache) {
  destinationId = await lookupDestinationByCountry(country, ...)
}

// AFTER:
const locationString = stay.location || stay.locationName || null
const country = stay.country || stay.countryName || null
if (locationString && country) {
  const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
  if (countryId) {
    destinationId = await resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL)
  }
}
if (!destinationId && country) {
  destinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
}
if (!destinationId && destinationIds.length > 0) {
  destinationId = destinationIds[0]
}
```

Add `type` to the Property creation body:
```javascript
type: classifyPropertyType(accommodationName),
```

---

## 15. Scraper: linkActivities() Fix

**Change 1: Track currentDestinationId alongside currentPropertyId**

```javascript
let currentPropertyId = null
let currentDestinationId = null   // ADD
let currentCountry = null

// In stay block:
if (type === 'stay' || type === 'accommodation') {
  const name = segment.name || segment.title || segment.supplierName
  currentPropertyId = name ? (propertyMap.get(name) || null) : null
  currentCountry = segment.country || segment.countryName || null
  // Resolve destination for current stay — same logic as linkProperties()
  const locationString = segment.location || segment.locationName || null
  const country = segment.country || segment.countryName || null
  if (locationString && country) {
    const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
    currentDestinationId = countryId
      ? await resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL)
      : null
  } else if (country) {
    currentDestinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
  } else {
    currentDestinationId = null
  }
  continue
}
```

**Change 2: Use currentDestinationId instead of segment.country lookup**

```javascript
// BEFORE:
const country = segment.country || segment.countryName || currentCountry
const destinationId = country ? await lookupDestinationByCountry(...) : null

// AFTER:
const destinationId = currentDestinationId || null
```

**Change 3: observationCount initialization**

```javascript
// BEFORE:
observationCount: 1

// AFTER:
observationCount: 0   // handler.js increments: (count || 0) + 1 → 1 on first scrape
```

**Change 4: Apply bookingBehaviour defaults when creating**

```javascript
const bookingDefaults = getActivityBookingDefaults(activityType)
body: JSON.stringify({
  name: activityName,
  slug,
  type: activityType,
  destinations: destinationId ? [destinationId] : [],
  properties: currentPropertyId ? [currentPropertyId] : [],
  observationCount: 0,
  bookingBehaviour: bookingDefaults,
})
```

---

## 16. Scraper: New linkAirports() Function

```javascript
async function linkAirports(segments, headers, PAYLOAD_API_URL) {
  const airportMap = new Map()  // iataCode (uppercase) or slug → airportId
  const processedKeys = new Set()
  const airportSegmentTypes = new Set(['point', 'entry', 'exit'])

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (!airportSegmentTypes.has(type)) continue

    const airportName = segment.title || segment.name || segment.supplierName || segment.location
    const iataCode = segment.locationCode ? segment.locationCode.toUpperCase() : null
    const countryCode = segment.countryCode || null

    if (!airportName) continue

    const lookupKey = iataCode || generateSlug(airportName)
    if (processedKeys.has(lookupKey)) continue
    processedKeys.add(lookupKey)

    let airportId = null

    // Lookup by IATA code
    if (iataCode) {
      const res = await fetch(
        `${PAYLOAD_API_URL}/api/airports?where[iataCode][equals]=${encodeURIComponent(iataCode)}&limit=1`,
        { headers }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.docs?.[0]?.id) {
          airportId = data.docs[0].id
          // Increment observationCount
          await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
          })
          console.log(`[linkAirports] FOUND by IATA: ${iataCode} → ${airportId}`)
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
          await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
          })
          console.log(`[linkAirports] FOUND by slug: ${slug} → ${airportId}`)
        }
      }
    }

    // Create airport
    if (!airportId) {
      const countryId = countryCode ? (COUNTRY_CODE_TO_ID[countryCode.toUpperCase()] || null) : null
      const slug = generateSlug(airportName)
      const airportType = classifyAirportType(airportName, iataCode)
      const serviceDefaults = getAirportServicesDefaults(airportType)

      const createRes = await fetch(`${PAYLOAD_API_URL}/api/airports`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: airportName,
          slug,
          iataCode: iataCode || null,
          type: airportType,
          city: segment.location || null,
          country: countryId,
          nearestDestination: null,
          services: serviceDefaults,
          observationCount: 1,
        }),
      })
      if (createRes.ok) {
        const created = await createRes.json()
        airportId = created.doc?.id || created.id
        console.log(`[linkAirports] CREATED: ${airportName} (${iataCode || 'no IATA'}) → ${airportId}`)
      } else {
        const errText = await createRes.text()
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
              console.log(`[linkAirports] LINKED after conflict: ${airportName} → ${airportId}`)
            }
          }
        }
        if (!airportId) console.error(`[linkAirports] FAILED: ${airportName}: ${createRes.status}`)
      }
    }

    if (airportId) airportMap.set(lookupKey, airportId)
  }

  console.log(`[linkAirports] Total airports: ${airportMap.size}`)
  return airportMap
}
```

---

## 17. Scraper: linkTransferRoutes() Fix

**Updated function signature:**
```javascript
async function linkTransferRoutes(segments, destinationCache, propertyMap, airportMap) {
```

**Endpoint resolution helper:**

```javascript
async function resolveEndpointDestination(endpointName, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL) {
  if (!endpointName) return null

  // Check if endpoint is a known property
  const propertyId = propertyMap.get(endpointName)
  if (propertyId) {
    const res = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=1`, { headers })
    if (res.ok) {
      const prop = await res.json()
      const destId = typeof prop.destination === 'object' ? prop.destination?.id : prop.destination
      if (destId) return destId
    }
  }

  // Check if endpoint is a known airport (match by slug or IATA code)
  const endpointSlug = generateSlug(endpointName)
  const endpointUpper = endpointName.toUpperCase()
  for (const [key, airportId] of airportMap.entries()) {
    if (key === endpointSlug || key === endpointUpper) {
      const res = await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}?depth=1`, { headers })
      if (res.ok) {
        const airport = await res.json()
        const nearestDestId = typeof airport.nearestDestination === 'object'
          ? airport.nearestDestination?.id
          : airport.nearestDestination
        if (nearestDestId) return nearestDestId
        // No nearestDestination yet — use airport's country
        const countryId = typeof airport.country === 'object' ? airport.country?.id : airport.country
        return countryId || null
      }
    }
  }

  return null  // Unknown — caller falls back to country
}
```

**TransferRoute creation — new fields:**

When creating or patching a TransferRoute, resolve and set:

```javascript
const from = segment.from || segment.fromPoint || segment.location || null
const to = segment.to || segment.toPoint || null

// fromProperty / toProperty — set when endpoint IS a property
const fromPropertyId = from ? propertyMap.get(from) || null : null
const toPropertyId = to ? propertyMap.get(to) || null : null

// fromAirport / toAirport — set when endpoint IS an airport
const fromKey = from ? (from.toUpperCase().length <= 4 ? from.toUpperCase() : generateSlug(from)) : null
const toKey = to ? (to.toUpperCase().length <= 4 ? to.toUpperCase() : generateSlug(to)) : null
const fromAirportId = fromKey && airportMap.has(fromKey) ? airportMap.get(fromKey) : null
const toAirportId = toKey && airportMap.has(toKey) ? airportMap.get(toKey) : null

// fromDestination / toDestination
const fromDestinationId = fromPropertyId
  ? await resolveEndpointDestination(from, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)
  : (fromKey && airportMap.has(fromKey))
    ? await resolveEndpointDestination(from, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)
    : (segment.country ? await lookupDestinationByCountry(segment.country, destinationCache, headers, PAYLOAD_API_URL) : null)

const toDestinationId = toPropertyId
  ? await resolveEndpointDestination(to, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)
  : (toKey && airportMap.has(toKey))
    ? await resolveEndpointDestination(to, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)
    : null
```

Include in both POST (create) and PATCH (update) bodies:
```javascript
{
  fromProperty: fromPropertyId,
  toProperty: toPropertyId,
  fromAirport: fromAirportId,
  toAirport: toAirportId,
  fromDestination: fromDestinationId,
  toDestination: toDestinationId,
  // ... rest of existing fields
}
```

---

## 18. Scraper: transform() Call Sequence

```javascript
// 1. Link destinations (countries)
const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking)

// 2. Link properties (uses resolveLocationToDestination)
const propertyMap = await linkProperties(segments, destinationIds, destinationCache)

// 3. Link airports (new — must run before linkTransferRoutes)
const airportMap = await linkAirports(segments, headers, PAYLOAD_API_URL)

// 4. Link transfer routes (updated signature)
const { routeMap, transferSequence, pendingTransferObs } =
  await linkTransferRoutes(segments, destinationCache, propertyMap, airportMap)

// 5. Link activities (destination resolution fixed, bookingBehaviour added)
const { activityMap, pendingActivityObs } =
  await linkActivities(segments, propertyMap, destinationCache)

// 6. Link service items (new — must run after linkAirports)
const { serviceItemMap, pendingServiceItemObs } =
  await linkServiceItems(segments, propertyMap, airportMap, destinationCache)
```

Add to `_knowledgeBase`:
```javascript
serviceItemIds: [...serviceItemMap.values()],
airportIds: [...airportMap.values()],
```

---

## 19. Required Data Fixes

These run in exact sequence. Each step verified before the next starts.

### Step A: Create Serengeti National Park destination

```
POST /api/destinations
{ name: "Serengeti National Park", slug: "serengeti-national-park", type: "destination", country: 3, _status: "draft" }
```

Record returned ID as `SERENGETI_ID`.

**Verification:** `SELECT id, name, type, country_id FROM destinations WHERE slug = 'serengeti-national-park';` → 1 row, type='destination', country_id=3.

### Step B: Fix Nyasi Tented Camp destination

```
PATCH /api/properties/41
{ destination: SERENGETI_ID }
```

**Verification:** `SELECT destination_id FROM properties WHERE id = 41;` → SERENGETI_ID.

### Step C: Fix remaining property destinations

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
Expected exactly:
```
Legendary Lodge   | Arusha                  | destination
Little Chem Chem  | Tarangire National Park | destination
Nyasi Tented Camp | Serengeti National Park | destination
Mwiba Lodge       | Mwiba Wildlife Reserve  | destination
```
Any other result = FAIL.

### Step D: Create 6 ServiceItems

Create via Payload API. Note: " Serengeti National Park Fee" has a leading space in the Activities table — use trimmed name "Serengeti National Park Fee" for the ServiceItem.

1. name: "Meet and Assist - Kilimanjaro Int Airport Arrival", slug: "meet-and-assist-kilimanjaro-int-airport-arrival", category: "airport_service", serviceLevel: "premium", serviceDirection: "arrival", isInclusionIndicator: true, observationCount: 1
2. name: "VIP Lounge - Kilimanjaro International Airport Arrival", slug: "vip-lounge-kilimanjaro-international-airport-arrival", category: "airport_service", serviceLevel: "ultra_premium", serviceDirection: "arrival", isInclusionIndicator: true, observationCount: 1
3. name: "Serengeti Camping Fee", slug: "serengeti-camping-fee", category: "park_fee", serviceLevel: "standard", serviceDirection: "na", isInclusionIndicator: true, observationCount: 1
4. name: "Serengeti National Park Fee", slug: "serengeti-national-park-fee", category: "park_fee", serviceLevel: "standard", serviceDirection: "na", isInclusionIndicator: true, observationCount: 1
5. name: "Meet and Assist - Kilimanjaro Int Airport Departure", slug: "meet-and-assist-kilimanjaro-int-airport-departure", category: "airport_service", serviceLevel: "premium", serviceDirection: "departure", isInclusionIndicator: true, observationCount: 1
6. name: "VIP Lounge - Kilimanjaro International Airport Departure", slug: "vip-lounge-kilimanjaro-international-airport-departure", category: "airport_service", serviceLevel: "ultra_premium", serviceDirection: "departure", isInclusionIndicator: true, observationCount: 1

**Verification:** `SELECT id, name, category, service_level, service_direction FROM service_items ORDER BY id;` → exactly 6 rows.

### Step E: Delete Activity records 8, 9, 10, 11, 13, 14

Delete child rows first:

```sql
SELECT id FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM _activities_v_rels WHERE parent_id IN (SELECT id FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14));
DELETE FROM activities_suitability WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM _activities_v WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM activities_rels WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM activities WHERE id IN (8, 9, 10, 11, 13, 14);
```

Do NOT delete id=12 (Serengeti Balloon Safari).

**Verification:** `SELECT id, name, type FROM activities;` → exactly 1 row, id=12, type='balloon_flight'.

### Step F: Fix Activity id=12 destination

```
PATCH /api/activities/12
{ destinations: [SERENGETI_ID] }
```

**Verification:**
```sql
SELECT d.name, d.type FROM activities_rels r
JOIN destinations d ON d.id = r.destinations_id
WHERE r.parent_id = 12 AND r.path = 'destinations';
```
Expected: 1 row, name='Serengeti National Park', type='destination'.

### Step G: Delete Destination id=36

Verify no FK references remain first:
```sql
SELECT COUNT(*) FROM properties WHERE destination_id = 36;   -- Expected: 0
SELECT COUNT(*) FROM activities_rels WHERE destinations_id = 36;  -- Expected: 0
SELECT COUNT(*) FROM itinerary_patterns_rels WHERE destinations_id = 36;  -- Expected: 0 or fix
```

Then delete:
```sql
DELETE FROM destinations WHERE id = 36 AND name = 'Serengeti Mobile';
```

**Verification:** `SELECT id FROM destinations WHERE id = 36;` → 0 rows.

### Step H: Add LocationMappings seed entry

Via Payload admin UI:
- externalString: "Serengeti Mobile"
- sourceSystem: "itrvl"
- resolvedAs: "destination"
- destination: SERENGETI_ID
- notes: "Serengeti Mobile is the mobile camp operating concept for Nyasi Tented Camp. The actual destination is Serengeti National Park."

### Step I: Update ItineraryPatterns record id=2

After schema migration adds `regions` and `serviceItems` fields:

```
PATCH /api/itinerary-patterns/2
{
  regions: [SERENGETI_ID, 37, 35, 34],   // Serengeti NP, Mwiba Wildlife Reserve, Tarangire NP, Arusha
  serviceItems: [IDs of the 6 ServiceItems created in Step D]
}
```

---

## 20. Implementation Sequence

Execute in exact order. No step starts before previous is verified.

```
Step 1: Schema files (Sections 3–11)
  ↓ verified: all .ts/.ts files exist and TypeScript compiles without errors

Step 2: Payload migration
  ↓ verified: Gate 1 queries pass

Step 3: Data fixes A–I (Section 19)
  ↓ verified: each step's verification query before proceeding

Step 4: Remove 'other' from Activities type enum
  ↓ verified: Activities admin loads without validation errors, no records have type='other'

Step 5: Update content cascade (Section 11)
  ↓ verified: cascade reads from location-mappings global without error

Step 6: Update scraper (Sections 12–18)
  ↓ verified: transform.js contains all new functions, no undefined references

Step 7: Deploy and test scrape (Gates 2–3)
```

---

## 21. Ungameable Verification Gates

These gates verify named data with expected values, not just structure.

### Gate 1: Schema migration complete

```sql
-- New tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('airports', 'service_items', 'location_mappings', 'location_mappings_mappings')
ORDER BY table_name;
-- Expected: 4 rows

-- airports has correct columns (check a subset)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'airports'
AND column_name IN ('id', 'name', 'slug', 'iata_code', 'type', 'observation_count')
ORDER BY column_name;
-- Expected: 6 rows (exact names depend on Payload snakeCase convention)

-- service_items has service_direction column
SELECT column_name FROM information_schema.columns
WHERE table_name = 'service_items' AND column_name = 'service_direction';
-- Expected: 1 row

-- activities table has booking_behaviour_requires_advance_booking column (or equivalent nested)
-- Note: Payload group fields may be stored as booking_behaviour_requires_advance_booking
-- Verify exact column name before asserting:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'activities' AND column_name LIKE '%booking%';
-- Expected: >= 1 row
```

### Gate 2: Data fixes complete

```sql
-- Gate 2A: Serengeti National Park exists
SELECT id, name, type, country_id FROM destinations WHERE slug = 'serengeti-national-park';
-- Expected: 1 row, type='destination', country_id=3

-- Gate 2B: Serengeti Mobile is gone
SELECT id FROM destinations WHERE name = 'Serengeti Mobile';
-- Expected: 0 rows

-- Gate 2C: All 4 properties point to destination-type records
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

-- Gate 2E: Balloon Safari destination is Serengeti National Park (not Tanzania)
SELECT d.name, d.type FROM activities_rels r
JOIN destinations d ON d.id = r.destinations_id
WHERE r.parent_id = 12 AND r.path = 'destinations';
-- Expected: 1 row, name='Serengeti National Park', type='destination'

-- Gate 2F: ServiceItems have correct categories and directions
SELECT name, category, service_direction FROM service_items ORDER BY id;
-- Expected: 6 rows
-- 2 with service_direction='arrival' (Meet & Assist arrival, VIP Lounge arrival)
-- 2 with service_direction='departure' (Meet & Assist departure, VIP Lounge departure)
-- 2 with service_direction='na' (park fees)

-- Gate 2G: No activity records with type='other'
SELECT COUNT(*) FROM activities WHERE type = 'other';
-- Expected: 0
```

### Gate 3: Scraper test — after scraping 1 itinerary

```sql
-- Gate 3A: No properties linked to country-type destinations
SELECT p.name, d.name, d.type
FROM properties p JOIN destinations d ON p.destination_id = d.id
WHERE d.type = 'country';
-- Expected: 0 rows

-- Gate 3B: No activity records with type='other'
SELECT id, name, type FROM activities WHERE type = 'other';
-- Expected: 0 rows

-- Gate 3C: Airports table populated
SELECT id, name, iata_code, type FROM airports ORDER BY id;
-- Expected: at least 1 row containing 'Kilimanjaro' with iata_code='JRO', type='international'

-- Gate 3D: ServiceItems retain correct service_direction
SELECT name, service_direction FROM service_items WHERE category = 'airport_service';
-- Expected: records with 'arrival' and 'departure' values (not all 'na')

-- Gate 3E: At least one Activity has bookingBehaviour populated
-- (exact column name to be verified from migration output before asserting)
SELECT id, name FROM activities WHERE type = 'balloon_flight';
-- Expected: Serengeti Balloon Safari exists with requiresAdvanceBooking=true
-- Verify via Payload admin UI — check the bookingBehaviour group is populated

-- Gate 3F: ItineraryPatterns has both countries and regions
SELECT path, COUNT(*) FROM itinerary_patterns_rels
GROUP BY path ORDER BY path;
-- Expected: path='countries' AND path='regions' both present

-- Gate 3G: TransferRoutes have destination-type fromDestination (not country-type)
SELECT tr."from", tr."to", d.name, d.type
FROM transfer_routes tr
JOIN destinations d ON d.id = tr.from_destination_id
ORDER BY tr.id;
-- Expected: all d.type='destination', none='country'
-- If re-scraping Tanzania itinerary: Arusha, Tarangire NP, Serengeti NP, Mwiba WR — not 'Tanzania'

-- Gate 3H: At least one TransferRoute has fromAirport or toAirport set
SELECT id, "from", "to", from_airport_id, to_airport_id
FROM transfer_routes
WHERE from_airport_id IS NOT NULL OR to_airport_id IS NOT NULL;
-- Expected: >= 1 row (routes involving Kilimanjaro Int or Arusha Airport)
```

---

## 22. What Does Not Change

- V7 two-field editorial pattern on Itineraries — unchanged
- Destinations collection structure (countries and destinations in same table) — unchanged
- PropertyNameMappings global — unchanged
- Content cascade orchestration logic — only destination resolver source changes
- ItineraryPatterns `countries` field — unchanged; `regions` is additive
- KIULI_AGENTIC_VISION.md — this document implements it; does not override it

---

*KIULI CANONICAL SCHEMA SPECIFICATION — Version 3.0*  
*"Every entity is one thing. Every relationship is a fact. Every fact is verifiable."*
