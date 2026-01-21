import type { CollectionBeforeDeleteHook } from 'payload'

/**
 * Clean up related itinerary when a job is deleted.
 * Media records are preserved for potential reuse.
 */
export const beforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req

  try {
    // Get the job to find related itinerary
    const job = await payload.findByID({
      collection: 'itinerary-jobs',
      id,
      depth: 0,
    })

    if (!job) {
      console.log(`[beforeDelete] Job ${id} not found, nothing to clean up`)
      return
    }

    // Delete the related itinerary if it exists
    const itineraryId = job.processedItinerary
    if (itineraryId) {
      const resolvedId = typeof itineraryId === 'object' ? itineraryId.id : itineraryId

      if (resolvedId) {
        try {
          await payload.delete({
            collection: 'itineraries',
            id: resolvedId,
          })
          console.log(`[beforeDelete] Deleted itinerary ${resolvedId} related to job ${id}`)
        } catch (error) {
          console.error(`[beforeDelete] Failed to delete itinerary ${resolvedId}:`, error)
          // Continue with job deletion even if itinerary delete fails
        }
      }
    }

    // Delete related image statuses
    try {
      const imageStatuses = await payload.find({
        collection: 'image-statuses',
        where: {
          job: { equals: id },
        },
        limit: 1000,
      })

      if (imageStatuses.docs.length > 0) {
        for (const status of imageStatuses.docs) {
          await payload.delete({
            collection: 'image-statuses',
            id: status.id,
          })
        }
        console.log(
          `[beforeDelete] Deleted ${imageStatuses.docs.length} image statuses for job ${id}`,
        )
      }
    } catch (error) {
      console.error(`[beforeDelete] Failed to delete image statuses for job ${id}:`, error)
    }

    // Note: We do NOT delete media records
    // Media stays in the database and S3 for reuse
    console.log(`[beforeDelete] Job ${id} cleanup complete (media preserved)`)
  } catch (error) {
    console.error('[beforeDelete] Error in cleanup hook:', error)
    // Don't throw - allow deletion to proceed
  }
}
