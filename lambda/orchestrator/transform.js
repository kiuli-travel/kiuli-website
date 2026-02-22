/**
 * Transform Logic for V6 Pipeline
 *
 * Converts scraped data to V6 schema format
 * Uses *Original fields for scraped content (enhancement comes later)
 */

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

    const url = `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(country)}&limit=1`;
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
 * @param {Array} segments - Raw segments from iTrvl
 * @param {string[]} destinationIds - Destination IDs returned by linkDestinations()
 * @returns {Promise<Map<string, number|string>>} Map of accommodation name → Property ID
 */
async function linkProperties(segments, destinationIds, destinationCache) {
  const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'http://localhost:3000';
  const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

  const propertyMap = new Map(); // accommodationName → propertyId
  const slugMap = new Map(); // slug → propertyId (dedup within this run)

  if (!PAYLOAD_API_KEY) {
    console.error('[linkProperties] PAYLOAD_API_KEY not set');
    return propertyMap;
  }

  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  if (stays.length === 0) {
    console.log('[linkProperties] No stay segments to process');
    return propertyMap;
  }

  const headers = { 'Authorization': `users API-Key ${PAYLOAD_API_KEY}` };

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
    if (propertyMap.has(accommodationName)) continue; // Already processed this name

    const slug = generateSlug(accommodationName);
    if (slugMap.has(slug)) {
      propertyMap.set(accommodationName, slugMap.get(slug));
      continue; // Already created/found by slug
    }

    try {
      // 1. Check PropertyNameMappings aliases
      let propertyId = null;
      for (const mapping of nameMappings) {
        const aliases = Array.isArray(mapping.aliases) ? mapping.aliases : [];
        const match = aliases.some(a => a.toLowerCase() === accommodationName.toLowerCase());
        if (match) {
          propertyId = typeof mapping.property === 'object' ? mapping.property.id : mapping.property;
          console.log(`[linkProperties] ALIAS MATCH: ${accommodationName} -> ${propertyId} (via mapping)`);
          break;
        }
      }

      // 2. Query Properties by slug
      if (!propertyId) {
        const slugRes = await fetch(
          `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
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
        // Resolve destination for this stay — use cache first
        let destinationId = null;
        const country = stay.country || stay.countryName;
        if (country && destinationCache) {
          destinationId = await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL);
        } else if (country) {
          const destRes = await fetch(
            `${PAYLOAD_API_URL}/api/destinations?where[name][equals]=${encodeURIComponent(country)}&limit=1`,
            { headers }
          );
          if (destRes.ok) {
            const destData = await destRes.json();
            if (destData.docs?.[0]?.id) {
              destinationId = destData.docs[0].id;
            }
          }
        }
        // Fallback: use first destination from the itinerary
        if (!destinationId && destinationIds.length > 0) {
          destinationId = destinationIds[0];
        }

        const descriptionText = stay.description || stay.clientIncludeExclude || null;

        const createRes = await fetch(`${PAYLOAD_API_URL}/api/properties`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: accommodationName,
            slug,
            destination: destinationId,
            description_itrvl: descriptionText,
            externalIds: {
              itrvlSupplierCode: stay.supplierCode || null,
              itrvlPropertyName: accommodationName,
            },
            canonicalContent: {
              contactEmail: stay.notes?.contactEmail || null,
              contactPhone: stay.notes?.contactNumber || null,
            },
            _status: 'draft',
          }),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          propertyId = created.doc?.id || created.id;
          console.log(`[linkProperties] CREATED: ${accommodationName} -> ${propertyId}`);
        } else {
          const errText = await createRes.text();
          // Handle slug uniqueness conflict — property may already exist
          if (createRes.status === 400 && errText.includes('unique')) {
            const retryRes = await fetch(
              `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
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
            console.error(`[linkProperties] Failed to create ${accommodationName}: ${createRes.status} - ${errText}`);
          }
        }
      }

      // 4. Backfill supplierCode on existing records without it
      if (propertyId && !propertyId.__backfilled) {
        try {
          const existingRes = await fetch(
            `${PAYLOAD_API_URL}/api/properties/${propertyId}?depth=0`,
            { headers }
          );
          if (existingRes.ok) {
            const existing = await existingRes.json();
            const existingExternalIds = existing.externalIds || {};
            if (!existingExternalIds.itrvlSupplierCode && (stay.supplierCode || stay.notes?.contactEmail)) {
              const mergedExternalIds = {
                ...existingExternalIds,
                ...(stay.supplierCode ? { itrvlSupplierCode: stay.supplierCode, itrvlPropertyName: accommodationName } : {}),
              };
              const existingCanonicalContent = existing.canonicalContent || {};
              const mergedCanonicalContent = {
                ...existingCanonicalContent,
                ...(stay.notes?.contactEmail && !existingCanonicalContent.contactEmail
                  ? { contactEmail: stay.notes.contactEmail } : {}),
                ...(stay.notes?.contactNumber && !existingCanonicalContent.contactPhone
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
              }
            }
          }
        } catch (err) {
          // Non-fatal — continue
          console.error(`[linkProperties] BACKFILL fetch failed for ${propertyId}: ${err.message}`);
        }
      }

      if (propertyId) {
        propertyMap.set(accommodationName, propertyId);
        slugMap.set(slug, propertyId);
      }
    } catch (err) {
      console.error(`[linkProperties] Error for ${accommodationName}:`, err.message);
    }
  }

  console.log(`[linkProperties] Total linked: ${propertyMap.size} properties`);
  return propertyMap;
}

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

  const routeMap = new Map();
  const slugLookupCache = new Map();
  const transferSequence = [];

  let propertyOrderIndex = 0;

  const transferTypes = new Set(['flight', 'road', 'boat']);

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

    const slug = generateSlug(from + '-to-' + to);

    let mode = 'road';
    if (type === 'flight') mode = 'flight';
    if (type === 'boat') mode = 'boat';

    const fromCountry = segment.country || segment.countryName || null;
    const fromDestinationId = fromCountry
      ? await lookupDestinationByCountry(fromCountry, destinationCache, headers, PAYLOAD_API_URL)
      : null;

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
              ...(fromDestinationId && !existingRoute.fromDestination
                ? { fromDestination: fromDestinationId }
                : {}),
            }),
          });
          console.log(`[linkTransferRoutes] UPDATED: ${from} → ${to} (${existingObs.length + 1} observations)`);

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
              fromDestination: fromDestinationId,
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

      if (routeId) {
        transferSequence.push({
          route: routeId,
          afterProperty: propertyOrderIndex,
          mode,
        });
      }

    } catch (err) {
      console.error(`[linkTransferRoutes] Error for ${from} → ${to}:`, err.message);
    }
  }

  console.log(`[linkTransferRoutes] Total routes: ${routeMap.size}, transfers in sequence: ${transferSequence.length}`);
  return { routeMap, transferSequence };
}

