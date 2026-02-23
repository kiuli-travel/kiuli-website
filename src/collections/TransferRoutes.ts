import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const TransferRoutes: CollectionConfig = {
  slug: 'transfer-routes',
  admin: {
    useAsTitle: 'slug',
    group: 'Knowledge Base',
    defaultColumns: ['from', 'to', 'mode', 'observationCount', 'updatedAt'],
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      admin: { description: 'Origin point name, e.g. "Mara North Airstrip"' },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'Destination point name, e.g. "Wilson Airport Nairobi"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Auto-generated: "mara-north-airstrip-to-wilson-airport-nairobi"' },
    },
    {
      name: 'fromDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination region containing the origin point' },
    },
    {
      name: 'toDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { description: 'Destination region containing the arrival point' },
    },
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
    {
      name: 'fromProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at origin, if applicable' },
    },
    {
      name: 'toProperty',
      type: 'relationship',
      relationTo: 'properties',
      admin: { description: 'Property at destination, if applicable' },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      options: [
        { label: 'Flight', value: 'flight' },
        { label: 'Road', value: 'road' },
        { label: 'Boat', value: 'boat' },
        { label: 'Helicopter', value: 'helicopter' },
        { label: 'Charter', value: 'charter' },
      ],
    },
    {
      name: 'typicalDurationMinutes',
      type: 'number',
      admin: { description: 'Typical journey duration in minutes' },
    },
    {
      name: 'distanceKm',
      type: 'number',
      admin: { description: 'Approximate distance in kilometres' },
    },
    {
      name: 'airlines',
      type: 'array',
      admin: { description: 'Airlines observed on this route across all scraped itineraries' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "Safarilink", "Auric Air"' },
        },
        {
          name: 'go7Airline',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Available via GO7/AeroCRS network (Phase 4)' },
        },
        {
          name: 'duffelAirline',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Available via Duffel API (Phase 4)' },
        },
      ],
    },
    {
      name: 'fromCoordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'toCoordinates',
      type: 'group',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    {
      name: 'observations',
      type: 'array',
      admin: { description: 'One entry per scrape that uses this route' },
      fields: [
        {
          name: 'itineraryId',
          type: 'relationship',
          relationTo: 'itineraries',
          admin: { description: 'Source itinerary' },
        },
        { name: 'departureTime', type: 'text' },
        { name: 'arrivalTime', type: 'text' },
        { name: 'airline', type: 'text' },
        { name: 'dateObserved', type: 'date' },
      ],
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'How many scraped itineraries use this route' },
    },
    {
      name: 'wetuRouteId',
      type: 'text',
      admin: { description: 'Wetu route entity ID (Phase 2)' },
    },
  ],
}
