/**
 * Transform Logic for V6 Pipeline
 *
 * Converts scraped data to V6 schema format
 * Uses *Original fields for scraped content (enhancement comes later)
 */

// Canonical country destination IDs in Payload DB (type='country')
// Update this map if countries are added to the destinations collection
const COUNTRY_CODE_TO_ID = {
  KE: 63,  // Kenya
  TZ: 82,  // Tanzania
  RW: 67,  // Rwanda
  ZA: 74,  // South Africa
  MZ: 75,  // Mozambique
};

/**
 * Classify property type from accommodation name.
 * Called ONLY when creating a new Property record.
 * @param {string} name
 * @returns {string}
 */
function classifyPropertyType(name) {
  const n = name.toLowerCase();
  if (n.includes('tented camp') || n.includes('tented-camp')) return 'tented_camp';
  if (n.includes('mobile camp') || n.includes('mobile-camp')) return 'mobile_camp';
  if (n.includes(' camp') || n.endsWith('camp')) return 'camp';
  if (n.includes('lodge')) return 'lodge';
  if (n.includes('hotel') || n.includes('manor') || n.includes('house') || n.includes('retreat')) return 'hotel';
  if (n.includes('villa') || n.includes('private')) return 'villa';
  return 'lodge'; // default
}

/**
 * Classify airport type from name and IATA code.
 * @param {string} name
 * @param {string} iataCode
 * @returns {string}
 */
function classifyAirportType(name, iataCode) {
  const n = (name || '').toLowerCase();
  const majorIatas = new Set(['NBO', 'JNB', 'CPT', 'DAR', 'EBB', 'KGL', 'GBE', 'LUN', 'HRE', 'WDH', 'MPM']);
  if (iataCode && majorIatas.has(iataCode.toUpperCase())) return 'international';
  if (n.includes('international')) return 'international';
  if (n.includes('domestic')) return 'domestic';
  if (n.includes('airstrip') || n.includes('bush') || n.includes('strip')) return 'airstrip';
  if (n.includes('private')) return 'airstrip';
  if (iataCode && iataCode.length === 3) return 'domestic';
  return 'domestic';
}

/**
 * Default services flags for airport type.
 * Field names from src/collections/Airports.ts services group:
 *   hasInternationalFlights, hasDomesticScheduledFlights, charterOnly
 * @param {string} type
 * @returns {object}
 */
function getAirportServicesDefaults(type) {
  if (type === 'international') {
    return {
      hasInternationalFlights: true,
      hasDomesticScheduledFlights: true,
      charterOnly: false,
    };
  }
  if (type === 'domestic') {
    return {
      hasInternationalFlights: false,
      hasDomesticScheduledFlights: true,
      charterOnly: false,
    };
  }
  // airstrip — charterOnly left false; scraper cannot determine charter exclusivity (editorial field)
  return {
    hasInternationalFlights: false,
    hasDomesticScheduledFlights: false,
    charterOnly: false,
  };
}

/**
 * Default booking behaviour for an activity type.
 * Field names from src/collections/Activities.ts bookingBehaviour group:
 *   requiresAdvanceBooking, availability, minimumLeadDays,
 *   maximumGroupSize, isIncludedInTariff, typicalAdditionalCost (type: 'text')
 * @param {string} activityType
 * @returns {object}
 */
function getActivityBookingDefaults(activityType) {
  const defaults = {
    availability: 'always_included',
    requiresAdvanceBooking: false,
    minimumLeadDays: 0,
    maximumGroupSize: null,
    isIncludedInTariff: true,
    typicalAdditionalCost: null,
  };

  switch (activityType) {
    case 'game_drive':
    case 'walking_safari':
    case 'birding':
    case 'sundowner':
    case 'bush_dinner':
      return defaults; // always_included, no booking required

    case 'gorilla_trek':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 90,
        maximumGroupSize: 8,
        isIncludedInTariff: false,
        typicalAdditionalCost: '800', // text field in schema
      };

    case 'chimpanzee_trek':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 30,
        maximumGroupSize: 8,
        isIncludedInTariff: false,
      };

    case 'balloon_flight':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 7,
        maximumGroupSize: 16,
        isIncludedInTariff: false,
      };

    case 'helicopter_flight':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 1,
        maximumGroupSize: 4,
        isIncludedInTariff: false,
      };

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
      return { ...defaults, availability: 'on_demand', requiresAdvanceBooking: false };

    case 'conservation_experience':
      return {
        ...defaults,
        availability: 'scheduled',
        requiresAdvanceBooking: true,
        minimumLeadDays: 7,
      };

    default:
      return defaults;
  }
}

/**
 * Classify a service item from its name.
 * Field names from src/collections/ServiceItems.ts:
 *   category: airport_service | park_fee | conservation_fee | departure_tax | accommodation_supplement | other
 *   serviceDirection: arrival | departure | both | na
 *   serviceLevel: standard | premium | ultra_premium
 * @param {string} name
 * @returns {object}
 */
function classifyServiceItem(name) {
  const n = (name || '').toLowerCase();

  if (n.includes('meet') && n.includes('assist')) {
    const direction = n.includes('arriv') ? 'arrival' : n.includes('depart') ? 'departure' : 'both';
    return { category: 'airport_service', serviceDirection: direction, serviceLevel: 'premium' };
  }

  if (n.includes('vip') && n.includes('lounge')) {
    const direction = n.includes('arriv') ? 'arrival' : n.includes('depart') ? 'departure' : 'both';
    return { category: 'airport_service', serviceDirection: direction, serviceLevel: 'ultra_premium' };
  }

  if (n.includes('park fee') || n.includes('conservation fee') || n.includes('camping fee') || n.includes('concession fee')) {
    return { category: 'park_fee', serviceDirection: 'na', serviceLevel: 'standard' };
  }

  if (n.includes('supplement') || n.includes('single room') || n.includes('single use')) {
    return { category: 'accommodation_supplement', serviceDirection: 'na', serviceLevel: 'standard' };
  }

  if (n.includes('departure tax') || n.includes('airport tax') || n.includes('departure levy')) {
    return { category: 'departure_tax', serviceDirection: 'departure', serviceLevel: 'standard' };
  }

  if (n.includes('visa')) {
    return { category: 'other', serviceDirection: 'na', serviceLevel: 'standard' }; // schema has no visa_fee option
  }

  return { category: 'other', serviceDirection: 'na', serviceLevel: 'standard' };
}

/**
 * Resolves a location string to a Destination ID.
 * Resolution order: LocationMappings global -> direct Destinations name match -> auto-create
 * @param {string} locationString - e.g. "Serengeti Mobile", "Masai Mara"
 * @param {string|number} countryId - Payload ID of the parent Country record
 * @param {object} headers - Auth headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<string|number|null>} Destination ID or countryId fallback
 */
