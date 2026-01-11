async function deduplicate(rawData, itineraryId) {
  const allImageKeys = rawData.images;
  console.log(`[Dedup] Total image references: ${allImageKeys.length}`);

  // Deduplicate within itinerary
  const uniqueKeys = [...new Set(allImageKeys)];
  console.log(`[Dedup] Unique images: ${uniqueKeys.length}`);

  // Check which already exist in Payload
  const existingMedia = {};
  const imagesToProcess = [];

  for (const s3Key of uniqueKeys) {
    const filename = `${itineraryId}_${s3Key.replace(/\//g, '_')}`;

    try {
      const response = await fetch(
        `${process.env.PAYLOAD_API_URL}/api/media?where[filename][equals]=${encodeURIComponent(filename)}&limit=1`,
        {
          headers: { 'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}` }
        }
      );

      const result = await response.json();

      if (result.docs?.length > 0) {
        existingMedia[s3Key] = result.docs[0].id;
        console.log(`[Dedup] Existing: ${filename}`);
      } else {
        imagesToProcess.push(s3Key);
      }
    } catch (err) {
      console.error(`[Dedup] Error checking ${filename}:`, err.message);
      imagesToProcess.push(s3Key);
    }
  }

  console.log(`[Dedup] To process: ${imagesToProcess.length}`);
  console.log(`[Dedup] Already exist: ${Object.keys(existingMedia).length}`);

  return {
    uniqueImages: imagesToProcess,
    existingMedia,
    totalReferences: allImageKeys.length,
    uniqueCount: uniqueKeys.length
  };
}

module.exports = { deduplicate };
