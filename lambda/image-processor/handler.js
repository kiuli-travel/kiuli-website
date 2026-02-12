/**
 * Image Processor Lambda - V6 Phase 2
 *
 * Chunked image processing with global deduplication.
 * Step Functions handles iteration — this Lambda processes one chunk and returns remaining count.
 * Separate ProcessVideos step handles video processing.
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { processImage } = require('./processImage');
const payload = require('./shared/payload');
const { notifyImagesProcessed } = require('./shared/notifications');

const CHUNK_SIZE = 20;
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-north-1' });

exports.handler = async (event) => {
  console.log('[ImageProcessor] Invoked', JSON.stringify(event));

  const { jobId, itineraryId, chunkIndex = 0, processVideosOnly = false } = event;

  if (!jobId || !itineraryId) {
    throw new Error('Missing jobId or itineraryId');
  }

  // Video-only mode: process videos and return
  if (processVideosOnly) {
    console.log('[ImageProcessor] Video processing mode');
    try {
      await processVideos(jobId, itineraryId);
    } catch (videoError) {
      console.error(`[ImageProcessor] Video processing failed (non-fatal): ${videoError.message}`);
      try {
        await payload.updateJob(jobId, { videoProcessingError: videoError.message });
      } catch (updateErr) {
        console.error(`[ImageProcessor] Failed to record video error: ${updateErr.message}`);
      }
    }

    await payload.updateJob(jobId, {
      phase2CompletedAt: new Date().toISOString(),
      currentPhase: 'Phase 3: Labeling Images'
    });

    await notifyImagesProcessed(jobId, 0, 0);

    return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0 };
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
      console.log('[ImageProcessor] No pending images');
      return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0, chunkIndex };
    }

    // 3. Get chunk to process
    const chunk = pendingImages.slice(0, CHUNK_SIZE);
    console.log(`[ImageProcessor] Processing chunk of ${chunk.length} images`);

    // 4. Process each image in chunk
    let processed = 0;
    let skipped = 0;
    let failed = 0;

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

      } catch (error) {
        console.error(`[ImageProcessor] Failed: ${sourceS3Key}`, error.message);
        failed++;
        await updateImageStatus(jobId, sourceS3Key, 'failed', null, null, new Date().toISOString(), error.message);
      }
    }

    // 5. Update job progress
    const totalProcessed = (job.processedImages || 0) + processed;
    const totalSkipped = (job.skippedImages || 0) + skipped;
    const totalFailed = (job.failedImages || 0) + failed;

    // Cap progress at 99% during processing - finalizer sets 100% after reconciliation
    const progressValue = allStatuses.length > 0
      ? Math.min(99, Math.round(((totalProcessed + totalSkipped + totalFailed) / allStatuses.length) * 100))
      : 0;

    await payload.updateJob(jobId, {
      processedImages: totalProcessed,
      skippedImages: totalSkipped,
      failedImages: totalFailed,
      progress: progressValue
    });

    const remainingPending = pendingImages.length - chunk.length;
    console.log(`[ImageProcessor] Chunk complete: ${processed} processed, ${skipped} skipped, ${failed} failed, ${remainingPending} remaining`);

    // Return for Step Functions flow control
    return {
      jobId: String(jobId),
      itineraryId: String(itineraryId),
      remaining: remainingPending,
      chunkIndex: chunkIndex + 1,
      processed,
      skipped,
      failed
    };

  } catch (error) {
    console.error('[ImageProcessor] Failed:', error);
    await payload.failJob(jobId, error.message, 'image-processor');
    throw error; // Step Functions catches this
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
 * Process pending videos by invoking video-processor Lambda
 * Note: video-processor is a separate Lambda (not recursive) — kept as Lambda invoke
 * because it requires the FFmpeg layer which only exists on that Lambda.
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
