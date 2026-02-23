# Kiuli Canonical Schema Specification

**Version:** 2.0  
**Date:** February 2026  
**Status:** AUTHORITATIVE — CLI must implement from this document exactly  
**Owner:** Graham Wallington  
**Supersedes:** Version 1.0 (contained factual errors and underspecified implementation)

---

## Purpose

This document defines the canonical entity hierarchy, all schema changes required, the resolution algorithm for external location strings, and the complete scraper evolution. Every function signature, return value, handler.js change, migration order, and verification query is specified completely. The CLI must not improvise any implementation detail not stated here.

---

## 1. The Canonical Entity Hierarchy

Five entity types form Kiuli's canonical knowledge base.

```
Countries (stored as destinations where type='country')
  └── Destinations (stored as destinations where type='destination')
        └── Properties
Airports (in Countries, optionally near Destinations)
ServiceItems (linked to Airports, Destinations, and Itineraries)
```

### 1.1 Countries

**Collection:** `destinations` (type = 'country')  
**Rule:** Pre-seeded. The scraper NEVER creates a country. It only links to existing country records by name lookup.  
**Current records:** Kenya, Tanzania, Uganda, Rwanda, Botswana, South Africa, Zambia, Zimbabwe, Namibia, Mozambique  
**Adding new countries:** Manual only, before scraping itineraries that visit them.

### 1.2 Destinations

**Collection:** `destinations` (type = 'destination')  
**Definition:** A geographic area within a country that a guest visits — a park, reserve, city, coastal area, or region — that Kiuli will build a content page for.  
**Examples:** Masai Mara, Serengeti National Park, Ngorongoro, Okavango Delta, Nairobi, Arusha, Sabi Sands, Tarangire National Park, Mwiba Wildlife Reserve, Cape Town.  
**A park is a destination. A city with multiple properties is a destination. A private reserve is a destination.**  
**NOT a destination:** a property name, a mobile camp concept name, an airport, a country.  
**Parent:** Always one country record (destinations.country FK).  
**Creation:** Scraper auto-creates when a stay segment's location string is not found. Gated by LocationMappings resolution — if the string resolves to 'property', 'airport', or 'ignore', no Destination is created.  
**ContentProject trigger:** Auto-created destinations are flagged for the content cascade to create a `destination_page` ContentProject. The SCRAPER does not create ContentProjects. The cascade does.

### 1.3 Properties

**Collection:** `properties`  
**Definition:** An individual lodge, camp, hotel, mobile camp, or villa where a guest sleeps.  
**Examples:** Angama Mara, Nyasi Tented Camp, Mwiba Lodge, Legendary Lodge, Singita Boulders.  
**NOT a property:** a destination, a park, a city, a mobile camp concept name.  
**Parent:** Always one Destination record. Never a Country record.  
**Creation:** Scraper auto-creates from stay segments using PropertyNameMappings for dedup and LocationMappings to resolve the correct parent Destination.  
**ContentProject trigger:** Same as Destinations — cascade handles this, not the scraper.

### 1.4 Airports

**Collection:** `airports` (NEW)  
**Definition:** A physical aviation facility — international airport, domestic airport, or bush airstrip.  
**NOT an airport:** a property, a destination, a country.  
**Examples:** Wilson Airport Nairobi (WIL), Kilimanjaro International Airport (JRO), Mara North Airstrip (MRE).  
**Parent:** Always one Country record. Optionally linked to nearest Destination.  
**Creation:** Scraper auto-creates from `point`, `entry`, and `exit` segment types. Deduplicates by IATA code first, then slug.

### 1.5 ServiceItems

**Collection:** `service-items` (NEW)  
**Definition:** A billable service or fee observed in an iTrvl `service` segment that is NOT an experiential activity. Never displayed on itinerary pages. Informs knowledge base about service level and price composition.  
**Examples:** Meet and Assist, VIP Lounge, Serengeti Camping Fee, Serengeti National Park Fee.  
**NOT a ServiceItem:** an experiential activity (those go to Activities).  
**Creation:** Scraper creates from `service` segments where `classifyActivity()` returns 'other'.

---

## 2. LocationMappings Global (replaces DestinationNameMappings)

### 2.1 Purpose

Translation layer between external system naming and Kiuli's canonical hierarchy. When iTrvl says a stay location is "Serengeti Mobile", LocationMappings maps that to the canonical Destination "Serengeti National Park". When Wetu or Expert Africa introduce different naming, mappings are added here. No code changes required — one row in the admin UI.

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
            description: 'Exact string as it appears in the source system, e.g. "Serengeti Mobile"',
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
            description: 'Required when resolvedAs = property',
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
            description: 'Why this mapping exists — required for audit trail',
          },
        },
      ],
    },
  ],
}
```

### 2.3 Resolution Algorithm (implemented in transform.js as `resolveStayLocation()`)

This function is called by `linkProperties()` for every stay segment. It returns one of four outcomes.

```javascript
/**
 * Resolves a stay segment's location string against LocationMappings and the
 * Destinations collection. Returns the canonical destination ID to use as the
 * property's parent, or null if resolution fails entirely.
 *
 * ONLY called for 'stay' segment types.
 *
 * @param {string} locationString - e.g. "Serengeti Mobile", "Tarangire National Park"
 * @param {string} countryName - e.g. "Tanzania"
 * @param {Map} destinationCache - country name → country destination ID
 * @param {object} headers - auth headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<{ destinationId: string|null, resolved: 'destination'|'country_fallback'|'failed' }>}
 */
