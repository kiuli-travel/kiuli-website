/**
 * Product JSON-LD Schema Generator
 *
 * Generates schema.org Product markup for SEO
 */

const IMGIX_DOMAIN = process.env.IMGIX_DOMAIN || 'kiuli.imgix.net';
const SITE_URL = 'https://kiuli.com';

/**
 * Generate Product JSON-LD schema for an itinerary
 */
function generateSchema(itinerary, mediaRecords, heroImageId) {
  // Get hero image URL
  let heroImageUrl = null;
  if (heroImageId) {
    const heroMedia = mediaRecords.find(m => m.id === heroImageId);
    if (heroMedia) {
      heroImageUrl = heroMedia.imgixUrl || heroMedia.url;
    }
  }

  // Get all image URLs
  const imageUrls = mediaRecords
    .slice(0, 10)  // Limit to 10 images for schema
    .map(m => m.imgixUrl || m.url)
    .filter(Boolean);

  // Extract data from itinerary
  const nights = itinerary.overview?.nights || 7;
  const countries = (itinerary.overview?.countries || [])
    .map(c => c.country)
    .filter(Boolean);
  const countryList = countries.length > 0 ? countries.join(', ') : 'Africa';

  // Get price
  const price = itinerary.investmentLevel?.fromPrice || 0;
  const currency = itinerary.investmentLevel?.currency || 'USD';

  // Build schema
  // Deduplicate images: use Set to ensure no duplicates, hero image first
  const allImages = heroImageUrl
    ? [heroImageUrl, ...imageUrls.filter(url => url !== heroImageUrl)]
    : imageUrls;
  const uniqueImages = [...new Set(allImages)];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': (itinerary.title || '').trim(),  // Fix: trim whitespace
    'description': itinerary.metaDescription || `A ${nights}-night luxury safari through ${countryList}`,
    'url': `${SITE_URL}/itineraries/${itinerary.slug}`,
    'brand': {
      '@type': 'Brand',
      'name': 'Kiuli',
      'url': SITE_URL
    },
    'category': 'Luxury Safari',
    'image': uniqueImages,  // Fix: deduplicated images
    'offers': {
      '@type': 'Offer',
      'priceCurrency': currency,
      'price': price,
      'priceValidUntil': getNextYear(),
      'availability': 'https://schema.org/InStock',
      'url': `${SITE_URL}/itineraries/${itinerary.slug}`,
      'seller': {
        '@type': 'Organization',
        'name': 'Kiuli',
        'url': SITE_URL
      }
    }
  };

  // Add aggregate rating placeholder (to be filled with real reviews)
  // schema.aggregateRating = {
  //   '@type': 'AggregateRating',
  //   'ratingValue': '5',
  //   'reviewCount': '1'
  // };

  // Add FAQ schema if we have FAQ items
  // Filter out FAQ items with placeholder text like "Unknown Country"
  // V7: Use answerEnhanced ?? answerItrvl (falling back to answerOriginal for legacy)
  if (itinerary.faqItems && itinerary.faqItems.length > 0) {
    const validFaqItems = itinerary.faqItems.filter(faq => {
      const question = faq.question || '';
      const answerText = extractTextFromRichText(faq.answerEnhanced || faq.answerItrvl || faq.answerOriginal);
      // Skip FAQs with "Unknown" placeholder content
      const hasUnknown = /unknown/i.test(question) || /unknown/i.test(answerText);
      return !hasUnknown && answerText.trim().length > 0;
    });

    // Log FAQ filtering for visibility
    const filteredCount = itinerary.faqItems.length - validFaqItems.length;
    if (filteredCount > 0) {
      console.log(`[Schema] Filtered ${filteredCount} FAQs with empty/invalid answers`);
    }

    if (validFaqItems.length > 0) {
      schema.mainEntity = {
        '@type': 'FAQPage',
        'mainEntity': validFaqItems.map(faq => ({
          '@type': 'Question',
          'name': faq.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': extractTextFromRichText(faq.answerEnhanced || faq.answerItrvl || faq.answerOriginal)
          }
        }))
      };
    }
  }

  return schema;
}

/**
 * Extract plain text from Lexical richText format
 */
function extractTextFromRichText(richText) {
  if (!richText) return '';
  if (typeof richText === 'string') return richText;

  try {
    const extractText = (node) => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (node.text) return node.text;
      if (node.children) {
        return node.children.map(extractText).join('');
      }
      return '';
    };

    return extractText(richText.root || richText);
  } catch (e) {
    return '';
  }
}

/**
 * Get date one year from now (ISO format)
 */
function getNextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
}

module.exports = { generateSchema };
