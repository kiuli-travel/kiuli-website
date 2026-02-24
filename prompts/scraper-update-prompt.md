# Scraper Update Prompt — Sections 12–18 + Vision 2.0
## For Claude Code (CLI)

**Context:** This is Step 6 of the Section 20 implementation sequence. Steps 1–5 are complete:
- Schema files committed and built
- Payload migrations applied (M1–M4)
- Data fixes A–I executed and verified
- Activities 'other' enum removed
- Content cascade updated

**What you are doing:** Rewriting `lambda/orchestrator/transform.js` and making targeted additions to `lambda/orchestrator/handler.js` to implement Sections 12–18 of `KIULI_CANONICAL_SCHEMA_SPEC.md` plus three mandatory Vision 2.0 field capture requirements.

**Authoritative source:** `KIULI_CANONICAL_SCHEMA_SPEC.md` in the project files. This prompt quotes from it directly. Where this prompt and the spec conflict, the spec wins.

**Philosophy:** No improvisation. Every function in this prompt is either quoted from the spec or derived directly from an existing schema. If something is unclear, stop and report — do not invent logic.

---

## Before you start

Read these files in full before writing a single line of code:

```
lambda/orchestrator/transform.js
lambda/orchestrator/handler.js
```

Also read:
```
src/collections/Properties.ts       (to verify field names for new writes)
src/collections/TransferRoutes.ts   (to verify field names)
src/collections/Activities.ts       (to verify bookingBehaviour group fields)
src/collections/ServiceItems.ts     (to verify fields before creating ServiceItems)
src/collections/Airports.ts         (to verify fields before creating Airports)
src/collections/ItineraryPatterns.ts (to verify regions and serviceItems fields exist)
```

Do not write any code until you have read all of these files.

---

## Overview of changes

**`lambda/orchestrator/transform.js`:**

1. Add `COUNTRY_CODE_TO_ID` constant
2. Add `classifyPropertyType(name)` function
3. Add `classifyAirportType(name, iataCode)` function
4. Add `getAirportServicesDefaults(type)` function
5. Add `getActivityBookingDefaults(activityType)` function
6. Add `classifyServiceItem(name)` function
7. Add `resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL)` function
8. Modify `linkProperties()` — use location-based destination resolution, call `classifyPropertyType()`, capture GPS coordinates
9. Modify `linkActivities()` — skip 'other' classifications, add `bookingBehaviour` defaults on create, fix `observationCount` to 0, track `currentDestinationId`
10. Modify `linkTransferRoutes()` — add `propertyMap` and `airportMap` parameters, populate `fromProperty`/`toProperty`/`fromAirport`/`toAirport`
11. Add `linkAirports(segments, headers, PAYLOAD_API_URL)` function
12. Add `linkServiceItems(segments, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL)` function
13. Modify `transform()` — updated call sequence, add `serviceItemIds`, `airportIds`, `regionIds` to `_knowledgeBase`

**`lambda/orchestrator/handler.js`:**

14. Add `regions` and `serviceItems` to ItineraryPatterns upsert
15. Update accumulatedData: add `typicalNights`, `observationCount`, `lastObservedAt`

---

## Step 1: Add constants and helper functions

### 1.1 `COUNTRY_CODE_TO_ID`

Add near the top of transform.js, after the initial comment block:

```javascript
// Canonical country destination IDs in Payload DB (type='country')
// Update this map if countries are added to the destinations collection
const COUNTRY_CODE_TO_ID = {
  KE: 2,   // Kenya
  TZ: 3,   // Tanzania
  UG: 4,   // Uganda
  RW: 5,   // Rwanda
  BW: 6,   // Botswana
  ZA: 7,   // South Africa
  ZM: 8,   // Zambia
  ZW: 9,   // Zimbabwe
  NA: 10,  // Namibia
  MZ: 11,  // Mozambique
}
```

### 1.2 `classifyPropertyType(name)` — Section 12

```javascript
function classifyPropertyType(name) {
  const n = name.toLowerCase()
  if (n.includes('tented camp') || n.includes('tented-camp')) return 'tented_camp'
  if (n.includes('mobile camp') || n.includes('mobile-camp')) return 'mobile_camp'
  if (n.includes(' camp') || n.endsWith('camp')) return 'camp'
  if (n.includes('lodge')) return 'lodge'
  if (n.includes('hotel') || n.includes('manor') || n.includes('house') || n.includes('retreat')) return 'hotel'
  if (n.includes('villa') || n.includes('private')) return 'villa'
  return 'lodge' // default
}
```

Called ONLY when creating a new Property record. Never called when updating.

### 1.3 `classifyAirportType(name, iataCode)`

```javascript
function classifyAirportType(name, iataCode) {
  const n = (name || '').toLowerCase()
  const majorIatas = new Set(['NBO', 'JNB', 'CPT', 'DAR', 'EBB', 'KGL', 'GBE', 'LUN', 'HRE', 'WDH', 'MPM'])
  if (iataCode && majorIatas.has(iataCode.toUpperCase())) return 'international'
  if (n.includes('international')) return 'international'
  if (n.includes('domestic')) return 'domestic'
  if (n.includes('airstrip') || n.includes('bush') || n.includes('strip')) return 'airstrip'
  if (n.includes('private')) return 'airstrip'
  if (iataCode && iataCode.length === 3) return 'domestic'
  return 'domestic'
}
```

### 1.4 `getAirportServicesDefaults(type)`

Read `src/collections/Airports.ts` first to confirm the exact field names in the `services` group before writing this function.