async function resolveStayLocation(locationString, countryName, destinationCache, headers, PAYLOAD_API_URL) {
  if (!locationString) {
    // No location string — fall back to country
    const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
    return { destinationId: countryId, resolved: 'country_fallback' }
  }

  // STEP 1: Query LocationMappings
  const mappingsRes = await fetch(
    `${PAYLOAD_API_URL}/api/globals/location-mappings`,
    { headers }
  )
  if (mappingsRes.ok) {
    const mappingsData = await mappingsRes.json()
    const mappings = mappingsData.mappings || []
    const match = mappings.find(m => {
      const stringMatch = m.externalString?.toLowerCase() === locationString.toLowerCase()
      const systemMatch = m.sourceSystem === 'itrvl' || m.sourceSystem === 'any'
      return stringMatch && systemMatch
    })
    if (match) {
      if (match.resolvedAs === 'destination' && match.destination) {
        const destId = typeof match.destination === 'object' ? match.destination.id : match.destination
        console.log(`[resolveStayLocation] LocationMappings: "${locationString}" → destination ${destId}`)
        return { destinationId: destId, resolved: 'destination' }
      }
      if (match.resolvedAs === 'property') {
        // This string is a property concept name, not a destination.
        // Fall back to country level for the property's destination.
        console.log(`[resolveStayLocation] LocationMappings: "${locationString}" → property (using country fallback)`)
        const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
        return { destinationId: countryId, resolved: 'country_fallback' }
      }
      if (match.resolvedAs === 'airport' || match.resolvedAs === 'ignore') {
        console.log(`[resolveStayLocation] LocationMappings: "${locationString}" → ${match.resolvedAs} (country fallback)`)
        const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
        return { destinationId: countryId, resolved: 'country_fallback' }
      }
    }
  }

  // STEP 2: Direct name match in Destinations (type=destination only)
  const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
  const nameRes = await fetch(
    `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(locationString)}&where[type][equals]=destination&limit=1`,
    { headers }
  )
  if (nameRes.ok) {
    const nameData = await nameRes.json()
    if (nameData.docs?.[0]?.id) {
      console.log(`[resolveStayLocation] Name match: "${locationString}" → ${nameData.docs[0].id}`)
      return { destinationId: nameData.docs[0].id, resolved: 'destination' }
    }
  }

  // STEP 3: Auto-create Destination record
  // Only reached if no LocationMappings entry and no existing Destination record.
  if (countryId) {
    const slug = generateSlug(locationString)
    const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: locationString,
        slug,
        type: 'destination',
        country: countryId,
        _status: 'draft',
      }),
    })
    if (createRes.ok) {
      const created = await createRes.json()
      const newId = created.doc?.id || created.id
      console.log(`[resolveStayLocation] AUTO-CREATED destination: "${locationString}" → ${newId}`)
      // NOTE: ContentProject creation for this destination is handled by the content cascade,
      // not the scraper. The cascade will find this draft destination record and create the project.
      return { destinationId: newId, resolved: 'destination' }
    }
  }

  // STEP 4: Failed — fall back to country
  console.warn(`[resolveStayLocation] FAILED to resolve "${locationString}" — using country fallback`)
  const fallbackId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
  return { destinationId: fallbackId, resolved: 'country_fallback' }
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
    defaultColumns: ['name', 'iataCode', 'type', 'country', 'observationCount'],
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
    },
    {
      name: 'iataCode',
      type: 'text',
      index: true,
      admin: { description: 'e.g. "WIL", "JRO", "MRE" — nullable for bush airstrips' },
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
      admin: { description: 'Country this airport is in (destinations where type=country)' },
    },
    {
      name: 'nearestDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Primary safari destination this airport serves — nullable, populated manually or via Wetu' },
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
      admin: { readOnly: true, description: 'How many scraped itineraries include this airport' },
    },
  ],
}
```

### 3.1 Airport deduplication logic (in transform.js)

Primary dedup key: `iataCode` (when not null).  
Secondary dedup key: `slug` (when IATA unavailable).

```javascript
async function lookupOrCreateAirport(name, iataCode, countryId, headers, PAYLOAD_API_URL) {
  // Try by IATA code first
  if (iataCode) {
    const res = await fetch(
      `${PAYLOAD_API_URL}/api/airports?where[iataCode][equals]=${encodeURIComponent(iataCode)}&limit=1`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.docs?.[0]?.id) {
        return data.docs[0].id
      }
    }
  }

  // Try by slug
  const slug = generateSlug(name)
  const slugRes = await fetch(
    `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
    { headers }
  )
  if (slugRes.ok) {
    const slugData = await slugRes.json()
    if (slugData.docs?.[0]?.id) {
      return slugData.docs[0].id
    }
  }

  // Create
  const createRes = await fetch(`${PAYLOAD_API_URL}/api/airports`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      slug,
      iataCode: iataCode || null,
      type: inferAirportType(name, iataCode),
      country: countryId,
      nearestDestination: null,
      observationCount: 0,
    }),
  })
  if (createRes.ok) {
    const created = await createRes.json()
    const newId = created.doc?.id || created.id
    console.log(`[linkAirports] CREATED airport: "${name}" (${iataCode || 'no IATA'}) → ${newId}`)
    return newId
  }
  console.error(`[linkAirports] Failed to create airport "${name}": ${createRes.status}`)
  return null
}

function inferAirportType(name, iataCode) {
  const n = name.toLowerCase()
  if (n.includes('international')) return 'international'
  if (n.includes('airstrip') || n.includes('strip') || n.includes('camp') || !iataCode) return 'airstrip'
  return 'domestic'
}
```

### 3.2 `linkAirports()` function (new, in transform.js)

```javascript
/**
 * Creates or looks up Airport records from point/entry/exit segments.
 * Returns Map of (iataCode || slug) → airportId.
 * Also increments observationCount on existing airports.
 */
async function linkAirports(segments, destinationCache, headers, PAYLOAD_API_URL) {
  const airportMap = new Map() // (iataCode || slug) → airportId

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (!['point', 'entry', 'exit'].includes(type)) continue

    const name = segment.title || segment.supplierName || segment.location
    if (!name) continue

    const iataCode = segment.locationCode || null
    const countryName = segment.country || segment.countryName
    if (!countryName) continue

    const countryId = await lookupDestinationByCountry(countryName, destinationCache, headers, PAYLOAD_API_URL)
    if (!countryId) {
      console.warn(`[linkAirports] Cannot resolve country "${countryName}" for airport "${name}" — skipping`)
      continue
    }

    const dedupKey = iataCode || generateSlug(name)
    if (airportMap.has(dedupKey)) continue

    const airportId = await lookupOrCreateAirport(name, iataCode, countryId, headers, PAYLOAD_API_URL)
    if (airportId) {
      airportMap.set(dedupKey, airportId)
      console.log(`[linkAirports] LINKED: "${name}" (${iataCode || 'no IATA'}) → ${airportId}`)
    }
  }

  console.log(`[linkAirports] Total airports: ${airportMap.size}`)
  return airportMap
}
```

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
    defaultColumns: ['name', 'category', 'serviceLevel', 'observationCount'],
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
      name: 'isInclusionIndicator',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'True if presence of this item means it is INCLUDED in the itinerary price',
      },
    },
    {
      name: 'associatedAirport',
      type: 'relationship',
      relationTo: 'airports',
      admin: { description: 'For airport_service items' },
    },
    {
      name: 'associatedDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'For park_fee and conservation_fee items' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
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

### 4.1 Service segment routing logic (in transform.js)

```javascript
/**
 * Called for every 'service' or 'activity' segment BEFORE any Activity logic.
 * Returns null if it should go to Activities (genuine experiential activity).
 * Returns classification object if it should go to ServiceItems.
 */
function classifyAsServiceItem(name) {
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

  return null // Not a service item — goes to Activities (where classifyActivity handles it)
}
```

**Routing decision in `linkActivities()` / new `linkServiceItems()`:**

For every `service` or `activity` segment:
1. Run `classifyAsServiceItem(segment.name)`
2. If result is NOT null → call `linkServiceItems()` with this segment and the classification
3. If result IS null → proceed to existing `classifyActivity()` and `linkActivities()` logic

### 4.2 `linkServiceItems()` function (new, in transform.js)

```javascript
/**
 * Creates or updates ServiceItem records for service segments that are not
 * experiential activities. Returns map of slug → serviceItemId and pending
 * observations for handler.js to finalize.
 */
async function linkServiceItems(segments, airportMap, destinationCache, headers, PAYLOAD_API_URL) {
  const serviceItemMap = new Map() // slug → serviceItemId
  const pendingServiceItemObs = []

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (type !== 'service' && type !== 'activity') continue

    const itemName = segment.name || segment.title
    if (!itemName) continue

    const classification = classifyAsServiceItem(itemName)
    if (!classification) continue // This is an experiential activity — skip here

    const slug = generateSlug(itemName)

    try {
      let serviceItemId = serviceItemMap.get(slug) || null

      if (!serviceItemId) {
        // Check if exists
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.docs?.[0]?.id) {
            serviceItemId = data.docs[0].id
          }
        }

        if (!serviceItemId) {
          // Resolve associated airport (look for airport name in segment name)
          let associatedAirportId = null
          for (const [key, airportId] of airportMap.entries()) {
            // key is iataCode or slug — check if segment name includes it
            if (itemName.toLowerCase().includes(key.toLowerCase())) {
              associatedAirportId = airportId
              break
            }
          }

          // Resolve associated destination for park/conservation fees
          let associatedDestinationId = null
          if (classification.category === 'park_fee' || classification.category === 'conservation_fee') {
            const country = segment.country || segment.countryName
            if (country) {
              // Try to find a destination mentioned in the item name
              // e.g. "Serengeti National Park Fee" — look for "Serengeti" in destinations
              // Best effort — destination linking is refined manually or via cascade
              associatedDestinationId = null // Leave null; refined by humans or cascade
            }
          }

          const createRes = await fetch(`${PAYLOAD_API_URL}/api/service-items`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: itemName,
              slug,
              category: classification.category,
              serviceLevel: classification.serviceLevel,
              isInclusionIndicator: true,
              associatedAirport: associatedAirportId,
              associatedDestination: associatedDestinationId,
              observationCount: 0,
            }),
          })

          if (createRes.ok) {
            const created = await createRes.json()
            serviceItemId = created.doc?.id || created.id
            console.log(`[linkServiceItems] CREATED: "${itemName}" → ${serviceItemId}`)
          } else {
            // Handle slug conflict (race condition on concurrent scrapes)
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
              { headers }
            )
            if (retryRes.ok) {
              const retryData = await retryRes.json()
              serviceItemId = retryData.docs?.[0]?.id || null
            }
          }
        }
      }

      if (serviceItemId) {
        serviceItemMap.set(slug, serviceItemId)
        pendingServiceItemObs.push({ serviceItemId, name: itemName })
      }
    } catch (err) {
      console.error(`[linkServiceItems] Error for "${itemName}":`, err.message)
    }
  }

  console.log(`[linkServiceItems] Total service items: ${serviceItemMap.size}`)
  return { serviceItemMap, pendingServiceItemObs }
}
```

---

## 5. Modified Collection: Activities (`src/collections/Activities.ts`)

Remove `{ label: 'Other', value: 'other' }` from the type select options array.

**Important:** This change is a Postgres enum modification. Postgres cannot drop an enum value while rows exist with that value. The data fix (Section 10, Step 4 — deleting Activity records with type='other') must be completed and verified BEFORE this schema change is applied and the migration run. See Section 10 for the correct execution order.

The updated type enum after removing 'other':
```
game_drive, walking_safari, gorilla_trek, chimpanzee_trek,
balloon_flight, boat_safari, canoe_safari, horseback_safari,
cultural_visit, bush_dinner, sundowner, fishing, snorkeling,
diving, spa, photography, birding, conservation_experience,
community_visit, helicopter_flight
```

---

## 6. Modified Collection: ItineraryPatterns (`src/collections/ItineraryPatterns.ts`)

Add two fields. Insert `regions` immediately after the existing `countries` field. Insert `serviceItems` immediately after the existing `transferSequence` field.

```typescript
// After 'countries' field:
{
  name: 'regions',
  type: 'relationship',
  relationTo: 'destinations',
  hasMany: true,
  admin: {
    description: 'Specific destinations/parks visited — not countries. e.g. Serengeti, Masai Mara, Tarangire.',
  },
},

// After 'transferSequence' field:
{
  name: 'serviceItems',
  type: 'relationship',
  relationTo: 'service-items',
  hasMany: true,
  admin: {
    description: 'Service items observed in this itinerary — fees, airport services, supplements.',
  },
},
```

---

## 7. Modified Collection: Properties (`src/collections/Properties.ts`)

Add `seasonalityData` inside the `accumulatedData` group, after `commonPairings`.

```typescript
{
  name: 'seasonalityData',
  type: 'array',
  admin: {
    description: 'Monthly observation counts — how many scraped itineraries include this property in each month of the year',
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

## 8. Modified Collection: TransferRoutes (`src/collections/TransferRoutes.ts`)

Add two fields after `toProperty`:

```typescript
{
  name: 'fromAirport',
  type: 'relationship',
  relationTo: 'airports',
  admin: { description: 'Origin airport — nullable, for flight segments' },
},
{
  name: 'toAirport',
  type: 'relationship',
  relationTo: 'airports',
  admin: { description: 'Destination airport — nullable, for flight segments' },
},
```

These are additive alongside `fromDestination`/`toDestination`, not replacing them.

---

## 9. Modified Global: payload.config.ts changes

**Register:**
- `Airports` collection
- `ServiceItems` collection
- `LocationMappings` global

**Deregister:**
- `DestinationNameMappings` global (removed from config, DB table retained as migration artefact)

The existing import and registration of `DestinationNameMappings` is removed. LocationMappings supersedes it. Do not drop the `destination_name_mappings` DB table.

---

## 10. Required Changes to transform.js

### 10.1 Updated `linkProperties()` signature and return value

Current: `async function linkProperties(segments, destinationIds, destinationCache)`  
Returns: `Map<accommodationName, propertyId>`

**Updated:**
- Now calls `resolveStayLocation()` for each stay's location string
- Also returns a `stayDestinationMap` alongside `propertyMap`

Updated return:
```javascript
return {
  propertyMap,        // Map<accommodationName, propertyId> — unchanged
  stayDestinationMap, // Map<accommodationName, destinationId> — NEW
                      // Maps each property's canonical parent destination ID
}
```

`stayDestinationMap` is built during the property resolution loop:
```javascript
const stayDestinationMap = new Map()

// In the loop, for each stay:
const { destinationId } = await resolveStayLocation(
  stay.location, stay.country, destinationCache, headers, PAYLOAD_API_URL
)
stayDestinationMap.set(accommodationName, destinationId)

// Use destinationId (not country ID) when creating the Property record
```

### 10.2 Updated `linkActivities()` signature

Current: `async function linkActivities(segments, propertyMap, destinationCache)`

**Updated:** `async function linkActivities(segments, propertyMap, stayDestinationMap, destinationCache)`

Inside the loop, replace country-based destination lookup with stay-based destination lookup:

```javascript
// Current (WRONG):
let currentCountry = null
// ...tracks currentCountry from stays and calls:
const destinationId = country
  ? await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
  : null

// Corrected:
let currentDestinationId = null
// In stay tracking block:
if (type === 'stay' || type === 'accommodation') {
  const name = segment.name || segment.title || segment.supplierName
  currentPropertyId = name ? (propertyMap.get(name) || null) : null
  currentDestinationId = name ? (stayDestinationMap.get(name) || null) : null
  continue
}
// When creating/updating Activity:
// Use currentDestinationId directly, not lookupDestinationByCountry
```

**Also:** `linkActivities()` must now skip service segment types that `classifyAsServiceItem()` returns non-null for. Add this check at the top of the segment loop:

```javascript
if (classifyAsServiceItem(activityName) !== null) {
  continue // This segment goes to linkServiceItems(), not Activities
}
```

### 10.3 Updated `linkTransferRoutes()` signature

Current: `async function linkTransferRoutes(segments, destinationCache)`

**Updated:** `async function linkTransferRoutes(segments, stayDestinationMap, airportMap, destinationCache)`

Inside the loop, track the preceding and following stay's destination:

```javascript
let precedingDestinationId = null
let precedingPropertyName = null

// In the loop, for stay segments:
if (type === 'stay' || type === 'accommodation') {
  const name = segment.name || segment.title || segment.supplierName
  precedingDestinationId = name ? (stayDestinationMap.get(name) || null) : null
  precedingPropertyName = name
  propertyOrderIndex++
  continue
}
```

For transfer segments, resolve `fromDestination` from `precedingDestinationId`:

```javascript
// CURRENT (wrong — uses country):
const fromDestinationId = fromCountry
  ? await lookupDestinationByCountry(fromCountry, destinationCache, headers, PAYLOAD_API_URL)
  : null

// CORRECTED:
const fromDestinationId = precedingDestinationId || null
// toDestination: resolved from the NEXT stay in the sequence.
// Implementation: build a look-ahead array before the loop.
// For each transfer at index i, toDestination = stayDestinationMap of the
// first stay segment that appears after position i in the segment array.
```

**Look-ahead implementation (before the loop):**
```javascript
// Build array of [segmentIndex, destinationId] for all stay segments
const stayDestinationByIndex = []
segments.forEach((seg, idx) => {
  const t = seg.type?.toLowerCase()
  if (t === 'stay' || t === 'accommodation') {
    const name = seg.name || seg.title || seg.supplierName
    const destId = name ? (stayDestinationMap.get(name) || null) : null
    stayDestinationByIndex.push({ idx, destId })
  }
})

// For each transfer segment at index i:
function getToDestination(transferIdx) {
  const nextStay = stayDestinationByIndex.find(s => s.idx > transferIdx)
  return nextStay?.destId || null
}
```

**Airport linking in transfer segments:**
```javascript
// For flight segments, try to match fromPoint/toPoint to airports
const fromPointName = segment.fromPoint || segment.from
const toPointName = segment.toPoint || segment.to

let fromAirportId = null
let toAirportId = null

if (type === 'flight') {
  for (const [key, airportId] of airportMap.entries()) {
    if (fromPointName?.toLowerCase().includes(key.toLowerCase())) fromAirportId = airportId
    if (toPointName?.toLowerCase().includes(key.toLowerCase())) toAirportId = airportId
  }
}

// Include fromAirport/toAirport in route create/update:
body: JSON.stringify({
  from, to, slug, mode,
  fromDestination: fromDestinationId,
  toDestination: toDestinationId, // was never populated before
  fromAirport: fromAirportId,
  toAirport: toAirportId,
  ...
})
```

### 10.4 Fix observationCount bug in `linkActivities()`

When creating a new Activity record:
```javascript
// CURRENT (wrong):
observationCount: 1,

// CORRECTED:
observationCount: 0,
// handler.js increments via (activity.observationCount || 0) + 1 → result = 1
```

### 10.5 Updated `transform()` main function call sequence

```javascript
// Current call sequence (wrong — missing new functions):
const { ids: destinationIds, cache: destinationCache } = await linkDestinations(...)
const propertyMap = await linkProperties(segments, destinationIds, destinationCache)
const { routeMap, transferSequence, pendingTransferObs } = await linkTransferRoutes(segments, destinationCache)
const { activityMap, pendingActivityObs } = await linkActivities(segments, propertyMap, destinationCache)

// Corrected call sequence:
const { ids: destinationIds, cache: destinationCache } = await linkDestinations(...)
const { propertyMap, stayDestinationMap } = await linkProperties(segments, destinationIds, destinationCache)
const airportMap = await linkAirports(segments, destinationCache, headers, PAYLOAD_API_URL)
const { routeMap, transferSequence, pendingTransferObs } = await linkTransferRoutes(segments, stayDestinationMap, airportMap, destinationCache)
const { activityMap, pendingActivityObs } = await linkActivities(segments, propertyMap, stayDestinationMap, destinationCache)
const { serviceItemMap, pendingServiceItemObs } = await linkServiceItems(segments, airportMap, destinationCache, headers, PAYLOAD_API_URL)
```

Note: `headers` and `PAYLOAD_API_URL` must be defined at the top of `transform()` and passed through. Currently they are defined only inside each function. Move them to the outer function scope.

### 10.6 Updated `_knowledgeBase` object

Add to the `_knowledgeBase` object built in `transform()`:

```javascript
const _knowledgeBase = {
  // Existing fields (unchanged):
  orderedPropertyIds,
  propertySequence,
  transferSequence,
  pendingTransferObs,
  pendingActivityObs: pendingActivityObsList,
  activityIds: [...activityMap.values()],
  adultsCount,
  childrenCount,
  startDate: itinerary.startDate || null,

  // NEW fields:
  stayDestinationIds: [...new Set(stayDestinationMap.values())].filter(Boolean), // Destination-level IDs
  serviceItemIds: [...new Set(serviceItemMap.values())],
  pendingServiceItemObs,
  airportIds: [...new Set(airportMap.values())],
}
```

---

## 11. Required Changes to handler.js

### 11.1 ServiceItem observations

After the existing Activity observations block, add:

```javascript
// KNOWLEDGE BASE: ServiceItem observation dedup
const pendingServiceItemObs = kb.pendingServiceItemObs || []
if (pendingServiceItemObs.length > 0) {
  console.log(`[Orchestrator] Processing ${pendingServiceItemObs.length} service item observations`)
  for (const obs of pendingServiceItemObs) {
    try {
      const item = await payload.getById('service-items', obs.serviceItemId, { depth: 0 })
      const existingObserved = (item.observedInItineraries || [])
        .map(id => typeof id === 'object' ? id?.id : id)
        .filter(id => id != null)

      if (existingObserved.some(id => String(id) === String(payloadItinerary.id))) {
        console.log(`[Orchestrator] ServiceItem already observed: ${obs.name} — skipping`)
        continue
      }

      await payload.update('service-items', obs.serviceItemId, {
        observationCount: (item.observationCount || 0) + 1,
        observedInItineraries: [...existingObserved, payloadItinerary.id],
      })
      console.log(`[Orchestrator] ServiceItem obs recorded: ${obs.name}`)
    } catch (err) {
      console.error(`[Orchestrator] ServiceItem obs failed for ${obs.serviceItemId}: ${err.message}`)
      // Non-fatal
    }
  }
}
```

### 11.2 Airport observationCount increment

After the ServiceItem block, add:

```javascript
// KNOWLEDGE BASE: Airport observation count
const airportIds = kb.airportIds || []
if (airportIds.length > 0) {
  console.log(`[Orchestrator] Incrementing observation count for ${airportIds.length} airports`)
  for (const airportId of airportIds) {
    try {
      const airport = await payload.getById('airports', airportId, { depth: 0 })
      await payload.update('airports', airportId, {
        observationCount: (airport.observationCount || 0) + 1,
      })
    } catch (err) {
      console.error(`[Orchestrator] Airport count failed for ${airportId}: ${err.message}`)
      // Non-fatal
    }
  }
}
```

### 11.3 ItineraryPatterns: add `regions` and `serviceItems`

In the existing `patternData` object, add two fields:

```javascript
const patternData = {
  // ... all existing fields unchanged ...
  countries: transformedData.destinations || [], // country-level IDs — unchanged

  // NEW:
  regions: kb.stayDestinationIds || [],          // destination-level IDs
  serviceItems: kb.serviceItemIds || [],          // service item IDs
}
```

### 11.4 Properties.accumulatedData: add `seasonalityData`

In the existing accumulatedData PATCH in the property loop, add `seasonalityData`:

```javascript
// Determine travel month from itinerary start date
const travelMonth = kb.startDate ? parseInt(kb.startDate.slice(5, 7)) : null

// Inside the property loop, add to accumulatedData PATCH:
let updatedSeasonality = existingProperty.accumulatedData?.seasonalityData || []
if (travelMonth) {
  const existingMonthIdx = updatedSeasonality.findIndex(s => s.month === travelMonth)
  if (existingMonthIdx >= 0) {
    updatedSeasonality = updatedSeasonality.map((s, idx) =>
      idx === existingMonthIdx ? { ...s, observationCount: (s.observationCount || 0) + 1 } : s
    )
  } else {
    updatedSeasonality = [...updatedSeasonality, { month: travelMonth, observationCount: 1 }]
  }
}

// In the PATCH body:
await payload.update('properties', propertyId, {
  accumulatedData: {
    pricePositioning: { observations: updatedObs, observationCount: updatedObs.length },
    commonPairings: mergedPairings,
    seasonalityData: updatedSeasonality, // NEW
  },
})
```

---

## 12. Update content cascade: destination-resolver.ts

In `content-system/cascade/destination-resolver.ts`, change the global lookup from `destination-name-mappings` to `location-mappings`, filtering for `resolvedAs = 'destination'`:

```typescript
// CURRENT:
const mappingsData = await payload.findGlobal({ slug: 'destination-name-mappings' })
const mappings = mappingsData.mappings || []

// UPDATED:
const mappingsData = await payload.findGlobal({ slug: 'location-mappings' })
const mappings = (mappingsData.mappings || []).filter(m => m.resolvedAs === 'destination')
// The rest of the alias matching logic is unchanged — use mapping.destination relationship
```

---

## 13. Execution Order (MANDATORY — do not change the order)

### Step 1: Data fixes — execute via direct DB queries

This must happen BEFORE schema files are changed. While Activity records with type='other' exist, the schema cannot remove 'other' from the enum.

**Step 1a: Create Serengeti National Park destination**
```sql
INSERT INTO destinations (name, slug, type, country_id, _status, updated_at, created_at)
VALUES (
  'Serengeti National Park',
  'serengeti-national-park',
  'destination',
  3,
  'draft',
  NOW(),
  NOW()
)
RETURNING id;
-- Note the returned ID — needed in Step 1b and 1c
```

**Step 1b: Fix all four property destination_id values**

Match by NAME, not by ID:
```sql
-- Nyasi Tented Camp → Serengeti National Park (use ID from Step 1a)
UPDATE properties SET destination_id = <new_serengeti_id>
WHERE name = 'Nyasi Tented Camp';

-- Little Chem Chem → Tarangire National Park (id=35)
UPDATE properties SET destination_id = 35
WHERE name = 'Little Chem Chem';

-- Mwiba Lodge → Mwiba Wildlife Reserve (id=37)
UPDATE properties SET destination_id = 37
WHERE name = 'Mwiba Lodge';

-- Legendary Lodge → Arusha (id=34)
UPDATE properties SET destination_id = 34
WHERE name = 'Legendary Lodge';
```

**Step 1c: Delete wrong destination record**
```sql
-- First verify no other records reference id=36 (Serengeti Mobile)
SELECT COUNT(*) FROM properties WHERE destination_id = 36;
-- Expected: 0 (after Step 1b fixes Nyasi)

SELECT COUNT(*) FROM destinations WHERE country_id = 36;
-- Expected: 0 (Serengeti Mobile has no child destinations)

-- Safe to delete:
DELETE FROM destinations WHERE id = 36 AND name = 'Serengeti Mobile';
-- Expected: 1 row deleted
```

**Step 1d: Migrate Activity records to ServiceItems**

The ServiceItems table does not exist yet (it's created in Step 2). Therefore Step 1d cannot use the service-items table. Instead, delete the wrong Activity records now and the ServiceItem records will be created by the NEXT scrape (after Step 3 deploys the updated scraper).

Delete Activity records that are not genuine experiential activities:
```sql
DELETE FROM activities WHERE name IN (
  'Meet and Assist - Kilimanjaro Int Airport Arrival',
  'VIP Lounge -  Kilimanjaro International Airport Arrival',
  'Serengeti Camping Fee',
  ' Serengeti National Park Fee',
  'Meet and Assist - Kilimanjaro Int Airport Departure',
  'VIP Lounge -  Kilimanjaro International Airport Departure'
);
-- Expected: 6 rows deleted

-- Clean up orphaned relationships
DELETE FROM activities_rels WHERE parent_id NOT IN (SELECT id FROM activities);
```

Verify only Serengeti Balloon Safari remains:
```sql
SELECT id, name, type FROM activities;
-- Expected: exactly 1 row: Serengeti Balloon Safari, balloon_flight
```

**Step 1e: Update ItineraryPatterns.countries to reflect corrected destinations**

The existing ItineraryPatterns record links to country-level destinations via itinerary_patterns_rels. After the scraper upgrade runs (Step 3), the next scrape will repopulate these correctly. No manual fix needed here — the existing record will be overwritten on next scrape.

**Step 1f: Verify Step 1 complete before proceeding**
```sql
-- All properties at destination level (not country level):
SELECT p.name, d.name AS destination, d.type
FROM properties p JOIN destinations d ON p.destination_id = d.id;
-- Expected: 4 rows, all d.type = 'destination'

-- Only one Activity record remains:
SELECT id, name, type FROM activities;
-- Expected: 1 row (Serengeti Balloon Safari)

-- Serengeti Mobile destination deleted:
SELECT id, name FROM destinations WHERE name = 'Serengeti Mobile';
-- Expected: 0 rows

-- Serengeti National Park exists:
SELECT id, name, type, country_id FROM destinations WHERE name = 'Serengeti National Park';
-- Expected: 1 row, type='destination', country_id=3
```

**DO NOT PROCEED to Step 2 until Step 1f queries all pass.**

---

### Step 2: Schema files — create and modify TypeScript files

Create:
- `src/collections/Airports.ts`
- `src/collections/ServiceItems.ts`
- `src/globals/LocationMappings.ts`

Modify:
- `src/collections/Activities.ts` — remove `{ label: 'Other', value: 'other' }` from type select
- `src/collections/ItineraryPatterns.ts` — add `regions` and `serviceItems` fields
- `src/collections/Properties.ts` — add `seasonalityData` inside `accumulatedData` group
- `src/collections/TransferRoutes.ts` — add `fromAirport` and `toAirport` fields
- `src/payload.config.ts` — register Airports, ServiceItems, LocationMappings; remove DestinationNameMappings

---

### Step 3: Generate and run migration

```bash
pnpm payload migrate:create
```

This generates a migration file in `src/migrations/`. Inspect the generated file before running. Verify it:
- Creates `airports` table
- Creates `service_items` table
- Creates `service_items_rels` table
- Adds `from_airport_id` and `to_airport_id` columns to `transfer_routes`
- Adds `regions` relationship path to `itinerary_patterns_rels`
- Adds `service_items` relationship path to `itinerary_patterns_rels`
- Adds `seasonality_data` array table for properties
- Modifies the activities type enum to remove 'other'

If the migration file looks correct:
```bash
pnpm payload migrate
```

**Verify migration:**
```sql
-- New tables exist:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('airports', 'service_items', 'service_items_rels')
ORDER BY table_name;
-- Expected: 3 rows

-- TransferRoutes has new columns:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transfer_routes'
AND column_name IN ('from_airport_id', 'to_airport_id');
-- Expected: 2 rows

-- 'other' removed from activities type enum:
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname LIKE '%activ%' AND enumlabel = 'other';
-- Expected: 0 rows
```

**DO NOT PROCEED to Step 4 until Step 3 verification passes.**

---

### Step 4: Register LocationMappings and update cascade

4a. Verify LocationMappings global is accessible:
```
GET /api/globals/location-mappings
Expected: 200 OK, { mappings: [] }
```

4b. Seed the Serengeti Mobile mapping via Payload API:
```bash
curl -X PATCH /api/globals/location-mappings \
  -H "Authorization: users API-Key <PAYLOAD_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": [{
      "externalString": "Serengeti Mobile",
      "sourceSystem": "itrvl",
      "resolvedAs": "destination",
      "destination": <serengeti_national_park_id>,
      "notes": "Serengeti Mobile is Nyasi Tented Camps mobile camp concept. The actual destination is Serengeti National Park."
    }]
  }'
