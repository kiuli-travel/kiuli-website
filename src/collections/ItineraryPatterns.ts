import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const ItineraryPatterns: CollectionConfig = {
  slug: 'itinerary-patterns',
  admin: {
    useAsTitle: 'sourceItinerary',
    group: 'Knowledge Base',
    defaultColumns: ['sourceItinerary', 'totalNights', 'priceTier', 'paxType', 'updatedAt'],
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  fields: [
    {
      name: 'sourceItinerary',
      type: 'relationship',
      relationTo: 'itineraries',
      required: true,
      unique: true,
      admin: { description: 'The scraped itinerary this pattern was extracted from' },
    },
    {
      name: 'extractedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'countries',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Countries covered by this itinerary' },
    },
    {
      name: 'totalNights',
      type: 'number',
      admin: { description: 'Total nights across all stays' },
    },
    {
      name: 'paxType',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: 'Family', value: 'family' },
        { label: 'Couple', value: 'couple' },
        { label: 'Group', value: 'group' },
        { label: 'Solo', value: 'solo' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'adults',
      type: 'number',
      admin: { description: 'Adult pax count' },
    },
    {
      name: 'children',
      type: 'number',
      admin: { description: 'Child pax count' },
    },
    {
      name: 'propertySequence',
      type: 'array',
      admin: { description: 'Ordered list of properties in this itinerary' },
      fields: [
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          required: true,
        },
        {
          name: 'nights',
          type: 'number',
          admin: { description: 'Nights at this property' },
        },
        {
          name: 'order',
          type: 'number',
          admin: { description: '1-based position in itinerary sequence' },
        },
        {
          name: 'roomType',
          type: 'text',
          admin: { description: 'Room type booked, if known' },
        },
      ],
    },
    {
      name: 'transferSequence',
      type: 'array',
      admin: { description: 'Ordered list of transfers, each positioned relative to the preceding property' },
      fields: [
        {
          name: 'route',
          type: 'relationship',
          relationTo: 'transfer-routes',
        },
        {
          name: 'afterProperty',
          type: 'number',
          admin: { description: '1-based index of the property this transfer follows' },
        },
        {
          name: 'mode',
          type: 'text',
          admin: { description: 'Segment type from iTrvl: flight, road, boat' },
        },
      ],
    },
    {
      name: 'priceTotal',
      type: 'number',
      admin: { description: 'Total itinerary price in USD' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'USD',
    },
    {
      name: 'pricePerNightAvg',
      type: 'number',
      admin: { description: 'priceTotal divided by totalNights' },
    },
    {
      name: 'priceTier',
      type: 'select',
      options: [
        { label: 'Ultra Premium', value: 'ultra_premium' },
        { label: 'Premium', value: 'premium' },
        { label: 'Mid Luxury', value: 'mid_luxury' },
        { label: 'Accessible Luxury', value: 'accessible_luxury' },
      ],
    },
    {
      name: 'travelMonth',
      type: 'number',
      admin: { description: '1–12, from itinerary start date' },
    },
    {
      name: 'travelYear',
      type: 'number',
      admin: { description: 'From itinerary start date' },
    },
  ],
}
