/**
 * Phase 6: Transform — Convert scraped data to structured format
 *
 * Input: Raw scraped data + enhanced content + media mapping
 * Output: Structured data ready for Payload ingest
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
 * Select the best hero image from media mapping
 */
function selectHeroImage(mediaMapping, mediaRecords) {
  // mediaRecords is an array of { s3Key, payloadId, labels }
  if (!mediaRecords || mediaRecords.length === 0) {
    // Fallback to first value in mediaMapping
    const ids = Object.values(mediaMapping);
    return ids.length > 0 ? ids[0] : null;
  }

  // First: Look for explicitly marked hero images
  const heroImage = mediaRecords.find(m => m.labels?.isHero === true);
  if (heroImage) return heroImage.payloadId;

  // Second: High-quality wildlife or landscape
  const highQuality = mediaRecords.find(m =>
    m.labels?.quality === 'high' &&
    ['wildlife', 'landscape'].includes(m.labels?.imageType)
  );
  if (highQuality) return highQuality.payloadId;

  // Third: Any wildlife or landscape
  const wildlife = mediaRecords.find(m =>
    ['wildlife', 'landscape'].includes(m.labels?.imageType)
  );
  if (wildlife) return wildlife.payloadId;

  // Fallback: First image
  return mediaRecords[0]?.payloadId || Object.values(mediaMapping)[0] || null;
}

/**
 * Extract countries from segments
 */
function extractCountries(segments) {
  const countries = new Set();

  for (const segment of segments) {
    if (segment.country) {
      countries.add(segment.country);
    }
    if (segment.countryName) {
      countries.add(segment.countryName);
    }
  }

  return Array.from(countries).filter(c => c && c !== 'Unknown');
}

/**
 * Extract highlights from segments
 */
function extractHighlights(segments) {
  const highlights = [];

  for (const segment of segments) {
    // Add accommodation names as highlights
    if ((segment.type === 'stay' || segment.type === 'accommodation') && segment.name) {
      highlights.push(segment.name);
    }
  }

  // Deduplicate and limit
  return [...new Set(highlights)].slice(0, 8);
}

/**
 * Calculate total nights from segments
 */
function calculateNights(segments, rawItinerary) {
  // First try to get from itinerary metadata
  if (rawItinerary?.nights) {
    return rawItinerary.nights;
  }

  let nights = 0;
  for (const segment of segments) {
    if ((segment.type === 'stay' || segment.type === 'accommodation') && segment.nights) {
      nights += segment.nights;
    }
  }

  return nights || 7;  // Default to 7 if not found
}

/**
 * Group segments by day
 */
