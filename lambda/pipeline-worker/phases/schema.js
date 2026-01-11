function generateSchema(enhancedData, price, itineraryId, mediaUrls = []) {
  console.log('[Schema] Generating Product schema');

  // Extract title
  const title = enhancedData.name || enhancedData.title || 'Safari Itinerary';

  // Build description from first few segments
  let description = '';
  const segments = [];
  findSegments(enhancedData, segments);

  for (const seg of segments.slice(0, 3)) {
    const text = seg.enhancedDescription || seg.description || '';
    if (text) {
      description += text + ' ';
      if (description.length > 400) break;
    }
  }
  description = description.trim().substring(0, 500);

  // Convert price from cents to dollars
  const priceInDollars = price > 100 ? (price / 100).toFixed(2) : price.toFixed(2);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': title,
    'description': description,
    'image': mediaUrls.slice(0, 5),
    'brand': {
      '@type': 'Brand',
      'name': 'Kiuli'
    },
    'sku': itineraryId,
    'offers': {
      '@type': 'Offer',
      'priceCurrency': 'USD',
      'price': priceInDollars,
      'availability': 'https://schema.org/InStock',
      'url': `https://kiuli.com/itineraries/${itineraryId}`
    }
  };

  console.log(`[Schema] Generated schema for "${title}" at $${priceInDollars}`);
  return schema;
}

function findSegments(obj, segments) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(item => findSegments(item, segments));
  } else {
    if (obj.description || obj.enhancedDescription) {
      segments.push(obj);
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        findSegments(value, segments);
      }
    }
  }
}

module.exports = { generateSchema };
