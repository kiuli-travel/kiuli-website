/**
 * Backfill context fields for existing Media documents
 * Matches images to their source segments via job.imageStatuses
 */

const PAYLOAD_API = 'https://admin.kiuli.com/api';
const API_KEY = 'cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=';

async function fetchAPI(endpoint) {
  const res = await fetch(`${PAYLOAD_API}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  return res.json();
}

async function patchMedia(id, data) {
  const res = await fetch(`${PAYLOAD_API}/media/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function main() {
  // Get all jobs with imageStatuses
  const jobs = await fetchAPI('/itinerary-jobs?limit=100&depth=0');
  console.log(`Found ${jobs.docs.length} jobs`);

  // Build mapping: mediaId -> context AND sourceS3Key -> context
  const contextByMediaId = new Map();
  const contextByS3Key = new Map();

  for (const job of jobs.docs) {
    for (const status of (job.imageStatuses || [])) {
      const context = {
        propertyName: status.propertyName,
        segmentType: status.segmentType,
        segmentTitle: status.segmentTitle,
        dayIndex: status.dayIndex,
        country: status.country,
      };

      if (status.mediaId) {
        contextByMediaId.set(String(status.mediaId), context);
      }
      if (status.sourceS3Key) {
        contextByS3Key.set(status.sourceS3Key, context);
      }
    }
  }

  console.log(`Built context map: ${contextByMediaId.size} by mediaId, ${contextByS3Key.size} by S3 key`);

  // Get all media
  const media = await fetchAPI('/media?limit=200');
  console.log(`Found ${media.docs.length} media documents`);

  let updated = 0;
  let skipped = 0;

  for (const m of media.docs) {
    // Try to find context by mediaId first, then by sourceS3Key
    let context = contextByMediaId.get(String(m.id));
    if (!context && m.sourceS3Key) {
      context = contextByS3Key.get(m.sourceS3Key);
    }

    if (context && (context.propertyName || context.country)) {
      await patchMedia(m.id, {
        sourceProperty: context.propertyName || null,
        sourceSegmentType: context.segmentType || null,
        sourceSegmentTitle: context.segmentTitle || null,
        sourceDayIndex: context.dayIndex || null,
        country: context.country || null,
      });
      updated++;
      if (updated % 20 === 0) {
        console.log(`Updated ${updated}...`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`\nComplete: ${updated} updated, ${skipped} skipped (no context found)`);
}

main().catch(console.error);
