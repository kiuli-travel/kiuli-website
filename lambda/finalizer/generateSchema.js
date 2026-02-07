/**
 * JSON-LD Schema Generator
 *
 * Generates schema.org markup for SEO:
 * - Product schema for the itinerary
 * - FAQPage schema (separate, not nested)
 * - BreadcrumbList schema for navigation
 */

const SITE_URL = 'https://kiuli.com';

/**
 * Generate all JSON-LD schemas for an itinerary
 *
 * Returns an object with separate schemas that should each be rendered
 * as individual <script type="application/ld+json"> blocks
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

  // Deduplicate images: use Set to ensure no duplicates, hero image first
  const allImages = heroImageUrl
    ? [heroImageUrl, ...imageUrls.filter(url => url !== heroImageUrl)]
    : imageUrls;
  const uniqueImages = [...new Set(allImages)];

  const slug = itinerary.slug;
  const title = (itinerary.title || '').trim();
  const pageUrl = `${SITE_URL}/safaris/${slug}`;

  // 1. Product schema
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': title,
    'description': itinerary.metaDescription || `A ${nights}-night luxury safari through ${countryList}`,
    'url': pageUrl,
    'brand': {
      '@type': 'Brand',
      'name': 'Kiuli',
      'url': SITE_URL
    },
    'category': 'Safari Tours',
    'image': uniqueImages,
    'offers': {
      '@type': 'Offer',
      'priceCurrency': currency,
      'price': price,
      'priceValidUntil': getNextYear(),
      'availability': 'https://schema.org/InStock',
      'url': pageUrl,
      'seller': {
        '@type': 'TravelAgency',
        'name': 'Kiuli',
        'url': SITE_URL
      }
    },
    'additionalProperty': [
      {
        '@type': 'PropertyValue',
        'name': 'Duration',
        'value': `${nights} nights`
      },
      {
        '@type': 'PropertyValue',
        'name': 'Destinations',
        'value': countryList
      }
    ]
  };

  // 2. FAQ schema (separate from Product, per Google guidelines)
  let faqSchema = null;
  if (itinerary.faqItems && itinerary.faqItems.length > 0) {
    const validFaqItems = itinerary.faqItems.filter(faq => {
      const question = faq.question || '';
      const answerText = extractTextFromRichText(faq.answerEnhanced || faq.answerItrvl || faq.answerOriginal);
      // Skip FAQs with "Unknown" placeholder content
      const hasUnknown = /unknown/i.test(question) || /unknown/i.test(answerText);
      return !hasUnknown && answerText.trim().length > 0;
    });

    const filteredCount = itinerary.faqItems.length - validFaqItems.length;
    if (filteredCount > 0) {
      console.log(`[Schema] Filtered ${filteredCount} FAQs with empty/invalid answers`);
    }

    if (validFaqItems.length > 0) {
      faqSchema = {
        '@context': 'https://schema.org',
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

  // 3. Breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_URL
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Safaris',
        'item': `${SITE_URL}/safaris`
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': title,
        'item': pageUrl
      }
    ]
  };

  // Return all schemas
  // The main 'product' schema is what the validator checks
  // Additional schemas are stored for frontend rendering
  return {
    product: productSchema,
    faq: faqSchema,
    breadcrumbs: breadcrumbSchema,
    // Legacy: keep '@context' and '@type' at root level for validator compatibility
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...productSchema
  };
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
