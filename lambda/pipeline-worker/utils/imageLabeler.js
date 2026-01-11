const { GoogleGenerativeAI } = require('@google/generative-ai');

const LABELING_PROMPT = `Analyze this safari/travel image and provide labels in JSON format.

Respond ONLY with valid JSON, no markdown, no explanation:

{
  "location": "Specific location if identifiable (e.g., 'Serengeti National Park', 'Masai Mara'), or general region (e.g., 'East African savanna')",
  "country": "One of: Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique, Unknown",
  "imageType": "One of: wildlife, landscape, accommodation, activity, people, food, aerial, detail",
  "animals": ["list", "of", "animals", "visible"],
  "tags": ["5-10", "searchable", "keywords", "describing", "the", "image"],
  "altText": "Accessibility description for screen readers, 10-20 words",
  "isHero": true or false (is this image striking/beautiful enough for a hero banner?),
  "quality": "high, medium, or low"
}`;

async function labelImage(imageBuffer) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[ImageLabeler] GEMINI_API_KEY not set, using defaults');
    return getDefaultLabels();
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64')
        }
      },
      { text: LABELING_PROMPT }
    ]);

    const text = result.response.text();

    // Extract JSON from response (may have markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find raw JSON
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      }
    }

    const labels = JSON.parse(jsonStr.trim());

    // Validate and normalize
    return {
      location: labels.location || 'Unknown',
      country: normalizeCountry(labels.country),
      imageType: normalizeImageType(labels.imageType),
      animals: Array.isArray(labels.animals) ? labels.animals : [],
      tags: Array.isArray(labels.tags) ? labels.tags : ['safari', 'travel'],
      altText: labels.altText || 'Safari travel image',
      isHero: Boolean(labels.isHero),
      quality: normalizeQuality(labels.quality)
    };

  } catch (error) {
    console.error('[ImageLabeler] Labeling failed:', error.message);
    return getDefaultLabels();
  }
}

function normalizeCountry(country) {
  const validCountries = [
    'Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa',
    'Zimbabwe', 'Zambia', 'Namibia', 'Uganda', 'Mozambique'
  ];

  if (!country) return 'Unknown';

  // Case-insensitive match
  const match = validCountries.find(c =>
    c.toLowerCase() === country.toLowerCase()
  );

  return match || 'Unknown';
}

function normalizeImageType(type) {
  const validTypes = [
    'wildlife', 'landscape', 'accommodation', 'activity',
    'people', 'food', 'aerial', 'detail'
  ];

  if (!type) return 'landscape';

  const match = validTypes.find(t =>
    t.toLowerCase() === type.toLowerCase()
  );

  return match || 'landscape';
}

function normalizeQuality(quality) {
  const validQualities = ['high', 'medium', 'low'];

  if (!quality) return 'medium';

  const match = validQualities.find(q =>
    q.toLowerCase() === quality.toLowerCase()
  );

  return match || 'medium';
}

function getDefaultLabels() {
  return {
    location: 'Unknown',
    country: 'Unknown',
    imageType: 'landscape',
    animals: [],
    tags: ['safari', 'travel', 'africa'],
    altText: 'Safari travel image',
    isHero: false,
    quality: 'medium'
  };
}

module.exports = { labelImage, getDefaultLabels };
