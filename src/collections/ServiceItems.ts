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