/**
 * Creates or updates Activity records for each service/activity segment.
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

  const activityMap = new Map();
  const slugCache = new Map();

  let currentPropertyId = null;
  let currentCountry = null;

  for (const segment of segments) {
    const type = segment.type?.toLowerCase();

    if (type === 'stay' || type === 'accommodation') {
      const name = segment.name || segment.title || segment.supplierName;
      currentPropertyId = name ? (propertyMap.get(name) || null) : null;
      currentCountry = segment.country || segment.countryName || null;
      continue;
    }

    if (type !== 'service' && type !== 'activity') continue;

    const activityName = segment.name || segment.title;
    if (!activityName) continue;

    const country = segment.country || segment.countryName || currentCountry;
    const destinationId = country
      ? await lookupDestinationByCountry(country, destinationCache, headers, PAYLOAD_API_URL)
      : null;

    const slug = generateSlug(activityName);
    const activityType = classifyActivity(activityName);

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
              observationCount: (existingActivity.observationCount || 0) + 1,
              destinations: updatedDestinations,
              properties: updatedProperties,
            }),
          });
          console.log(`[linkActivities] UPDATED: ${activityName} (${(existingActivity.observationCount || 0) + 1} observations)`);

        } else {
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
    }
  }

  console.log(`[linkActivities] Total activities: ${activityMap.size}`);
  return activityMap;
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
 * 1. If day has stay segment → use accommodation name
 * 2. If day has activity only → use location + first activity
 * 3. Fallback → "Day {n} - {location}" or "Day {n}"
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
  } else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' || type === 'entry' || type === 'exit' || type === 'point') {
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

  // Link to destination records based on extracted countries
  const countriesForLinking = countries.map(c => ({ country: c }));
  const { ids: destinationIds, cache: destinationCache } = await linkDestinations(countriesForLinking);

  // Link/create property records for stay segments
  const propertyMap = await linkProperties(segments, destinationIds, destinationCache);

  // Link transfer routes and activities
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