```

4c. Update `content-system/cascade/destination-resolver.ts` per Section 12.

---

### Step 5: Update scraper (transform.js and handler.js)

Implement all changes from Sections 10 and 11. This is the largest code change. The complete function call sequence in `transform()` must match Section 10.5 exactly.

---

### Step 6: Deploy

Deploy the updated Next.js app (schema changes) to Vercel. This triggers the production migration. Deploy the updated Lambda functions (transform.js, handler.js).

---

### Step 7: Test scrape and verify

Scrape one test itinerary through the full pipeline. Then run all verification queries from Section 14.

---

## 14. Ungameable Verification Queries

These queries verify specific named entities and values, not just row counts. Run after Step 7.

### V1: Property hierarchy is correct

```sql
SELECT p.name AS property, d.name AS destination, d.type AS dest_type
FROM properties p
JOIN destinations d ON p.destination_id = d.id
ORDER BY p.name;
```

**Expected — exact values, not just counts:**
```
Legendary Lodge     | Arusha                  | destination
Little Chem Chem    | Tarangire National Park  | destination
Mwiba Lodge         | Mwiba Wildlife Reserve   | destination
Nyasi Tented Camp   | Serengeti National Park  | destination
```

Any row showing `dest_type = 'country'` is a failure.

### V2: Wrong destination record deleted

```sql
SELECT id, name FROM destinations WHERE name = 'Serengeti Mobile';
```

Expected: 0 rows. If 1 row, Step 1c failed.

### V3: Activity records are correct

```sql
SELECT name, type, observation_count FROM activities ORDER BY name;
```

Expected minimum: Serengeti Balloon Safari with type=balloon_flight and observation_count=1 (not 2) after ONE scrape.  
Any row with type='other' is a failure.  
Any row with observation_count=2 after a single scrape is a failure (the observationCount bug).

### V4: ServiceItems exist with correct names and categories

```sql
SELECT name, category, service_level FROM service_items ORDER BY name;
```

Expected: rows matching the service segments from the test itinerary, with correct categories. Example expected rows (names must match the iTrvl segment names exactly):
```
Meet and Assist - Kilimanjaro Int Airport Arrival    | airport_service | premium
Meet and Assist - Kilimanjaro Int Airport Departure  | airport_service | premium
Serengeti Camping Fee                                | park_fee        | standard
Serengeti National Park Fee                          | park_fee        | standard
VIP Lounge - ... Arrival                             | airport_service | ultra_premium
VIP Lounge - ... Departure                           | airport_service | ultra_premium
```

Any ServiceItem with category='other' that matches one of the above names is a failure.

### V5: Airports created with correct data

```sql
SELECT name, iata_code, type AS airport_type,
       d.name AS country_name, d.type AS country_type
