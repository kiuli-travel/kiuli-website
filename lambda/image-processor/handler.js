/**
 * Image Processor Lambda - V6 Phase 2
 *
 * Chunked image processing with global deduplication
 * Self-invokes for next chunk, triggers Labeler when complete
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { processImage } = require('./processImage');
const payload = require('./shared/payload');
const { notifyImagesProcessed } = require('./shared/notifications');

const CHUNK_SIZE = 20;
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-north-1' });

exports.handler = async (event) => {
  console.log('[ImageProcessor] Invoked');

  const { jobId, itineraryId, chunkIndex = 0 } = event;

  if (!jobId || !itineraryId) {
    console.error('[ImageProcessor] Missing jobId or itineraryId');
    return { success: false, error: 'Missing jobId or itineraryId' };
  }

  console.log(`[ImageProcessor] Job: ${jobId}, Chunk: ${chunkIndex}`);

  try {
    // 1. Get job
    const job = await payload.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // 2. Query image statuses from separate collection (images only, not videos)
    const allStatusesResult = await payload.find('image-statuses', {
      'where[and][0][job][equals]': jobId,
      'where[and][1][mediaType][not_equals]': 'video',
      limit: '1000'
    });
    const allStatuses = allStatusesResult.docs || [];

    const pendingResult = await payload.find('image-statuses', {
      'where[and][0][job][equals]': jobId,
      'where[and][1][status][equals]': 'pending',
      'where[and][2][mediaType][not_equals]': 'video',
      limit: '1000'
    });
    const pendingImages = pendingResult.docs || [];

    console.log(`[ImageProcessor] Total: ${allStatuses.length}, Pending: ${pendingImages.length}`);

    if (pendingImages.length === 0) {
      // All images processed, move to labeling
      console.log('[ImageProcessor] No pending images, triggering labeler');
      await triggerLabeler(jobId, itineraryId);
      return { success: true, message: 'No pending images' };
    }

    // 2. Get chunk to process
    const chunk = pendingImages.slice(0, CHUNK_SIZE);
    console.log(`[ImageProcessor] Processing chunk of ${chunk.length} images`);

    // 3. Process each image in chunk
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const mediaMapping = {};

    for (const imageStatus of chunk) {
      const sourceS3Key = imageStatus.sourceS3Key;

      try {
        // Update status to processing
        await updateImageStatus(jobId, sourceS3Key, 'processing', null, new Date().toISOString());

        // Process image (includes dedup check) - pass context for Media enrichment
        const result = await processImage(sourceS3Key, itineraryId, imageStatus);

        if (result.skipped) {
          skipped++;
          await updateImageStatus(jobId, sourceS3Key, 'skipped', result.mediaId, null, new Date().toISOString());
        } else {
          processed++;
          await updateImageStatus(jobId, sourceS3Key, 'complete', result.mediaId, null, new Date().toISOString());
        }

        mediaMapping[sourceS3Key] = result.mediaId;

      } catch (error) {
        console.error(`[ImageProcessor] Failed: ${sourceS3Key}`, error.message);
        failed++;
        await updateImageStatus(jobId, sourceS3Key, 'failed', null, null, new Date().toISOString(), error.message);
      }
    }

    // 4. Update job progress
    const totalProcessed = (job.processedImages || 0) + processed;
    const totalSkipped = (job.skippedImages || 0) + skipped;
    const totalFailed = (job.failedImages || 0) + failed;

    await payload.updateJob(jobId, {
      processedImages: totalProcessed,
      skippedImages: totalSkipped,
      failedImages: totalFailed,
      progress: Math.min(100, Math.round(((totalProcessed + totalSkipped + totalFailed) / allStatuses.length) * 100))
    });

    // 5. Skip itinerary media update here - defer to finalizer
    // This avoids 413 errors when the images array grows large
    // The finalizer will update itinerary.images from image-statuses collection
    console.log(`[ImageProcessor] Skipping itinerary media update (${Object.keys(mediaMapping).length} IDs), deferring to finalizer`);

    console.log(`[ImageProcessor] Chunk complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);

    // 6. Check if more images to process
    const remainingPending = pendingImages.length - chunk.length;

    if (remainingPending > 0) {
      // Self-invoke for next chunk
      console.log(`[ImageProcessor] ${remainingPending} images remaining, self-invoking...`);

      await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          jobId,
          itineraryId,
          chunkIndex: chunkIndex + 1
        })
      }));

    } else {
      // All images done, process videos before triggering labeler
      console.log('[ImageProcessor] All images processed, checking for videos...');

      // Process pending videos (non-blocking - don't let video failures block labeler)
      try {
        await processVideos(jobId, itineraryId);
      } catch (videoError) {
        console.error(`[ImageProcessor] Video processing failed (non-fatal): ${videoError.message}`);
        // Continue to labeler regardless of video failures
      }

      // All done, trigger labeler
      console.log('[ImageProcessor] Triggering labeler');

      await payload.updateJob(jobId, {
        phase2CompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 3: Labeling Images'
      });

      await notifyImagesProcessed(jobId, totalProcessed + totalSkipped, totalFailed);
      await triggerLabeler(jobId, itineraryId);
    }

    return {
      success: true,
      processed,
      skipped,
      failed,
      remaining: remainingPending
    };

  } catch (error) {
    console.error('[ImageProcessor] Failed:', error);
    await payload.failJob(jobId, error.message, 'image-processor');
    return { success: false, error: error.message };
  }
};

/**
 * Update single image status in image-statuses collection
 */
