import type { CollectionBeforeChangeHook } from 'payload'

interface ItineraryData {
  tripTypes?: string[] | null
  publishChecklist?: Record<string, boolean>
}

/**
 * Calculate publish checklist values from document data.
 * This runs before validatePublish to ensure checklist is up-to-date.
 */
export const calculateChecklist: CollectionBeforeChangeHook = async ({ data }) => {
  const typedData = data as ItineraryData

  // Initialize publishChecklist if it doesn't exist
  if (!typedData.publishChecklist) {
    typedData.publishChecklist = {}
  }

  // Calculate tripTypesSelected based on tripTypes array
  const tripTypes = typedData.tripTypes
  const hasTripTypes = Array.isArray(tripTypes) && tripTypes.length > 0
  typedData.publishChecklist.tripTypesSelected = hasTripTypes

  return data
}