FROM airports a
JOIN destinations d ON a.country_id = d.id
ORDER BY a.name;
```

Expected: at least one airport row. Each row must have:
- `country_type = 'country'` (not 'destination')
- `iata_code` populated where iTrvl provided `locationCode`
- `airport_type` is one of: international, domestic, airstrip

### V6: TransferRoutes have fromDestination and toDestination at correct level

```sql
SELECT tr.from, tr.to,
       fd.name AS from_dest, fd.type AS from_type,
       td.name AS to_dest, td.type AS to_type
FROM transfer_routes tr
LEFT JOIN destinations fd ON tr.from_destination_id = fd.id
LEFT JOIN destinations td ON tr.to_destination_id = td.id
ORDER BY tr.from;
```

Expected: `from_type` and `to_type` where not null must be 'destination', not 'country'.  
Expected: `to_dest` is now populated (was always null before).

### V7: ItineraryPatterns has regions (destination-level, not country-level)

```sql
SELECT ip.id,
       d_countries.name AS country_name, d_countries.type AS country_type,
       d_regions.name AS region_name, d_regions.type AS region_type
FROM itinerary_patterns ip
LEFT JOIN itinerary_patterns_rels ipr_c ON ipr_c.parent_id = ip.id AND ipr_c.path = 'countries'
LEFT JOIN destinations d_countries ON d_countries.id = ipr_c.destinations_id
LEFT JOIN itinerary_patterns_rels ipr_r ON ipr_r.parent_id = ip.id AND ipr_r.path = 'regions'
LEFT JOIN destinations d_regions ON d_regions.id = ipr_r.destinations_id
ORDER BY ip.id;
```

Expected: at least one `region_type = 'destination'` row (e.g. Serengeti National Park).  
Expected: `countries` path rows have `country_type = 'country'`.

### V8: LocationMappings global is seeded

```
GET /api/globals/location-mappings
Expected: { mappings: [{ externalString: "Serengeti Mobile", resolvedAs: "destination", ... }] }
```

### V9: No enum remnants

```sql
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname LIKE '%activ%' AND enumlabel = 'other';
```

Expected: 0 rows.

### V10: Properties.seasonalityData is populated

```sql
SELECT p.name, ps.month, ps.observation_count
FROM properties p
JOIN properties_accumulated_data_seasonality_data ps ON ps._parent_id = p.id
ORDER BY p.name, ps.month;
```

Expected: at least one row per scraped property, with correct month number matching the test itinerary's travel month.

---

## 15. What This Document Does Not Change

- V7 two-field editorial pattern on Itineraries — unchanged
- Destinations collection structure (countries and destinations in same table with type discriminator) — unchanged and correct
- PropertyNameMappings global — unchanged
- Content cascade orchestration logic — only destination-resolver.ts changes (global slug reference)
- KIULI_AGENTIC_VISION.md — this document implements what that vision specifies

---

*KIULI CANONICAL SCHEMA SPECIFICATION — Version 2.0*  
*"Slow is smooth. Smooth is fast."*
