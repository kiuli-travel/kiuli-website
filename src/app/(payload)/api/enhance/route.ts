import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { enhanceContent, extractTextFromRichText } from '@/services/enhancer';

export const maxDuration = 60; // Allow up to 60s for AI enhancement

// Helper to convert plain text to Payload RichText format
function toRichText(text: string): object {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: text.split('\n\n').map(paragraph => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'text', text: paragraph.trim(), format: 0, version: 1 }],
        direction: 'ltr',
      })),
      direction: 'ltr',
    },
  };
}

// Helper to get value at a nested path
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;

    // Handle array indices
    const index = parseInt(part, 10);
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// Helper to set value at a nested path (returns new object)
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split('.');
  const result = JSON.parse(JSON.stringify(obj)); // Deep clone

  let current: Record<string, unknown> | unknown[] = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const index = parseInt(part, 10);
    const nextPart = parts[i + 1];
    const nextIndex = parseInt(nextPart, 10);

    if (!isNaN(index) && Array.isArray(current)) {
      // Ensure array has element at this index
      if (current[index] === undefined) {
        current[index] = !isNaN(nextIndex) ? [] : {};
      }
      current = current[index] as Record<string, unknown> | unknown[];
    } else {
      const obj = current as Record<string, unknown>;
      if (obj[part] === undefined) {
        // Create intermediate objects/arrays as needed
        obj[part] = !isNaN(nextIndex) ? [] : {};
      }
      current = obj[part] as Record<string, unknown> | unknown[];
    }
  }

  const lastPart = parts[parts.length - 1];
  const lastIndex = parseInt(lastPart, 10);

  if (!isNaN(lastIndex) && Array.isArray(current)) {
    current[lastIndex] = value;
  } else {
    (current as Record<string, unknown>)[lastPart] = value;
  }

  return result;
}

// Map field paths to their Itrvl/Enhanced counterparts
function getFieldPaths(fieldPath: string): { itrvlPath: string; enhancedPath: string; isRichText: boolean } {
  // Root level fields
  const rootFields: Record<string, { itrvl: string; enhanced: string; richText: boolean }> = {
    title: { itrvl: 'titleItrvl', enhanced: 'titleEnhanced', richText: false },
    metaTitle: { itrvl: 'metaTitleItrvl', enhanced: 'metaTitleEnhanced', richText: false },
    metaDescription: { itrvl: 'metaDescriptionItrvl', enhanced: 'metaDescriptionEnhanced', richText: false },
    whyKiuli: { itrvl: 'whyKiuliItrvl', enhanced: 'whyKiuliEnhanced', richText: true },
  };

  // Check if it's a root field
  if (rootFields[fieldPath]) {
    return {
      itrvlPath: rootFields[fieldPath].itrvl,
      enhancedPath: rootFields[fieldPath].enhanced,
      isRichText: rootFields[fieldPath].richText,
    };
  }

  // Nested fields - determine the field name from the path
  const parts = fieldPath.split('.');
  const fieldName = parts[parts.length - 1];

  // Determine if this is a RichText field
  const richTextFields = ['description', 'answer', 'inclusions', 'summary', 'includes'];
  const isRichText = richTextFields.includes(fieldName);

  // Build the Itrvl and Enhanced paths
  const basePath = parts.slice(0, -1).join('.');
  const itrvlFieldName = `${fieldName}Itrvl`;
  const enhancedFieldName = `${fieldName}Enhanced`;

  return {
    itrvlPath: basePath ? `${basePath}.${itrvlFieldName}` : itrvlFieldName,
    enhancedPath: basePath ? `${basePath}.${enhancedFieldName}` : enhancedFieldName,
    isRichText,
  };
}

