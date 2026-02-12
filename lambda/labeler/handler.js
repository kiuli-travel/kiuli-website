/**
 * Labeler Lambda - V6 Phase 3
 *
 * Conservative AI labeling with batched processing.
 * Step Functions handles iteration — this Lambda processes one batch and returns remaining count.
 * Image discovery uses ImageStatuses collection (not usedInItineraries which breaks on dedup).
 */

const { labelImage } = require('./labelImage');
const payload = require('./shared/payload');

const BATCH_SIZE = 10;  // Images per invocation
const CONCURRENT = 3;   // Concurrent AI calls

exports.handler = async (event) => {
  console.log('[Labeler] Invoked', JSON.stringify(event));

  const { jobId, itineraryId, batchIndex = 0 } = event;

  if (!jobId || !itineraryId) {
    throw new Error('Missing jobId or itineraryId');
  }

  console.log(`[Labeler] Job: ${jobId}, Batch: ${batchIndex}`);

  try {
    // 0. Get job for current progress
    const job = await payload.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // 1. Update job phase
    if (batchIndex === 0) {
      await payload.updateJob(jobId, {
        currentPhase: 'Phase 3: Labeling Images',
        labelingStartedAt: new Date().toISOString(),
        imagesLabeled: 0
      });
    }

    // 2. Get media IDs from ImageStatuses (authoritative source — not usedInItineraries)
    const imageStatusesResult = await payload.find('image-statuses', {
      'where[and][0][job][equals]': jobId,
      'where[and][1][mediaType][not_equals]': 'video',
      'where[and][2][mediaId][exists]': 'true',
      limit: '1000'
    });
    const imageStatuses = imageStatusesResult.docs || [];
    const mediaIds = [...new Set(imageStatuses.map(s => s.mediaId).filter(Boolean))];

    if (mediaIds.length === 0) {
      console.log('[Labeler] No media IDs found in ImageStatuses');
      await payload.updateJob(jobId, {
        phase3CompletedAt: new Date().toISOString(),
        labelingCompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 4: Finalizing'
      });
      return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0 };
    }

    // 3. Query unlabeled media from these IDs
    const unlabeledResult = await payload.find('media', {
      'where[and][0][id][in]': mediaIds.join(','),
      'where[and][1][labelingStatus][equals]': 'pending',
      'where[and][2][mediaType][not_equals]': 'video',
      limit: BATCH_SIZE.toString()
    });
    const unlabeledMedia = unlabeledResult.docs || [];
    console.log(`[Labeler] Found ${unlabeledMedia.length} unlabeled images`);

    if (unlabeledMedia.length === 0) {
      // All labeled, update job phase
      console.log('[Labeler] All images labeled');

      await payload.updateJob(jobId, {
        phase3CompletedAt: new Date().toISOString(),
        labelingCompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 4: Finalizing'
      });

      return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0 };
    }

    // 4. Update total to label count on first batch
    if (batchIndex === 0) {
      const totalUnlabeled = await payload.find('media', {
        'where[and][0][id][in]': mediaIds.join(','),
        'where[and][1][labelingStatus][equals]': 'pending',
        'where[and][2][mediaType][not_equals]': 'video',
        limit: '1'
      });

      await payload.updateJob(jobId, {
        imagesToLabel: totalUnlabeled.totalDocs || unlabeledMedia.length
      });
    }

    // 5. Process batch with concurrency limit
    let labeled = 0;
    let failed = 0;

    // Process in groups of CONCURRENT
    for (let i = 0; i < unlabeledMedia.length; i += CONCURRENT) {
      const group = unlabeledMedia.slice(i, i + CONCURRENT);

      const results = await Promise.allSettled(
        group.map(media => processMediaLabeling(media, imageStatuses))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          labeled++;
        } else {
          failed++;
        }
      }
    }

    // 6. Update job progress
    const totalLabeled = (job.imagesLabeled || 0) + labeled;

    await payload.updateJob(jobId, {
      imagesLabeled: totalLabeled
    });

    console.log(`[Labeler] Batch complete: ${labeled} labeled, ${failed} failed`);

    // 7. Check remaining count
    const remainingResult = await payload.find('media', {
      'where[and][0][id][in]': mediaIds.join(','),
      'where[and][1][labelingStatus][equals]': 'pending',
      'where[and][2][mediaType][not_equals]': 'video',
      limit: '1'
    });
    const remainingCount = remainingResult.totalDocs || 0;

    if (remainingCount === 0) {
      await payload.updateJob(jobId, {
        phase3CompletedAt: new Date().toISOString(),
        labelingCompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 4: Finalizing'
      });
    }

    // Return for Step Functions flow control
    return {
      jobId: String(jobId),
      itineraryId: String(itineraryId),
      remaining: remainingCount,
      labeled,
      failed
    };

  } catch (error) {
    console.error('[Labeler] Failed:', error);
    await payload.failJob(jobId, error.message, 'labeler');
    throw error; // Step Functions catches this
  }
};

/**
 * Process labeling for a single media item
 * @param {object} media - Payload Media document
 * @param {array} imageStatuses - ImageStatuses collection records for context lookup
 */
async function processMediaLabeling(media, imageStatuses = []) {
  const mediaId = media.id;

  try {
    // Update status to processing
    await payload.updateMedia(mediaId, {
      labelingStatus: 'processing'
    });

    // Look up context from imageStatuses
    // Match by mediaId (set during image processing) or sourceS3Key
    const imageStatus = imageStatuses.find(s =>
      s.mediaId === String(mediaId) ||
      s.mediaId === mediaId ||
      s.sourceS3Key === media.sourceS3Key
    );

    const context = {
      propertyName: imageStatus?.propertyName || media.sourceProperty || null,
      country: imageStatus?.country || media.country || null,
      segmentType: imageStatus?.segmentType || media.sourceSegmentType || null,
      segmentTitle: imageStatus?.segmentTitle || media.sourceSegmentTitle || null,
      dayIndex: imageStatus?.dayIndex || media.sourceDayIndex || null,
    };

    // Call AI labeling with context (new GPT-4o function)
    const labels = await labelImage(media, context);

    // Update media with all enrichment fields
    await payload.updateMedia(mediaId, labels);

    console.log(`[Labeler] Labeled: ${mediaId} -> ${labels.imageType}, ${context.propertyName || 'no property'}`);

    return { success: true, mediaId };

  } catch (error) {
    console.error(`[Labeler] Failed to label ${mediaId}:`, error.message);

    await payload.updateMedia(mediaId, {
      labelingStatus: 'failed',
      processingError: error.message
    });

    return { success: false, mediaId, error: error.message };
  }
}