async function updateImageStatus(jobId, sourceS3Key, status, mediaId = null, startedAt = null, completedAt = null, error = null) {
  // Find the ImageStatus record
  const result = await payload.find('image-statuses', {
    'where[and][0][job][equals]': jobId,
    'where[and][1][sourceS3Key][equals]': sourceS3Key,
    limit: '1'
  });

  const imageStatus = result.docs?.[0];
  if (!imageStatus) {
    console.error(`[ImageProcessor] ImageStatus not found: job=${jobId}, sourceS3Key=${sourceS3Key}`);
    return;
  }

  // Update the record
  const updateData = { status };
  if (mediaId) updateData.mediaId = mediaId;
  if (startedAt) updateData.startedAt = startedAt;
  if (completedAt) updateData.completedAt = completedAt;
  if (error) updateData.error = error;

  await payload.update('image-statuses', imageStatus.id, updateData);
}

/**
 * Update itinerary with media mappings
 */
async function updateItineraryMedia(itineraryId, mediaMapping) {
  try {
    const itinerary = await payload.getItinerary(itineraryId);

    // Collect all media IDs
    const existingImages = itinerary.images || [];
    const newMediaIds = Object.values(mediaMapping);
    const allImages = [...new Set([...existingImages, ...newMediaIds])];

    // Update itinerary images array
    await payload.updateItinerary(itineraryId, {
      images: allImages
    });

    // Note: Segment-level image updates are handled by the finalizer Lambda
    // which has access to the full ImageStatuses collection with context

    console.log(`[ImageProcessor] Updated itinerary with ${newMediaIds.length} new media IDs`);

  } catch (error) {
    console.error('[ImageProcessor] Failed to update itinerary media:', error.message);
  }
}

/**
 * Process pending videos by invoking video-processor Lambda
 */
async function processVideos(jobId, itineraryId) {
  // Query pending videos
  const pendingVideosResult = await payload.find('image-statuses', {
    'where[and][0][job][equals]': jobId,
    'where[and][1][status][equals]': 'pending',
    'where[and][2][mediaType][equals]': 'video',
    limit: '100'
  });
  const pendingVideos = pendingVideosResult.docs || [];

  if (pendingVideos.length === 0) {
    console.log('[ImageProcessor] No pending videos');
    return;
  }

  console.log(`[ImageProcessor] Processing ${pendingVideos.length} video(s)...`);

  const videoProcessorArn = process.env.LAMBDA_VIDEO_PROCESSOR_ARN;

  if (!videoProcessorArn) {
    console.log('[ImageProcessor] LAMBDA_VIDEO_PROCESSOR_ARN not set, skipping video processing');
    return;
  }

  // Invoke video-processor for each video (async)
  for (const video of pendingVideos) {
    console.log(`[ImageProcessor] Invoking video-processor for: ${video.sourceS3Key}`);

    await lambdaClient.send(new InvokeCommand({
      FunctionName: videoProcessorArn,
      InvocationType: 'Event', // Async
      Payload: JSON.stringify({
        jobId,
        itineraryId,
        hlsUrl: video.sourceS3Key, // HLS URL stored as sourceS3Key
        videoContext: video.videoContext,
        statusId: video.id
      })
    }));
  }

  console.log(`[ImageProcessor] Video processor invoked for ${pendingVideos.length} video(s)`);
}

/**
 * Trigger labeler Lambda
 */
async function triggerLabeler(jobId, itineraryId) {
  const labelerArn = process.env.LAMBDA_LABELER_ARN;

  if (!labelerArn) {
    console.log('[ImageProcessor] LAMBDA_LABELER_ARN not set, skipping labeler');
    return;
  }

  await lambdaClient.send(new InvokeCommand({
    FunctionName: labelerArn,
    InvocationType: 'Event',
    Payload: JSON.stringify({
      jobId,
      itineraryId,
      batchIndex: 0
    })
  }));

  console.log('[ImageProcessor] Labeler Lambda invoked');
}