```javascript
function getAirportServicesDefaults(type) {
  if (type === 'international') {
    return {
      hasInternationalFlights: true,
      hasDomesticFlights: true,
      hasCharterFlights: true,
    }
  }
  if (type === 'domestic') {
    return {
      hasInternationalFlights: false,
      hasDomesticFlights: true,
      hasCharterFlights: true,
    }
  }
  // airstrip
  return {
    hasInternationalFlights: false,
    hasDomesticFlights: false,
    hasCharterFlights: true,
  }
}
```

**IMPORTANT:** After reading `src/collections/Airports.ts`, verify these field names match the actual schema. Use the exact field names from the schema — not the names in this prompt if they differ.

### 1.5 `getActivityBookingDefaults(activityType)` — Section 5

Read `src/collections/Activities.ts` first to confirm the exact field names in the `bookingBehaviour` group (e.g. `requiresAdvanceBooking`, `availability`, `minimumLeadDays`, etc.).

```javascript
function getActivityBookingDefaults(activityType) {
  const defaults = {
    availability: 'always_included',
    requiresAdvanceBooking: false,
    minimumLeadDays: 0,
    maximumGroupSize: null,
    isIncludedInTariff: true,
    typicalAdditionalCost: null,
  }

  switch (activityType) {
    case 'game_drive':
    case 'walking_safari':
    case 'birding':
    case 'sundowner':
    case 'bush_dinner':
      return defaults // always_included, no booking required

    case 'gorilla_trek':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 90,
        maximumGroupSize: 8,
        isIncludedInTariff: false,
        typicalAdditionalCost: 800,
      }

    case 'chimpanzee_trek':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 30,
        maximumGroupSize: 8,
        isIncludedInTariff: false,
      }

    case 'balloon_flight':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 7,
        maximumGroupSize: 16,
        isIncludedInTariff: false,
      }

    case 'helicopter_flight':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 1,
        maximumGroupSize: 4,
        isIncludedInTariff: false,
      }

    case 'boat_safari':
    case 'canoe_safari':
    case 'horseback_safari':
    case 'fishing':
    case 'spa':
    case 'photography':
    case 'community_visit':
    case 'cultural_visit':
    case 'snorkeling':
    case 'diving':
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false }

    case 'conservation_experience':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 7,
      }

    default:
      return defaults
  }
}
```

**IMPORTANT:** After reading `src/collections/Activities.ts`, verify all field names (e.g. `typicalAdditionalCost` vs `additionalCostUsd`). Use exact names from schema.

### 1.6 `classifyServiceItem(name)`

Read `src/collections/ServiceItems.ts` first to confirm `category`, `serviceDirection`, and `serviceLevel` option values before writing this function.

```javascript
function classifyServiceItem(name) {
  const n = (name || '').toLowerCase()

  if (n.includes('meet') && n.includes('assist')) {
    const direction = n.includes('arriv') ? 'arrival' : n.includes('depart') ? 'departure' : 'both'
    return { category: 'airport_service', serviceDirection: direction, serviceLevel: 'premium' }
  }

  if (n.includes('vip') && n.includes('lounge')) {
    const direction = n.includes('arriv') ? 'arrival' : n.includes('depart') ? 'departure' : 'both'
    return { category: 'airport_service', serviceDirection: direction, serviceLevel: 'ultra_premium' }
  }

  if (n.includes('park fee') || n.includes('conservation fee') || n.includes('camping fee') || n.includes('concession fee')) {
    return { category: 'park_fee', serviceDirection: 'na', serviceLevel: 'standard' }
  }

  if (n.includes('supplement') || n.includes('single room') || n.includes('single use')) {
    return { category: 'accommodation_supplement', serviceDirection: 'na', serviceLevel: 'standard' }
  }

  if (n.includes('departure tax') || n.includes('airport tax') || n.includes('departure levy')) {
    return { category: 'departure_tax', serviceDirection: 'departure', serviceLevel: 'standard' }
  }

  if (n.includes('visa')) {
    return { category: 'visa_fee', serviceDirection: 'na', serviceLevel: 'standard' }
  }

  return { category: 'other', serviceDirection: 'na', serviceLevel: 'standard' }
}
```

**IMPORTANT:** After reading `src/collections/ServiceItems.ts`, verify option values for `category`, `serviceDirection`, and `serviceLevel`. If the schema uses different values (e.g. `'ultra-premium'` vs `'ultra_premium'`), use the schema values.

---

## Step 2: Add `resolveLocationToDestination()` — Section 13

Add this function to transform.js. It is called from `linkProperties()` and `linkActivities()`.

**Performance note:** This function fetches the LocationMappings global on every call. Both callers should pass a pre-fetched mappings cache if this becomes a bottleneck — but for correctness in iteration 1, per-call fetching is fine.

