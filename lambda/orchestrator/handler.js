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

    const rawData = await scraperResponse.json();
    console.log(`[Orchestrator] Scrape complete: ${rawData.images?.length || 0} images found`);

    // Update phase timestamp
    await payload.updateJob(jobId, {
      phase1CompletedAt: new Date().toISOString()
    });

    // 3. Check for existing itinerary (versioning)
    let existingItinerary = null;
    const itineraryId = rawData.itineraryId;

    if (mode === 'update' || mode === 'create') {
      existingItinerary = await payload.findItineraryByItineraryId(itineraryId);
      if (existingItinerary && mode === 'create') {
        console.log(`[Orchestrator] Itinerary exists (${existingItinerary.id}), switching to update mode`);
      }
    }

    // 4. Transform raw data (without media mapping yet - that happens after image processing)
    console.log('[Orchestrator] Transforming data...');
    const transformedData = await transform(rawData, {}, itrvlUrl);

    // 5. Build image list for job
    const imageList = (rawData.images || []).map(s3Key => ({
      sourceS3Key: s3Key,
      status: 'pending'
    }));

    console.log(`[Orchestrator] Image list: ${imageList.length} images`);

    // 6. Create or update itinerary
    let payloadItinerary;

    if (existingItinerary) {
      // Update mode: archive current version, update
      console.log(`[Orchestrator] Updating existing itinerary: ${existingItinerary.id}`);

      const previousVersion = {
        versionNumber: existingItinerary.version || 1,
        scrapedAt: existingItinerary.source?.lastScrapedAt || existingItinerary.updatedAt,
        data: {
          title: existingItinerary.title,
          overview: existingItinerary.overview,
          days: existingItinerary.days
        }
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

    // 7. Update job with image statuses and itinerary reference
    await payload.updateJob(jobId, {
      processedItinerary: payloadItinerary.id,
      payloadId: payloadItinerary.id,
      totalImages: imageList.length,
      processedImages: 0,
      failedImages: 0,
      skippedImages: 0,
      imageStatuses: imageList,
      currentPhase: 'Phase 2: Processing Images'
    });

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
