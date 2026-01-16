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

const { selectHeroImage } = require('./selectHero');
const { generateSchema } = require('./generateSchema');
const { validateSchema, formatValidationResult } = require('./schemaValidator');
const payload = require('./shared/payload');
const { notifyJobCompleted } = require('./shared/notifications');

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

  // Count by status from authoritative ImageStatuses collection
  const counts = {
    totalImages: statuses.length,
    processedImages: statuses.filter(s => s.status === 'complete').length,
    skippedImages: statuses.filter(s => s.status === 'skipped').length,
    failedImages: statuses.filter(s => s.status === 'failed').length,
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
 * Link images to segments by matching source s3Keys to processed mediaIds
 *
 * @param {Object} itinerary - The itinerary document from Payload
 * @param {array} imageStatuses - ImageStatuses from the collection
 * @returns {Object} Updated days array with populated segment.images
 */
function linkImagesToSegments(itinerary, imageStatuses) {
  // Build lookup: sourceS3Key -> mediaId from ImageStatuses collection
  const mediaMapping = {};
  for (const img of (imageStatuses || [])) {
    if ((img.status === 'complete' || img.status === 'skipped') && img.mediaId && img.sourceS3Key) {
      mediaMapping[img.sourceS3Key] = img.mediaId;
    }
  }

  console.log(`[Finalizer] Built mediaMapping with ${Object.keys(mediaMapping).length} entries`);

  if (Object.keys(mediaMapping).length === 0) {
    console.log('[Finalizer] No mediaMapping entries, skipping segment linking');
    return itinerary.days;
  }

  // Get raw segments from source.rawData (which have image s3Key references)
  const rawData = itinerary.source?.rawData || {};
  const rawItinerary = rawData.itinerary?.itineraries?.[0] || rawData.itinerary || rawData;
  const rawSegments = rawItinerary.segments || [];

  console.log(`[Finalizer] Raw segments: ${rawSegments.length}`);

  // Build lookup: segment identifier -> [s3Keys]
  // Match by name/title since that's how transform creates segments
  const segmentImageKeys = {};
  for (const rawSeg of rawSegments) {
    const segName = rawSeg.name || rawSeg.title || '';
    const segType = rawSeg.type?.toLowerCase() || '';

    // Create key matching transform.js logic
    let blockType = 'unknown';
    if (segType === 'stay' || segType === 'accommodation') {
      blockType = 'stay';
    } else if (segType === 'service' || segType === 'activity') {
      blockType = 'activity';
    } else if (segType === 'flight' || segType === 'road' || segType === 'transfer' || segType === 'boat') {
      blockType = 'transfer';
    }

    const segKey = `${blockType}-${segName}`;
    const imageKeys = [];

    if (rawSeg.images && Array.isArray(rawSeg.images)) {
      for (const img of rawSeg.images) {
        const s3Key = typeof img === 'string' ? img : (img.s3Key || img.key);
        if (s3Key) {
          imageKeys.push(s3Key);
        }
      }
    }

    if (imageKeys.length > 0) {
      segmentImageKeys[segKey] = imageKeys;
      console.log(`[Finalizer] Raw segment "${segKey}" has ${imageKeys.length} image keys`);
    }
  }

  // Update itinerary segments with mediaIds
  const updatedDays = [];
  let linkedCount = 0;
  let segmentsWithImages = 0;
  let segmentsWithoutImages = 0;

  for (const day of (itinerary.days || [])) {
    const updatedSegments = [];

    for (const segment of (day.segments || [])) {
      // Build segment key to match raw segment
      const segName = segment.accommodationName || segment.title || '';
      const segKey = `${segment.blockType}-${segName}`;
      const sourceKeys = segmentImageKeys[segKey] || [];

      // Map source keys to media IDs
      const mediaIds = [];
      for (const s3Key of sourceKeys) {
        const mediaId = mediaMapping[s3Key];
        if (mediaId) {
          // Ensure it's a number for Payload relationship field
          mediaIds.push(typeof mediaId === 'number' ? mediaId : parseInt(mediaId, 10));
          linkedCount++;
        }
      }

      if (mediaIds.length > 0) {
        segmentsWithImages++;
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

  console.log(`[Finalizer] Linked ${linkedCount} images to segments`);
  console.log(`[Finalizer] Segments with images: ${segmentsWithImages}, without: ${segmentsWithoutImages}`);

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
    // Use bracket notation - Payload doesn't parse JSON where clauses correctly
    const mediaResult = await payload.find('media', {
      'where[usedInItineraries][contains]': itineraryId,
      limit: '500'
    });

    const mediaRecords = mediaResult.docs || [];
    console.log(`[Finalizer] Found ${mediaRecords.length} media records`);

    // 2. Get job and image statuses from collection
    const job = await payload.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Query image statuses from separate collection
    const imageStatusesResult = await payload.find('image-statuses', {
      'where[job][equals]': jobId,
      limit: '1000'
    });
    const imageStatuses = imageStatusesResult.docs || [];
    console.log(`[Finalizer] Found ${imageStatuses.length} ImageStatus records`);

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

    // 6. Update itinerary with linked images and other fields
    // Build flat images array from all media IDs in ImageStatuses collection
    const allMediaIds = imageStatuses
      .filter(img => img.mediaId && (img.status === 'complete' || img.status === 'skipped'))
      .map(img => typeof img.mediaId === 'number' ? img.mediaId : parseInt(img.mediaId, 10));

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
      heroImage: heroImageId,
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
