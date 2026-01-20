/**
 * Transform Logic for V6 Pipeline
 *
 * Converts scraped data to V6 schema format
 * Uses *Original fields for scraped content (enhancement comes later)
 */

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
 * Extract countries from segments
 */
function extractCountries(segments) {
  const countries = new Set();

  for (const segment of segments) {
    if (segment.country) countries.add(segment.country);
    if (segment.countryName) countries.add(segment.countryName);
  }

  return Array.from(countries).filter(c => c && !c.toLowerCase().includes('unknown'));
}

/**
 * Extract highlights from segments
 * Note: iTrvl data has name=null, property name is in title or supplierName
 */
function extractHighlights(segments) {
  const highlights = [];

  for (const segment of segments) {
    if (segment.type === 'stay' || segment.type === 'accommodation') {
      const propertyName = segment.name || segment.title || segment.supplierName;
      if (propertyName) {
        highlights.push(propertyName);
      }
    }
  }

  return [...new Set(highlights)].slice(0, 8);
}

/**
 * Calculate total nights
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
 * Group segments by day using startDate calculation
 * @param {Array} segments - Raw segments from iTrvl
 * @param {string} itineraryStartDate - Trip start date (e.g., "2026-06-14")
 */
function groupSegmentsByDay(segments, itineraryStartDate) {
  const dayMap = new Map();

  // Parse itinerary start date (midnight UTC to avoid timezone issues)
  let tripStart = null;
  if (itineraryStartDate) {
    tripStart = new Date(itineraryStartDate.slice(0, 10) + 'T00:00:00Z');
  }

  for (const segment of segments) {
    let dayNum = 1; // Default to day 1

    // Calculate day number from startDate relative to trip start
    if (segment.startDate && tripStart) {
      const segDate = new Date(segment.startDate.slice(0, 10) + 'T00:00:00Z');
      const diffMs = segDate.getTime() - tripStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      dayNum = Math.max(1, diffDays + 1); // Day 1 = first day, ensure at least 1
    }

    if (!dayMap.has(dayNum)) {
      // Use segment startDate, or itinerary startDate for Day 1 as fallback
      let dayDate = null;
      if (segment.startDate) {
        dayDate = segment.startDate.slice(0, 10);
      } else if (dayNum === 1 && itineraryStartDate) {
        dayDate = itineraryStartDate.slice(0, 10);
      }

      dayMap.set(dayNum, {
        dayNumber: dayNum,
        date: dayDate,
        title: null,
        location: null,
        segments: []
      });
    }

    const day = dayMap.get(dayNum);

    // Collect location from any segment
    if (!day.location && (segment.location || segment.locationName)) {
      day.location = segment.location || segment.locationName;
    }

    day.segments.push(segment);
  }

  // Second pass: Generate titles for all days
  const dayArray = Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);

  for (const day of dayArray) {
    day.title = generateDayTitle(day);
  }

  return dayArray;
}

/**
 * Generate a title for a day based on its segments
 * Priority:
 * 1. If day has stay segment → use accommodation name
 * 2. If day has activity only → use location + first activity
 * 3. Fallback → "Day {n} - {location}" or "Day {n}"
 *
 * @param {Object} day - Day object with dayNumber, location, segments
 * @returns {string} Generated title
 */
function generateDayTitle(day) {
  const { dayNumber, location, segments } = day;

  // Check for stay segment first
  const staySegment = segments.find(s =>
    s.type === 'stay' || s.type === 'accommodation'
  );

  if (staySegment) {
    const accommodationName = staySegment.name || staySegment.title || staySegment.supplierName;
    if (accommodationName) {
      return accommodationName;
    }
  }

  // Check for activity segments
  const activitySegment = segments.find(s =>
    s.type === 'service' || s.type === 'activity'
  );

  if (activitySegment) {
    const activityName = activitySegment.name || activitySegment.title;
    if (activityName && location) {
      return `${location} - ${activityName}`;
    }
    if (activityName) {
      return activityName;
    }
  }

  // Check for significant transfer (entry/exit points often have meaningful names)
  const transferSegment = segments.find(s =>
    s.type === 'entry' || s.type === 'exit' || s.type === 'flight'
  );

  if (transferSegment) {
    const transferTitle = transferSegment.name || transferSegment.title;
    if (transferTitle && !transferTitle.toLowerCase().includes('transfer')) {
      return transferTitle;
    }
  }

  // Fallback: Use location if available
  if (location) {
    return `Day ${dayNumber} - ${location}`;
  }

  // Final fallback
  return `Day ${dayNumber}`;
}

