import type { CollectionAfterReadHook } from 'payload';

/**
 * Resolve two-field pairs to single fields for front-end consumption.
 *
 * Logic: enhanced ?? itrvl
 *
 * The front-end should NEVER see *Itrvl, *Enhanced, or *Reviewed fields.
 * This hook transforms the internal editorial structure into clean output.
 *
 * IMPORTANT: Admin UI requests (authenticated users) get the raw document
 * with all internal fields preserved. This is required for FieldPairEditor
 * components to access *Itrvl, *Enhanced, and *Reviewed fields.
 *
 * NOTE: Using afterRead hook (not beforeRead) because Payload re-applies
 * schema fields after beforeRead, which would re-add our filtered fields.
 */
export const resolveFields: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!doc) return doc;

  // Preserve internal fields for authenticated requests (admin UI and API)
  // The admin UI needs access to *Itrvl, *Enhanced, *Reviewed fields
  // for FieldPairEditor components to work correctly.
  // Frontend requests are typically unauthenticated and only need resolved fields.
  // Check for both user auth (session) and API key auth (Authorization header)
  let authHeader: string | null = null;
  if (req?.headers) {
    // Headers could be a Headers object (with .get method) or plain object
    if (typeof req.headers.get === 'function') {
      authHeader = req.headers.get('authorization');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authHeader = (req.headers as any).authorization ?? null;
    }
  }
  const isApiKeyAuth = authHeader && authHeader.includes('API-Key');
  if (req?.user || isApiKeyAuth) {
    return doc;
  }

  // Helper to resolve a field pair
  const resolve = <T>(enhanced: T | null | undefined, itrvl: T | null | undefined): T | null => {
    return enhanced ?? itrvl ?? null;
  };

  // Helper to check if a value is "empty" (null, undefined, or empty RichText)
  const isEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    // Check for empty RichText (has root but no meaningful content)
    if (typeof value === 'object' && 'root' in (value as object)) {
      const root = (value as { root?: { children?: unknown[] } }).root;
      if (!root?.children || root.children.length === 0) return true;
    }
    return false;
  };

  // Smart resolve that handles empty strings and empty RichText
  const smartResolve = <T>(enhanced: T | null | undefined, itrvl: T | null | undefined): T | null => {
    if (!isEmpty(enhanced)) return enhanced as T;
    if (!isEmpty(itrvl)) return itrvl as T;
    return null;
  };

  // Helper to clean up internal fields from an object
  const cleanInternalFields = (obj: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip internal fields
      if (key.endsWith('Itrvl') || key.endsWith('Enhanced') || key.endsWith('Reviewed')) {
        continue;
      }
      // Skip legacy fields that shouldn't be in output
      if (key === 'descriptionOriginal' || key === 'answerOriginal') {
        continue;
      }
      cleaned[key] = value;
    }
    return cleaned;
  };

  // Resolve segment fields based on block type
  const resolveSegment = (segment: Record<string, unknown>): Record<string, unknown> => {
    const blockType = segment.blockType as string;
    let resolved: Record<string, unknown> = { ...segment };

    if (blockType === 'stay') {
      resolved = {
        ...resolved,
        accommodationName: smartResolve(
          segment.accommodationNameEnhanced as string,
          segment.accommodationNameItrvl as string
        ) || segment.accommodationName,
        description: smartResolve(segment.descriptionEnhanced, segment.descriptionItrvl),
        inclusions: smartResolve(segment.inclusionsEnhanced, segment.inclusionsItrvl),
      };
    } else if (blockType === 'activity') {
      resolved = {
        ...resolved,
        title: smartResolve(
          segment.titleEnhanced as string,
          segment.titleItrvl as string
        ) || segment.title,
        description: smartResolve(segment.descriptionEnhanced, segment.descriptionItrvl),
      };
    } else if (blockType === 'transfer') {
      resolved = {
        ...resolved,
        title: smartResolve(
          segment.titleEnhanced as string,
          segment.titleItrvl as string
        ) || segment.title,
        description: smartResolve(segment.descriptionEnhanced, segment.descriptionItrvl),
      };
    }

    return cleanInternalFields(resolved);
  };

  // Resolve day fields
  const resolveDay = (day: Record<string, unknown>): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {
      ...day,
      title: smartResolve(day.titleEnhanced as string, day.titleItrvl as string) || day.title,
    };

    // Resolve segments if present
    if (Array.isArray(day.segments)) {
      resolved.segments = day.segments.map((seg: Record<string, unknown>) => resolveSegment(seg));
    }

    return cleanInternalFields(resolved);
  };

  // Resolve FAQ fields
  const resolveFaq = (faq: Record<string, unknown>): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {
      ...faq,
      question: smartResolve(faq.questionEnhanced as string, faq.questionItrvl as string) || faq.question,
      answer: smartResolve(faq.answerEnhanced, faq.answerItrvl),
    };

    return cleanInternalFields(resolved);
  };

  // Resolve overview group
  const resolveOverview = (overview: Record<string, unknown>): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {
      ...overview,
      summary: smartResolve(overview.summaryEnhanced, overview.summaryItrvl),
    };
    return cleanInternalFields(resolved);
  };

  // Resolve investmentLevel group
  const resolveInvestmentLevel = (
    investmentLevel: Record<string, unknown>
  ): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {
      ...investmentLevel,
      includes: smartResolve(investmentLevel.includesEnhanced, investmentLevel.includesItrvl),
    };
    return cleanInternalFields(resolved);
  };

  // Build resolved document
  const resolved: Record<string, unknown> = {
    ...doc,

    // Root-level fields
    title: smartResolve(doc.titleEnhanced as string, doc.titleItrvl as string) || doc.title,
    metaTitle:
      smartResolve(doc.metaTitleEnhanced as string, doc.metaTitleItrvl as string) || doc.metaTitle,
    metaDescription:
      smartResolve(doc.metaDescriptionEnhanced as string, doc.metaDescriptionItrvl as string) ||
      doc.metaDescription,
    whyKiuli: smartResolve(doc.whyKiuliEnhanced, doc.whyKiuliItrvl),

    // Overview group
    overview: doc.overview ? resolveOverview(doc.overview as Record<string, unknown>) : doc.overview,

    // Investment level group
    investmentLevel: doc.investmentLevel
      ? resolveInvestmentLevel(doc.investmentLevel as Record<string, unknown>)
      : doc.investmentLevel,

    // Days array
    days: Array.isArray(doc.days)
      ? doc.days.map((day: Record<string, unknown>) => resolveDay(day))
      : doc.days,

    // FAQ items array
    faqItems: Array.isArray(doc.faqItems)
      ? doc.faqItems.map((faq: Record<string, unknown>) => resolveFaq(faq))
      : doc.faqItems,
  };

  // Clean up root-level internal fields
  return cleanInternalFields(resolved);
};

export default resolveFields;