async function resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL) {
  if (!locationString) return countryId;

  // Step 1: LocationMappings lookup
  try {
    const mappingsRes = await fetch(
      `${PAYLOAD_API_URL}/api/globals/location-mappings`,
      { headers }
    );
    if (mappingsRes.ok) {
      const mappingsData = await mappingsRes.json();
      const mappings = mappingsData.mappings || [];
      for (const mapping of mappings) {
        if (!mapping.externalString) continue;
        if (mapping.externalString.toLowerCase() !== locationString.toLowerCase()) continue;
        if (mapping.sourceSystem !== 'itrvl' && mapping.sourceSystem !== 'any') continue;

        if (mapping.resolvedAs === 'destination') {
          const destId = typeof mapping.destination === 'object'
            ? mapping.destination?.id
            : mapping.destination;
          if (destId) {
            console.log(`[resolveLocation] MAPPING: "${locationString}" -> destination ${destId}`);
            return destId;
          }
        }
        // property / airport / ignore — use country fallback
        console.log(`[resolveLocation] MAPPING: "${locationString}" resolves as ${mapping.resolvedAs} — country fallback`);
        return countryId;
      }
    }
  } catch (err) {
    console.error(`[resolveLocation] LocationMappings fetch failed: ${err.message}`);
  }

  // Step 2: Direct Destinations name match
  try {
    const destRes = await fetch(
      `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(locationString)}&where[type][equals]=destination&limit=1&draft=true`,
      { headers }
    );
    if (destRes.ok) {
      const destData = await destRes.json();
      if (destData.docs?.[0]?.id) {
        console.log(`[resolveLocation] DIRECT MATCH: "${locationString}" -> ${destData.docs[0].id}`);
        return destData.docs[0].id;
      }
    }
  } catch (err) {
    console.error(`[resolveLocation] Direct match fetch failed: ${err.message}`);
  }

  // Step 3: Auto-create Destination as draft
  const slug = generateSlug(locationString);
  try {
    const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations?draft=true`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: locationString,
        slug,
        type: 'destination',
        country: countryId,
        _status: 'draft',
      }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      const newId = created.doc?.id || created.id;
      console.log(`[resolveLocation] AUTO-CREATED: "${locationString}" -> ${newId}`);
      return newId;
    }
    // 400 with 'unique' = already exists under this slug
    const errText = await createRes.text();
    if (createRes.status === 400 && errText.includes('unique')) {
      const retryRes = await fetch(
        `${PAYLOAD_API_URL}/api/destinations?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&draft=true`,
        { headers }
      );
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        if (retryData.docs?.[0]?.id) {
          console.log(`[resolveLocation] LINKED (after conflict): "${locationString}" -> ${retryData.docs[0].id}`);
          return retryData.docs[0].id;
        }
      }
    }
  } catch (err) {
    console.error(`[resolveLocation] Auto-create failed for "${locationString}": ${err.message}`);
  }

  // Step 4: Country fallback
  console.warn(`[resolveLocation] ALL RESOLUTION FAILED for "${locationString}" — country fallback ${countryId}`);
  return countryId;
}

/**
 * Links itinerary to destination records based on extracted countries
 * @param {Array<{country: string}>} countries - From overview.countries
 * @returns {Promise<string[]>} Array of destination document IDs
 */
async function linkDestinations(countries) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const destinationCache = new Map();

  if (!countries || countries.length === 0) {
    console.log('[linkDestinations] No countries to link');
    return { ids: [], cache: destinationCache };
  }

  if (!PAYLOAD_API_KEY) {
    console.error('[linkDestinations] PAYLOAD_API_KEY not set');
    return { ids: [], cache: destinationCache };
  }

  const destinationIds = [];

  for (const { country } of countries) {
    if (!country) continue;

    const url = `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(country)}&limit=1&draft=true`;
    console.log(`[linkDestinations] Querying: ${country}`);

    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` },
      });

      if (!response.ok) {
        console.error(`[linkDestinations] Query failed for ${country}: ${response.status}`);
        destinationCache.set(country, null);
        continue;
      }

      const data = await response.json();

      if (data.docs?.[0]?.id) {
        destinationIds.push(data.docs[0].id);
        destinationCache.set(country, data.docs[0].id);
        console.log(`[linkDestinations] LINKED: ${country} -> ${data.docs[0].id}`);
      } else {
        console.warn(`[linkDestinations] NOT FOUND: ${country}`);
        destinationCache.set(country, null);
      }
    } catch (err) {
      console.error(`[linkDestinations] Error for ${country}:`, err.message);
      destinationCache.set(country, null);
    }
  }

  console.log(`[linkDestinations] Total linked: ${destinationIds.length}/${countries.length}`);
  return { ids: destinationIds, cache: destinationCache };
}

/**
 * Links itinerary stay segments to Property records.
 * Creates new Property records when not found via PropertyNameMappings or slug lookup.
 * Returns propertyMap AND regionIds (destination IDs resolved for each property).
 */
