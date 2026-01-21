const { scrape } = require('./phases/scrape');
const { deduplicate } = require('./phases/deduplicate');
const { processImages } = require('./phases/processImages');
const { enhance } = require('./phases/enhance');
const { generateSchema } = require('./phases/schema');
const { transform } = require('./phases/transform');
const { ingest } = require('./phases/ingest');
const { JobTracker } = require('./services/jobTracker');

exports.handler = async (event) => {
  console.log('[Handler] Lambda invoked');

  // Parse event
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch (e) {
    console.error('[Handler] Failed to parse event body');
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Validate invocation secret
  const invokeSecret = event.headers?.['x-invoke-secret'] || body.invokeSecret;
  if (process.env.INVOKE_SECRET && invokeSecret !== process.env.INVOKE_SECRET) {
    console.error('[Handler] Unauthorized invocation');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { jobId, itrvlUrl, itineraryId } = body;

  if (!jobId || !itrvlUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing jobId or itrvlUrl' }) };
  }

  const tracker = new JobTracker(jobId);

  try {
    // Phase 1: Scrape
    await tracker.startPhase('scraping');
    const rawData = await scrape(itrvlUrl);
    await tracker.completePhase('scraping');

    // Phase 2: Deduplicate
    await tracker.startPhase('deduplicating');
    const { uniqueImages, existingMedia, uniqueCount } = await deduplicate(rawData, itineraryId);
    await tracker.completePhase('deduplicating', {
      totalImages: uniqueCount,
      skippedImages: Object.keys(existingMedia).length
    });

    // Phase 3: Process Images
    await tracker.startPhase('images');
    const { mediaMapping, processed, failed } = await processImages(
      uniqueImages,
      itineraryId,
      existingMedia,
      tracker
    );

    // Debug: log mediaMapping content
    console.log(`[Handler] mediaMapping has ${Object.keys(mediaMapping).length} entries`);
    if (Object.keys(mediaMapping).length > 0) {
      const firstKey = Object.keys(mediaMapping)[0];
      const firstValue = mediaMapping[firstKey];
      console.log(`[Handler] First mapping: "${firstKey}" -> ${firstValue}`);
    }

    await tracker.completePhase('images', {
      processedImages: processed,
      failedImages: failed
    });

    // Phase 4: Enhance Content
    await tracker.startPhase('enhancing');
    const enhancedData = await enhance(rawData);
    await tracker.completePhase('enhancing');

    // Phase 5: Generate Schema
    await tracker.startPhase('schema');
    // Build actual imgix URLs for schema (not Payload API endpoints)
    // mediaMapping is s3Key -> payloadId, we need s3Key for imgix URL
    // S3 key format: media/originals/{itineraryId}/{itineraryId}_{sanitized_s3Key}.{ext}
    const imgixBaseUrl = process.env.IMGIX_URL || 'https://kiuli.imgix.net';
    const mediaMappingKeys = Object.keys(mediaMapping);
    console.log(`[Handler] Schema generation: ${mediaMappingKeys.length} keys in mediaMapping`);

    const mediaUrls = mediaMappingKeys.map(s3Key => {
      const extension = s3Key.includes('.') ? s3Key.split('.').pop() : 'jpg';
      const baseFilename = s3Key.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${itineraryId}_${baseFilename}.${extension}`;
      const originalS3Key = `media/originals/${itineraryId}/${filename}`;
      return `${imgixBaseUrl}/${originalS3Key}?w=1200&h=630&fit=crop&auto=format`;
    }).slice(0, 5); // Schema typically only needs first 5 images

    console.log(`[Handler] Schema image URLs: ${mediaUrls.length} URLs generated`);
    if (mediaUrls.length > 0) {
      console.log(`[Handler] First schema URL: ${mediaUrls[0]}`);
    }

    const schema = generateSchema(enhancedData, rawData.price, itineraryId, mediaUrls);
    console.log(`[Handler] Schema generated with ${schema.image?.length || 0} images`);
    await tracker.completePhase('schema');

    // Phase 6: Transform to structured format
    await tracker.startPhase('transform');
    console.log(`[Handler] Calling transform with ${Object.keys(mediaMapping).length} media mappings`);
    const transformedData = await transform(
      rawData,
      enhancedData,
      mediaMapping,
      null,  // mediaRecords - not yet tracking labels
      itrvlUrl
    );
    console.log(`[Handler] Transform complete. heroImage: ${transformedData.heroImage}, images: ${transformedData.images?.length || 0}`);
    await tracker.completePhase('transform');

    // Phase 7: Ingest to Payload
    await tracker.startPhase('ingesting');
    const payloadId = await ingest(transformedData, schema);
    await tracker.completePhase('ingesting');

    // Complete
    await tracker.complete(payloadId);

    console.log('[Handler] Pipeline complete');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, payloadId })
    };

  } catch (error) {
    console.error('[Handler] Pipeline failed:', error);
    await tracker.fail(error.message, tracker.currentPhase);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
