import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Activities: CollectionConfig = {
  slug: 'activities',
  admin: {
    hidden: true,
    useAsTitle: 'name',
    group: 'Knowledge Base',
    defaultColumns: ['name', 'type', 'observationCount', 'updatedAt'],
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
      admin: { description: 'e.g. "Gorilla Trekking", "Morning Game Drive"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL-friendly slug for deduplication' },
    },
    {
      name: 'type',
      type: 'select',
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
      admin: { description: 'Activity category for pattern matching' },
    },
    {
      name: 'destinations',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { description: 'Destinations where this activity is available' },
    },
    {
      name: 'properties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
      admin: { description: 'Properties that offer this activity' },
    },
    {
      name: 'description',
      type: 'richText',
      admin: { description: 'Activity description' },
    },
    {
      name: 'typicalDuration',
      type: 'text',
      admin: { description: 'e.g. "3–4 hours", "Full day"' },
    },
    {
      name: 'bestTimeOfDay',
      type: 'select',
      options: [
        { label: 'Early Morning', value: 'early_morning' },
        { label: 'Morning', value: 'morning' },
        { label: 'Midday', value: 'midday' },
        { label: 'Afternoon', value: 'afternoon' },
        { label: 'Evening', value: 'evening' },
        { label: 'Night', value: 'night' },
        { label: 'Any Time', value: 'any' },
      ],
      admin: { description: 'Optimal time of day for this activity' },
    },
    {
      name: 'suitability',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Family', value: 'family' },
        { label: 'Couples', value: 'couples' },
        { label: 'Honeymoon', value: 'honeymoon' },
        { label: 'Group', value: 'group' },
        { label: 'Solo', value: 'solo' },
        { label: 'Accessible', value: 'accessible' },
      ],
    },
    {
      name: 'minimumAge',
      type: 'number',
      admin: { description: 'Minimum age requirement. Leave empty if no restriction.' },
    },
    {
      name: 'fitnessLevel',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Moderate', value: 'moderate' },
        { label: 'High', value: 'high' },
      ],
    },
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
            },
            {
              label: 'On Demand',
              value: 'on_demand',
            },
            {
              label: 'Scheduled',
              value: 'scheduled',
            },
            {
              label: 'Seasonal',
              value: 'seasonal',
            },
            {
              label: 'Optional Extra',
              value: 'optional_extra',
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
            description: 'Minimum days advance booking required. 0 = same day. Null = not applicable.',
          },
        },
        {
          name: 'maximumGroupSize',
          type: 'number',
          admin: {
            description: 'Maximum group size for this activity. Null = no practical limit.',
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
            description: 'Human-readable additional cost estimate if not included. Leave empty if included in tariff.',
          },
        },
      ],
    },
    {
      name: 'wetuContentEntityId',
      type: 'number',
      admin: { description: 'Wetu content entity ID (Phase 2)' },
    },
    {
      name: 'observationCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'How many scraped itineraries include this activity',
      },
    },
    {
      name: 'observedInItineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      admin: {
        readOnly: true,
        description: 'Itineraries that have contributed to observationCount — used for dedup on re-scrape',
      },
    },
  ],
}
