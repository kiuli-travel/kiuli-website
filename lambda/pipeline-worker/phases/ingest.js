async function ingest(data) {
  const {
    rawData,
    enhancedData,
    schema,
    faqHtml,
    mediaMapping,
    itineraryId
  } = data;

  console.log('[Ingest] Creating Payload itinerary entry');

  // Extract title
  const title = enhancedData.name || enhancedData.title || rawData.itinerary?.name || 'Safari Itinerary';

  // Get media IDs (filter out any non-existent mappings)
  const mediaIds = Object.values(mediaMapping).filter(id => id);

  // Build payload
  const payload = {
    title,
    itineraryId,
    price: rawData.price,
    priceFormatted: `$${(rawData.price / 100).toFixed(2)}`,
    images: mediaIds,
    rawItinerary: rawData.itinerary,
    enhancedItinerary: enhancedData,
    schema,
    faq: faqHtml,
    schemaStatus: 'pass',
    googleInspectionStatus: 'pending',
    buildTimestamp: new Date().toISOString(),
    _status: 'draft'
  };

  console.log(`[Ingest] Creating entry with ${mediaIds.length} images`);

  const response = await fetch(`${process.env.PAYLOAD_API_URL}/api/itineraries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payload ingestion failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const payloadId = result.doc?.id || result.id;

  console.log(`[Ingest] Created itinerary: ${payloadId}`);
  return payloadId;
}

module.exports = { ingest };
