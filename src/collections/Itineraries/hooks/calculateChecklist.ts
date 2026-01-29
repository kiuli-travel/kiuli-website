import type { CollectionBeforeChangeHook } from 'payload'

interface ItineraryData {
  tripTypes?: string[] | null
  publishChecklist?: Record<string, boolean>
}

/**
 * Calculate publish checklist values from document data.
 * This runs before validatePublish to ensure checklist is up-to-date.
 *
 * IMPORTANT: On partial updates (like publishing which only changes _status),
 * fields not being updated won't be in `data`. We must fall back to originalDoc
 * values to avoid incorrectly resetting checklist values.
 */
export const calculateChecklist: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  const typedData = data as ItineraryData
  const typedOriginal = originalDoc as ItineraryData | undefined

  // Initialize publishChecklist if it doesn't exist
  if (!typedData.publishChecklist) {
    typedData.publishChecklist = typedOriginal?.publishChecklist ?? {}
  }

  // Calculate tripTypesSelected based on tripTypes array
  // Use originalDoc value if tripTypes isn't in the update payload
  const tripTypes = typedData.tripTypes ?? typedOriginal?.tripTypes
  const hasTripTypes = Array.isArray(tripTypes) && tripTypes.length > 0
  typedData.publishChecklist.tripTypesSelected = hasTripTypes

  return data
}
