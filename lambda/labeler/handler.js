/**
 * Labeler Lambda - V6 Phase 3
 *
 * Conservative AI labeling with batched processing
 * Self-invokes for next batch, triggers Finalizer when complete
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { labelImage } = require('./labelImage');
const payload = require('./shared/payload');

const BATCH_SIZE = 10;  // Images per invocation
const CONCURRENT = 3;   // Concurrent AI calls
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-north-1' });

exports.handler = async (event) => {
  console.log('[Labeler] Invoked');

  const { jobId, itineraryId, batchIndex = 0 } = event;

  if (!jobId || !itineraryId) {
    console.error('[Labeler] Missing jobId or itineraryId');
    return { success: false, error: 'Missing jobId or itineraryId' };
  }

  console.log(`[Labeler] Job: ${jobId}, Batch: ${batchIndex}`);

  try {
    // 1. Update job phase
    if (batchIndex === 0) {
      await payload.updateJob(jobId, {
        currentPhase: 'Phase 3: Labeling Images',
        labelingStartedAt: new Date().toISOString(),
        imagesLabeled: 0
      });
    }

    // 2. Get unlabeled media for this itinerary
    const mediaResult = await payload.find('media', {
      where: JSON.stringify({
        and: [
          { labelingStatus: { equals: 'pending' } },
          { usedInItineraries: { contains: itineraryId } }
        ]
      }),
      limit: BATCH_SIZE.toString()
    });

    const unlabeledMedia = mediaResult.docs || [];
    console.log(`[Labeler] Found ${unlabeledMedia.length} unlabeled images`);

    if (unlabeledMedia.length === 0) {
      // All labeled, move to finalizer
      console.log('[Labeler] All images labeled, triggering finalizer');

      await payload.updateJob(jobId, {
        phase3CompletedAt: new Date().toISOString(),
        labelingCompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 4: Finalizing'
      });

      await triggerFinalizer(jobId, itineraryId);
      return { success: true, message: 'All images labeled' };
    }

    // 3. Update total to label count on first batch
    if (batchIndex === 0) {
      const totalUnlabeled = await payload.find('media', {
        where: JSON.stringify({
          and: [
            { labelingStatus: { equals: 'pending' } },
            { usedInItineraries: { contains: itineraryId } }
          ]
        }),
        limit: '1'
      });

      await payload.updateJob(jobId, {
        imagesToLabel: totalUnlabeled.totalDocs || unlabeledMedia.length
      });
    }

    // 4. Process batch with concurrency limit
    let labeled = 0;
    let failed = 0;

    // Process in groups of CONCURRENT
    for (let i = 0; i < unlabeledMedia.length; i += CONCURRENT) {
      const group = unlabeledMedia.slice(i, i + CONCURRENT);

      const results = await Promise.allSettled(
        group.map(media => processMediaLabeling(media))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          labeled++;
        } else {
          failed++;
        }
      }
    }

    // 5. Update job progress
    const job = await payload.getJob(jobId);
    const totalLabeled = (job.imagesLabeled || 0) + labeled;

    await payload.updateJob(jobId, {
      imagesLabeled: totalLabeled
    });

    console.log(`[Labeler] Batch complete: ${labeled} labeled, ${failed} failed`);

    // 6. Check if more to label
    const remainingResult = await payload.find('media', {
      where: JSON.stringify({
        and: [
          { labelingStatus: { equals: 'pending' } },
          { usedInItineraries: { contains: itineraryId } }
        ]
      }),
      limit: '1'
    });

    const remainingCount = remainingResult.totalDocs || 0;

    if (remainingCount > 0) {
      // Self-invoke for next batch
      console.log(`[Labeler] ${remainingCount} images remaining, self-invoking...`);

      await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          jobId,
          itineraryId,
          batchIndex: batchIndex + 1
        })
      }));

    } else {
      // All done, trigger finalizer
      console.log('[Labeler] All images labeled, triggering finalizer');

      await payload.updateJob(jobId, {
        phase3CompletedAt: new Date().toISOString(),
        labelingCompletedAt: new Date().toISOString(),
        currentPhase: 'Phase 4: Finalizing'
      });

      await triggerFinalizer(jobId, itineraryId);
    }

    return {
      success: true,
      labeled,
      failed,
      remaining: remainingCount
    };

  } catch (error) {
    console.error('[Labeler] Failed:', error);
    await payload.failJob(jobId, error.message, 'labeler');
    return { success: false, error: error.message };
  }
};

/**
 * Process labeling for a single media item
 */
async function processMediaLabeling(media) {
  const mediaId = media.id;

  try {
    // Update status to processing
    await payload.updateMedia(mediaId, {
      labelingStatus: 'processing'
    });

    // Get image URL for labeling
    const imageUrl = media.imgixUrl || media.url;

    if (!imageUrl) {
      throw new Error('No image URL available');
    }

    // Call AI labeling
    const labels = await labelImage(imageUrl);

    // Update media with labels
    await payload.updateMedia(mediaId, {
      labelingStatus: 'complete',
      location: labels.location,
      country: labels.country,
      imageType: labels.imageType,
      animals: labels.animals,
      tags: labels.tags,
      altText: labels.altText,
      alt: labels.altText,  // Also set the main alt field
      isHero: labels.isHero,
      quality: labels.quality
    });

    console.log(`[Labeler] Labeled: ${mediaId} -> ${labels.imageType}, ${labels.country}`);

    return { success: true, mediaId };

  } catch (error) {
    console.error(`[Labeler] Failed to label ${mediaId}:`, error.message);

    await payload.updateMedia(mediaId, {
      labelingStatus: 'failed'
    });

    return { success: false, mediaId, error: error.message };
  }
}

/**
 * Trigger finalizer Lambda
 */
async function triggerFinalizer(jobId, itineraryId) {
  const finalizerArn = process.env.LAMBDA_FINALIZER_ARN;

  if (!finalizerArn) {
    console.log('[Labeler] LAMBDA_FINALIZER_ARN not set, skipping finalizer');
    return;
  }

  await lambdaClient.send(new InvokeCommand({
    FunctionName: finalizerArn,
    InvocationType: 'Event',
    Payload: JSON.stringify({
      jobId,
      itineraryId
    })
  }));

  console.log('[Labeler] Finalizer Lambda invoked');
}
