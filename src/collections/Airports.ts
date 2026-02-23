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