async function linkProperties(segments, destinationIds, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` };

  const propertyMap = new Map();   // accommodationName -> propertyId
  const slugMap = new Map();       // slug -> propertyId (dedup within this run)
  const createdThisRun = new Set();
  const regionIds = [];            // Destination IDs (type='destination') for each property, in order

  if (!PAYLOAD_API_KEY) {
    console.error('[linkProperties] PAYLOAD_API_KEY not set');
    return { propertyMap, regionIds };
  }

  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  if (stays.length === 0) {
    console.log('[linkProperties] No stay segments to process');
    return { propertyMap, regionIds };
  }

  // Fetch PropertyNameMappings ONCE
  let nameMappings = [];
  try {
    const mappingsRes = await fetch(`${PAYLOAD_API_URL}/api/globals/property-name-mappings`, { headers });
    if (mappingsRes.ok) {
      const mappingsData = await mappingsRes.json();
      nameMappings = mappingsData.mappings || [];
    }
  } catch (err) {
    console.error('[linkProperties] Failed to fetch PropertyNameMappings:', err.message);
  }

  for (const stay of stays) {
    const accommodationName = stay.name || stay.title || stay.supplierName;
    if (!accommodationName) continue;
    if (propertyMap.has(accommodationName)) {
      // Already processed — push null placeholder so regionIds stays in sync with stays array
      regionIds.push(null);
      continue;
    }

    const slug = generateSlug(accommodationName);
    if (slugMap.has(slug)) {
      propertyMap.set(accommodationName, slugMap.get(slug));
      regionIds.push(null);
      continue;
    }

    let propertyId = null;
    let resolvedDestinationId = null;

    try {
      // 1. Check PropertyNameMappings aliases
      for (const mapping of nameMappings) {
        const aliases = Array.isArray(mapping.aliases) ? mapping.aliases : [];
        const match = aliases.some(a => a.toLowerCase() === accommodationName.toLowerCase());
        if (match) {
          propertyId = typeof mapping.property === 'object' ? mapping.property.id : mapping.property;
          console.log(`[linkProperties] ALIAS MATCH: ${accommodationName} -> ${propertyId}`);
          break;
        }
      }

      // 2. Query Properties by slug (include drafts — orchestrator creates properties as draft)
      if (!propertyId) {
        const slugRes = await fetch(
          `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&draft=true`,
          { headers }
        );
        if (slugRes.ok) {
          const slugData = await slugRes.json();
          if (slugData.docs?.[0]?.id) {
            propertyId = slugData.docs[0].id;
            console.log(`[linkProperties] LINKED: ${accommodationName} -> ${propertyId} (existing)`);
          }
        }
      }

      // 3. Create new Property if not found
      if (!propertyId) {
        // Resolve destination: location first (via resolveLocationToDestination), country fallback
        const locationString = stay.location || stay.locationName || null;
        const country = stay.country || stay.countryName || null;

        if (locationString && country) {
          const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
          if (countryId) {
            resolvedDestinationId = await resolveLocationToDestination(
              locationString,
              countryId,
              headers,
              PAYLOAD_API_URL
            );
          }
        } else if (country) {
          resolvedDestinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
        }

        if (!resolvedDestinationId && destinationIds.length > 0) {
          resolvedDestinationId = destinationIds[0];
        }

        if (!resolvedDestinationId) {
          console.warn(`[linkProperties] No destination resolved for ${accommodationName} — skipping creation`);
          regionIds.push(null);
          continue;
        }

        // Capture GPS coordinates if present in segment data
        const lat = stay.latitude ?? stay.lat ?? null;
        const lng = stay.longitude ?? stay.lng ?? stay.lon ?? null;
        if (lat !== null && lng !== null) {
          console.log(`[linkProperties] GPS captured for ${accommodationName}: ${lat}, ${lng}`);
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
        };

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/properties`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          propertyId = created.doc?.id || created.id;
          createdThisRun.add(propertyId);
          console.log(`[linkProperties] CREATED: ${accommodationName} -> ${propertyId}`);
        } else {
          const errText = await createRes.text();
          if (createRes.status === 400 && errText.includes('unique')) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&draft=true`,
              { headers }
            );
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.docs?.[0]?.id) {
                propertyId = retryData.docs[0].id;
                console.log(`[linkProperties] LINKED (after conflict): ${accommodationName} -> ${propertyId}`);
              }
            }
          }
          if (!propertyId) {
            console.error(`[linkProperties] Failed to create ${accommodationName}: ${createRes.status}`);
          }
        }
      }

      // 4. Backfill supplierCode / GPS on existing records that are missing them
      if (propertyId && !createdThisRun.has(propertyId)) {
        try {
          const existingRes = await fetch(
            `${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=0&draft=true`,
            { headers }
          );
          if (existingRes.ok) {
            const existing = await existingRes.json();
            const existingExt = existing.externalIds || {};
            const existingCc = existing.canonicalContent || {};
            const lat = stay.latitude ?? stay.lat ?? null;
            const lng = stay.longitude ?? stay.lng ?? stay.lon ?? null;

            const needsBackfill =
              (!existingExt.itrvlSupplierCode && stay.supplierCode) ||
              (lat !== null && lng !== null && !existingCc.coordinates?.latitude) ||
              (!existingCc.contactEmail && stay.notes?.contactEmail);

            if (needsBackfill) {
              const patch = {};
              if (!existingExt.itrvlSupplierCode && stay.supplierCode) {
                patch.externalIds = {
                  ...existingExt,
                  itrvlSupplierCode: stay.supplierCode,
                  itrvlPropertyName: existingExt.itrvlPropertyName || accommodationName,
                };
              }
              const ccPatch = {};
              if (lat !== null && lng !== null && !existingCc.coordinates?.latitude) {
                ccPatch.coordinates = { latitude: lat, longitude: lng };
              }
              if (!existingCc.contactEmail && stay.notes?.contactEmail) {
                ccPatch.contactEmail = stay.notes.contactEmail;
              }
              if (!existingCc.contactPhone && stay.notes?.contactNumber) {
                ccPatch.contactPhone = stay.notes.contactNumber;
              }
              if (Object.keys(ccPatch).length > 0) {
                patch.canonicalContent = { ...existingCc, ...ccPatch };
              }
              if (Object.keys(patch).length > 0) {
                await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}`, {
                  method: 'PATCH',
                  headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                });
                console.log(`[linkProperties] BACKFILLED for property ${propertyId}`);
              }
            }
          }
        } catch (err) {
          console.error(`[linkProperties] BACKFILL failed for ${propertyId}: ${err.message}`);
        }
      }

      // Resolve destination ID for this property (for regionIds) if not already resolved
      if (propertyId && !resolvedDestinationId) {
        try {
          const propRes = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=0&draft=true`, { headers });
          if (propRes.ok) {
            const prop = await propRes.json();
            resolvedDestinationId = typeof prop.destination === 'object'
              ? prop.destination?.id
              : prop.destination;
          }
        } catch (err) {
          // Non-fatal
        }
      }

      if (propertyId) {
        propertyMap.set(accommodationName, propertyId);
        slugMap.set(slug, propertyId);
      }
      regionIds.push(resolvedDestinationId || null);

    } catch (err) {
      console.error(`[linkProperties] Error for ${accommodationName}:`, err.message);
      regionIds.push(null);
    }
  }

  console.log(`[linkProperties] Total linked: ${propertyMap.size} properties, ${regionIds.filter(Boolean).length} regions resolved`);
  return { propertyMap, regionIds };
}

/**
 * Creates or updates TransferRoutes records for each flight/road/boat segment.
 * Returns a Map of route-slug -> routeId and an array of transfer objects
 * in the order they appear in the segment list, each referencing the 1-based
 * index of the property that precedes it.
 *
 * @param {Array} segments - Presentation segments in chronological order
 * @param {Map<string, string|null>} destinationCache - Country -> destinationId cache
 * @param {Map<string, string>} propertyMap - accommodationName -> propertyId
 * @param {Map<string, string>} airportMap - iataCode/slug -> airportId
 * @returns {Promise<{ routeMap: Map<string, string>, transferSequence: Array, pendingTransferObs: Array }>}
 */
async function linkTransferRoutes(segments, destinationCache, propertyMap, airportMap) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const routeMap = new Map();
  const slugLookupCache = new Map();
  const transferSequence = [];
  const pendingTransferObs = [];

  let propertyOrderIndex = 0;

  const transferTypes = new Set(['flight', 'road', 'boat', 'helicopter']);

  // Endpoint resolution helper: resolves an endpoint name to a destination ID
  // by checking propertyMap and airportMap
  async function resolveEndpointDestination(endpointName) {
    if (!endpointName) return null;

    // Check if it's a known property -> get that property's destination
    const propertyId = propertyMap.get(endpointName);
    if (propertyId) {
      try {
        const res = await fetch(`${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=1&draft=true`, { headers });
        if (res.ok) {
          const prop = await res.json();
          const destId = typeof prop.destination === 'object' ? prop.destination?.id : prop.destination;
          if (destId) return destId;
        }
      } catch (err) { /* non-fatal */ }
    }

    // Check if it's a known airport (by IATA or slug)
    const endpointSlug = generateSlug(endpointName);
    const endpointUpper = endpointName.toUpperCase();
    for (const [key, airportId] of airportMap.entries()) {
      if (key === endpointSlug || key === endpointUpper) {
        try {
          const res = await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}?depth=1`, { headers });
          if (res.ok) {
            const airport = await res.json();
            const nearestDestId = typeof airport.nearestDestination === 'object'
              ? airport.nearestDestination?.id
              : airport.nearestDestination;
            if (nearestDestId) return nearestDestId;
            const countryId = typeof airport.country === 'object' ? airport.country?.id : airport.country;
            return countryId || null;
          }
        } catch (err) { /* non-fatal */ }
      }
    }

    return null;
  }

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();

    if (type === 'stay' || type === 'accommodation') {
      propertyOrderIndex++;
      continue;
    }

    if (!transferTypes.has(type)) continue;

    const from = segment.from || segment.fromPoint || segment.location || null;
    const to = segment.to || segment.toPoint || null;

    if (!from || !to || from === to) continue;

    // Resolve property and airport endpoints
    const fromPropertyId = from ? (propertyMap.get(from) || null) : null;
    const toPropertyId = to ? (propertyMap.get(to) || null) : null;

    // Short strings (<=4 chars) are treated as IATA codes; longer strings use slug
    const fromKey = from ? (from.length <= 4 ? from.toUpperCase() : generateSlug(from)) : null;
    const toKey = to ? (to.length <= 4 ? to.toUpperCase() : generateSlug(to)) : null;
    const fromAirportId = fromKey && airportMap.has(fromKey) ? airportMap.get(fromKey) : null;
    const toAirportId = toKey && airportMap.has(toKey) ? airportMap.get(toKey) : null;

    const fromCountry = segment.country || segment.countryName || null;
    const fromDestinationId = (fromPropertyId || fromAirportId)
      ? await resolveEndpointDestination(from)
      : (fromCountry ? await lookupDestinationByCountry(fromCountry, destinationCache, headers, PAYLOAD_API_URL) : null);

    // Resolve toDestination: try property/airport first, then look ahead to next stay segment
    let toDestinationId = null;
    if (toPropertyId || toAirportId) {
      toDestinationId = await resolveEndpointDestination(to);
    }
    if (!toDestinationId) {
      // Look ahead: find the next stay segment after this transfer to derive toDestination
      const currentIdx = segments.indexOf(segment);
      for (let j = currentIdx + 1; j < segments.length; j++) {
        const nextType = segments[j].type?.toLowerCase();
        if (nextType === 'stay' || nextType === 'accommodation') {
          const nextCountry = segments[j].country || segments[j].countryName || null;
          const nextLocation = segments[j].location || segments[j].locationName || null;
          if (nextLocation && nextCountry) {
            const nextCountryId = await lookupDestinationByCountry(nextCountry, destinationCache, headers, PAYLOAD_API_URL);
            if (nextCountryId) {
              toDestinationId = await resolveLocationToDestination(nextLocation, nextCountryId, headers, PAYLOAD_API_URL);
            }
          } else if (nextCountry) {
            toDestinationId = await lookupDestinationByCountry(nextCountry, destinationCache, headers, PAYLOAD_API_URL);
          }
          break;
        }
      }
    }

    const slug = generateSlug(from + '-to-' + to);

    let mode = 'road';
    if (type === 'flight') mode = 'flight';
    if (type === 'boat') mode = 'boat';
    if (type === 'helicopter') mode = 'helicopter';

    try {
      let routeId = routeMap.get(slug) || null;

      if (!routeId) {
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

          await fetch(`${PAYLOAD_API_URL}/api/transfer-routes/${routeId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              airlines: updatedAirlines,
              ...(fromPropertyId && !existingRoute.fromProperty ? { fromProperty: fromPropertyId } : {}),
              ...(toPropertyId && !existingRoute.toProperty ? { toProperty: toPropertyId } : {}),
              ...(fromAirportId && !existingRoute.fromAirport ? { fromAirport: fromAirportId } : {}),
              ...(toAirportId && !existingRoute.toAirport ? { toAirport: toAirportId } : {}),
              ...(fromDestinationId && !existingRoute.fromDestination ? { fromDestination: fromDestinationId } : {}),
              ...(toDestinationId && !existingRoute.toDestination ? { toDestination: toDestinationId } : {}),
            }),
          });
          console.log(`[linkTransferRoutes] UPDATED airlines: ${from} -> ${to}`);

          pendingTransferObs.push({
            routeId,
            slug,
            departureTime: segment.departureTime || null,
            arrivalTime: segment.arrivalTime || null,
            airline: segment.airline || null,
            dateObserved: new Date().toISOString().slice(0, 10),
          });

        } else {
          const airlineName = segment.airline || null;
          const createRes = await fetch(`${PAYLOAD_API_URL}/api/transfer-routes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              from,
              to,
              slug,
              mode,
              fromProperty: fromPropertyId,
              toProperty: toPropertyId,
              fromAirport: fromAirportId,
              toAirport: toAirportId,
              fromDestination: fromDestinationId,
              ...(toDestinationId ? { toDestination: toDestinationId } : {}),
              airlines: airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : [],
              observations: [],
              observationCount: 0,
            }),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            routeId = created.doc?.id || created.id;
            routeMap.set(slug, routeId);
            console.log(`[linkTransferRoutes] CREATED: ${from} -> ${to} (${routeId})`);
            pendingTransferObs.push({
              routeId,
              slug,
              departureTime: segment.departureTime || null,
              arrivalTime: segment.arrivalTime || null,
              airline: segment.airline || null,
              dateObserved: new Date().toISOString().slice(0, 10),
            });
          } else {
            const errText = await createRes.text();
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
                  pendingTransferObs.push({
                    routeId,
                    slug,
                    departureTime: segment.departureTime || null,
                    arrivalTime: segment.arrivalTime || null,
                    airline: segment.airline || null,
                    dateObserved: new Date().toISOString().slice(0, 10),
                  });
                  console.log(`[linkTransferRoutes] LINKED (after conflict): ${from} -> ${to}`);
                }
              }
            }
            if (!routeId) {
              console.error(`[linkTransferRoutes] Failed to create ${from} -> ${to}: ${createRes.status}`);
            }
          }
        }
      }

      if (routeId) {
        transferSequence.push({
          route: routeId,
          afterProperty: propertyOrderIndex,
          mode,
        });
      }

    } catch (err) {
      console.error(`[linkTransferRoutes] Error for ${from} -> ${to}:`, err.message);
    }
  }

  console.log(`[linkTransferRoutes] Total routes: ${routeMap.size}, pending obs: ${pendingTransferObs.length}`);
  return { routeMap, transferSequence, pendingTransferObs };
}