```javascript
/**
 * Resolves a location string to a Destination ID.
 * Resolution order: LocationMappings global → direct Destinations name match → auto-create
 * @param {string} locationString - e.g. "Serengeti Mobile", "Masai Mara"
 * @param {string|number} countryId - Payload ID of the parent Country record
 * @param {object} headers - Auth headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<string|number|null>} Destination ID or countryId fallback
 */
async function resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL) {
  if (!locationString) return countryId

  // Step 1: LocationMappings lookup
  try {
    const mappingsRes = await fetch(
      `${PAYLOAD_API_URL}/api/globals/location-mappings`,
      { headers }
    )
    if (mappingsRes.ok) {
      const mappingsData = await mappingsRes.json()
      const mappings = mappingsData.mappings || []
      for (const mapping of mappings) {
        if (!mapping.externalString) continue
        if (mapping.externalString.toLowerCase() !== locationString.toLowerCase()) continue
        if (mapping.sourceSystem !== 'itrvl' && mapping.sourceSystem !== 'any') continue

        if (mapping.resolvedAs === 'destination') {
          const destId = typeof mapping.destination === 'object'
            ? mapping.destination?.id
            : mapping.destination
          if (destId) {
            console.log(`[resolveLocation] MAPPING: "${locationString}" → destination ${destId}`)
            return destId
          }
        }
        // property / airport / ignore — use country fallback
        console.log(`[resolveLocation] MAPPING: "${locationString}" resolves as ${mapping.resolvedAs} — country fallback`)
        return countryId
      }
    }
  } catch (err) {
    console.error(`[resolveLocation] LocationMappings fetch failed: ${err.message}`)
  }

  // Step 2: Direct Destinations name match
  try {
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
  } catch (err) {
    console.error(`[resolveLocation] Direct match fetch failed: ${err.message}`)
  }

  // Step 3: Auto-create Destination as draft
  const slug = generateSlug(locationString)
  try {
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
      console.log(`[resolveLocation] AUTO-CREATED: "${locationString}" → ${newId}`)
      return newId
    }
    // 400 with 'unique' = already exists under this slug
    const errText = await createRes.text()
    if (createRes.status === 400 && errText.includes('unique')) {
      const retryRes = await fetch(
        `${PAYLOAD_API_URL}/api/destinations?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
        { headers }
      )
      if (retryRes.ok) {
        const retryData = await retryRes.json()
        if (retryData.docs?.[0]?.id) {
          console.log(`[resolveLocation] LINKED (after conflict): "${locationString}" → ${retryData.docs[0].id}`)
          return retryData.docs[0].id
        }
      }
    }
  } catch (err) {
    console.error(`[resolveLocation] Auto-create failed for "${locationString}": ${err.message}`)
  }

  // Step 4: Country fallback
  console.warn(`[resolveLocation] ALL RESOLUTION FAILED for "${locationString}" — country fallback ${countryId}`)
  return countryId
}
```

---

## Step 3: Rewrite `linkProperties()` — Section 14

Replace the entire `linkProperties()` function with the version below. Key changes from current:
- Uses `resolveLocationToDestination()` for destination resolution (not just country lookup)
- Calls `classifyPropertyType()` when creating new records
- Captures GPS coordinates (`segment.latitude`, `segment.longitude`) — write if present, skip silently if absent
- Returns `{ propertyMap, regionIds }` instead of just `propertyMap` so `transform()` can include `regionIds` in `_knowledgeBase`

```javascript
/**
 * Links itinerary stay segments to Property records.
 * Creates new Property records when not found via PropertyNameMappings or slug lookup.
 * Returns propertyMap AND regionIds (destination IDs resolved for each property).
 */
