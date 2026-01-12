/**
 * Phase 4: Content Enhancement using OpenRouter
 */

const { completeText } = require('../services/openrouter');

const ENHANCEMENT_PROMPT = `You are a luxury travel content writer for high-net-worth safari travelers.

Enhance the following safari segment description:
- Expand by 100-200% with vivid sensory details
- Preserve ALL factual information exactly
- Add luxury keywords: exclusive, bespoke, curated, intimate, authentic
- Maintain elegant, sophisticated tone
- DO NOT add fictional details or pricing

Original:
{description}

Respond with ONLY the enhanced text, no explanation or preamble:`;

const CONCURRENCY = 5;

async function enhance(rawData) {
  console.log('[Enhance] Starting content enhancement');

  const enhancedData = JSON.parse(JSON.stringify(rawData.itinerary));

  // Find all segments with descriptions
  const segments = [];
  findSegmentsWithDescriptions(enhancedData, segments);

  console.log(`[Enhance] Found ${segments.length} segments to enhance`);

  // Process in batches to respect rate limits
  for (let i = 0; i < segments.length; i += CONCURRENCY) {
    const batch = segments.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (segment) => {
      if (!segment.description || segment.description.length < 50) {
        return;
      }

      try {
        const prompt = ENHANCEMENT_PROMPT.replace('{description}', segment.description);
        const enhanced = await completeText(prompt);

        if (enhanced && enhanced.length > segment.description.length) {
          segment.enhancedDescription = enhanced.trim();
          console.log(`[Enhance] Enhanced: ${segment.title || segment.name || 'segment'}`);
        } else {
          segment.enhancedDescription = segment.description;
        }
      } catch (error) {
        console.error(`[Enhance] Failed: ${error.message}`);
        segment.enhancedDescription = segment.description;
      }
    }));

    // Small delay between batches
    if (i + CONCURRENCY < segments.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('[Enhance] Enhancement complete');
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