// Build context for the enhancement based on field path
function buildContext(
  itinerary: Record<string, unknown>,
  fieldPath: string
): Record<string, string> {
  const context: Record<string, string> = {};

  // Add itinerary-level context
  context.itineraryTitle = String(itinerary.title || itinerary.titleItrvl || '');

  // Get overview for nights info
  const overview = itinerary.overview as Record<string, unknown> | undefined;
  if (overview?.nights) {
    context.nights = String(overview.nights);
  }

  // Parse field path to understand context
  const parts = fieldPath.split('.');

  // Check if this is a segment field
  if (parts[0] === 'days' && parts.includes('segments')) {
    const dayIndex = parseInt(parts[1], 10);
    const segmentIndex = parseInt(parts[3], 10);

    const days = itinerary.days as Array<Record<string, unknown>> | undefined;
    if (days?.[dayIndex]) {
      const day = days[dayIndex];
      context.dayNumber = String(day.dayNumber || dayIndex + 1);
      context.location = String(day.location || '');

      const segments = day.segments as Array<Record<string, unknown>> | undefined;
      if (segments?.[segmentIndex]) {
        const segment = segments[segmentIndex];
        context.segmentType = String(segment.blockType || '');
        context.name = String(
          segment.accommodationName ||
          segment.accommodationNameItrvl ||
          segment.title ||
          segment.titleItrvl ||
          ''
        );
      }
    }
  }

  // Check if this is a day title field
  if (parts[0] === 'days' && parts[2] === 'title') {
    const dayIndex = parseInt(parts[1], 10);
    const days = itinerary.days as Array<Record<string, unknown>> | undefined;
    if (days?.[dayIndex]) {
      const day = days[dayIndex];
      context.dayNumber = String(day.dayNumber || dayIndex + 1);
      context.location = String(day.location || '');

      // Get main element from first segment
      const segments = day.segments as Array<Record<string, unknown>> | undefined;
      if (segments?.[0]) {
        const segment = segments[0];
        context.mainElement = String(
          segment.accommodationName ||
          segment.accommodationNameItrvl ||
          segment.title ||
          segment.titleItrvl ||
          ''
        );
      }

      // Get country from overview
      const countries = overview?.countries as Array<{ country: string }> | undefined;
      if (countries?.[0]) {
        context.country = countries[0].country;
      }
    }
  }

  // Check if this is an FAQ field
  if (parts[0] === 'faqItems') {
    const faqIndex = parseInt(parts[1], 10);
    const faqItems = itinerary.faqItems as Array<Record<string, unknown>> | undefined;
    if (faqItems?.[faqIndex]) {
      context.question = String(faqItems[faqIndex].question || faqItems[faqIndex].questionItrvl || '');
    }
  }

  // Check if this is overview summary
  if (parts[0] === 'overview' && parts[1] === 'summary') {
    const highlights = overview?.highlights as Array<{ highlight: string }> | undefined;
    if (highlights) {
      context.highlights = highlights.map(h => h.highlight).join(', ');
    }
    const countries = overview?.countries as Array<{ country: string }> | undefined;
    if (countries) {
      context.destinations = countries.map(c => c.country).join(', ');
    }
  }

  // Check if this is investment includes
  if (parts[0] === 'investmentLevel' && parts[1] === 'includes') {
    // Get accommodations from days
    const days = itinerary.days as Array<Record<string, unknown>> | undefined;
    const accommodations: string[] = [];
    if (days) {
      for (const day of days) {
        const segments = day.segments as Array<Record<string, unknown>> | undefined;
        if (segments) {
          for (const segment of segments) {
            if (segment.blockType === 'stay') {
              const name = String(segment.accommodationName || segment.accommodationNameItrvl || '');
              if (name && !accommodations.includes(name)) {
                accommodations.push(name);
              }
            }
          }
        }
      }
    }
    context.accommodations = accommodations.join(', ');
    context.propertyInclusions = ''; // Could extract from segments if available
  }

  return context;
}

/**
 * Validate authentication via Payload session OR API key
 */
async function validateAuth(request: NextRequest): Promise<boolean> {
  // First check for Bearer token (Lambda/external calls)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY) {
      return true;
    }
  }

  // Then check for Payload session (admin UI)
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    if (user) {
      return true;
    }
  } catch {
    // Session check failed
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing authentication' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { itineraryId, fieldPath, voiceConfig } = body;

    // Validate required fields
    if (!itineraryId || !fieldPath || !voiceConfig) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: itineraryId, fieldPath, voiceConfig' },
        { status: 400 }
      );
    }

    // Get Payload instance
    const payload = await getPayload({ config });

    // Fetch the itinerary with overrideAccess to bypass afterRead hooks
    // The afterRead hook strips *Itrvl fields, but we need them for enhancement
    const itinerary = await payload.findByID({
      collection: 'itineraries',
      id: itineraryId,
      depth: 2,
      overrideAccess: true, // Bypass access control but NOT hooks
    });

    if (!itinerary) {
      return NextResponse.json(
        { success: false, error: `Itinerary ${itineraryId} not found` },
        { status: 404 }
      );
    }

    // Get the field paths
    const { itrvlPath, enhancedPath, isRichText } = getFieldPaths(fieldPath);

    // Get the original content from either the Itrvl field or the resolved field
    // The afterRead hook may have resolved fields, so check both
    let originalValue = getNestedValue(itinerary as unknown as Record<string, unknown>, itrvlPath);

    // If Itrvl field is empty, try the base field name (afterRead may have resolved it)
    if (!originalValue) {
      // Extract base field name from itrvlPath (e.g., "overview.summaryItrvl" -> "overview.summary")
      const baseFieldPath = itrvlPath.replace(/Itrvl$/, '');
      originalValue = getNestedValue(itinerary as unknown as Record<string, unknown>, baseFieldPath);
    }

    if (!originalValue) {
      return NextResponse.json(
        { success: false, error: `No content found at ${itrvlPath}` },
        { status: 400 }
      );
    }

    // Extract text content
    let textContent: string;
    if (isRichText && typeof originalValue === 'object') {
      textContent = extractTextFromRichText(originalValue);
    } else {
      textContent = String(originalValue);
    }

    if (!textContent.trim()) {
      return NextResponse.json(
        { success: false, error: 'Original content is empty' },
        { status: 400 }
      );
    }

    // Build context for enhancement
    const context = buildContext(itinerary as unknown as Record<string, unknown>, fieldPath);

    // Call enhancement service
    const result = await enhanceContent(textContent, voiceConfig, context);

    // Convert to RichText if needed
    const enhancedValue = isRichText ? toRichText(result.enhanced) : result.enhanced;

    // Update the itinerary using dot notation for nested fields
    // Payload supports dot notation to update nested fields directly
    const updateData: Record<string, unknown> = {};
    updateData[enhancedPath] = enhancedValue;

    // Update the itinerary
    await payload.update({
      collection: 'itineraries',
      id: itineraryId,
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      enhanced: enhancedValue,
      tokensUsed: result.tokensUsed,
      fieldPath: enhancedPath,
    });

  } catch (error) {
    console.error('Enhancement error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Enhancement failed' },
      { status: 500 }
    );
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic';
