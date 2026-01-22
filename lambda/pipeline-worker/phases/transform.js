/**
 * Phase 6: Transform — Convert scraped data to V7 structured format
 *
 * V7 Two-Field Pattern:
 * - *Itrvl fields: Original data from iTrvl (read-only)
 * - *Enhanced fields: AI-enhanced content (null initially)
 * - *Reviewed flags: Editorial review status (false initially)
 *
 * Input: Raw scraped data + enhanced content + media mapping
 * Output: V7 structured data ready for Payload ingest
 */

const { convertToRichText } = require('../utils/richTextConverter');

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Select the best hero image from media mapping
 */
function selectHeroImage(mediaMapping, mediaRecords) {
  console.log(`[Transform] selectHeroImage called with ${Object.keys(mediaMapping || {}).length} mappings, ${(mediaRecords || []).length} records`);

  // Fallback: use first image from mediaMapping if no mediaRecords
  if (!mediaRecords || mediaRecords.length === 0) {
    const ids = Object.values(mediaMapping || {});
    const heroId = ids.length > 0 ? ids[0] : null;
    console.log(`[Transform] No mediaRecords, using first from mapping: ${heroId}`);
    return heroId;
  }

  // Priority: hero > high-quality wildlife/landscape > any wildlife/landscape > first
  const heroImage = mediaRecords.find(m => m.labels?.isHero === true);
  if (heroImage) {
    console.log(`[Transform] Found labeled hero image: ${heroImage.payloadId}`);
    return heroImage.payloadId;
  }

  const highQuality = mediaRecords.find(m =>
    m.labels?.quality === 'high' &&
    ['wildlife', 'landscape'].includes(m.labels?.imageType)
  );
  if (highQuality) {
    console.log(`[Transform] Found high-quality image: ${highQuality.payloadId}`);
    return highQuality.payloadId;
  }

  const wildlife = mediaRecords.find(m =>
    ['wildlife', 'landscape'].includes(m.labels?.imageType)
  );
  if (wildlife) {
    console.log(`[Transform] Found wildlife/landscape image: ${wildlife.payloadId}`);
    return wildlife.payloadId;
  }

  const fallbackId = mediaRecords[0]?.payloadId || Object.values(mediaMapping)[0] || null;
  console.log(`[Transform] Using fallback hero image: ${fallbackId}`);
  return fallbackId;
}

/**
 * Extract countries from segments
 */
function extractCountries(segments) {
  const countries = new Set();
  for (const segment of segments) {
    if (segment.country) countries.add(segment.country);
    if (segment.countryName) countries.add(segment.countryName);
  }
  return Array.from(countries).filter(c => c && c !== 'Unknown');
}

/**
 * Extract highlights from segments
 */
function extractHighlights(segments) {
  const highlights = [];
  for (const segment of segments) {
    if ((segment.type === 'stay' || segment.type === 'accommodation') && segment.name) {
      highlights.push(segment.name);
    }
  }
  return [...new Set(highlights)].slice(0, 8);
}

/**
 * Calculate total nights from segments
 */
function calculateNights(segments, rawItinerary) {
  if (rawItinerary?.nights) return rawItinerary.nights;

  let nights = 0;
  for (const segment of segments) {
    if ((segment.type === 'stay' || segment.type === 'accommodation') && segment.nights) {
      nights += segment.nights;
    }
  }
  return nights || 7;
}

/**
 * Generate a title for a day based on its segments
 * Priority: Stay name > Activity title > Location > Fallback
 */
function generateDayTitle(day) {
  const { dayNumber, location, segments } = day;

  // Check for stay segment
  const staySegment = segments.find(s => s.type === 'stay' || s.type === 'accommodation');
  if (staySegment) {
    const name = staySegment.name || staySegment.title || staySegment.supplierName;
    if (name) return name;
  }

  // Check for activity
  const activitySegment = segments.find(s => s.type === 'service' || s.type === 'activity');
  if (activitySegment) {
    const name = activitySegment.name || activitySegment.title;
    if (name && location) return `${location} - ${name}`;
    if (name) return name;
  }

  // Check for significant transfer
  const transferSegment = segments.find(s => s.type === 'entry' || s.type === 'exit' || s.type === 'flight');
  if (transferSegment) {
    const name = transferSegment.name || transferSegment.title;
    if (name && !name.toLowerCase().includes('transfer')) return name;
  }

  if (location) return `Day ${dayNumber} - ${location}`;
  return `Day ${dayNumber}`;
}

/**
 * Group segments by day
 */
