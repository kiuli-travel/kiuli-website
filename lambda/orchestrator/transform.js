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
    const accommodationName = segment.name || segment.title || 'Accommodation';
    const inclusionsText = segment.clientIncludeExclude || segment.inclusions || segment.included;

    return {
      blockType: 'stay',
      // V7 two-field pattern for accommodationName
      accommodationName: accommodationName,
      accommodationNameItrvl: accommodationName,
      accommodationNameEnhanced: null,
      accommodationNameReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      nights: segment.nights || 1,
      location: segment.location || segment.locationName || null,
      country: segment.country || segment.countryName || null,
      images: imageIds,
      imagesReviewed: false,
      // V7 two-field pattern for inclusions
      inclusionsItrvl: textToRichText(inclusionsText),
      inclusionsEnhanced: null,
      inclusionsReviewed: false,
      roomType: segment.roomType || null,
    };
  }

  if (blockType === 'activity') {
    const activityTitle = segment.name || segment.title || 'Activity';

    return {
      blockType: 'activity',
      // V7 two-field pattern for title
      title: activityTitle,
      titleItrvl: activityTitle,
      titleEnhanced: null,
      titleReviewed: false,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      images: imageIds,
      imagesReviewed: false,
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

    // Extract 'to' destination from multiple sources
    let toDestination = segment.endLocation?.name || segment.to || null;

    // If no direct 'to', try to parse from title
    if (!toDestination && title) {
      // Common patterns: "Transfer to X", "Flight to X", "Drive to X"
      const toMatch = title.match(/(?:transfer|flight|drive|road)\s+to\s+([^,\-]+)/i);
      if (toMatch) {
        toDestination = toMatch[1].trim();
      }
      // Also try "X to Y" pattern
      if (!toDestination) {
        const fromToMatch = title.match(/\bto\s+([^,\-]+)$/i);
        if (fromToMatch) {
          toDestination = fromToMatch[1].trim();
        }
      }
    }

    // If still no 'to', check transitPointCode or travelHubCode for exit segments
    if (!toDestination && type === 'exit') {
      toDestination = segment.travelHubCode || segment.transitPointCode || null;
    }

    return {
      blockType: 'transfer',
      type: transferType,
      // V7 two-field pattern for title
      title: title,
      titleItrvl: title,
      titleEnhanced: null,
      titleReviewed: false,
      from: segment.startLocation?.name || segment.from || segment.location || null,
      to: toDestination,
      // V7 two-field pattern for description
      descriptionItrvl: textToRichText(segment.description),
      descriptionEnhanced: null,
      descriptionReviewed: false,
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
        answerItrvl: textToRichText(
          stay.inclusions || stay.description ||
          `${stay.name} offers luxury accommodation with full board and activities as specified in the itinerary.`
        ),
        answerEnhanced: null,
        answerReviewed: false,
      });
    }
  }

  const countryList = countries.length > 0 ? countries.join(' and ') : 'East Africa';

  faqItems.push({
    question: `What is the best time to visit ${countryList}?`,
    answerItrvl: textToRichText(
      `${countryList} offers excellent wildlife viewing year-round. Our travel designers can advise on the optimal timing based on your specific interests.`
    ),
    answerEnhanced: null,
        answerReviewed: false,
  });

  faqItems.push({
    question: 'What level of fitness is required for this safari?',
    answerItrvl: textToRichText(
      'This safari is suitable for most fitness levels. Game drives involve sitting in comfortable vehicles, and bush walks can be adjusted to your pace.'
    ),
    answerEnhanced: null,
        answerReviewed: false,
  });

  faqItems.push({
    question: 'Is this safari suitable for children?',
    answerItrvl: textToRichText(
      'Family safaris are a specialty. Some lodges have age restrictions for certain activities, but we can customize the itinerary for travelers of all ages.'
    ),
    answerEnhanced: null,
        answerReviewed: false,
  });

  faqItems.push({
    question: 'What should I pack for this safari?',
    answerItrvl: textToRichText(
      'We recommend neutral-colored clothing, comfortable walking shoes, sun protection, binoculars, and a camera. A detailed packing list will be provided upon booking.'
    ),
    answerEnhanced: null,
        answerReviewed: false,
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
 * Generate investmentLevel.includes by aggregating inclusions from all stay segments
 * Creates a summary of what's included across all accommodations
 *
 * @param {Array} segments - Raw segments from iTrvl
 * @param {number} nights - Total nights
 * @returns {string} Summary text of inclusions
 */
function generateInvestmentIncludes(segments, nights) {
  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');

  // Collect unique inclusions from all stays
  const allInclusions = new Set();
  const accommodationNames = [];

  for (const stay of stays) {
    if (stay.name || stay.title) {
      accommodationNames.push(stay.name || stay.title);
    }

    // Get inclusions from clientIncludeExclude or other fields
    const inclusionsText = stay.clientIncludeExclude || stay.inclusions || stay.included || '';
    if (inclusionsText) {
      // Parse common inclusion items
      const text = inclusionsText.toLowerCase();
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

  // Build summary text
  const parts = [];

  // Accommodation summary
  if (accommodationNames.length > 0) {
    const uniqueNames = [...new Set(accommodationNames)];
    parts.push(`${nights} nights at ${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ' and more' : ''}`);
  }

  // Inclusions summary
  if (allInclusions.size > 0) {
    const inclusionsList = Array.from(allInclusions).slice(0, 5);
    parts.push(inclusionsList.join(', '));
  }

  // Default inclusions if none found
  if (parts.length === 0) {
    return `Luxury accommodation for ${nights} nights with full board, game activities, and expert guiding throughout your safari experience.`;
  }

  return parts.join('. ') + '.';
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
    // V7 two-field pattern for day title
    titleItrvl: day.title,
    titleEnhanced: null,
    titleReviewed: false,
    location: day.location,
    segments: day.segments
      .map(s => mapSegmentToBlock(s, mediaMapping))
      .filter(Boolean)
  }));

  const faqItems = generateFaqItems(segments, title, countries);
  const { metaTitle, metaDescription } = generateMetaFields(title, nights, countries);
  const investmentIncludes = generateInvestmentIncludes(segments, nights);

  const transformed = {
    // Basic - V7 two-field pattern
    title,
    titleItrvl: title,
    titleEnhanced: null,
    titleReviewed: false,
    slug,
    itineraryId,

    // SEO - V7 two-field pattern
    metaTitle,
    metaTitleItrvl: metaTitle,
    metaTitleEnhanced: null,
    metaTitleReviewed: false,
    metaDescription,
    metaDescriptionItrvl: metaDescription,
    metaDescriptionEnhanced: null,
    metaDescriptionReviewed: false,

    // Overview with V7 *Itrvl fields
    overview: {
      summaryItrvl: textToRichText(itinerary.summary || itinerary.description || `A ${nights}-night luxury safari through ${countries.join(' and ')}.`),
      summaryEnhanced: null,
      summaryReviewed: false,
      nights,
      countries: countries.map(c => ({ country: c })),
      highlights: highlights.map(h => ({ highlight: h })),
    },

    // Investment
    investmentLevel: {
      fromPrice: Math.round(priceInCents / 100),
      currency: 'USD',
      includesItrvl: textToRichText(investmentIncludes),
      includesEnhanced: null,
      includesReviewed: false,
    },

    // Structured days
    days,

    // FAQ with V6 format
    faqItems,

    // Why Kiuli (V6 format)
    whyKiuliItrvl: textToRichText('Kiuli delivers exceptional safari experiences with expert local knowledge, exclusive access, and personalized service that turns your African dream into reality.'),
    whyKiuliEnhanced: null,
    whyKiuliReviewed: false,

    // Images (populated after image processing)
    images: Object.values(mediaMapping),

    // Source
    source: {
      itrvlUrl,
      lastScrapedAt: new Date().toISOString(),
      // Note: rawData removed to avoid payload size issues (was causing 413 errors)
      // Raw data available in iTrvl via itrvlUrl if needed
    },

    // Build info
    buildTimestamp: new Date().toISOString(),
    _status: 'draft',
  };

  console.log(`[Transform] Complete: ${days.length} days, ${faqItems.length} FAQs`);

  return transformed;
}

module.exports = { transform, generateSlug, textToRichText };
