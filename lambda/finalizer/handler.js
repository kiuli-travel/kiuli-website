/**
 * Finalizer Lambda - V6 Phase 4
 *
 * Final steps:
 * 1. Select hero image (if not locked)
 * 2. Generate Product JSON-LD schema
 * 3. Calculate publish checklist
 * 4. Update itinerary
 * 5. Update job status
 * 6. Send notification
 */

const { selectHeroImage, selectHeroVideo } = require('./selectHero');
const { generateSchema } = require('./generateSchema');
const { validateSchema, formatValidationResult } = require('./schemaValidator');
const payload = require('./shared/payload');
const { notifyJobCompleted } = require('./shared/notifications');

/**
 * Generate consistent segment key for image-to-segment matching
 * Uses same normalization for both ImageStatus grouping and segment lookup
 *
 * @param {string} blockType - Segment type ('stay', 'activity', 'transfer')
 * @param {Object} segment - Segment object from itinerary
 * @returns {string} Normalized segment key
 */
function getSegmentKey(blockType, segment) {
  let name = '';
  if (blockType === 'stay') {
    // For stays: use accommodationName (set from name || title in transform)
    name = segment.accommodationName || segment.title || '';
  } else {
    // For activities/transfers: use title
    name = segment.title || '';
  }
  return `${blockType}-${name}`.toLowerCase().trim();
}

/**
 * Generate segment key from ImageStatus record
 * Must match getSegmentKey() output for proper linking
 *
 * @param {Object} img - ImageStatus record
 * @returns {string} Normalized segment key
 */
function getImageStatusKey(img) {
  const segmentType = img.segmentType || 'unknown';
  const name = img.propertyName || img.segmentTitle || '';
  return `${segmentType}-${name}`.toLowerCase().trim();
}

/**
 * Reconcile job counter fields with authoritative ImageStatuses collection
 *
 * Problem: Counter fields (processedImages, skippedImages, failedImages) are
 * updated incrementally per chunk in image-processor and can get out of sync.
 *
 * Solution: Recalculate from ImageStatuses collection and update job before using counters.
 *
 * @param {string|number} jobId - The job ID
 * @param {array} imageStatuses - ImageStatuses from the collection
 * @returns {Object} The reconciled counts
 */
async function reconcileJobCounters(jobId, imageStatuses) {
  const job = await payload.getJob(jobId);
  const statuses = imageStatuses || [];

  // Separate images from videos for accurate counting
  const imageOnlyStatuses = statuses.filter(s => s.mediaType !== 'video');
  const videoStatuses = statuses.filter(s => s.mediaType === 'video');

  // Count by status from authoritative ImageStatuses collection
  // totalImages should only count images, not videos
  const counts = {
    totalImages: imageOnlyStatuses.length,
    processedImages: imageOnlyStatuses.filter(s => s.status === 'complete').length,
    skippedImages: imageOnlyStatuses.filter(s => s.status === 'skipped').length,
    failedImages: imageOnlyStatuses.filter(s => s.status === 'failed').length,
    totalVideos: videoStatuses.length,
  };

  // Log if there was a discrepancy
  const wasOutOfSync =
    job.totalImages !== counts.totalImages ||
    job.processedImages !== counts.processedImages ||
    job.skippedImages !== counts.skippedImages ||
    job.failedImages !== counts.failedImages;

  if (wasOutOfSync) {
    console.log(`[Finalizer] Counter reconciliation:`);
    console.log(`  totalImages: ${job.totalImages} -> ${counts.totalImages}`);
    console.log(`  processedImages: ${job.processedImages} -> ${counts.processedImages}`);
    console.log(`  skippedImages: ${job.skippedImages} -> ${counts.skippedImages}`);
    console.log(`  failedImages: ${job.failedImages} -> ${counts.failedImages}`);

    // Update job with reconciled counts
    await payload.updateJob(jobId, counts);
  } else {
    console.log(`[Finalizer] Counters already in sync`);
  }

  return counts;
}