function groupSegmentsByDay(segments) {
  const dayMap = new Map();

  for (const segment of segments) {
    let dayNum = segment.day || segment.dayNumber || 1;
    if (!dayNum && segment.sequence) {
      dayNum = Math.ceil(segment.sequence / 3);
    }

    if (!dayMap.has(dayNum)) {
      dayMap.set(dayNum, {
        dayNumber: dayNum,
        date: segment.startDate || null,
        location: null,
        segments: []
      });
    }

    const day = dayMap.get(dayNum);
    if (!day.location && (segment.location || segment.locationName)) {
      day.location = segment.location || segment.locationName;
    }
    day.segments.push(segment);
  }

  return Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);
}

/**
 * Extract 'to' destination from transfer title
 */
function extractTransferTo(title) {
  if (!title) return null;

  // Pattern: "Transfer to X", "Flight to X", "Drive to X"
  const toMatch = title.match(/(?:transfer|flight|drive|road)\s+to\s+([^,\-]+)/i);
  if (toMatch) return toMatch[1].trim();

  // Pattern: "X to Y"
  const fromToMatch = title.match(/\bto\s+([^,\-]+)$/i);
  if (fromToMatch) return fromToMatch[1].trim();

  return null;
}

/**
 * Map inclusions from clientIncludeExclude array
 */
function mapInclusions(segment) {
  const raw = segment.clientIncludeExclude || segment.inclusions || segment.included;

  if (typeof raw === 'string') return raw;

  if (Array.isArray(raw)) {
    return raw
      .filter(item => item.included === true || item.type === 'included')
      .map(item => item.name || item.description || item)
      .join('\n');
  }

  return '';
}

/**
 * Extract s3Keys from various possible image locations on a segment
 * iTrvl data can have images in different structures:
 * - segment.images: ['s3key', ...] or [{s3Key: 'key'}, ...]
 * - segment.photos: similar
 * - segment.media: similar
 * - segment.headerImage: 's3key'
 * - segment.accommodation.images: nested
 * - segment.supplier.images: nested
 */
function extractSegmentImageKeys(segment) {
  const keys = [];

  // Helper to extract from an array
  const extractFromArray = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === 'string' && item.length > 0) {
        keys.push(item);
      } else if (item && typeof item === 'object') {
        const key = item.s3Key || item.key || item.url || item.src;
        if (key && typeof key === 'string') keys.push(key);
      }
    }
  };

  // Check common image locations
  extractFromArray(segment.images);
  extractFromArray(segment.photos);
  extractFromArray(segment.media);
  extractFromArray(segment.gallery);

  // Check for single header image
  if (segment.headerImage && typeof segment.headerImage === 'string') {
    keys.push(segment.headerImage);
  }
  if (segment.image && typeof segment.image === 'string') {
    keys.push(segment.image);
  }

  // Check nested objects
  if (segment.accommodation) {
    extractFromArray(segment.accommodation.images);
    extractFromArray(segment.accommodation.photos);
    if (segment.accommodation.headerImage) keys.push(segment.accommodation.headerImage);
  }
  if (segment.supplier) {
    extractFromArray(segment.supplier.images);
    extractFromArray(segment.supplier.photos);
    if (segment.supplier.headerImage) keys.push(segment.supplier.headerImage);
  }
  if (segment.property) {
    extractFromArray(segment.property.images);
    extractFromArray(segment.property.photos);
  }

  return [...new Set(keys)]; // Deduplicate
}

/**
 * Map segment to V7 block structure
 */