/**
 * Convert plain text to Lexical richText format
 */
function textToRichText(text) {
  if (!text) return null;

  return {
    root: {
      children: [
        {
          children: [
            { text: text, type: 'text' }
          ],
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  };
}

/**
 * Map segment to V6 block format
 * Uses *Original fields - enhanced versions added later
 */
function mapSegmentToBlock(segment, mediaMapping = {}) {
  const type = segment.type?.toLowerCase();

  let blockType = null;
  if (type === 'stay' || type === 'accommodation') {
    blockType = 'stay';
  } else if (type === 'service' || type === 'activity') {
    blockType = 'activity';
  } else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' || type === 'entry' || type === 'exit' || type === 'point') {
    blockType = 'transfer';
  } else {
    // Log unknown segment types for debugging
    console.log(`[Transform] Unknown segment type: ${type}, skipping`);
    return null;
  }

  // Get image IDs (will be populated after image processing)
  const imageIds = [];
  if (segment.images && Array.isArray(segment.images)) {
    for (const img of segment.images) {
      const s3Key = typeof img === 'string' ? img : img.s3Key || img.key;
      if (s3Key && mediaMapping[s3Key]) {
        imageIds.push(mediaMapping[s3Key]);
      }
    }
  }

  if (blockType === 'stay') {
    return {
      blockType: 'stay',
      accommodationName: segment.name || segment.title || 'Accommodation',
      // V6: Use descriptionOriginal for scraped content
      descriptionOriginal: textToRichText(segment.description),
      descriptionEnhanced: null,
      nights: segment.nights || 1,
      location: segment.location || segment.locationName || null,
      country: segment.country || segment.countryName || null,
      images: imageIds,
      inclusions: textToRichText(segment.inclusions || segment.included),
      roomType: segment.roomType || null,
    };
  }

  if (blockType === 'activity') {
    return {
      blockType: 'activity',
      title: segment.name || segment.title || 'Activity',
      descriptionOriginal: textToRichText(segment.description),
      descriptionEnhanced: null,
      images: imageIds,
    };
  }

  if (blockType === 'transfer') {
    // Map segment type to transfer type (including entry/exit/point)
    let transferType = 'road';
    if (type === 'flight') transferType = 'flight';
    if (type === 'boat') transferType = 'boat';
    if (type === 'entry') transferType = 'entry';
    if (type === 'exit') transferType = 'exit';
    if (type === 'point') transferType = 'point';

    // Build title for entry/exit/point segments
    let title = segment.name || segment.title || segment.description || 'Transfer';
    if (type === 'entry' || type === 'exit' || type === 'point') {
      // These segments often have location info in travelHubCode or transitPointCode
      const locationCode = segment.travelHubCode || segment.transitPointCode || '';
      if (locationCode && !title.includes(locationCode)) {
        title = `${title} (${locationCode})`.trim();
      }
    }

    return {
      blockType: 'transfer',
      type: transferType,
      title: title,
      from: segment.startLocation?.name || segment.from || segment.location || null,
      to: segment.endLocation?.name || segment.to || null,
      descriptionOriginal: textToRichText(segment.description),
      descriptionEnhanced: null,
      departureTime: segment.departureTime || null,
      arrivalTime: segment.arrivalTime || null,
    };
  }

  return null;
}

/**
 * Generate FAQ items (V6 format with *Original fields)
 */
function generateFaqItems(segments, title, countries) {
  const faqItems = [];

  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  for (const stay of stays.slice(0, 3)) {
    if (stay.name) {
      faqItems.push({
        question: `What is included at ${stay.name}?`,
        answerOriginal: textToRichText(
          stay.inclusions || stay.description ||
          `${stay.name} offers luxury accommodation with full board and activities as specified in the itinerary.`
        ),
        answerEnhanced: null,
      });
    }
  }

  const countryList = countries.length > 0 ? countries.join(' and ') : 'East Africa';

  faqItems.push({
    question: `What is the best time to visit ${countryList}?`,
    answerOriginal: textToRichText(
      `${countryList} offers excellent wildlife viewing year-round. Our travel designers can advise on the optimal timing based on your specific interests.`
    ),
    answerEnhanced: null,
  });

  faqItems.push({
    question: 'What level of fitness is required for this safari?',
    answerOriginal: textToRichText(
      'This safari is suitable for most fitness levels. Game drives involve sitting in comfortable vehicles, and bush walks can be adjusted to your pace.'
    ),
    answerEnhanced: null,
  });

  faqItems.push({
    question: 'Is this safari suitable for children?',
    answerOriginal: textToRichText(
      'Family safaris are a specialty. Some lodges have age restrictions for certain activities, but we can customize the itinerary for travelers of all ages.'
    ),
    answerEnhanced: null,
  });

  faqItems.push({
    question: 'What should I pack for this safari?',
    answerOriginal: textToRichText(
      'We recommend neutral-colored clothing, comfortable walking shoes, sun protection, binoculars, and a camera. A detailed packing list will be provided upon booking.'
    ),
    answerEnhanced: null,
  });

  return faqItems;
}

/**
 * Generate meta fields
 */
function generateMetaFields(title, nights, countries) {
  const countryList = countries.length > 0 ? countries.join(' & ') : 'Africa';
  const metaTitle = `${title} | ${nights}-Night Luxury Safari`.trim().substring(0, 60);
  const metaDescription = `Experience a ${nights}-night luxury safari through ${countryList}. Exclusive lodges, expert guides, and unforgettable wildlife encounters. Inquire with Kiuli today.`.substring(0, 160);

  return { metaTitle, metaDescription };
}

/**
 * Main transform function
 */
async function transform(rawData, mediaMapping = {}, itrvlUrl) {
  console.log('[Transform] Starting V6 transformation');

  const itinerary = rawData.itinerary?.itineraries?.[0] ||
                    rawData.itinerary ||
                    rawData;

  const segments = itinerary.segments || [];
  const title = (itinerary.name || itinerary.itineraryName || 'Safari Itinerary').trim();
  const priceInCents = rawData.price || itinerary.sellFinance || 0;
  const itineraryId = itinerary.id || rawData.itineraryId;

  console.log(`[Transform] Processing: ${title}`);
  console.log(`[Transform] Segments: ${segments.length}`);

  const slug = generateSlug(title);
  const nights = calculateNights(segments, itinerary);
  const countries = extractCountries(segments);
  const highlights = extractHighlights(segments);

  console.log(`[Transform] Nights: ${nights}, Countries: ${countries.join(', ')}`);

  const groupedDays = groupSegmentsByDay(segments, itinerary.startDate);

  const days = groupedDays.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    location: day.location,
    segments: day.segments
      .map(s => mapSegmentToBlock(s, mediaMapping))
      .filter(Boolean)
  }));

  const faqItems = generateFaqItems(segments, title, countries);
  const { metaTitle, metaDescription } = generateMetaFields(title, nights, countries);

  const transformed = {
    // Basic
    title,
    slug,
    itineraryId,

    // SEO
    metaTitle,
    metaDescription,

    // Overview with V6 *Original fields
    overview: {
      summaryOriginal: textToRichText(itinerary.summary || itinerary.description || `A ${nights}-night luxury safari through ${countries.join(' and ')}.`),
      summaryEnhanced: null,
      nights,
      countries: countries.map(c => ({ country: c })),
      highlights: highlights.map(h => ({ highlight: h })),
    },

    // Investment
    investmentLevel: {
      fromPrice: Math.round(priceInCents / 100),
      currency: 'USD',
    },

    // Structured days
    days,

    // FAQ with V6 format
    faqItems,

    // Why Kiuli (V6 format)
    whyKiuliOriginal: textToRichText('Kiuli delivers exceptional safari experiences with expert local knowledge, exclusive access, and personalized service that turns your African dream into reality.'),
    whyKiuliEnhanced: null,

    // Images (populated after image processing)
    images: Object.values(mediaMapping),

    // Source
    source: {
      itrvlUrl,
      lastScrapedAt: new Date().toISOString(),
      rawData: rawData,
    },

    // Build info
    buildTimestamp: new Date().toISOString(),
    _status: 'draft',
  };

  console.log(`[Transform] Complete: ${days.length} days, ${faqItems.length} FAQs`);

  return transformed;
}

module.exports = { transform, generateSlug, textToRichText };