/**
 * Link images to segments using ImageStatuses collection data
 *
 * ImageStatuses contains context about each image:
 * - segmentType: 'stay' | 'activity' | 'transfer'
 * - propertyName: accommodation/segment name
 * - segmentIndex: index within all segments (not by type)
 * - dayIndex: which day the segment belongs to
 * - mediaId: the processed Payload media ID
 *
 * We match images to segments by segment type + property name
 *
 * @param {Object} itinerary - The itinerary document from Payload
 * @param {array} imageStatuses - ImageStatuses from the collection
 * @returns {Object} Updated days array with populated segment.images
 */
function linkImagesToSegments(itinerary, imageStatuses) {
  // Filter to only processed images with valid mediaIds
  const processedImages = (imageStatuses || []).filter(img =>
    (img.status === 'complete' || img.status === 'skipped') && img.mediaId
  );

  console.log(`[Finalizer] Processed images with mediaId: ${processedImages.length}`);

  if (processedImages.length === 0) {
    console.log('[Finalizer] No processed images, skipping segment linking');
    return itinerary.days;
  }

  // Group images by segment identifier using consistent key generation
  const imagesBySegment = {};
  for (const img of processedImages) {
    // Use helper function for consistent key generation
    const segKey = getImageStatusKey(img);

    if (!imagesBySegment[segKey]) {
      imagesBySegment[segKey] = [];
    }

    const mediaId = typeof img.mediaId === 'number' ? img.mediaId : parseInt(img.mediaId, 10);
    if (!isNaN(mediaId) && !imagesBySegment[segKey].includes(mediaId)) {
      imagesBySegment[segKey].push(mediaId);
    }
  }

  console.log(`[Finalizer] Image groups by segment: ${Object.keys(imagesBySegment).length}`);
  for (const [key, ids] of Object.entries(imagesBySegment)) {
    console.log(`[Finalizer]   "${key}": ${ids.length} images`);
  }

  // Update itinerary segments with mediaIds
  const updatedDays = [];
  let linkedCount = 0;
  let segmentsWithImages = 0;
  let segmentsWithoutImages = 0;

  for (const day of (itinerary.days || [])) {
    const updatedSegments = [];

    for (const segment of (day.segments || [])) {
      // Use helper function for consistent key generation
      const blockType = segment.blockType || 'unknown';
      const segKey = getSegmentKey(blockType, segment);

      // Get media IDs for this segment
      const mediaIds = imagesBySegment[segKey] || [];

      if (mediaIds.length > 0) {
        segmentsWithImages++;
        linkedCount += mediaIds.length;
        console.log(`[Finalizer] Segment "${segKey}" -> ${mediaIds.length} images`);
      } else {
        segmentsWithoutImages++;
      }

      updatedSegments.push({
        ...segment,
        images: mediaIds
      });
    }

    updatedDays.push({
      ...day,
      segments: updatedSegments
    });
  }

  console.log(`[Finalizer] Linked ${linkedCount} images to ${segmentsWithImages} segments`);
  console.log(`[Finalizer] Segments without images: ${segmentsWithoutImages}`);

  return updatedDays;
}