function groupSegmentsByDay(segments) {
  const dayMap = new Map();

  for (const segment of segments) {
    // Try to determine day number
    let dayNum = segment.day || segment.dayNumber || 1;

    // Parse from sequence if available
    if (!dayNum && segment.sequence) {
      dayNum = Math.ceil(segment.sequence / 3);  // Rough approximation
    }

    if (!dayMap.has(dayNum)) {
      dayMap.set(dayNum, {
        dayNumber: dayNum,
        date: segment.startDate || null,
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
 * Map segment type to block type
 */
function mapSegmentToBlock(segment, mediaMapping) {
  const type = segment.type?.toLowerCase();

  // Determine block type
  let blockType = null;
  if (type === 'stay' || type === 'accommodation') {
    blockType = 'stay';
  } else if (type === 'service' || type === 'activity') {
    blockType = 'activity';
  } else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat') {
    blockType = 'transfer';
  } else {
    // Skip segments we don't map (entry, exit, point, etc.)
    return null;
  }

  // Get Payload Media IDs for segment images
  const imageIds = [];
  if (segment.images && Array.isArray(segment.images)) {
    for (const img of segment.images) {
      const s3Key = typeof img === 'string' ? img : img.s3Key || img.key;
      if (s3Key && mediaMapping[s3Key]) {
        imageIds.push(mediaMapping[s3Key]);
      }
    }
  }

  // Build block based on type
  if (blockType === 'stay') {
    return {
      blockType: 'stay',
      accommodationName: segment.name || segment.title || 'Accommodation',
      description: segment.enhancedDescription || segment.description || null,
      nights: segment.nights || 1,
      location: segment.location || segment.locationName || null,
      country: segment.country || segment.countryName || null,
      images: imageIds,
      // clientIncludeExclude is the primary iTrvl field for inclusions
      inclusions: segment.clientIncludeExclude || segment.inclusions || segment.included || null,
      roomType: segment.roomType || null,
    };
  }

  if (blockType === 'activity') {
    return {
      blockType: 'activity',
      title: segment.name || segment.title || 'Activity',
      description: segment.enhancedDescription || segment.description || null,
      images: imageIds,
    };
  }

  if (blockType === 'transfer') {
    let transferType = 'road';
    if (type === 'flight') transferType = 'flight';
    if (type === 'boat') transferType = 'boat';

    const title = segment.name || segment.title || 'Transfer';

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

    return {
      blockType: 'transfer',
      type: transferType,
      title: title,
      from: segment.startLocation?.name || segment.from || null,
      to: toDestination,
      description: segment.enhancedDescription || segment.description || null,
      departureTime: segment.departureTime || null,
      arrivalTime: segment.arrivalTime || null,
    };
  }

  return null;
}

/**
 * Generate FAQ items from segments
 */
function generateFaqItems(segments, title, countries) {
  const faqItems = [];

  // FAQ about each accommodation
  const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
  for (const stay of stays.slice(0, 3)) {
    if (stay.name) {
      faqItems.push({
        question: `What is included at ${stay.name}?`,
        answer: stay.inclusions || stay.description ||
                `${stay.name} offers luxury accommodation with full board and activities as specified in the itinerary.`,
      });
    }
  }

  // Destination FAQ
  const countryList = countries.length > 0 ? countries.join(' and ') : 'East Africa';
  faqItems.push({
    question: `What is the best time to visit ${countryList}?`,
    answer: `${countryList} offers excellent wildlife viewing year-round. Our travel designers can advise on the optimal timing based on your specific interests, whether that's the Great Migration, calving season, or particular wildlife encounters.`,
  });

  // General FAQs
  faqItems.push({
    question: 'What level of fitness is required for this safari?',
    answer: 'This safari is suitable for most fitness levels. Game drives involve sitting in comfortable vehicles, and bush walks can be adjusted to your pace. Please let us know of any mobility concerns.',
  });

  faqItems.push({
    question: 'Is this safari suitable for children?',
    answer: 'Family safaris are a specialty. Some lodges have age restrictions for certain activities, but we can customize the itinerary to ensure an unforgettable experience for travelers of all ages.',
  });

  faqItems.push({
    question: 'What should I pack for this safari?',
    answer: 'We recommend neutral-colored clothing, comfortable walking shoes, sun protection, binoculars, and a camera. A detailed packing list will be provided upon booking.',
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

    const inclusionsText = stay.clientIncludeExclude || stay.inclusions || stay.included || '';
    if (inclusionsText) {
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

  const parts = [];

  if (accommodationNames.length > 0) {
    const uniqueNames = [...new Set(accommodationNames)];
    parts.push(`${nights} nights at ${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ' and more' : ''}`);
  }

  if (allInclusions.size > 0) {
    const inclusionsList = Array.from(allInclusions).slice(0, 5);
    parts.push(inclusionsList.join(', '));
  }

  if (parts.length === 0) {
    return `Luxury accommodation for ${nights} nights with full board, game activities, and expert guiding throughout your safari experience.`;
  }

  return parts.join('. ') + '.';
}

/**
 * Main transform function
 */
async function transform(rawData, enhancedData, mediaMapping, mediaRecords, itrvlUrl) {
  console.log('[Transform] Starting transformation');

  // Extract itinerary data (handle nested structure)
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

  // Calculate values
  const slug = generateSlug(title);
  const nights = calculateNights(segments, itinerary);
  const countries = extractCountries(segments);
  const highlights = extractHighlights(segments);
  const heroImage = selectHeroImage(mediaMapping, mediaRecords);

  console.log(`[Transform] Nights: ${nights}, Countries: ${countries.join(', ')}`);

  // Group segments by day
  const groupedDays = groupSegmentsByDay(segments);

  // Transform each day's segments to blocks
  const days = groupedDays.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    location: day.location,
    segments: day.segments
      .map(s => mapSegmentToBlock(s, mediaMapping))
      .filter(Boolean)
  }));

  // Generate FAQ items
  const faqItems = generateFaqItems(segments, title, countries);

  // Generate meta fields
  const { metaTitle, metaDescription } = generateMetaFields(title, nights, countries);

  // Generate investment includes
  const investmentIncludes = generateInvestmentIncludes(segments, nights);

  // Get all media IDs
  const allImageIds = Object.values(mediaMapping);

  // Build the transformed output
  const transformed = {
    // Basic
    title,
    slug,
    itineraryId,

    // SEO
    metaTitle,
    metaDescription,

    // Hero
    heroImage,

    // Overview
    overview: {
      nights,
      countries: countries.map(c => ({ country: c })),
      highlights: highlights.map(h => ({ highlight: h })),
    },

    // Investment
    investmentLevel: {
      fromPrice: Math.round(priceInCents / 100),
      currency: 'USD',
      includes: investmentIncludes,
    },

    // Structured days
    days,

    // FAQ
    faqItems,

    // All images
    images: allImageIds,

    // Source (hidden)
    source: {
      itrvlUrl,
      lastScrapedAt: new Date().toISOString(),
      rawData: rawData,
    },

    // Build info
    buildTimestamp: new Date().toISOString(),
    _status: 'draft',
  };

  console.log(`[Transform] Complete: ${days.length} days, ${faqItems.length} FAQs, ${allImageIds.length} images`);

  return transformed;
}

module.exports = { transform, generateSlug, selectHeroImage };
