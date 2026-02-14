import type { Payload } from 'payload'
import type { EntityMap, CountryEntity, LocationEntity, PropertyEntity } from './types'
import { normalize, extractId } from './utils'

const GENERIC_ACTIVITIES = new Set([
  'meet and assist',
  'meet & assist',
  'arrival',
  'departure',
  'check in',
  'check-in',
  'check out',
  'check-out',
  'transfer',
  'airport transfer',
  'road transfer',
  'flight',
  'domestic flight',
  'international flight',
  'free day',
  'day at leisure',
  'leisure',
  'rest day',
])

interface StayBlock {
  blockType: 'stay'
  accommodationNameItrvl?: string | null
  accommodationName?: string | null
  location?: string | null
  country?: string | null
  property?: unknown
}

interface ActivityBlock {
  blockType: 'activity'
  titleItrvl?: string | null
  title?: string | null
}

type SegmentBlock = StayBlock | ActivityBlock | { blockType: string }

interface DayData {
  dayNumber?: number
  location?: string | null
  segments?: SegmentBlock[] | null
}

interface CountryItem {
  country?: string | null
}

interface ItineraryData {
  overview?: {
    countries?: CountryItem[] | null
  } | null
  days?: DayData[] | null
}

/**
 * Extract entities deterministically from an itinerary.
 * Fetches the itinerary at depth 2 to resolve relationship objects.
 */
export async function extractEntities(
  payload: Payload,
  itineraryId: number,
): Promise<EntityMap> {
  const itinerary = (await payload.findByID({
    collection: 'itineraries',
    id: itineraryId,
    depth: 2,
    draft: true,
  })) as unknown as ItineraryData

  const countrySeen = new Map<string, CountryEntity>()
  const locationSeen = new Map<string, LocationEntity>()
  const propertySeen = new Map<string, PropertyEntity>()
  const activitySeen = new Set<string>()

  // Countries from overview.countries
  const overviewCountries = itinerary.overview?.countries || []
  for (const item of overviewCountries) {
    const name = item.country?.trim()
    if (!name) continue
    const key = normalize(name)
    if (!countrySeen.has(key)) {
      countrySeen.set(key, { name, normalized: key })
    }
  }

  // Walk days
  const days = itinerary.days || []
  const fallbackCountry = overviewCountries[0]?.country?.trim() || ''

  for (const day of days) {
    const dayLocation = day.location?.trim()

    for (const segment of day.segments || []) {
      if (segment.blockType === 'stay') {
        const stay = segment as StayBlock
        extractStay(stay, dayLocation, fallbackCountry, countrySeen, locationSeen, propertySeen)
      } else if (segment.blockType === 'activity') {
        const activity = segment as ActivityBlock
        extractActivity(activity, activitySeen)
      }
    }
  }

  return {
    countries: Array.from(countrySeen.values()),
    locations: filterLocationsThatAreCountries(
      Array.from(locationSeen.values()),
      countrySeen,
    ),
    properties: Array.from(propertySeen.values()),
    activities: Array.from(activitySeen),
  }
}

function extractStay(
  stay: StayBlock,
  dayLocation: string | undefined,
  fallbackCountry: string,
  countrySeen: Map<string, CountryEntity>,
  locationSeen: Map<string, LocationEntity>,
  propertySeen: Map<string, PropertyEntity>,
): void {
  const countryName = stay.country?.trim() || fallbackCountry
  if (countryName) {
    const key = normalize(countryName)
    if (!countrySeen.has(key)) {
      countrySeen.set(key, { name: countryName, normalized: key })
    }
  }

  const locationName = stay.location?.trim() || dayLocation
  if (locationName) {
    const key = normalize(locationName)
    if (!locationSeen.has(key)) {
      locationSeen.set(key, {
        name: locationName,
        normalized: key,
        country: countryName || fallbackCountry,
      })
    }
  }

  const propName = (stay.accommodationNameItrvl || stay.accommodationName || '').trim()
  if (propName) {
    const key = normalize(propName)
    if (!propertySeen.has(key)) {
      propertySeen.set(key, {
        name: propName,
        normalized: key,
        location: locationName || '',
        country: countryName || fallbackCountry,
        existingPropertyId: extractId(stay.property),
      })
    }
  }
}

function extractActivity(
  activity: ActivityBlock,
  activitySeen: Set<string>,
): void {
  const title = (activity.titleItrvl || activity.title || '').trim()
  if (!title) return
  if (GENERIC_ACTIVITIES.has(normalize(title))) return
  activitySeen.add(title)
}

function filterLocationsThatAreCountries(
  locations: LocationEntity[],
  countrySeen: Map<string, CountryEntity>,
): LocationEntity[] {
  return locations.filter((loc) => !countrySeen.has(loc.normalized))
}