exports.handler = async (event) => {
  console.log('[Finalizer] Invoked');
  const startTime = Date.now();

  const { jobId, itineraryId } = event;

  if (!jobId || !itineraryId) {
    console.error('[Finalizer] Missing jobId or itineraryId');
    return { success: false, error: 'Missing jobId or itineraryId' };
  }

  console.log(`[Finalizer] Job: ${jobId}, Itinerary: ${itineraryId}`);

  try {
    // 1. Get itinerary and related media
    const itinerary = await payload.getItinerary(itineraryId);

    if (!itinerary) {
      throw new Error(`Itinerary not found: ${itineraryId}`);
    }

    // Get all media for this itinerary
    // NOTE: We can't rely on usedInItineraries query because it's not updated for dedup hits
    // Instead, get media IDs from image-statuses collection first, then fetch media records
    const imageStatusesResult = await payload.find('image-statuses', {
      'where[job][equals]': jobId,
      limit: '1000'
    });
    const imageStatuses = imageStatusesResult.docs || [];
    console.log(`[Finalizer] Found ${imageStatuses.length} ImageStatus records`);

    // Get unique media IDs from image statuses (both complete and skipped)
    const mediaIds = [...new Set(
      imageStatuses
        .filter(s => s.mediaId && (s.status === 'complete' || s.status === 'skipped'))
        .map(s => s.mediaId)
    )];
    console.log(`[Finalizer] Unique media IDs from ImageStatuses: ${mediaIds.length}`);

    // Fetch actual media records for these IDs
    let mediaRecords = [];
    if (mediaIds.length > 0) {
      // Batch fetch media records
      const mediaResult = await payload.find('media', {
        'where[id][in]': mediaIds.join(','),
        limit: '500'
      });
      mediaRecords = mediaResult.docs || [];
    }
    console.log(`[Finalizer] Fetched ${mediaRecords.length} media records`);

    // 2. Get job (imageStatuses already queried above)
    const job = await payload.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Reconcile counter fields with authoritative ImageStatuses collection
    const reconciledCounts = await reconcileJobCounters(jobId, imageStatuses);

    // Link images to segments using ImageStatuses mapping
    const updatedDays = linkImagesToSegments(itinerary, imageStatuses);

    // 3. Select hero image (if not locked)
    let heroImageId = itinerary.heroImage;

    if (!itinerary.heroImageLocked || !heroImageId) {
      heroImageId = selectHeroImage(mediaRecords);
      console.log(`[Finalizer] Selected hero image: ${heroImageId}`);
    } else {
      console.log(`[Finalizer] Hero image locked: ${heroImageId}`);
    }

    // 3b. Select hero video (if not locked)
    let heroVideoId = itinerary.heroVideo;

    if (!itinerary.heroVideoLocked || !heroVideoId) {
      heroVideoId = selectHeroVideo(mediaRecords);
      if (heroVideoId) {
        console.log(`[Finalizer] Selected hero video: ${heroVideoId}`);
      } else {
        console.log(`[Finalizer] No videos available for hero`);
      }
    } else {
      console.log(`[Finalizer] Hero video locked: ${heroVideoId}`);
    }

    // 4. Generate and validate JSON-LD schema
    const schema = generateSchema(itinerary, mediaRecords, heroImageId);
    const schemaValidation = validateSchema(schema);
    console.log('[Finalizer] ' + formatValidationResult(schemaValidation));

    // 5. Calculate publish checklist using reconciled counts
    const { totalImages, processedImages, skippedImages, failedImages } = reconciledCounts;
    const totalProcessed = processedImages + skippedImages;

    const publishChecklist = {
      allImagesProcessed: totalProcessed >= totalImages,
      noFailedImages: failedImages === 0,
      heroImageSelected: !!heroImageId,
      contentEnhanced: false,  // Enhancement is manual step
      schemaGenerated: !!schema,
      schemaValid: schemaValidation.status !== 'fail',
      metaFieldsFilled: !!(itinerary.metaTitle && itinerary.metaDescription)
    };

    // Calculate publish blockers
    const publishBlockers = [];

    if (!publishChecklist.allImagesProcessed) {
      publishBlockers.push({
        reason: `${totalImages - totalProcessed} images not yet processed`,
        severity: 'error'
      });
    }

    if (!publishChecklist.noFailedImages) {
      publishBlockers.push({
        reason: `${failedImages} images failed to process`,
        severity: 'error'
      });
    }

    if (!publishChecklist.heroImageSelected) {
      publishBlockers.push({
        reason: 'No hero image selected',
        severity: 'error'
      });
    }

    if (!publishChecklist.contentEnhanced) {
      publishBlockers.push({
        reason: 'Content not yet enhanced (use Enhance buttons)',
        severity: 'warning'
      });
    }

    if (!publishChecklist.metaFieldsFilled) {
      publishBlockers.push({
        reason: 'Meta title or description missing',
        severity: 'warning'
      });
    }

    if (!publishChecklist.schemaValid) {
      publishBlockers.push({
        reason: `Schema validation failed: ${schemaValidation.errors.join(', ')}`,
        severity: 'error'
      });
    } else if (schemaValidation.warnings.length > 0) {
      publishBlockers.push({
        reason: `Schema warnings: ${schemaValidation.warnings.join(', ')}`,
        severity: 'warning'
      });
    }

    // Determine final status
    const hasErrors = publishBlockers.some(b => b.severity === 'error');
    const finalStatus = hasErrors ? 'needs_attention' : 'ready_for_review';

    // 6. Update itinerary with linked images/videos and other fields
    // Build flat images array from all media IDs in ImageStatuses collection (images only)
    const allMediaIds = imageStatuses
      .filter(img => img.mediaId && (img.status === 'complete' || img.status === 'skipped') && img.mediaType !== 'video')
      .map(img => typeof img.mediaId === 'number' ? img.mediaId : parseInt(img.mediaId, 10));

    // Build video IDs array (videos only)
    const allVideoIds = imageStatuses
      .filter(img => img.mediaId && (img.status === 'complete' || img.status === 'skipped') && img.mediaType === 'video')
      .map(img => typeof img.mediaId === 'number' ? img.mediaId : parseInt(img.mediaId, 10));

    console.log(`[Finalizer] Videos found: ${allVideoIds.length}`);

    // Log sample of what we're sending for debugging
    if (updatedDays.length > 0 && updatedDays[0].segments?.length > 0) {
      const sampleSeg = updatedDays[0].segments.find(s => s.images?.length > 0);
      if (sampleSeg) {
        console.log(`[Finalizer] Sample segment images: ${JSON.stringify(sampleSeg.images.slice(0, 3))}`);
      }
    }
    console.log(`[Finalizer] Sample flat images: ${JSON.stringify(allMediaIds.slice(0, 5))}`);

    await payload.updateItinerary(itineraryId, {
      days: updatedDays,
      images: [...new Set(allMediaIds)],
      videos: [...new Set(allVideoIds)],
      heroImage: heroImageId,
      heroVideo: heroVideoId,
      schema,
      schemaStatus: schemaValidation.status,  // 'pass', 'warn', or 'fail'
      publishChecklist,
      publishBlockers
    });

    console.log('[Finalizer] Updated itinerary with linked segment images');

    // 7. Complete job
    const duration = (Date.now() - startTime) / 1000;

    // Get total duration from job start
    const jobStarted = job.startedAt ? new Date(job.startedAt).getTime() : startTime;
    const totalDuration = (Date.now() - jobStarted) / 1000;

    // Note: status only accepts: pending, processing, completed, failed
    // Store finalStatus in the job for UI purposes (ready_for_review vs needs_attention)
    // Ensure itineraryId is an integer for relationship field
    const itineraryIdInt = typeof itineraryId === 'number' ? itineraryId : parseInt(itineraryId, 10);

    await payload.updateJob(jobId, {
      status: 'completed',  // Pipeline completed successfully
      currentPhase: 'Complete',
      phase4CompletedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: totalDuration,
      progress: 100,
      payloadId: itineraryIdInt,
      processedItinerary: itineraryIdInt,
      // Store review status in notes for now
      notes: `Final status: ${finalStatus}. Blockers: ${publishBlockers.length > 0 ? publishBlockers.map(b => b.reason).join(', ') : 'None'}`
    });

    // 8. Send notification
    await notifyJobCompleted(jobId, itineraryId, itinerary.title);

    console.log(`[Finalizer] Complete in ${duration}s. Status: ${finalStatus}`);

    return {
      success: true,
      status: finalStatus,
      heroImage: heroImageId,
      heroVideo: heroVideoId,
      videosCount: allVideoIds.length,
      publishChecklist,
      blockers: publishBlockers.length,
      duration
    };

  } catch (error) {
    console.error('[Finalizer] Failed:', error);
    await payload.failJob(jobId, error.message, 'finalizer');
    return { success: false, error: error.message };
  }
};
