/**
 * Orchestrator Lambda - V6 Phase 1
 *
 * Responsibilities:
 * 1. Validate input
 * 2. Call scraper Lambda
 * 3. Transform raw data to structured format
 * 4. Handle versioning if update mode
 * 5. Create draft itinerary
 * 6. Update job with image list
 * 7. Invoke image-processor Lambda
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { transform } = require('./transform');
const payload = require('./shared/payload');
const { notifyJobStarted } = require('./shared/notifications');

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-north-1' });

/**
 * Map iTrvl segment type to Kiuli segment type enum
 * Note: entry/exit/point are sub-types of transfer for Media sourceSegmentType
 */
function mapSegmentType(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === 'stay' || t === 'accommodation') return 'stay';
  if (t === 'service' || t === 'activity' || t === 'tour') return 'activity';
  if (t === 'transfer' || t === 'flight' || t === 'transport' || t === 'road' || t === 'boat' || t === 'entry' || t === 'exit' || t === 'point') return 'transfer';
  return null;
}

exports.handler = async (event) => {
  console.log('[Orchestrator] Invoked');
  const startTime = Date.now();

  // Parse event
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;
  } catch (e) {
    return errorResponse(400, 'Invalid request body');
  }

  const { jobId, itrvlUrl, mode = 'create' } = body;

  if (!jobId || !itrvlUrl) {
    return errorResponse(400, 'Missing jobId or itrvlUrl');
  }

  console.log(`[Orchestrator] Job: ${jobId}, URL: ${itrvlUrl}, Mode: ${mode}`);

  try {
    // 1. Update job status
    await payload.updateJobPhase(jobId, 'Phase 1: Scraping');

    // 2. Call scraper Lambda
    console.log('[Orchestrator] Calling scraper Lambda...');
    const scraperUrl = process.env.LAMBDA_SCRAPER_URL;
    const scraperSecret = process.env.LAMBDA_SCRAPER_SECRET;

    if (!scraperUrl) {
      throw new Error('LAMBDA_SCRAPER_URL not configured');
    }

    const scraperResponse = await fetch(scraperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itrvlUrl,
        secret: scraperSecret
      })
    });

    if (!scraperResponse.ok) {
      const error = await scraperResponse.text();
      throw new Error(`Scraper failed: ${scraperResponse.status} - ${error}`);
    }

    const scraperResult = await scraperResponse.json();

    // Scraper returns { success: true, data: { itinerary, images, imageMapping } }
    if (!scraperResult.success || !scraperResult.data) {
      throw new Error(`Scraper returned invalid response: ${JSON.stringify(scraperResult).slice(0, 200)}`);
    }

    const rawData = scraperResult.data;
    console.log(`[Orchestrator] Scrape complete: ${rawData.images?.length || 0} images, ${rawData.videos?.length || 0} videos found`);

    // Update phase timestamp
    await payload.updateJob(jobId, {
      phase1CompletedAt: new Date().toISOString()
    });

    // 3. Check for existing itinerary (versioning)
    let existingItinerary = null;
    // Extract itineraryId from the itinerary data
    const itineraryData = rawData.itinerary?.itineraries?.[0] || {};
    const itineraryId = itineraryData.id;

    if (mode === 'update' || mode === 'create') {
      existingItinerary = await payload.findItineraryByItineraryId(itineraryId);
      if (existingItinerary && mode === 'create') {
        console.log(`[Orchestrator] Itinerary exists (${existingItinerary.id}), switching to update mode`);
      }
    }

    // 4. Transform raw data (without media mapping yet - that happens after image processing)
    console.log('[Orchestrator] Transforming data...');
    const transformedData = await transform(rawData, {}, itrvlUrl);

    // 5. Build image list WITH context from segments
    const imageList = [];
    const segments = rawData.itinerary?.itineraries?.[0]?.segments || [];
    const itineraryCountries = rawData.itinerary?.itineraries?.[0]?.countries || [];
    const defaultCountry = itineraryCountries[0] || null;
    const itineraryStartDate = rawData.itinerary?.itineraries?.[0]?.startDate || null;

    // Parse itinerary start date for day calculation (midnight UTC)
    let tripStart = null;
    if (itineraryStartDate) {
      tripStart = new Date(itineraryStartDate.slice(0, 10) + 'T00:00:00Z');
    }

    segments.forEach((segment, segmentIndex) => {
      const segmentImages = segment.images || [];
      if (segmentImages.length === 0) return;

      // Calculate day index from segment startDate relative to itinerary start
      let dayIndex = null;
      if (segment.startDate && tripStart) {
        const segDate = new Date(segment.startDate.slice(0, 10) + 'T00:00:00Z');
        const diffMs = segDate.getTime() - tripStart.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        dayIndex = Math.max(1, diffDays + 1); // Day 1 = first day
      }

      // Map segment type to our enum
      const segmentType = mapSegmentType(segment.type);

      // Get property/segment name
      const propertyName = segment.title || segment.name || segment.supplierName || null;

      // Get country (prefer segment-level, fallback to itinerary-level)
      const country = segment.country || segment.countryName || defaultCountry;

      segmentImages.forEach(s3Key => {
        imageList.push({
          sourceS3Key: typeof s3Key === 'string' ? s3Key : (s3Key.s3Key || s3Key),
          status: 'pending',
          propertyName,
          segmentType,
          segmentTitle: propertyName,
          dayIndex,
          segmentIndex,
          country,
        });
      });
    });

    // Fallback: if no images found in segments, use flat array (legacy support)
    if (imageList.length === 0 && rawData.images?.length > 0) {
      console.log('[Orchestrator] Warning: No images in segments, using flat array without context');
      rawData.images.forEach(s3Key => {
        imageList.push({
          sourceS3Key: s3Key,
          status: 'pending',
          propertyName: null,
          segmentType: null,
          segmentTitle: null,
          dayIndex: null,
          segmentIndex: null,
          country: defaultCountry,
        });
      });
    }

    console.log(`[Orchestrator] Image list: ${imageList.length} images with context`);

    // 5b. Build video list from scraper result
    const videoList = [];
    const videos = rawData.videos || [];

    videos.forEach((videoData) => {
      videoList.push({
        sourceS3Key: videoData.hlsUrl, // Use HLS URL as source key for dedup
        status: 'pending',
        mediaType: 'video',
        videoContext: videoData.context || 'hero',
        propertyName: null,
        segmentType: null,
        segmentTitle: null,
        dayIndex: null,
        segmentIndex: null,
        country: defaultCountry,
      });
    });

    console.log(`[Orchestrator] Video list: ${videoList.length} videos`);

    // 6. Create or update itinerary
    let payloadItinerary;

    if (existingItinerary) {
      // Update mode: archive current version, update
      console.log(`[Orchestrator] Updating existing itinerary: ${existingItinerary.id}`);

      // Store minimal version info to avoid payload size issues
      // Full data can be retrieved from Payload version history if needed
      const previousVersion = {
        versionNumber: existingItinerary.version || 1,
        scrapedAt: existingItinerary.source?.lastScrapedAt || existingItinerary.updatedAt,
        title: existingItinerary.title,
        nights: existingItinerary.overview?.nights || 0,
        dayCount: existingItinerary.days?.length || 0,
      };

      const updateData = {
        ...transformedData,
        version: (existingItinerary.version || 1) + 1,
        previousVersions: [...(existingItinerary.previousVersions || []), previousVersion],
        // Preserve locked hero image
        heroImage: existingItinerary.heroImageLocked ? existingItinerary.heroImage : null,
        heroImageLocked: existingItinerary.heroImageLocked || false,
        // Reset publish checklist
        publishChecklist: {
          allImagesProcessed: false,
          noFailedImages: false,
          heroImageSelected: !!existingItinerary.heroImageLocked,
          contentEnhanced: false,
          schemaGenerated: false,
          metaFieldsFilled: false
        }
      };

      payloadItinerary = await payload.updateItinerary(existingItinerary.id, updateData);

    } else {
      // Create mode: new itinerary
      console.log('[Orchestrator] Creating new itinerary');

      const createData = {
        ...transformedData,
        version: 1,
        publishChecklist: {
          allImagesProcessed: false,
          noFailedImages: false,
          heroImageSelected: false,
          contentEnhanced: false,
          schemaGenerated: false,
          metaFieldsFilled: false
        }
      };

      payloadItinerary = await payload.createItinerary(createData);
    }

    console.log(`[Orchestrator] Itinerary saved: ${payloadItinerary.id}`);

    // 7. Update job with itinerary reference and counters
    // Track images and videos separately to avoid counter drift
    await payload.updateJob(jobId, {
      processedItinerary: payloadItinerary.id,
      payloadId: payloadItinerary.id,
      totalImages: imageList.length,    // Images only (not including videos)
      totalVideos: videoList.length,    // Videos tracked separately
      processedImages: 0,
      failedImages: 0,
      skippedImages: 0,
      currentPhase: 'Phase 2: Processing Images'
    });

    // 7b. Create ImageStatus records in separate collection
    console.log(`[Orchestrator] Creating ${imageList.length} ImageStatus records...`);
    for (const img of imageList) {
      await payload.create('image-statuses', {
        job: jobId,
        sourceS3Key: img.sourceS3Key,
        status: img.status,
        mediaType: 'image',
        propertyName: img.propertyName,
        segmentType: img.segmentType,
        segmentTitle: img.segmentTitle,
        dayIndex: img.dayIndex,
        segmentIndex: img.segmentIndex,
        country: img.country,
      });
    }
    console.log(`[Orchestrator] ImageStatus records created`);

    // 7c. Create VideoStatus records (using same collection with mediaType: 'video')
    if (videoList.length > 0) {
      console.log(`[Orchestrator] Creating ${videoList.length} VideoStatus records...`);
      for (const vid of videoList) {
        await payload.create('image-statuses', {
          job: jobId,
          sourceS3Key: vid.sourceS3Key,
          status: vid.status,
          mediaType: 'video',
          videoContext: vid.videoContext,
          propertyName: vid.propertyName,
          segmentType: vid.segmentType,
          segmentTitle: vid.segmentTitle,
          dayIndex: vid.dayIndex,
          segmentIndex: vid.segmentIndex,
          country: vid.country,
        });
      }
      console.log(`[Orchestrator] VideoStatus records created`);
    }

    // Send notification
    await notifyJobStarted(jobId, transformedData.title);

    // 8. Invoke image-processor Lambda
    const imageProcessorArn = process.env.LAMBDA_IMAGE_PROCESSOR_ARN;

    if (imageProcessorArn) {
      console.log('[Orchestrator] Invoking image-processor Lambda...');

      await lambdaClient.send(new InvokeCommand({
        FunctionName: imageProcessorArn,
        InvocationType: 'Event', // Async invocation
        Payload: JSON.stringify({
          jobId,
          itineraryId: payloadItinerary.id,
          chunkIndex: 0
        })
      }));

      console.log('[Orchestrator] Image-processor invoked');
    } else {
      console.log('[Orchestrator] LAMBDA_IMAGE_PROCESSOR_ARN not set, skipping image processing');
    }

    // 9. Return success
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Orchestrator] Phase 1 complete in ${duration}s`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        jobId,
        itineraryId: payloadItinerary.id,
        imagesFound: imageList.length,
        videosFound: videoList.length,
        mode: existingItinerary ? 'update' : 'create',
        duration
      })
    };

  } catch (error) {
    console.error('[Orchestrator] Failed:', error);

    await payload.failJob(jobId, error.message, 'orchestrator');

    return errorResponse(500, error.message);
  }
};

function errorResponse(status, message) {
  return {
    statusCode: status,
    body: JSON.stringify({ success: false, error: message })
  };
}
