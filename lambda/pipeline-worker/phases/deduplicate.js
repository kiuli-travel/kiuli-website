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
    // Match filename format from processImages.js
    const extension = s3Key.includes('.') ? s3Key.split('.').pop() : 'jpg';
    const baseFilename = s3Key.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${itineraryId}_${baseFilename}.${extension}`;

    try {
      const response = await fetch(
        `${process.env.PAYLOAD_API_URL}/api/media?where[filename][contains]=${encodeURIComponent(itineraryId + '_' + baseFilename)}&limit=1`,
        {
          headers: { 'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}` }
        }
      );

      const result = await response.json();

      if (result.docs?.length > 0) {
        const mediaId = result.docs[0].id;
        existingMedia[s3Key] = mediaId;
        console.log(`[Dedup] Existing: ${filename} -> ID ${mediaId}`);
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

  // Debug: Show first few existing media mappings
  const existingKeys = Object.keys(existingMedia);
  if (existingKeys.length > 0) {
    console.log(`[Dedup] First existing mapping: "${existingKeys[0]}" -> ${existingMedia[existingKeys[0]]}`);
  }

  return {
    uniqueImages: imagesToProcess,
    existingMedia,
    totalReferences: allImageKeys.length,
    uniqueCount: uniqueKeys.length
  };
}

module.exports = { deduplicate };