function mapSegmentToBlock(segment, mediaMapping) {
  const type = segment.type?.toLowerCase();

  // Determine block type - map iTrvl segment types to Payload block types
  let blockType = null;
  let transferType = null;

  if (type === 'stay' || type === 'accommodation') {
    blockType = 'stay';
  } else if (type === 'service' || type === 'activity' || type === 'point') {
    // 'point' = point of interest, treat as activity
    blockType = 'activity';
  } else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' ||
             type === 'entry' || type === 'exit') {
    // entry/exit are arrival/departure transfers
    blockType = 'transfer';
    // Map to transfer type for the select field
    if (type === 'flight') transferType = 'flight';
    else if (type === 'boat') transferType = 'boat';
    else if (type === 'entry') transferType = 'entry';
    else if (type === 'exit') transferType = 'exit';
    else transferType = 'road';
  } else {
    console.warn(`[Transform] Unknown segment type: ${type}, skipping`);
    return null; // Skip truly unknown types
  }

  // Get media IDs using enhanced extraction
  const imageIds = [];
  const segmentName = segment.name || segment.title || segment.supplierName || 'unknown';

  // DEBUG: Log segment structure (first segment only to avoid log spam)
  const segmentKeys = Object.keys(segment);
  console.log(`[Transform] Segment "${segmentName}" keys: ${segmentKeys.join(', ')}`);

  // Extract image keys from all possible locations
  const imageKeys = extractSegmentImageKeys(segment);
  console.log(`[Transform] Segment "${segmentName}" found ${imageKeys.length} image keys from structure`);

  // Map keys to Payload media IDs
  for (const s3Key of imageKeys) {
    if (mediaMapping[s3Key]) {
      imageIds.push(mediaMapping[s3Key]);
      console.log(`[Transform]   - "${s3Key}" -> mediaId: ${mediaMapping[s3Key]}`);
    } else {
      console.log(`[Transform]   - "${s3Key}" NOT FOUND in mediaMapping`);
    }
  }

  // If no images found directly, check if there's an images property that's not an array
  if (imageIds.length === 0 && segment.images) {
    console.log(`[Transform] segment.images exists but no IDs extracted. Type: ${typeof segment.images}, value:`,
      typeof segment.images === 'object' ? JSON.stringify(segment.images).substring(0, 200) : segment.images);
  }

  console.log(`[Transform] Segment "${segmentName}" final imageIds: ${imageIds.length}`);

  // Build V7 block based on type
  if (blockType === 'stay') {
    const accommodationName = segment.name || segment.title || 'Accommodation';
    const description = segment.enhancedDescription || segment.description || '';
    const inclusions = mapInclusions(segment);

    return {
      blockType: 'stay',
      // V7 two-field pattern for accommodationName
      accommodationNameItrvl: accommodationName,
      accommodationNameEnhanced: null,
      accommodationNameReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: convertToRichText(description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      // V7 two-field pattern for inclusions
      inclusionsItrvl: convertToRichText(inclusions),
      inclusionsEnhanced: null,
      inclusionsReviewed: false,
      // Other fields
      nights: segment.nights || 1,
      location: segment.location || segment.locationName || null,
      country: segment.country || segment.countryName || null,
      images: imageIds,
      imagesReviewed: false,
      roomType: segment.roomType || null,
    };
  }

  if (blockType === 'activity') {
    const title = segment.name || segment.title || 'Activity';
    const description = segment.enhancedDescription || segment.description || '';

    return {
      blockType: 'activity',
      // V7 two-field pattern for title
      titleItrvl: title,
      titleEnhanced: null,
      titleReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: convertToRichText(description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      // Other fields
      images: imageIds,
      imagesReviewed: false,
    };
  }

  if (blockType === 'transfer') {
    // Use the transferType we computed earlier (entry, exit, flight, boat, or road)
    const finalTransferType = transferType || 'road';

    const title = segment.name || segment.title || 'Transfer';
    const description = segment.enhancedDescription || segment.description || '';
    const toDestination = segment.endLocation?.name || segment.to || extractTransferTo(title);

    return {
      blockType: 'transfer',
      // V7 two-field pattern for title
      titleItrvl: title,
      titleEnhanced: null,
      titleReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: convertToRichText(description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      // Other fields
      type: finalTransferType,
      from: segment.startLocation?.name || segment.from || null,
      to: toDestination,
      departureTime: segment.departureTime || null,
      arrivalTime: segment.arrivalTime || null,
    };
  }

  return null;
}

/**
 * Generate FAQ items with V7 pattern
 */
function generateFaqItems(segments, title, countries) {
  const faqItems = [];

  // FAQ about each accommodation
  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  for (const stay of stays.slice(0, 3)) {
    if (stay.name) {
      const question = `What is included at ${stay.name}?`;
      const answer = stay.inclusions || stay.description ||
        `${stay.name} offers luxury accommodation with full board and activities as specified in the itinerary.`;

      faqItems.push({
        questionItrvl: question,
        questionEnhanced: null,
        questionReviewed: false,
        answerItrvl: convertToRichText(answer),
        answerEnhanced: null,
        answerReviewed: false,
      });
    }
  }

  // Destination FAQ
  const countryList = countries.length > 0 ? countries.join(' and ') : 'East Africa';
  faqItems.push({
    questionItrvl: `What is the best time to visit ${countryList}?`,
    questionEnhanced: null,
    questionReviewed: false,
    answerItrvl: convertToRichText(`${countryList} offers excellent wildlife viewing year-round. Our travel designers can advise on the optimal timing based on your specific interests, whether that's the Great Migration, calving season, or particular wildlife encounters.`),
    answerEnhanced: null,
    answerReviewed: false,
  });

  // General FAQs
  faqItems.push({
    questionItrvl: 'What level of fitness is required for this safari?',
    questionEnhanced: null,
    questionReviewed: false,
    answerItrvl: convertToRichText('This safari is suitable for most fitness levels. Game drives involve sitting in comfortable vehicles, and bush walks can be adjusted to your pace. Please let us know of any mobility concerns.'),
    answerEnhanced: null,
    answerReviewed: false,
  });

  faqItems.push({
    questionItrvl: 'Is this safari suitable for children?',
    questionEnhanced: null,
    questionReviewed: false,
    answerItrvl: convertToRichText('Family safaris are a specialty. Some lodges have age restrictions for certain activities, but we can customize the itinerary to ensure an unforgettable experience for travelers of all ages.'),
    answerEnhanced: null,
    answerReviewed: false,
  });

  faqItems.push({
    questionItrvl: 'What should I pack for this safari?',
    questionEnhanced: null,
    questionReviewed: false,
    answerItrvl: convertToRichText('We recommend neutral-colored clothing, comfortable walking shoes, sun protection, binoculars, and a camera. A detailed packing list will be provided upon booking.'),
    answerEnhanced: null,
    answerReviewed: false,
  });

  return faqItems;
}

/**
 * Generate meta fields for SEO
 */
function generateMetaFields(title, nights, countries) {
  const countryList = countries.length > 0 ? countries.join(' & ') : 'Africa';
  const metaTitle = `${title} | ${nights}-Night Luxury Safari`.substring(0, 60);
  const metaDescription = `Experience a ${nights}-night luxury safari through ${countryList}. Exclusive lodges, expert guides, and unforgettable wildlife encounters. Inquire with Kiuli today.`.substring(0, 160);
  return { metaTitle, metaDescription };
}

/**
 * Generate investmentLevel.includes by aggregating inclusions from all stay segments
 */
function generateInvestmentIncludes(segments, nights) {
  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  const allInclusions = new Set();
  const accommodationNames = [];

  for (const stay of stays) {
    if (stay.name || stay.title) {
      accommodationNames.push(stay.name || stay.title);
    }

    const inclusionsText = stay.clientIncludeExclude || stay.inclusions || stay.included || '';
    if (inclusionsText) {
      const text = String(inclusionsText).toLowerCase();
      if (text.includes('meal') || text.includes('breakfast') || text.includes('dinner') || text.includes('full board')) {
        allInclusions.add('all meals');
      }
      if (text.includes('drink') || text.includes('beverage') || text.includes('wine') || text.includes('beer')) {
        allInclusions.add('premium beverages');
      }
      if (text.includes('game drive') || text.includes('safari')) {
        allInclusions.add('daily game drives');
      }
      if (text.includes('transfer') || text.includes('transport')) {
        allInclusions.add('all transfers');
      }
      if (text.includes('park fee') || text.includes('conservation')) {
        allInclusions.add('park fees');
      }
      if (text.includes('laundry')) {
        allInclusions.add('laundry service');
      }
      if (text.includes('wifi') || text.includes('wi-fi')) {
        allInclusions.add('WiFi');
      }
    }
  }

  const parts = [];
  if (accommodationNames.length > 0) {
    const uniqueNames = [...new Set(accommodationNames)];
    parts.push(`${nights} nights at ${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ' and more' : ''}`);
  }
  if (allInclusions.size > 0) {
    parts.push(Array.from(allInclusions).slice(0, 5).join(', '));
  }

  if (parts.length === 0) {
    return `Luxury accommodation for ${nights} nights with full board, game activities, and expert guiding throughout your safari experience.`;
  }
  return parts.join('. ') + '.';
}

/**
 * Main transform function — outputs V7 two-field pattern structure
 */
async function transform(rawData, enhancedData, mediaMapping, mediaRecords, itrvlUrl) {
  console.log('[Transform] Starting V7 transformation');

  // Extract itinerary data
  const itinerary = rawData.itinerary?.itineraries?.[0] ||
                    rawData.itinerary ||
                    rawData;

  const segments = itinerary.segments ||
                   enhancedData?.segments ||
                   [];

  const title = itinerary.name ||
                itinerary.itineraryName ||
                enhancedData?.name ||
                'Safari Itinerary';

  const priceInCents = rawData.price ||
                       itinerary.sellFinance ||
                       0;

  const itineraryId = itinerary.id ||
                      rawData.itineraryId;

  console.log(`[Transform] Processing: ${title}`);
  console.log(`[Transform] Segments: ${segments.length}`);

  // DEBUG: Log first segment's complete structure to understand data format
  if (segments.length > 0) {
    const firstSegment = segments[0];
    console.log(`[Transform] First segment type: ${firstSegment.type}`);
    console.log(`[Transform] First segment keys: ${Object.keys(firstSegment).join(', ')}`);
    console.log(`[Transform] First segment (truncated): ${JSON.stringify(firstSegment).substring(0, 1000)}`);

    // Find first stay segment and log its structure
    const firstStay = segments.find(s => s.type === 'stay' || s.type === 'accommodation');
    if (firstStay) {
      console.log(`[Transform] First STAY segment keys: ${Object.keys(firstStay).join(', ')}`);
      console.log(`[Transform] First STAY segment.images: ${JSON.stringify(firstStay.images)}`);
      console.log(`[Transform] First STAY segment (truncated): ${JSON.stringify(firstStay).substring(0, 1500)}`);
    }
  }

  // Calculate values
  const slug = generateSlug(title);
  const nights = calculateNights(segments, itinerary);
  const countries = extractCountries(segments);
  const highlights = extractHighlights(segments);
  const heroImage = selectHeroImage(mediaMapping, mediaRecords);
  const { metaTitle, metaDescription } = generateMetaFields(title, nights, countries);
  const investmentIncludes = generateInvestmentIncludes(segments, nights);

  console.log(`[Transform] Nights: ${nights}, Countries: ${countries.join(', ')}`);

  // Group and transform segments by day
  const groupedDays = groupSegmentsByDay(segments);
  const days = groupedDays.map(day => {
    const dayTitle = generateDayTitle(day);
    return {
      dayNumber: day.dayNumber,
      date: day.date,
      // V7 two-field pattern for day title
      titleItrvl: dayTitle,
      titleEnhanced: null,
      titleReviewed: false,
      // Location
      location: day.location,
      // V7 segments
      segments: day.segments
        .map(s => mapSegmentToBlock(s, mediaMapping))
        .filter(Boolean)
    };
  });

  // Generate FAQ items with V7 pattern
  const faqItems = generateFaqItems(segments, title, countries);

  // Get all media IDs
  const allImageIds = Object.values(mediaMapping);

  // Build V7 transformed output
  const transformed = {
    // === BASIC INFO ===
    // Display field (resolveFields hook will compute from Itrvl/Enhanced)
    title,
    slug,
    itineraryId,

    // V7 two-field pattern for title
    titleItrvl: title,
    titleEnhanced: null,
    titleReviewed: false,

    // === SEO ===
    // Display fields
    metaTitle,
    metaDescription,

    // V7 two-field pattern for metaTitle
    metaTitleItrvl: metaTitle,
    metaTitleEnhanced: null,
    metaTitleReviewed: false,

    // V7 two-field pattern for metaDescription
    metaDescriptionItrvl: metaDescription,
    metaDescriptionEnhanced: null,
    metaDescriptionReviewed: false,

    // === HERO ===
    heroImage,
    heroImageReviewed: false,

    // === OVERVIEW ===
    overview: {
      nights,
      countries: countries.map(c => ({ country: c })),
      highlights: highlights.map(h => ({ highlight: h })),
      // V7 two-field pattern for summary
      summaryItrvl: convertToRichText(itinerary.presentation?.overview || `A ${nights}-night luxury safari through ${countries.join(' and ') || 'Africa'}.`),
      summaryEnhanced: null,
      summaryReviewed: false,
    },

    // === INVESTMENT LEVEL ===
    investmentLevel: {
      fromPrice: Math.round(priceInCents / 100),
      currency: 'USD',
      // V7 two-field pattern for includes
      includesItrvl: convertToRichText(investmentIncludes),
      includesEnhanced: null,
      includesReviewed: false,
      notIncluded: null,
    },

    // === DAYS (with V7 segments) ===
    days,

    // === FAQ (with V7 pattern) ===
    faqItems,

    // === IMAGES ===
    images: allImageIds,

    // === SOURCE (hidden in admin) ===
    source: {
      itrvlUrl,
      lastScrapedAt: new Date().toISOString(),
      // Note: rawData removed to avoid payload size issues
      // Raw data available in iTrvl via itrvlUrl
    },

    // === STATUS ===
    buildTimestamp: new Date().toISOString(),
    _status: 'draft',
  };

  console.log(`[Transform] V7 Complete: ${days.length} days, ${faqItems.length} FAQs, ${allImageIds.length} images`);

  return transformed;
}

module.exports = { transform, generateSlug, selectHeroImage };
