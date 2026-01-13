/**
 * Phase 8: Ingest — Save transformed data to Payload CMS
 */

async function ingest(transformedData, schema) {
  console.log('[Ingest] Starting Payload ingest');

  const payloadUrl = process.env.PAYLOAD_API_URL;
  const apiKey = process.env.PAYLOAD_API_KEY;

  if (!payloadUrl || !apiKey) {
    throw new Error('Missing PAYLOAD_API_URL or PAYLOAD_API_KEY');
  }

  // Add schema to transformed data
  const payload = {
    ...transformedData,
    schema: schema,
    schemaStatus: 'pending',
    googleInspectionStatus: 'pending',
  };

  console.log(`[Ingest] Creating itinerary: ${payload.title}`);
  console.log(`[Ingest] Slug: ${payload.slug}`);
  console.log(`[Ingest] Days: ${payload.days?.length || 0}`);
  console.log(`[Ingest] Images: ${payload.images?.length || 0}`);

  const response = await fetch(`${payloadUrl}/api/itineraries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`[Ingest] Payload error: ${response.status}`);
    console.error(`[Ingest] Response: ${responseText.substring(0, 500)}`);
    throw new Error(`Payload ingest failed (${response.status}): ${responseText.substring(0, 200)}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response from Payload: ${responseText.substring(0, 200)}`);
  }

  const docId = result.doc?.id || result.id;

  if (!docId) {
    console.error('[Ingest] Response:', responseText.substring(0, 500));
    throw new Error('No document ID in Payload response');
  }

  console.log(`[Ingest] Created itinerary: ${docId}`);

  // Verify the document exists
  const verifyResponse = await fetch(`${payloadUrl}/api/itineraries/${docId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!verifyResponse.ok) {
    console.error(`[Ingest] Verification failed: ${verifyResponse.status}`);
    throw new Error(`Verification failed: Document ${docId} not found after creation`);
  }

  console.log(`[Ingest] Verified: Itinerary ${docId} exists`);

  return docId;
}

module.exports = { ingest };
