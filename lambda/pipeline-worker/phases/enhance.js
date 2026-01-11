const { GoogleGenerativeAI } = require('@google/generative-ai');

const ENHANCEMENT_PROMPT = `You are a luxury travel content writer creating content for high-net-worth travelers.

Enhance the following travel description:
- Expand by 100-200% with vivid sensory details
- Preserve ALL factual information exactly
- Add luxury keywords: exclusive, bespoke, curated, intimate, authentic
- Include emotional resonance: anticipation, wonder, transformation
- Maintain elegant, sophisticated tone
- DO NOT add fictional details or pricing

Original:
{description}

Enhanced:`;

const CONCURRENCY = 5;

async function enhance(rawData) {
  console.log('[Enhance] Starting content enhancement');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const enhancedData = JSON.parse(JSON.stringify(rawData.itinerary));

  // Find all segments with descriptions
  const segments = [];
  findSegmentsWithDescriptions(enhancedData, segments);

  console.log(`[Enhance] Found ${segments.length} segments to enhance`);

  // Process in batches
  for (let i = 0; i < segments.length; i += CONCURRENCY) {
    const batch = segments.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (segment) => {
      if (!segment.description || segment.description.length < 50) {
        return;
      }

      try {
        const prompt = ENHANCEMENT_PROMPT.replace('{description}', segment.description);
        const result = await model.generateContent(prompt);
        const enhanced = result.response.text();

        if (enhanced && enhanced.length > segment.description.length) {
          segment.enhancedDescription = enhanced;
          console.log(`[Enhance] Enhanced segment: ${segment.title || 'untitled'}`);
        }
      } catch (err) {
        console.error(`[Enhance] Failed to enhance segment: ${err.message}`);
        segment.enhancedDescription = segment.description;
      }
    }));

    // Small delay between batches
    if (i + CONCURRENCY < segments.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('[Enhance] Enhancement complete');
  return enhancedData;
}

function findSegmentsWithDescriptions(obj, segments, path = '') {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => findSegmentsWithDescriptions(item, segments, `${path}[${idx}]`));
  } else {
    if (obj.description && typeof obj.description === 'string') {
      segments.push(obj);
    }
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        findSegmentsWithDescriptions(value, segments, `${path}.${key}`);
      }
    }
  }
}

module.exports = { enhance };
