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
 * 7. Return result for Step Functions (no longer invokes image-processor)
 */

const { transform } = require('./transform');
const payload = require('./shared/payload');
const { notifyJobStarted } = require('./shared/notifications');

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

function classifyPriceTier(priceTotal, totalNights) {
  if (!priceTotal || !totalNights) return null;
  const perNight = priceTotal / totalNights;
  if (perNight >= 3000) return 'ultra_premium';
  if (perNight >= 1500) return 'premium';
  if (perNight >= 800) return 'mid_luxury';
  return 'accessible_luxury';
}

function determinePaxType(adults, children) {
  if (children && children > 0) return 'family';
  if (adults === 1) return 'solo';
  if (adults === 2) return 'couple';
  if (adults > 4) return 'group';
  return 'unknown';
}

/**
 * Strip all internal fields (prefixed with _) before saving to Payload.
 * These fields carry pipeline state and must not reach the database.
 */
function stripInternalFields(data) {
  const stripped = { ...data };
  Object.keys(stripped)
    .filter(k => k.startsWith('_'))
    .forEach(k => delete stripped[k]);
  return stripped;
}

exports.handler = async (event) => {
  console.log('[Orchestrator] Invoked');
  const startTime = Date.now();

  // Parse event — Step Functions passes plain object
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;
  } catch (e) {
    throw new Error('Invalid request body');
  }

  const { jobId, itrvlUrl, mode = 'create' } = body;

  if (!jobId || !itrvlUrl) {
    throw new Error('Missing jobId or itrvlUrl');
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

    // 5c. Track if videos were scraped
    const videoScrapedFromSource = videoList.length > 0;
    console.log(`[Orchestrator] Videos scraped from source: ${videoScrapedFromSource}`);

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
        // Track video scraping
        videoScrapedFromSource,
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

      const cleanUpdateData = stripInternalFields(updateData);
      payloadItinerary = await payload.updateItinerary(existingItinerary.id, cleanUpdateData);

    } else {
      // Create mode: new itinerary
      console.log('[Orchestrator] Creating new itinerary');

      const createData = {
        ...transformedData,
        version: 1,
        videoScrapedFromSource,
        publishChecklist: {
          allImagesProcessed: false,
          noFailedImages: false,
          heroImageSelected: false,
          contentEnhanced: false,
          schemaGenerated: false,
          metaFieldsFilled: false
        }
      };

      const cleanCreateData = stripInternalFields(createData);
      payloadItinerary = await payload.createItinerary(cleanCreateData);
    }

    console.log(`[Orchestrator] Itinerary saved: ${payloadItinerary.id}`);

    // Update Property relatedItineraries for bidirectional linking
    const propertyIds = transformedData._propertyIds || [];
    if (propertyIds.length > 0) {
      console.log(`[Orchestrator] Linking ${propertyIds.length} properties to itinerary ${payloadItinerary.id}`);
      for (const propertyId of propertyIds) {
        try {
          const property = await payload.getById('properties', propertyId, { depth: 0 });
          const existingRelated = (property.relatedItineraries || []).map(r => typeof r === 'object' ? r.id : r);
          if (!existingRelated.includes(payloadItinerary.id)) {
            await payload.update('properties', propertyId, {
              relatedItineraries: [...existingRelated, payloadItinerary.id]
            });
            console.log(`[Orchestrator] Linked property ${propertyId} -> itinerary ${payloadItinerary.id}`);
          }
        } catch (err) {
          console.log(`[Orchestrator] Failed to update Property ${propertyId} relatedItineraries: ${err.message}`);
          // Non-fatal — don't fail the pipeline
        }
      }
    }

    // ============================================================
    // KNOWLEDGE BASE
    // ============================================================
    const kb = transformedData._knowledgeBase || {};

    // ============================================================
    // KNOWLEDGE BASE: TransferRoute observations with itineraryId
    // ============================================================
    const pendingTransferObs = kb.pendingTransferObs || [];
    if (pendingTransferObs.length > 0) {
      console.log(`[Orchestrator] Writing ${pendingTransferObs.length} TransferRoute observations`);
      for (const obs of pendingTransferObs) {
        try {
          const route = await payload.getById('transfer-routes', obs.routeId, { depth: 0 });
          const existingObs = route.observations || [];
          const existingAirlines = route.airlines || [];

          // Dedup: skip if an observation for this itinerary already exists
          const alreadyRecorded = existingObs.some(o => {
            const id = typeof o.itineraryId === 'object' ? o.itineraryId?.id : o.itineraryId;
            return String(id) === String(payloadItinerary.id);
          });
          if (alreadyRecorded) {
            console.log(`[Orchestrator] TransferRoute obs already exists for route ${obs.routeId}, itinerary ${payloadItinerary.id} — skipping`);
            continue;
          }

          // Dedup airline
          const airlineName = obs.airline || null;
          const airlineAlreadyPresent = airlineName && existingAirlines.some(a => a.name === airlineName);
          const updatedAirlines = airlineAlreadyPresent
            ? existingAirlines
            : [
                ...existingAirlines,
                ...(airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : []),
              ];

          await payload.update('transfer-routes', obs.routeId, {
            observations: [...existingObs, {
              itineraryId: payloadItinerary.id,
              departureTime: obs.departureTime,
              arrivalTime: obs.arrivalTime,
              airline: obs.airline,
              dateObserved: obs.dateObserved,
            }],
            observationCount: existingObs.length + 1,
            airlines: updatedAirlines,
          });
          console.log(`[Orchestrator] TransferRoute obs saved: ${obs.slug} (itinerary ${payloadItinerary.id})`);
        } catch (err) {
          console.error(`[Orchestrator] TransferRoute obs failed for route ${obs.routeId}: ${err.message}`);
          // Non-fatal — continue
        }
      }
    }

    // ============================================================
    // KNOWLEDGE BASE: Activity observation dedup
    // ============================================================
    const pendingActivityObs = kb.pendingActivityObs || [];
    if (pendingActivityObs.length > 0) {
      console.log(`[Orchestrator] Processing ${pendingActivityObs.length} activity observations`);
      for (const obs of pendingActivityObs) {
        try {
          const activity = await payload.getById('activities', obs.activityId, { depth: 0 });
          const existingObserved = (activity.observedInItineraries || [])
            .map(id => typeof id === 'object' ? id.id : id)
            .map(String);

          if (existingObserved.includes(String(payloadItinerary.id))) {
            console.log(`[Orchestrator] Activity already observed for itinerary ${payloadItinerary.id}: ${obs.slug} — skipping`);
            continue;
          }

          await payload.update('activities', obs.activityId, {
            observationCount: (activity.observationCount || 0) + 1,
            observedInItineraries: [...existingObserved, String(payloadItinerary.id)],
          });
          console.log(`[Orchestrator] Activity obs recorded: ${obs.slug} (count: ${(activity.observationCount || 0) + 1})`);
        } catch (err) {
          console.error(`[Orchestrator] Activity obs failed for ${obs.activityId}: ${err.message}`);
          // Non-fatal — continue
        }
      }
    }

    // ============================================================
    // KNOWLEDGE BASE: accumulatedData updates
    // ============================================================
    const orderedPropertyIds = kb.orderedPropertyIds || [];
    const priceTotal = transformedData.investmentLevel?.fromPrice || null;
    const totalNights = transformedData.overview?.nights || 0;
    const priceTierValue = classifyPriceTier(priceTotal, totalNights);
    const pricePerNight = (priceTotal && totalNights) ? Math.round(priceTotal / totalNights) : null;

    if (orderedPropertyIds.length > 0) {
      console.log(`[Orchestrator] Updating accumulatedData for ${orderedPropertyIds.length} properties`);

      for (let i = 0; i < orderedPropertyIds.length; i++) {
        const propertyId = orderedPropertyIds[i];
        try {
          const existingProperty = await payload.getById('properties', propertyId, { depth: 0 });

          // === Dedup check: skip if this itinerary's data is already recorded ===
          const existingObsCheck = existingProperty.accumulatedData?.pricePositioning?.observations || [];
          const alreadyRecorded = existingObsCheck.some(obs => {
            const id = typeof obs.itineraryId === 'object' ? obs.itineraryId?.id : obs.itineraryId;
            return String(id) === String(payloadItinerary.id);
          });
          if (alreadyRecorded) {
            console.log(`[Orchestrator] accumulatedData already recorded for property ${propertyId}, itinerary ${payloadItinerary.id} — skipping`);
            continue;
          }

          // === Price observation ===
          const existingObs = existingProperty.accumulatedData?.pricePositioning?.observations || [];
          const newObs = {
            itineraryId: payloadItinerary.id,
            pricePerNight,
            priceTier: priceTierValue,
            observedAt: new Date().toISOString(),
          };
          const updatedObs = [...existingObs, newObs];

          // === Common pairings ===
          const existingPairings = existingProperty.accumulatedData?.commonPairings || [];
          const newPairings = [];
          if (i > 0) {
            newPairings.push({ property: orderedPropertyIds[i - 1], position: 'before', count: 1 });
          }
          if (i < orderedPropertyIds.length - 1) {
            newPairings.push({ property: orderedPropertyIds[i + 1], position: 'after', count: 1 });
          }

          // Merge: increment count if pairing already exists, otherwise add
          const mergedPairings = [...existingPairings];
          for (const newPairing of newPairings) {
            const existingIdx = mergedPairings.findIndex(p => {
              const pId = typeof p.property === 'object' ? p.property?.id : p.property;
              return pId === newPairing.property && p.position === newPairing.position;
            });
            if (existingIdx >= 0) {
              mergedPairings[existingIdx] = {
                ...mergedPairings[existingIdx],
                count: (mergedPairings[existingIdx].count || 1) + 1,
              };
            } else {
              mergedPairings.push(newPairing);
            }
          }

          // PATCH — send complete accumulatedData group to avoid partial overwrite
          await payload.update('properties', propertyId, {
            accumulatedData: {
              pricePositioning: {
                observations: updatedObs,
                observationCount: updatedObs.length,
              },
              commonPairings: mergedPairings,
            },
          });
          console.log(`[Orchestrator] Updated accumulatedData for property ${propertyId} (${updatedObs.length} obs)`);

        } catch (err) {
          console.error(`[Orchestrator] accumulatedData update failed for property ${propertyId}: ${err.message}`);
          // Non-fatal — continue to next property
        }
      }
    }

    // ============================================================
    // KNOWLEDGE BASE: ItineraryPatterns upsert
    // ============================================================
    try {
      const startDate = kb.startDate || null;

      const patternData = {
        sourceItinerary: payloadItinerary.id,
        extractedAt: new Date().toISOString(),
        countries: transformedData.destinations || [],
        totalNights,
        paxType: determinePaxType(kb.adultsCount, kb.childrenCount),
        adults: kb.adultsCount,
        children: kb.childrenCount,
        propertySequence: kb.propertySequence || [],
        transferSequence: kb.transferSequence || [],
        priceTotal,
        currency: transformedData.investmentLevel?.currency || 'USD',
        pricePerNightAvg: (totalNights > 0 && priceTotal) ? Math.round(priceTotal / totalNights) : null,
        priceTier: priceTierValue,
        travelMonth: startDate ? parseInt(startDate.slice(5, 7)) : null,
        travelYear: startDate ? parseInt(startDate.slice(0, 4)) : null,
      };

      // Upsert: check if a pattern already exists for this itinerary (handles re-scrape)
      const existingPattern = await payload.findOne('itinerary-patterns', {
        'where[sourceItinerary][equals]': String(payloadItinerary.id),
      });

      if (existingPattern) {
        await payload.update('itinerary-patterns', existingPattern.id, patternData);
        console.log(`[Orchestrator] Updated ItineraryPattern ${existingPattern.id} for itinerary ${payloadItinerary.id}`);
      } else {
        const created = await payload.create('itinerary-patterns', patternData);
        console.log(`[Orchestrator] Created ItineraryPattern ${created.doc?.id || created.id} for itinerary ${payloadItinerary.id}`);
      }

    } catch (err) {
      console.error(`[Orchestrator] ItineraryPattern upsert failed: ${err.message}`);
      // Non-fatal — log and continue
    }

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
          sourceItinerary: String(payloadItinerary.id), // Track which itinerary this video belongs to
        });
      }
      console.log(`[Orchestrator] VideoStatus records created`);
    }

    // Send notification
    await notifyJobStarted(jobId, transformedData.title);

    // 8. Return result for Step Functions (plain object, not HTTP response)
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Orchestrator] Phase 1 complete in ${duration}s`);

    return {
      jobId: String(jobId),
      itineraryId: String(payloadItinerary.id),
      imagesFound: imageList.length,
      videosFound: videoList.length,
      mode: existingItinerary ? 'update' : 'create',
      chunkIndex: 0
    };

  } catch (error) {
    console.error('[Orchestrator] Failed:', error);
    await payload.failJob(jobId, error.message, 'orchestrator');
    throw error; // Step Functions catches this
  }
};