async function linkProperties(segments, destinationIds, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000'
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY
  const headers = { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` }

  const propertyMap = new Map()   // accommodationName → propertyId
  const slugMap = new Map()       // slug → propertyId (dedup within this run)
  const createdThisRun = new Set()
  const regionIds = []            // Destination IDs (type='destination') for each property, in order

  if (!PAYLOAD_API_KEY) {
    console.error('[linkProperties] PAYLOAD_API_KEY not set')
    return { propertyMap, regionIds }
  }

  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation')
  if (stays.length === 0) {
    console.log('[linkProperties] No stay segments to process')
    return { propertyMap, regionIds }
  }

  // Fetch PropertyNameMappings ONCE
  let nameMappings = []
  try {
    const mappingsRes = await fetch(`${PAYLOAD_API_URL}/api/globals/property-name-mappings`, { headers })
    if (mappingsRes.ok) {
      const mappingsData = await mappingsRes.json()
      nameMappings = mappingsData.mappings || []
    }
  } catch (err) {
    console.error('[linkProperties] Failed to fetch PropertyNameMappings:', err.message)
  }

  for (const stay of stays) {
    const accommodationName = stay.name || stay.title || stay.supplierName
    if (!accommodationName) continue
    if (propertyMap.has(accommodationName)) {
      // Already processed — push null placeholder so regionIds stays in sync with stays array
      regionIds.push(null)
      continue
    }

    const slug = generateSlug(accommodationName)
    if (slugMap.has(slug)) {
      propertyMap.set(accommodationName, slugMap.get(slug))
      regionIds.push(null)
      continue
    }

    let propertyId = null
    let resolvedDestinationId = null

    try {
      // 1. Check PropertyNameMappings aliases
      for (const mapping of nameMappings) {
        const aliases = Array.isArray(mapping.aliases) ? mapping.aliases : []
        const match = aliases.some(a => a.toLowerCase() === accommodationName.toLowerCase())
        if (match) {
          propertyId = typeof mapping.property === 'object' ? mapping.property.id : mapping.property
          console.log(`[linkProperties] ALIAS MATCH: ${accommodationName} -> ${propertyId}`)
          break
        }
      }

      // 2. Query Properties by slug
      if (!propertyId) {
        const slugRes = await fetch(
          `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        )
        if (slugRes.ok) {
          const slugData = await slugRes.json()
          if (slugData.docs?.[0]?.id) {
            propertyId = slugData.docs[0].id
            console.log(`[linkProperties] LINKED: ${accommodationName} -> ${propertyId} (existing)`)
          }
        }
      }

      // 3. Create new Property if not found
      if (!propertyId) {
        // Resolve destination: location first (via resolveLocationToDestination), country fallback
        const locationString = stay.location || stay.locationName || null
        const country = stay.country || stay.countryName || null

        if (locationString && country) {
          const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
          if (countryId) {
            resolvedDestinationId = await resolveLocationToDestination(
              locationString,
              countryId,
              headers,
              PAYLOAD_API_URL
            )
          }
        } else if (country) {
          resolvedDestinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
        }

        if (!resolvedDestinationId && destinationIds.length > 0) {
          resolvedDestinationId = destinationIds[0]
        }

        if (!resolvedDestinationId) {
          console.warn(`[linkProperties] No destination resolved for ${accommodationName} — skipping creation`)
          regionIds.push(null)
          continue
        }

        // Capture GPS coordinates if present in segment data
        const lat = stay.latitude ?? stay.lat ?? null
        const lng = stay.longitude ?? stay.lng ?? stay.lon ?? null
        if (lat !== null && lng !== null) {
          console.log(`[linkProperties] GPS captured for ${accommodationName}: ${lat}, ${lng}`)
        }

        const createBody = {
          name: accommodationName,
          slug,
          destination: resolvedDestinationId,
          type: classifyPropertyType(accommodationName),
          externalIds: {
            itrvlSupplierCode: stay.supplierCode || null,
            itrvlPropertyName: accommodationName,
          },
          canonicalContent: {
            source: 'scraper',
            contactEmail: stay.notes?.contactEmail || null,
            contactPhone: stay.notes?.contactNumber || null,
            ...(lat !== null && lng !== null ? {
              coordinates: { latitude: lat, longitude: lng }
            } : {}),
          },
          _status: 'draft',
        }

        // NOTE: description is intentionally omitted here.
        // READ src/collections/Properties.ts to determine the correct field name
        // (description_itrvl vs canonicalContent.description) before adding it.

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/properties`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
        })

        if (createRes.ok) {
          const created = await createRes.json()
          propertyId = created.doc?.id || created.id
          createdThisRun.add(propertyId)
          console.log(`[linkProperties] CREATED: ${accommodationName} -> ${propertyId}`)
        } else {
          const errText = await createRes.text()
          if (createRes.status === 400 && errText.includes('unique')) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
              { headers }
            )
            if (retryRes.ok) {
              const retryData = await retryRes.json()
              if (retryData.docs?.[0]?.id) {
                propertyId = retryData.docs[0].id
                console.log(`[linkProperties] LINKED (after conflict): ${accommodationName} -> ${propertyId}`)
              }
            }
          }
          if (!propertyId) {
            console.error(`[linkProperties] Failed to create ${accommodationName}: ${createRes.status}`)
          }
        }
      }

      // 4. Backfill supplierCode / GPS on existing records that are missing them
      if (propertyId && !createdThisRun.has(propertyId)) {
        try {
          const existingRes = await fetch(
            `${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=0`,
            { headers }
          )
          if (existingRes.ok) {
            const existing = await existingRes.json()
            const existingExt = existing.externalIds || {}
            const existingCc = existing.canonicalContent || {}
            const lat = stay.latitude ?? stay.lat ?? null
            const lng = stay.longitude ?? stay.lng ?? stay.lon ?? null

            const needsBackfill =
              (!existingExt.itrvlSupplierCode && stay.supplierCode) ||
              (lat !== null && lng !== null && !existingCc.coordinates?.latitude) ||
              (!existingCc.contactEmail && stay.notes?.contactEmail)

            if (needsBackfill) {
              const patch = {}
              if (!existingExt.itrvlSupplierCode && stay.supplierCode) {
                patch.externalIds = {
                  ...existingExt,
                  itrvlSupplierCode: stay.supplierCode,
                  itrvlPropertyName: existingExt.itrvlPropertyName || accommodationName,
                }
              }
              const ccPatch = {}
              if (lat !== null && lng !== null && !existingCc.coordinates?.latitude) {
                ccPatch.coordinates = { latitude: lat, longitude: lng }
              }
              if (!existingCc.contactEmail && stay.notes?.contactEmail) {
                ccPatch.contactEmail = stay.notes.contactEmail
              }
              if (!existingCc.contactPhone && stay.notes?.contactNumber) {
                ccPatch.contactPhone = stay.notes.contactNumber
              }
              if (Object.keys(ccPatch).length > 0) {
                patch.canonicalContent = { ...existingCc, ...ccPatch }
              }
              if (Object.keys(patch).length > 0) {
                await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}`, {
                  method: 'PATCH',
                  headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                })
                console.log(`[linkProperties] BACKFILLED for property ${propertyId}`)
              }
            }
          }
        } catch (err) {
          console.error(`[linkProperties] BACKFILL failed for ${propertyId}: ${err.message}`)
        }
      }

      // Resolve destination ID for this property (for regionIds) if not already resolved
      if (propertyId && !resolvedDestinationId) {
        try {
          const propRes = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=0`, { headers })
          if (propRes.ok) {
            const prop = await propRes.json()
            resolvedDestinationId = typeof prop.destination === 'object'
              ? prop.destination?.id
              : prop.destination
          }
        } catch (err) {
          // Non-fatal
        }
      }

      if (propertyId) {
        propertyMap.set(accommodationName, propertyId)
        slugMap.set(slug, propertyId)
      }
      regionIds.push(resolvedDestinationId || null)

    } catch (err) {
      console.error(`[linkProperties] Error for ${accommodationName}:`, err.message)
      regionIds.push(null)
    }
  }

  console.log(`[linkProperties] Total linked: ${propertyMap.size} properties, ${regionIds.filter(Boolean).length} regions resolved`)
  return { propertyMap, regionIds }
}
```

---

## Step 4: Rewrite `linkActivities()` — Section 15

Replace the entire `linkActivities()` function. Key changes:
- Track `currentDestinationId` in the stay loop (resolved via `resolveLocationToDestination`)
- Use `currentDestinationId` instead of per-segment country lookup
- Skip activities where `classifyActivity()` returns `'other'` (those go to `linkServiceItems()`)
- Set `observationCount: 0` on create (handler.js increments to 1)
- Apply `bookingBehaviour` defaults on create

```javascript
async function linkActivities(segments, propertyMap, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000'
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  }

  const activityMap = new Map()
  const slugCache = new Map()
  const activityPropertyLinks = new Map()
  const pendingActivityObs = []

  let currentPropertyId = null
  let currentDestinationId = null   // Resolved destination for current stay block
  let currentCountry = null         // Raw country string (kept for logging)

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()

    if (type === 'stay' || type === 'accommodation') {
      const name = segment.name || segment.title || segment.supplierName
      currentPropertyId = name ? (propertyMap.get(name) || null) : null
      currentCountry = segment.country || segment.countryName || null

      // Resolve destination for this stay block — used by all subsequent activity segments
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

    if (type !== 'service' && type !== 'activity') continue

    const activityName = segment.name || segment.title
    if (!activityName) continue

    const activityType = classifyActivity(activityName)

    // Skip 'other' — those go to linkServiceItems()
    if (activityType === 'other') continue

    const destinationId = currentDestinationId || null
    const slug = generateSlug(activityName)

    try {
      let activityId = activityMap.get(slug) || null

      if (!activityId) {
        let existingActivity = slugCache.get(slug) || null
        if (!existingActivity) {
          const res = await fetch(
            `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
            { headers }
          )
          if (res.ok) {
            const data = await res.json()
            existingActivity = data.docs?.[0] || null
            if (existingActivity) slugCache.set(slug, existingActivity)
          }
        }

        if (existingActivity) {
          activityId = existingActivity.id
          activityMap.set(slug, activityId)

          const existingDestinations = (existingActivity.destinations || [])
            .map(d => typeof d === 'object' ? d.id : d)
          const existingProperties = (existingActivity.properties || [])
            .map(p => typeof p === 'object' ? p.id : p)

          const updatedDestinations = destinationId && !existingDestinations.includes(destinationId)
            ? [...existingDestinations, destinationId]
            : existingDestinations
          const updatedProperties = currentPropertyId && !existingProperties.includes(currentPropertyId)
            ? [...existingProperties, currentPropertyId]
            : existingProperties

          await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              destinations: updatedDestinations,
              properties: updatedProperties,
            }),
          })
          console.log(`[linkActivities] UPDATED: ${activityName}`)
          activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)))
          pendingActivityObs.push({ activityId, slug: activityName })

        } else {
          const bookingDefaults = getActivityBookingDefaults(activityType)

          const createRes = await fetch(`${PAYLOAD_API_URL}/api/activities`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: activityName,
              slug,
              type: activityType,
              destinations: destinationId ? [destinationId] : [],
              properties: currentPropertyId ? [currentPropertyId] : [],
              observationCount: 0,
              bookingBehaviour: bookingDefaults,
            }),
          })

          if (createRes.ok) {
            const created = await createRes.json()
            activityId = created.doc?.id || created.id
            activityMap.set(slug, activityId)
            activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)))
            pendingActivityObs.push({ activityId, slug: activityName })
            console.log(`[linkActivities] CREATED: ${activityName} → ${activityId}`)
          } else {
            const errText = await createRes.text()
            if (createRes.status === 400 && errText.includes('unique')) {
              const retryRes = await fetch(
                `${PAYLOAD_API_URL}/api/activities?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
                { headers }
              )
              if (retryRes.ok) {
                const retryData = await retryRes.json()
                if (retryData.docs?.[0]?.id) {
                  activityId = retryData.docs[0].id
                  activityMap.set(slug, activityId)
                  activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)))
                  pendingActivityObs.push({ activityId, slug: activityName })
                  console.log(`[linkActivities] LINKED (after conflict): ${activityName}`)
                }
              }
            }
            if (!activityId) {
              console.error(`[linkActivities] Failed to create ${activityName}: ${createRes.status}`)
            }
          }
        }

      } else {
        // Already seen this activity in this itinerary — link additional property if needed
        if (currentPropertyId) {
          const linked = activityPropertyLinks.get(slug) || new Set()
          if (!linked.has(currentPropertyId)) {
            try {
              const actRes = await fetch(
                `${PAYLOAD_API_URL}/api/activities/${activityId}?depth=0`,
                { headers }
              )
              if (actRes.ok) {
                const existingAct = await actRes.json()
                const existingProps = (existingAct.properties || []).map(p => typeof p === 'object' ? p.id : p)
                if (!existingProps.includes(currentPropertyId)) {
                  await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ properties: [...existingProps, currentPropertyId] }),
                  })
                }
                linked.add(currentPropertyId)
                activityPropertyLinks.set(slug, linked)
              }
            } catch (err) {
              console.error(`[linkActivities] Additional property link failed for ${activityName}: ${err.message}`)
            }
          }
        }
      }

    } catch (err) {
      console.error(`[linkActivities] Error for ${activityName}:`, err.message)
    }
  }

  console.log(`[linkActivities] Total activities: ${activityMap.size}`)
  return { activityMap, pendingActivityObs }
}
```

---

## Step 5: Add `linkAirports()` — Section 16

Add this new function to transform.js:

```javascript
/**
 * Creates or looks up Airport records for all point/entry/exit segments.
 * @param {Array} segments
 * @param {object} headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<Map>} airportMap: iataCode (uppercase) or slug → airportId
 */
async function linkAirports(segments, headers, PAYLOAD_API_URL) {
  const airportMap = new Map()
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

    // 1. Lookup by IATA code
    if (iataCode) {
      try {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/airports?where[iataCode][equals]=${encodeURIComponent(iataCode)}&limit=1`,
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
            console.log(`[linkAirports] FOUND by IATA: ${iataCode} → ${airportId}`)
          }
        }
      } catch (err) {
        console.error(`[linkAirports] IATA lookup failed for ${iataCode}: ${err.message}`)
      }
    }

    // 2. Lookup by slug
    if (!airportId) {
      const airportSlug = generateSlug(airportName)
      try {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(airportSlug)}&limit=1`,
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
            console.log(`[linkAirports] FOUND by slug: ${airportSlug} → ${airportId}`)
          }
        }
      } catch (err) {
        console.error(`[linkAirports] Slug lookup failed for ${airportSlug}: ${err.message}`)
      }
    }

    // 3. Create airport
    if (!airportId) {
      const countryId = countryCode ? (COUNTRY_CODE_TO_ID[countryCode.toUpperCase()] || null) : null
      const airportSlug = generateSlug(airportName)
      const airportType = classifyAirportType(airportName, iataCode)
      const serviceDefaults = getAirportServicesDefaults(airportType)

      try {
        const createRes = await fetch(`${PAYLOAD_API_URL}/api/airports`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: airportName,
            slug: airportSlug,
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
            const retrySlug = generateSlug(airportName)
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(retrySlug)}&limit=1`,
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
          if (!airportId) {
            console.error(`[linkAirports] FAILED: ${airportName}: ${createRes.status}`)
          }
        }
      } catch (err) {
        console.error(`[linkAirports] Create failed for ${airportName}: ${err.message}`)
      }
    }

    if (airportId) airportMap.set(lookupKey, airportId)
  }

  console.log(`[linkAirports] Total airports: ${airportMap.size}`)
  return airportMap
}
```

---

## Step 6: Add `linkServiceItems()` — Section 18

Add this new function to transform.js. ServiceItems are service segments where `classifyActivity()` returns `'other'`.

```javascript
/**
 * Creates or looks up ServiceItem records for service segments that are NOT activities.
 * These are segments where classifyActivity() returns 'other'.
 * @param {Array} segments
 * @param {Map} propertyMap
 * @param {Map} airportMap
 * @param {Map} destinationCache
 * @param {object} headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<{ serviceItemMap: Map, pendingServiceItemObs: Array }>}
 */