/**
 * Creates or updates Activity records for each service/activity segment.
 * Skips activities where classifyActivity() returns 'other' (those go to linkServiceItems).
 * Sets observationCount: 0 on create (handler.js increments to 1).
 * Applies bookingBehaviour defaults on create.
 *
 * @param {Array} segments - Presentation segments in chronological order
 * @param {Map<string, string>} propertyMap - accommodationName -> propertyId
 * @param {Map<string, string|null>} destinationCache - Country -> destinationId cache
 * @returns {Promise<{ activityMap: Map, pendingActivityObs: Array }>}
 */
async function linkActivities(segments, propertyMap, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const headers = {
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const activityMap = new Map();
  const slugCache = new Map();
  const activityPropertyLinks = new Map();
  const pendingActivityObs = [];

  let currentPropertyId = null;
  let currentDestinationId = null;   // Resolved destination for current stay block
  let currentCountry = null;         // Raw country string (kept for logging)

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();

    if (type === 'stay' || type === 'accommodation') {
      const name = segment.name || segment.title || segment.supplierName;
      currentPropertyId = name ? (propertyMap.get(name) || null) : null;
      currentCountry = segment.country || segment.countryName || null;

      // Resolve destination for this stay block — used by all subsequent activity segments
      const locationString = segment.location || segment.locationName || null;
      const country = segment.country || segment.countryName || null;
      if (locationString && country) {
        const countryId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
        currentDestinationId = countryId
          ? await resolveLocationToDestination(locationString, countryId, headers, PAYLOAD_API_URL)
          : null;
      } else if (country) {
        currentDestinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
      } else {
        currentDestinationId = null;
      }
      continue;
    }

    if (type !== 'service' && type !== 'activity') continue;

    const activityName = segment.name || segment.title;
    if (!activityName) continue;

    const activityType = classifyActivity(activityName);

    // Skip 'other' — those go to linkServiceItems()
    if (activityType === 'other') continue;

    const destinationId = currentDestinationId || null;
    const slug = generateSlug(activityName);

    try {
      let activityId = activityMap.get(slug) || null;

      if (!activityId) {
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
              destinations: updatedDestinations,
              properties: updatedProperties,
            }),
          });
          console.log(`[linkActivities] UPDATED: ${activityName}`);
          activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
          pendingActivityObs.push({ activityId, slug: activityName });

        } else {
          const bookingDefaults = getActivityBookingDefaults(activityType);

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
          });

          if (createRes.ok) {
            const created = await createRes.json();
            activityId = created.doc?.id || created.id;
            activityMap.set(slug, activityId);
            activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
            pendingActivityObs.push({ activityId, slug: activityName });
            console.log(`[linkActivities] CREATED: ${activityName} -> ${activityId}`);
          } else {
            const errText = await createRes.text();
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
                  activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
                  pendingActivityObs.push({ activityId, slug: activityName });
                  console.log(`[linkActivities] LINKED (after conflict): ${activityName}`);
                }
              }
            }
            if (!activityId) {
              console.error(`[linkActivities] Failed to create ${activityName}: ${createRes.status}`);
            }
          }
        }

      } else {
        // Already seen this activity in this itinerary — link additional property if needed
        if (currentPropertyId) {
          const linked = activityPropertyLinks.get(slug) || new Set();
          if (!linked.has(currentPropertyId)) {
            try {
              const actRes = await fetch(
                `${PAYLOAD_API_URL}/api/activities/${activityId}?depth=0`,
                { headers }
              );
              if (actRes.ok) {
                const existingAct = await actRes.json();
                const existingProps = (existingAct.properties || []).map(p => typeof p === 'object' ? p.id : p);
                if (!existingProps.includes(currentPropertyId)) {
                  await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ properties: [...existingProps, currentPropertyId] }),
                  });
                }
                linked.add(currentPropertyId);
                activityPropertyLinks.set(slug, linked);
              }
            } catch (err) {
              console.error(`[linkActivities] Additional property link failed for ${activityName}: ${err.message}`);
            }
          }
        }
      }

    } catch (err) {
      console.error(`[linkActivities] Error for ${activityName}:`, err.message);
    }
  }

  console.log(`[linkActivities] Total activities: ${activityMap.size}`);
  return { activityMap, pendingActivityObs };
}

