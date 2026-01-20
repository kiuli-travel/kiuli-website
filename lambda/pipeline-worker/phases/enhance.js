/**
 * Phase 4: Content Enhancement (V7: Passthrough Mode)
 *
 * V7 NOTE: Automatic AI enhancement has been removed.
 * Enhancement is now manual-only via the admin UI FieldPairEditor component.
 *
 * This phase now simply passes through the raw data without AI processing.
 * The *_itrvl fields will be populated by the ingester, and *_enhanced fields
 * will remain null until manually enhanced by editors.
 */

async function enhance(rawData) {
  console.log('[Enhance] V7 Passthrough Mode - skipping automatic AI enhancement');

  // Deep clone the data without modification
  const enhancedData = JSON.parse(JSON.stringify(rawData.itinerary));

  // Count segments for logging
  const segments = [];
  findSegmentsWithDescriptions(enhancedData, segments);

  console.log(`[Enhance] Found ${segments.length} segments (passthrough, no enhancement)`);
  console.log('[Enhance] Enhancement will be done manually via admin UI');

  return enhancedData;
}

function findSegmentsWithDescriptions(obj, segments, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return;

  if (Array.isArray(obj)) {
    obj.forEach(item => findSegmentsWithDescriptions(item, segments, depth + 1));
  } else {
    if (obj.description && typeof obj.description === 'string') {
      segments.push(obj);
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        findSegmentsWithDescriptions(value, segments, depth + 1);
      }
    }
  }
}

module.exports = { enhance };
