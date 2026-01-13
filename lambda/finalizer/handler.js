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
const payload = require('./shared/payload');
const { notifyJobCompleted } = require('./shared/notifications');

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
    const mediaResult = await payload.find('media', {
      where: JSON.stringify({
        usedInItineraries: { contains: itineraryId }
      }),
      limit: '500'
    });

    const mediaRecords = mediaResult.docs || [];
    console.log(`[Finalizer] Found ${mediaRecords.length} media records`);

    // 2. Select hero image (if not locked)
    let heroImageId = itinerary.heroImage;

    if (!itinerary.heroImageLocked || !heroImageId) {
      heroImageId = selectHeroImage(mediaRecords);
      console.log(`[Finalizer] Selected hero image: ${heroImageId}`);
    } else {
      console.log(`[Finalizer] Hero image locked: ${heroImageId}`);
    }

    // 3. Generate JSON-LD schema
    const schema = generateSchema(itinerary, mediaRecords, heroImageId);
    console.log('[Finalizer] Generated JSON-LD schema');

    // 4. Calculate publish checklist
    const job = await payload.getJob(jobId);
    const failedImages = job.failedImages || 0;
    const totalImages = job.totalImages || 0;
    const processedImages = (job.processedImages || 0) + (job.skippedImages || 0);

    const publishChecklist = {
      allImagesProcessed: processedImages >= totalImages,
      noFailedImages: failedImages === 0,
      heroImageSelected: !!heroImageId,
      contentEnhanced: false,  // Enhancement is manual step
      schemaGenerated: !!schema,
      metaFieldsFilled: !!(itinerary.metaTitle && itinerary.metaDescription)
    };

    // Calculate publish blockers
    const publishBlockers = [];

    if (!publishChecklist.allImagesProcessed) {
      publishBlockers.push({
        reason: `${totalImages - processedImages} images not yet processed`,
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

    // Determine final status
    const hasErrors = publishBlockers.some(b => b.severity === 'error');
    const finalStatus = hasErrors ? 'needs_attention' : 'ready_for_review';

    // 5. Update itinerary
    await payload.updateItinerary(itineraryId, {
      heroImage: heroImageId,
      schema,
      schemaStatus: 'pass',
      publishChecklist,
      publishBlockers
    });

    console.log('[Finalizer] Updated itinerary');

    // 6. Complete job
    const duration = (Date.now() - startTime) / 1000;

    // Get total duration from job start
    const jobStarted = job.startedAt ? new Date(job.startedAt).getTime() : startTime;
    const totalDuration = (Date.now() - jobStarted) / 1000;

    await payload.updateJob(jobId, {
      status: finalStatus === 'ready_for_review' ? 'completed' : finalStatus,
      currentPhase: 'Complete',
      phase4CompletedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: totalDuration,
      progress: 100,
      payloadId: itineraryId,
      processedItinerary: itineraryId
    });

    // 7. Send notification
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