async function linkServiceItems(segments, propertyMap, airportMap, destinationCache, headers, PAYLOAD_API_URL) {
  const serviceItemMap = new Map()  // slug → serviceItemId
  const slugCache = new Map()
  const pendingServiceItemObs = []

  for (const segment of segments) {
    const type = segment.type?.toLowerCase()
    if (type !== 'service' && type !== 'activity') continue

    const serviceName = segment.name || segment.title
    if (!serviceName) continue

    // Only process segments that classifyActivity() cannot classify
    const activityType = classifyActivity(serviceName)
    if (activityType !== 'other') continue

    const slug = generateSlug(serviceName)
    if (serviceItemMap.has(slug)) {
      pendingServiceItemObs.push({ serviceItemId: serviceItemMap.get(slug), slug: serviceName })
      continue
    }

    try {
      // 1. Lookup by slug
      let serviceItemId = null
      let existingItem = slugCache.get(slug) || null
      if (!existingItem) {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        )
        if (res.ok) {
          const data = await res.json()
          existingItem = data.docs?.[0] || null
          if (existingItem) slugCache.set(slug, existingItem)
        }
      }

      if (existingItem) {
        serviceItemId = existingItem.id
        // Increment observationCount
        await fetch(`${PAYLOAD_API_URL}/api/service-items/${serviceItemId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ observationCount: (existingItem.observationCount || 0) + 1 }),
        })
        console.log(`[linkServiceItems] FOUND: ${serviceName} → ${serviceItemId}`)

      } else {
        // 2. Create
        const { category, serviceDirection, serviceLevel } = classifyServiceItem(serviceName)

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/service-items`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: serviceName,
            slug,
            category,
            serviceDirection,
            serviceLevel,
            isInclusionIndicator: true,
            observationCount: 1,
          }),
        })

        if (createRes.ok) {
          const created = await createRes.json()
          serviceItemId = created.doc?.id || created.id
          console.log(`[linkServiceItems] CREATED: ${serviceName} → ${serviceItemId}`)
        } else {
          const errText = await createRes.text()
          if (createRes.status === 400 && errText.includes('unique')) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
              { headers }
            )
            if (retryRes.ok) {
              const retryData = await retryRes.json()
              if (retryData.docs?.[0]?.id) {
                serviceItemId = retryData.docs[0].id
                console.log(`[linkServiceItems] LINKED after conflict: ${serviceName} → ${serviceItemId}`)
              }
            }
          }
          if (!serviceItemId) {
            console.error(`[linkServiceItems] FAILED: ${serviceName}: ${createRes.status}`)
          }
        }
      }

      if (serviceItemId) {
        serviceItemMap.set(slug, serviceItemId)
        pendingServiceItemObs.push({ serviceItemId, slug: serviceName })
      }

    } catch (err) {
      console.error(`[linkServiceItems] Error for ${serviceName}: ${err.message}`)
    }
  }

  console.log(`[linkServiceItems] Total service items: ${serviceItemMap.size}`)
  return { serviceItemMap, pendingServiceItemObs }
}
```

---

## Step 7: Rewrite `linkTransferRoutes()` — Section 17

Update the function signature and add `fromProperty`, `toProperty`, `fromAirport`, `toAirport` fields.

**New signature:**
```javascript
async function linkTransferRoutes(segments, destinationCache, propertyMap, airportMap) {
```

**Add endpoint resolution helper inside the function** (before the main loop):

```javascript
  async function resolveEndpointDestination(endpointName) {
    if (!endpointName) return null

    // Check if it's a known property → get that property's destination
    const propertyId = propertyMap.get(endpointName)
    if (propertyId) {
      try {
        const res = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=1`, { headers })
        if (res.ok) {
          const prop = await res.json()
          const destId = typeof prop.destination === 'object' ? prop.destination?.id : prop.destination
          if (destId) return destId
        }
      } catch (err) { /* non-fatal */ }
    }

    // Check if it's a known airport (by IATA or slug)
    const endpointSlug = generateSlug(endpointName)
    const endpointUpper = endpointName.toUpperCase()
    for (const [key, airportId] of airportMap.entries()) {
      if (key === endpointSlug || key === endpointUpper) {
        try {
          const res = await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}?depth=1`, { headers })
          if (res.ok) {
            const airport = await res.json()
            const nearestDestId = typeof airport.nearestDestination === 'object'
              ? airport.nearestDestination?.id
              : airport.nearestDestination
            if (nearestDestId) return nearestDestId
            const countryId = typeof airport.country === 'object' ? airport.country?.id : airport.country
            return countryId || null
          }
        } catch (err) { /* non-fatal */ }
      }
    }

    return null
  }