/**
 * Creates or looks up Airport records for all point/entry/exit segments.
 * @param {Array} segments
 * @param {object} headers
 * @param {string} PAYLOAD_API_URL
 * @returns {Promise<Map>} airportMap: iataCode (uppercase) or slug -> airportId
 */
async function linkAirports(segments, headers, PAYLOAD_API_URL) {
  const airportMap = new Map();
  const processedKeys = new Set();
  const airportSegmentTypes = new Set(['point', 'entry', 'exit']);

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();
    if (!airportSegmentTypes.has(type)) continue;

    const airportName = segment.title || segment.name || segment.supplierName || segment.location;
    const iataCode = segment.locationCode ? segment.locationCode.toUpperCase() : null;
    const countryCode = segment.countryCode || null;

    if (!airportName) continue;

    const lookupKey = iataCode || generateSlug(airportName);
    if (processedKeys.has(lookupKey)) continue;
    processedKeys.add(lookupKey);

    let airportId = null;

    // 1. Lookup by IATA code
    if (iataCode) {
      try {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/airports?where[iataCode][equals]=${encodeURIComponent(iataCode)}&limit=1`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.docs?.[0]?.id) {
            airportId = data.docs[0].id;
            await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
              method: 'PATCH',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
            });
            console.log(`[linkAirports] FOUND by IATA: ${iataCode} -> ${airportId}`);
          }
        }
      } catch (err) {
        console.error(`[linkAirports] IATA lookup failed for ${iataCode}: ${err.message}`);
      }
    }

    // 2. Lookup by slug
    if (!airportId) {
      const airportSlug = generateSlug(airportName);
      try {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(airportSlug)}&limit=1`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.docs?.[0]?.id) {
            airportId = data.docs[0].id;
            await fetch(`${PAYLOAD_API_URL}/api/airports/${airportId}`, {
              method: 'PATCH',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ observationCount: (data.docs[0].observationCount || 0) + 1 }),
            });
            console.log(`[linkAirports] FOUND by slug: ${airportSlug} -> ${airportId}`);
          }
        }
      } catch (err) {
        console.error(`[linkAirports] Slug lookup failed for ${airportSlug}: ${err.message}`);
      }
    }

    // 3. Create airport
    if (!airportId) {
      const countryId = countryCode ? (COUNTRY_CODE_TO_ID[countryCode.toUpperCase()] || null) : null;
      const airportSlug = generateSlug(airportName);
      const airportType = classifyAirportType(airportName, iataCode);
      const serviceDefaults = getAirportServicesDefaults(airportType);

      // Resolve nearest destination from location string
      const locationForResolution = segment.location || segment.city || null;
      const nearestDestId = locationForResolution
        ? await resolveLocationToDestination(locationForResolution, countryId, headers, PAYLOAD_API_URL)
        : countryId;

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
            nearestDestination: nearestDestId,
            services: serviceDefaults,
            observationCount: 1,
          }),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          airportId = created.doc?.id || created.id;
          console.log(`[linkAirports] CREATED: ${airportName} (${iataCode || 'no IATA'}) -> ${airportId}`);
        } else {
          const errText = await createRes.text();
          if (createRes.status === 400 && errText.includes('unique')) {
            const retrySlug = generateSlug(airportName);
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/airports?where[slug][equals]=${encodeURIComponent(retrySlug)}&limit=1`,
              { headers }
            );
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.docs?.[0]?.id) {
                airportId = retryData.docs[0].id;
                console.log(`[linkAirports] LINKED after conflict: ${airportName} -> ${airportId}`);
              }
            }
          }
          if (!airportId) {
            console.error(`[linkAirports] FAILED: ${airportName}: ${createRes.status} — ${errText.slice(0, 200)}`);
          }
        }
      } catch (err) {
        console.error(`[linkAirports] Create failed for ${airportName}: ${err.message}`);
      }
    }

    if (airportId) {
      airportMap.set(lookupKey, airportId);
      // Also store under slug key when primary key is IATA, so transfer route lookups by name work
      if (iataCode) {
        const slugKey = generateSlug(airportName);
        if (slugKey !== lookupKey) {
          airportMap.set(slugKey, airportId);
        }
      }
    }
  }

  console.log(`[linkAirports] Total airports: ${airportMap.size}`);
  return airportMap;
}

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
  const serviceItemMap = new Map();  // slug -> serviceItemId
  const slugCache = new Map();
  const pendingServiceItemObs = [];

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();
    if (type !== 'service' && type !== 'activity') continue;

    const serviceName = segment.name || segment.title;
    if (!serviceName) continue;

    // Only process segments that classifyActivity() cannot classify
    const activityType = classifyActivity(serviceName);
    if (activityType !== 'other') continue;

    const slug = generateSlug(serviceName);
    if (serviceItemMap.has(slug)) {
      pendingServiceItemObs.push({ serviceItemId: serviceItemMap.get(slug), slug: serviceName });
      continue;
    }

    try {
      // 1. Lookup by slug
      let serviceItemId = null;
      let existingItem = slugCache.get(slug) || null;
      if (!existingItem) {
        const res = await fetch(
          `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          existingItem = data.docs?.[0] || null;
          if (existingItem) slugCache.set(slug, existingItem);
        }
      }

      if (existingItem) {
        serviceItemId = existingItem.id;
        // Increment observationCount
        await fetch(`${PAYLOAD_API_URL}/api/service-items/${serviceItemId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ observationCount: (existingItem.observationCount || 0) + 1 }),
        });
        console.log(`[linkServiceItems] FOUND: ${serviceName} -> ${serviceItemId}`);

      } else {
        // 2. Create
        const { category, serviceDirection, serviceLevel } = classifyServiceItem(serviceName);

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
        });

        if (createRes.ok) {
          const created = await createRes.json();
          serviceItemId = created.doc?.id || created.id;
          console.log(`[linkServiceItems] CREATED: ${serviceName} -> ${serviceItemId}`);
        } else {
          const errText = await createRes.text();
          if (createRes.status === 400 && errText.includes('unique')) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/service-items?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
              { headers }
            );
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.docs?.[0]?.id) {
                serviceItemId = retryData.docs[0].id;
                console.log(`[linkServiceItems] LINKED after conflict: ${serviceName} -> ${serviceItemId}`);
              }
            }
          }
          if (!serviceItemId) {
            console.error(`[linkServiceItems] FAILED: ${serviceName}: ${createRes.status}`);
          }
        }
      }

      if (serviceItemId) {
        serviceItemMap.set(slug, serviceItemId);
        pendingServiceItemObs.push({ serviceItemId, slug: serviceName });
      }

    } catch (err) {
      console.error(`[linkServiceItems] Error for ${serviceName}: ${err.message}`);
    }
  }

  console.log(`[linkServiceItems] Total service items: ${serviceItemMap.size}`);
  return { serviceItemMap, pendingServiceItemObs };
}

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
      `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(countryName)}&limit=1&draft=true`,
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

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Extract countries from segments
 */
function extractCountries(segments) {
  const countries = new Set();

  for (const segment of segments) {
    if (segment.country) countries.add(segment.country);
    if (segment.countryName) countries.add(segment.countryName);
  }

  return Array.from(countries).filter(c => c && !c.toLowerCase().includes('unknown'));
}

/**
 * Extract highlights from segments
 * Note: iTrvl data has name=null, property name is in title or supplierName
 */
function extractHighlights(segments) {
  const highlights = [];

  for (const segment of segments) {
    if (segment.type === 'stay' || segment.type === 'accommodation') {
      const propertyName = segment.name || segment.title || segment.supplierName;
      if (propertyName) {
        highlights.push(propertyName);
      }
    }
  }

  return [...new Set(highlights)].slice(0, 8);
}

/**
 * Calculate total nights
 */
function calculateNights(segments, rawItinerary) {
  if (rawItinerary?.nights) return rawItinerary.nights;

  let nights = 0;
  for (const segment of segments) {
    if ((segment.type === 'stay' || segment.type === 'accommodation') && segment.nights) {
      nights += segment.nights;
    }
  }

  return nights || 7;
}

/**
 * Group segments by day using startDate calculation
 * @param {Array} segments - Raw segments from iTrvl
 * @param {string} itineraryStartDate - Trip start date (e.g., "2026-06-14")
 */
function groupSegmentsByDay(segments, itineraryStartDate) {
  const dayMap = new Map();

  // Parse itinerary start date (midnight UTC to avoid timezone issues)
  let tripStart = null;
  if (itineraryStartDate) {
    tripStart = new Date(itineraryStartDate.slice(0, 10) + 'T00:00:00Z');
  }

  for (const segment of segments) {
    let dayNum = 1; // Default to day 1

    // Calculate day number from startDate relative to trip start
    if (segment.startDate && tripStart) {
      const segDate = new Date(segment.startDate.slice(0, 10) + 'T00:00:00Z');
      const diffMs = segDate.getTime() - tripStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      dayNum = Math.max(1, diffDays + 1); // Day 1 = first day, ensure at least 1
    }

    if (!dayMap.has(dayNum)) {
      // Use segment startDate, or itinerary startDate for Day 1 as fallback
      let dayDate = null;
      if (segment.startDate) {
        dayDate = segment.startDate.slice(0, 10);
      } else if (dayNum === 1 && itineraryStartDate) {
        dayDate = itineraryStartDate.slice(0, 10);
      }

      dayMap.set(dayNum, {
        dayNumber: dayNum,
        date: dayDate,
        title: null,
        location: null,
        segments: []
      });
    }

    const day = dayMap.get(dayNum);

    // Collect location from any segment
    if (!day.location && (segment.location || segment.locationName)) {
      day.location = segment.location || segment.locationName;
    }

    day.segments.push(segment);
  }

  // Second pass: Generate titles for all days
  const dayArray = Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);

  for (const day of dayArray) {
    day.title = generateDayTitle(day);
  }

  return dayArray;
}

/**
 * Generate a title for a day based on its segments
 * Priority:
 * 1. If day has stay segment -> use accommodation name
 * 2. If day has activity only -> use location + first activity
 * 3. Fallback -> "Day {n} - {location}" or "Day {n}"
 *
 * @param {Object} day - Day object with dayNumber, location, segments
 * @returns {string} Generated title
 */
function generateDayTitle(day) {
  const { dayNumber, location, segments } = day;

  // Check for stay segment first
  const staySegment = segments.find(s =>
    s.type === 'stay' || s.type === 'accommodation'
  );

  if (staySegment) {
    const accommodationName = staySegment.name || staySegment.title || staySegment.supplierName;
    if (accommodationName) {
      return accommodationName;
    }
  }

  // Check for activity segments
  const activitySegment = segments.find(s =>
    s.type === 'service' || s.type === 'activity'
  );

  if (activitySegment) {
    const activityName = activitySegment.name || activitySegment.title;
    if (activityName && location) {
      return `${location} - ${activityName}`;
    }
    if (activityName) {
      return activityName;
    }
  }

  // Check for significant transfer (entry/exit points often have meaningful names)
  const transferSegment = segments.find(s =>
    s.type === 'entry' || s.type === 'exit' || s.type === 'flight'
  );

  if (transferSegment) {
    const transferTitle = transferSegment.name || transferSegment.title;
    if (transferTitle && !transferTitle.toLowerCase().includes('transfer')) {
      return transferTitle;
    }
  }

  // Fallback: Use location if available
  if (location) {
    return `Day ${dayNumber} - ${location}`;
  }

  // Final fallback
  return `Day ${dayNumber}`;
}

/**
 * Convert plain text to Lexical richText format
 */
function textToRichText(text) {
  if (!text) return null;

  return {
    root: {
      children: [
        {
          children: [
            { text: text, type: 'text' }
          ],
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  };
}

/**
 * Map segment to V6 block format
 * Uses *Original fields - enhanced versions added later
 */
function mapSegmentToBlock(segment, mediaMapping = {}, propertyMap) {
  const type = segment.type?.toLowerCase();

  let blockType = null;
  if (type === 'stay' || type === 'accommodation') {
    blockType = 'stay';
  } else if (type === 'service' || type === 'activity') {
    blockType = 'activity';
  } else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' || type === 'helicopter' || type === 'entry' || type === 'exit' || type === 'point') {
    blockType = 'transfer';
  } else {
    // Log unknown segment types for debugging
    console.log(`[Transform] Unknown segment type: ${type}, skipping`);
    return null;
  }

  // Get image IDs (will be populated after image processing)
  const imageIds = [];
  if (segment.images && Array.isArray(segment.images)) {
    for (const img of segment.images) {
      const s3Key = typeof img === 'string' ? img : img.s3Key || img.key;
      if (s3Key && mediaMapping[s3Key]) {
        imageIds.push(mediaMapping[s3Key]);
      }
    }
  }

  if (blockType === 'stay') {
    const accommodationName = segment.name || segment.title || 'Accommodation';
    const inclusionsText = segment.clientIncludeExclude || segment.inclusions || segment.included;

    return {
      blockType: 'stay',
      // V7 two-field pattern for accommodationName
      accommodationName: accommodationName,
      accommodationNameItrvl: accommodationName,
      accommodationNameEnhanced: null,
      accommodationNameReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      nights: segment.nights || 1,
      location: segment.location || segment.locationName || null,
      country: segment.country || segment.countryName || null,
      images: imageIds,
      imagesReviewed: false,
      // V7 two-field pattern for inclusions
      inclusionsItrvl: textToRichText(inclusionsText),
      inclusionsEnhanced: null,
      inclusionsReviewed: false,
      roomType: segment.roomType || null,
      property: propertyMap?.get(accommodationName) || null,
    };
  }

  if (blockType === 'activity') {
    const activityTitle = segment.name || segment.title || 'Activity';

    return {
      blockType: 'activity',
      // V7 two-field pattern for title
      title: activityTitle,
      titleItrvl: activityTitle,
      titleEnhanced: null,
      titleReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      images: imageIds,
      imagesReviewed: false,
    };
  }

  if (blockType === 'transfer') {
    // Map segment type to transfer type (including entry/exit/point)
    let transferType = 'road';
    if (type === 'flight') transferType = 'flight';
    if (type === 'boat') transferType = 'boat';
    if (type === 'helicopter') transferType = 'helicopter';
    if (type === 'entry') transferType = 'entry';
    if (type === 'exit') transferType = 'exit';
    if (type === 'point') transferType = 'point';

    // Build title for entry/exit/point segments
    let title = segment.name || segment.title || segment.description || 'Transfer';
    if (type === 'entry' || type === 'exit' || type === 'point') {
      // These segments often have location info in travelHubCode or transitPointCode
      const locationCode = segment.travelHubCode || segment.transitPointCode || '';
      if (locationCode && !title.includes(locationCode)) {
        title = `${title} (${locationCode})`.trim();
      }
    }

    // Extract 'to' destination from multiple sources
    let toDestination = segment.endLocation?.name || segment.to || null;

    // If no direct 'to', try to parse from title
    if (!toDestination && title) {
      // Common patterns: "Transfer to X", "Flight to X", "Drive to X"
      const toMatch = title.match(/(?:transfer|flight|drive|road)\s+to\s+([^,\-]+)/i);
      if (toMatch) {
        toDestination = toMatch[1].trim();
      }
      // Also try "X to Y" pattern
      if (!toDestination) {
        const fromToMatch = title.match(/\bto\s+([^,\-]+)$/i);
        if (fromToMatch) {
          toDestination = fromToMatch[1].trim();
        }
      }
    }

    // If still no 'to', check transitPointCode or travelHubCode for exit segments
    if (!toDestination && type === 'exit') {
      toDestination = segment.travelHubCode || segment.transitPointCode || null;
    }

    return {
      blockType: 'transfer',
      type: transferType,
      // V7 two-field pattern for title
      title: title,
      titleItrvl: title,
      titleEnhanced: null,
      titleReviewed: false,
      from: segment.startLocation?.name || segment.from || segment.location || null,
      to: toDestination,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      departureTime: segment.departureTime || null,
      arrivalTime: segment.arrivalTime || null,
    };
  }

  return null;
}

/**
 * Generate FAQ items (V7 format with two-field pattern)
 * - question: the display title
 * - questionItrvl: original scraped question (same as question initially)
 * - questionEnhanced: enhanced version (null initially)
 * - answerItrvl: original scraped answer
 * - answerEnhanced: enhanced version (null initially)
 */
function generateFaqItems(segments, title, countries) {
  const faqItems = [];

  // Helper to create a FAQ item with proper V7 two-field pattern
  const createFaqItem = (question, answerText) => ({
    question,
    questionItrvl: question,
    questionEnhanced: null,
    questionReviewed: false,
    answerItrvl: textToRichText(answerText),
    answerEnhanced: null,
    answerReviewed: false,
    reviewed: false,
  });

  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  for (const stay of stays.slice(0, 3)) {
    const propertyName = stay.name || stay.title || stay.supplierName;
    if (propertyName) {
      faqItems.push(createFaqItem(
        `What is included at ${propertyName}?`,
        stay.clientIncludeExclude || stay.inclusions || stay.description ||
        `${propertyName} offers luxury accommodation with full board and activities as specified in the itinerary.`
      ));
    }
  }

  const countryList = countries.length > 0 ? countries.join(' and ') : 'East Africa';

  faqItems.push(createFaqItem(
    `What is the best time to visit ${countryList}?`,
    `${countryList} offers excellent wildlife viewing year-round. Our travel designers can advise on the optimal timing based on your specific interests.`
  ));

  faqItems.push(createFaqItem(
    'What level of fitness is required for this safari?',
    'This safari is suitable for most fitness levels. Game drives involve sitting in comfortable vehicles, and bush walks can be adjusted to your pace.'
  ));

  faqItems.push(createFaqItem(
    'Is this safari suitable for children?',
    'Family safaris are a specialty. Some lodges have age restrictions for certain activities, but we can customize the itinerary for travelers of all ages.'
  ));

  faqItems.push(createFaqItem(
    'What should I pack for this safari?',
    'We recommend neutral-colored clothing, comfortable walking shoes, sun protection, binoculars, and a camera. A detailed packing list will be provided upon booking.'
  ));

  return faqItems;
}

/**
 * Generate meta fields
 */
function generateMetaFields(title, nights, countries) {
  const countryList = countries.length > 0 ? countries.join(' & ') : 'Africa';
  const metaTitle = `${title} | ${nights}-Night Luxury Safari`.trim().substring(0, 60);
  const metaDescription = `Experience a ${nights}-night luxury safari through ${countryList}. Exclusive lodges, expert guides, and unforgettable wildlife encounters. Inquire with Kiuli today.`.substring(0, 160);

  return { metaTitle, metaDescription };
}

/**
 * Generate investmentLevel.includes by aggregating inclusions from all stay segments
 * Creates a summary of what's included across all accommodations
 *
 * @param {Array} segments - Raw segments from iTrvl
 * @param {number} nights - Total nights
 * @returns {string} Summary text of inclusions
 */
function generateInvestmentIncludes(segments, nights) {
  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');

  // Collect unique inclusions from all stays
  const allInclusions = new Set();
  const accommodationNames = [];

  for (const stay of stays) {
    if (stay.name || stay.title) {
      accommodationNames.push(stay.name || stay.title);
    }

    // Get inclusions from clientIncludeExclude or other fields
    const inclusionsText = stay.clientIncludeExclude || stay.inclusions || stay.included || '';
    if (inclusionsText) {
      // Parse common inclusion items
      const text = inclusionsText.toLowerCase();
      if (text.includes('meal') || text.includes('breakfast') || text.includes('dinner') || text.includes('full board')) {
        allInclusions.add('all meals');
      }
      if (text.includes('drink') || text.includes('beverage') || text.includes('wine') || text.includes('beer')) {
        allInclusions.add('premium beverages');
      }
      if (text.includes('game drive') || text.includes('safari')) {
        allInclusions.add('daily game drives');
      }
      if (text.includes('transfer') || text.includes('transport')) {
        allInclusions.add('all transfers');
      }
      if (text.includes('park fee') || text.includes('conservation')) {
        allInclusions.add('park fees');
      }
      if (text.includes('laundry')) {
        allInclusions.add('laundry service');
      }
      if (text.includes('wifi') || text.includes('wi-fi')) {
        allInclusions.add('WiFi');
      }
    }
  }

  // Build summary text
  const parts = [];

  // Accommodation summary
  if (accommodationNames.length > 0) {
    const uniqueNames = [...new Set(accommodationNames)];
    parts.push(`${nights} nights at ${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ' and more' : ''}`);
  }

  // Inclusions summary
  if (allInclusions.size > 0) {
    const inclusionsList = Array.from(allInclusions).slice(0, 5);
    parts.push(inclusionsList.join(', '));
  }

  // Default inclusions if none found
  if (parts.length === 0) {
    return `Luxury accommodation for ${nights} nights with full board, game activities, and expert guiding throughout your safari experience.`;
  }

  return parts.join('. ') + '.';
}

/**
 * Main transform function
 */
async function transform(rawData, mediaMapping = {}, itrvlUrl) {
  console.log('[Transform] Starting V6 transformation');

  const itinerary = rawData.itinerary?.itineraries?.[0] ||
                    rawData.itinerary ||
                    rawData;

  const segments = itinerary.segments || [];
  const title = (itinerary.name || itinerary.itineraryName || 'Safari Itinerary').trim();
  const priceInCents = rawData.price || itinerary.sellFinance || 0;
  const itineraryId = itinerary.id || rawData.itineraryId;

  console.log(`[Transform] Processing: ${title}`);
  console.log(`[Transform] Segments: ${segments.length}`);

  const slug = generateSlug(title);
  const nights = calculateNights(segments, itinerary);
  const countries = extractCountries(segments);
  const highlights = extractHighlights(segments);

  console.log(`[Transform] Nights: ${nights}, Countries: ${countries.join(', ')}`);

  const groupedDays = groupSegmentsByDay(segments, itinerary.startDate);

  const faqItems = generateFaqItems(segments, title, countries);
  const { metaTitle, metaDescription } = generateMetaFields(title, nights, countries);
  const investmentIncludes = generateInvestmentIncludes(segments, nights);

  // 1. Link destinations (countries)
  const countriesForLinking = countries.map(c => ({ country: c }));
  const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking);

  // 2. Link properties (uses resolveLocationToDestination, returns regionIds)
  const { propertyMap, regionIds } = await linkProperties(segments, destinationIds, destinationCache);

  // 3. Link airports (new — must run before linkTransferRoutes)
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;
  const _headers = { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` };
  const airportMap = await linkAirports(segments, _headers, PAYLOAD_API_URL);

  // 4. Link transfer routes (updated signature: propertyMap and airportMap added)
  const { routeMap: transferRouteMap, transferSequence, pendingTransferObs } =
    await linkTransferRoutes(segments, destinationCache, propertyMap, airportMap);

  // 5. Link activities (skips 'other', adds bookingBehaviour defaults)
  const { activityMap, pendingActivityObs: pendingActivityObsList } =
    await linkActivities(segments, propertyMap, destinationCache);

  // 6. Link service items (new — segments where classifyActivity returns 'other')
  const { serviceItemMap, pendingServiceItemObs } =
    await linkServiceItems(segments, propertyMap, airportMap, destinationCache, _headers, PAYLOAD_API_URL);

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
  };

  const days = groupedDays.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    // V7 two-field pattern for day title
    titleItrvl: day.title,
    titleEnhanced: null,
    titleReviewed: false,
    location: day.location,
    segments: day.segments
      .map(s => mapSegmentToBlock(s, mediaMapping, propertyMap))
      .filter(Boolean)
  }));

  const transformed = {
    // Basic - V7 two-field pattern
    title,
    titleItrvl: title,
    titleEnhanced: null,
    titleReviewed: false,
    slug,
    itineraryId,

    // SEO - V7 two-field pattern
    metaTitle,
    metaTitleItrvl: metaTitle,
    metaTitleEnhanced: null,
    metaTitleReviewed: false,
    metaDescription,
    metaDescriptionItrvl: metaDescription,
    metaDescriptionEnhanced: null,
    metaDescriptionReviewed: false,

    // Overview with V7 *Itrvl fields
    overview: {
      summaryItrvl: textToRichText(itinerary.summary || itinerary.description || `A ${nights}-night luxury safari through ${countries.join(' and ')}.`),
      summaryEnhanced: null,
      summaryReviewed: false,
      nights,
      countries: countries.map(c => ({ country: c })),
      highlights: highlights.map(h => ({ highlight: h })),
    },

    // Destinations (linked from countries)
    destinations: destinationIds,

    // Investment
    investmentLevel: {
      fromPrice: Math.round(priceInCents / 100),
      currency: 'USD',
      includesItrvl: textToRichText(investmentIncludes),
      includesEnhanced: null,
      includesReviewed: false,
    },

    // Structured days
    days,

    // FAQ with V6 format
    faqItems,

    // Why Kiuli (V6 format)
    whyKiuliItrvl: textToRichText('Kiuli delivers exceptional safari experiences with expert local knowledge, exclusive access, and personalized service that turns your African dream into reality.'),
    whyKiuliEnhanced: null,
    whyKiuliReviewed: false,

    // Images (populated after image processing)
    images: Object.values(mediaMapping),

    // Source
    source: {
      itrvlUrl,
      lastScrapedAt: new Date().toISOString(),
      // Note: rawData removed to avoid payload size issues (was causing 413 errors)
      // Raw data available in iTrvl via itrvlUrl if needed
    },

    // Build info
    buildTimestamp: new Date().toISOString(),
    _status: 'draft',

    // Internal fields for handler.js — stripped before Payload save
    _propertyIds: [...new Set(propertyMap.values())],
    _knowledgeBase,
  };

  console.log(`[Transform] Complete: ${days.length} days, ${faqItems.length} FAQs`);

  return transformed;
}

module.exports = { transform, generateSlug, textToRichText };
