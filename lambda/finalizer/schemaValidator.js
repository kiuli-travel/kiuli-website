/**
 * Schema Validator for Product JSON-LD
 *
 * Validates schema against Google Rich Results requirements
 * https://developers.google.com/search/docs/appearance/structured-data/product
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {'pass'|'warn'|'fail'} status - Overall status
 * @property {string[]} errors - Critical errors (fail)
 * @property {string[]} warnings - Non-critical issues (warn)
 */

/**
 * Validate Product JSON-LD schema
 *
 * @param {Object} schema - The generated schema
 * @returns {ValidationResult}
 */
function validateSchema(schema) {
  const errors = [];
  const warnings = [];

  // Required fields per Google Product requirements
  if (!schema) {
    return { status: 'fail', errors: ['Schema is null or undefined'], warnings: [] };
  }

  // @context and @type are required
  if (schema['@context'] !== 'https://schema.org') {
    errors.push('@context must be "https://schema.org"');
  }

  if (schema['@type'] !== 'Product') {
    errors.push('@type must be "Product"');
  }

  // name is required
  if (!schema.name || typeof schema.name !== 'string') {
    errors.push('name is required and must be a string');
  } else {
    if (schema.name.trim() !== schema.name) {
      warnings.push('name has leading/trailing whitespace');
    }
    if (schema.name.length > 150) {
      warnings.push('name exceeds 150 characters');
    }
  }

  // image is required for Rich Results
  if (!schema.image) {
    errors.push('image is required');
  } else if (Array.isArray(schema.image)) {
    if (schema.image.length === 0) {
      errors.push('image array must not be empty');
    }
    // Check for valid URLs
    const invalidUrls = schema.image.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      errors.push(`${invalidUrls.length} invalid image URL(s)`);
    }
    // Check for duplicates
    const uniqueImages = new Set(schema.image);
    if (uniqueImages.size < schema.image.length) {
      warnings.push('image array contains duplicates');
    }
  } else if (typeof schema.image === 'string') {
    if (!isValidUrl(schema.image)) {
      errors.push('image URL is invalid');
    }
  }

  // offers validation (required for price display)
  if (schema.offers) {
    if (schema.offers['@type'] !== 'Offer') {
      errors.push('offers.@type must be "Offer"');
    }
    if (typeof schema.offers.price !== 'number' && typeof schema.offers.price !== 'string') {
      warnings.push('offers.price should be a number or string');
    }
    if (!schema.offers.priceCurrency) {
      warnings.push('offers.priceCurrency is recommended');
    }
    if (!schema.offers.availability) {
      warnings.push('offers.availability is recommended');
    }
    if (schema.offers.priceValidUntil) {
      const date = new Date(schema.offers.priceValidUntil);
      if (isNaN(date.getTime())) {
        warnings.push('offers.priceValidUntil is not a valid date');
      } else if (date < new Date()) {
        warnings.push('offers.priceValidUntil is in the past');
      }
    }
  } else {
    warnings.push('offers is recommended for price display in search results');
  }

  // description validation
  if (!schema.description) {
    warnings.push('description is recommended');
  } else if (schema.description.length > 5000) {
    warnings.push('description exceeds 5000 characters');
  }

  // url validation
  if (schema.url && !isValidUrl(schema.url)) {
    errors.push('url is invalid');
  }

  // brand validation
  if (schema.brand) {
    if (!schema.brand['@type']) {
      warnings.push('brand.@type should be "Brand" or "Organization"');
    }
    if (!schema.brand.name) {
      warnings.push('brand.name is recommended');
    }
  }

  // FAQ schema validation (now separate, accessed via schema.faq)
  if (schema.faq) {
    const faqSchema = schema.faq;
    if (faqSchema['@type'] !== 'FAQPage') {
      errors.push('faq schema @type must be "FAQPage"');
    }
    const faqItems = faqSchema.mainEntity || [];
    if (faqItems.length === 0) {
      warnings.push('FAQPage has no questions');
    }
    for (let i = 0; i < faqItems.length; i++) {
      const faq = faqItems[i];
      if (faq['@type'] !== 'Question') {
        errors.push(`FAQ item ${i} has invalid @type`);
      }
      if (!faq.name) {
        errors.push(`FAQ item ${i} missing question (name)`);
      }
      if (!faq.acceptedAnswer?.text) {
        errors.push(`FAQ item ${i} missing answer text`);
      }
      // Check for placeholder text
      if (faq.name && /unknown/i.test(faq.name)) {
        warnings.push(`FAQ item ${i} contains "Unknown" in question`);
      }
      if (faq.acceptedAnswer?.text && /unknown/i.test(faq.acceptedAnswer.text)) {
        warnings.push(`FAQ item ${i} contains "Unknown" in answer`);
      }
    }
  }

  // Breadcrumb schema validation (accessed via schema.breadcrumbs)
  if (schema.breadcrumbs) {
    const bcSchema = schema.breadcrumbs;
    if (bcSchema['@type'] !== 'BreadcrumbList') {
      errors.push('breadcrumbs schema @type must be "BreadcrumbList"');
    }
    if (!bcSchema.itemListElement || bcSchema.itemListElement.length === 0) {
      warnings.push('BreadcrumbList has no items');
    }
  }

  // Determine overall status
  let status = 'pass';
  if (warnings.length > 0) status = 'warn';
  if (errors.length > 0) status = 'fail';

  return { status, errors, warnings };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Format validation result for logging
 */
function formatValidationResult(result) {
  const lines = [`Schema validation: ${result.status.toUpperCase()}`];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    result.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  return lines.join('\n');
}

module.exports = { validateSchema, formatValidationResult };