```

**Compute new fields before the route lookup/create logic.** Add these variable declarations at the top of the main loop body, before the existing `const slug = ...` line:

```javascript
    const from = segment.from || segment.fromPoint || segment.location || null
    const to = segment.to || segment.toPoint || null

    const fromPropertyId = from ? (propertyMap.get(from) || null) : null
    const toPropertyId = to ? (propertyMap.get(to) || null) : null

    // Short strings (≤4 chars) are treated as IATA codes; longer strings use slug
    const fromKey = from ? (from.length <= 4 ? from.toUpperCase() : generateSlug(from)) : null
    const toKey = to ? (to.length <= 4 ? to.toUpperCase() : generateSlug(to)) : null
    const fromAirportId = fromKey && airportMap.has(fromKey) ? airportMap.get(fromKey) : null
    const toAirportId = toKey && airportMap.has(toKey) ? airportMap.get(toKey) : null

    const fromCountry = segment.country || segment.countryName || null
    const fromDestinationId = (fromPropertyId || fromAirportId)
      ? await resolveEndpointDestination(from)
      : (fromCountry ? await lookupDestinationByCountry(fromCountry, destinationCache, headers, PAYLOAD_API_URL) : null)

    const toDestinationId = (toPropertyId || toAirportId)
      ? await resolveEndpointDestination(to)
      : null
