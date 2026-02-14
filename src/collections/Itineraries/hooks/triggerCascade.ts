import type { CollectionAfterChangeHook } from 'payload'

/**
 * Fire-and-forget cascade trigger on itinerary create or publish.
 * Does NOT await the cascade — runs in the background via fetch.
 *
 * Safety: Relationship manager updates to the itinerary don't change _status,
 * so this hook won't re-fire from cascade's own updates.
 */
export const triggerCascade: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
}) => {
  const secret = process.env.CONTENT_SYSTEM_SECRET
  if (!secret) return doc

  const shouldTrigger =
    operation === 'create' ||
    (operation === 'update' &&
      doc._status === 'published' &&
      previousDoc?._status !== 'published')

  if (!shouldTrigger) return doc

  const baseUrl = process.env.PAYLOAD_API_URL || process.env.NEXT_PUBLIC_SERVER_URL || ''
  if (!baseUrl) {
    console.warn('[cascade] No PAYLOAD_API_URL or NEXT_PUBLIC_SERVER_URL — cannot trigger cascade')
    return doc
  }

  // Fire-and-forget — don't await
  fetch(`${baseUrl}/api/content/cascade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ itineraryId: doc.id }),
  }).catch((err) => {
    console.error('[cascade] Failed to trigger cascade:', err)
  })

  return doc
}