```

**Add these fields to the create body** (POST /api/transfer-routes):
```javascript
              fromProperty: fromPropertyId,
              toProperty: toPropertyId,
              fromAirport: fromAirportId,
              toAirport: toAirportId,
              fromDestination: fromDestinationId,
              ...(toDestinationId ? { toDestination: toDestinationId } : {}),
```

**Add these fields to the update body** (PATCH on existing route):
```javascript
              ...(fromPropertyId && !existingRoute.fromProperty ? { fromProperty: fromPropertyId } : {}),
              ...(toPropertyId && !existingRoute.toProperty ? { toProperty: toPropertyId } : {}),
              ...(fromAirportId && !existingRoute.fromAirport ? { fromAirport: fromAirportId } : {}),
              ...(toAirportId && !existingRoute.toAirport ? { toAirport: toAirportId } : {}),
              ...(fromDestinationId && !existingRoute.fromDestination ? { fromDestination: fromDestinationId } : {}),
              ...(toDestinationId && !existingRoute.toDestination ? { toDestination: toDestinationId } : {}),
```

Keep all existing logic intact (airline dedup, observations, `pendingTransferObs`, `go7Airline: false`, `duffelAirline: false`). Only add the new fields.

---

## Step 8: Update `transform()` call sequence — Section 18

Replace the four `link*` calls in `transform()` with:

```javascript
  // 1. Link destinations (countries)
  const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking)

  // 2. Link properties (uses resolveLocationToDestination, returns regionIds)
  const { propertyMap, regionIds } = await linkProperties(segments, destinationIds, destinationCache)

  // 3. Link airports (new — must run before linkTransferRoutes)
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000'
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY
  const _headers = { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` }
  const airportMap = await linkAirports(segments, _headers, PAYLOAD_API_URL)

  // 4. Link transfer routes (updated signature: propertyMap and airportMap added)
  const { routeMap: transferRouteMap, transferSequence, pendingTransferObs } =
    await linkTransferRoutes(segments, destinationCache, propertyMap, airportMap)

  // 5. Link activities (skips 'other', adds bookingBehaviour defaults)
  const { activityMap, pendingActivityObs: pendingActivityObsList } =
    await linkActivities(segments, propertyMap, destinationCache)

  // 6. Link service items (new — segments where classifyActivity returns 'other')
  const { serviceItemMap, pendingServiceItemObs } =
    await linkServiceItems(segments, propertyMap, airportMap, destinationCache, _headers, PAYLOAD_API_URL)
```

**Then update `_knowledgeBase`** to include the new fields:

```javascript
  const _knowledgeBase = {
    orderedPropertyIds: propertySequence.map(p => p.property),
    propertySequence,
    transferSequence,
    pendingTransferObs,
    pendingActivityObs: pendingActivityObsList,
    pendingServiceItemObs,
    activityIds: [...activityMap.values()],
    serviceItemIds: [...serviceItemMap.values()],
    airportIds: [...airportMap.values()],
    regionIds: regionIds.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), // unique non-null destination IDs
    adultsCount,
    childrenCount,
    startDate: itinerary.startDate || null,
  }
```

---

## Step 9: Update `handler.js` — ItineraryPatterns upsert

In `handler.js`, find the ItineraryPatterns upsert block (look for `patternData`). Add `regions` and `serviceItems` to the `patternData` object:

```javascript
// After existing patternData fields, add:
regions: kb.regionIds || [],
serviceItems: kb.serviceItemIds || [],
```

The complete addition is minimal — just these two lines added inside the `patternData = { ... }` object literal. Do not restructure the existing patternData fields.

Also in `handler.js`, in the `accumulatedData` update loop, find this block:

```javascript
          await payload.update('properties', propertyId, {
            accumulatedData: {
              pricePositioning: {
                observations: updatedObs,
                observationCount: updatedObs.length,
              },
              commonPairings: mergedPairings,
            },
          });
```

Replace with:

```javascript
          const propertySeqEntry = (kb.propertySequence || []).find(p => p.property === propertyId)
          const nightsAtProperty = propertySeqEntry?.nights || 0

          await payload.update('properties', propertyId, {
            accumulatedData: {
              observationCount: (existingProperty.accumulatedData?.observationCount || 0) + 1,
              lastObservedAt: new Date().toISOString(),
              typicalNights: {
                median: nightsAtProperty,
                min: nightsAtProperty,
                max: nightsAtProperty,
              },
              pricePositioning: {
                observations: updatedObs,
                observationCount: updatedObs.length,
              },
              commonPairings: mergedPairings,
            },
          });
```

**Note:** `typicalNights` is seeded with the observed nights on first observation. After multiple scrapes, median/min/max should be computed from all observations. This is correct for iteration 1.

---

## Step 10: Verification

After making all changes, run this verification sequence. Report the exact output of every command.

### 10.1 Syntax check
```bash
node --check lambda/orchestrator/transform.js
node --check lambda/orchestrator/handler.js
```

Both must exit 0 with no output.

### 10.2 Module load test
```bash
node -e "require('./lambda/orchestrator/transform'); console.log('transform.js: OK')"
node -e "require('./lambda/orchestrator/handler'); console.log('handler.js: OK')"
```

### 10.3 Required additions present
```bash
grep -c "classifyPropertyType\|classifyAirportType\|getActivityBookingDefaults\|classifyServiceItem\|resolveLocationToDestination\|linkAirports\|linkServiceItems\|COUNTRY_CODE_TO_ID" lambda/orchestrator/transform.js
```
Expected: 8 (one match per term minimum).

```bash
grep -n "go7Airline: false" lambda/orchestrator/transform.js
```
Expected: at least 2 lines (create and update paths in linkTransferRoutes).

```bash
grep -n "observationCount: 0" lambda/orchestrator/transform.js
```
Expected: at least 1 line (linkActivities create path).

```bash
grep -n "regionIds\|serviceItemIds\|airportIds" lambda/orchestrator/transform.js
```
Expected: matches in both _knowledgeBase definition and function return statements.

### 10.4 handler.js additions present
```bash
grep -n "regions.*kb\|serviceItems.*kb\|kb.regionIds\|kb.serviceItemIds\|typicalNights\|lastObservedAt" lambda/orchestrator/handler.js
```
Expected: matches for regions, serviceItems, typicalNights, lastObservedAt.

---

## What NOT to change

- `generateFaqItems()` — unchanged
- `generateMetaFields()` — unchanged
- `generateInvestmentIncludes()` — unchanged
- `mapSegmentToBlock()` — unchanged
- `groupSegmentsByDay()` / `generateDayTitle()` — unchanged
- `textToRichText()` — unchanged
- `extractCountries()` / `extractHighlights()` / `calculateNights()` — unchanged
- `classifyActivity()` — unchanged (adding 'other' skip logic to callers, not to this function)
- `classifyPriceTier()` / `determinePaxType()` — unchanged
- `linkDestinations()` — unchanged
- `lookupDestinationByCountry()` — unchanged
- All handler.js logic except the specific additions in Step 9
- Exports: `module.exports = { transform, generateSlug, textToRichText }` — unchanged

---

## After completing all changes

Report back with:
1. Exact output of every verification command in Step 10
2. List of every function modified or added, with line numbers
3. Any field names where you used different names than this prompt because the schema used different names — state explicitly what the schema says vs what this prompt says
4. Confirmation that `node --check` passes on both files

**Do not commit until verification is complete and reported back to Graham.**
