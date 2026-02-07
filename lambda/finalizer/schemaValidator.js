/**
 * Schema Validator for JSON-LD Array
 *
 * Validates an array of schema.org objects against Google Rich Results requirements.
 * Each object is validated independently by its @type.
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {'pass'|'warn'|'fail'} status - Overall status
 * @property {string[]} errors - Critical errors (fail)
 * @property {string[]} warnings - Non-critical issues (warn)
 */

/**
 * Validate an array of JSON-LD schema objects
 *
 * @param {Array} schemas - Array of schema objects
 * @returns {ValidationResult}
 */
function validateSchema(schemas) {
  const errors = [];
  const warnings = [];

  // Must be an array
  if (!Array.isArray(schemas)) {
    return { status: 'fail', errors: ['Schema must be an array'], warnings: [] };
  }

  if (schemas.length === 0) {
    return { status: 'fail', errors: ['Schema array is empty'], warnings: [] };
  }

  // Track which types we've seen
  let hasProduct = false;
  let hasFAQPage = false;
  let hasBreadcrumbList = false;

  // Validate each schema by its @type
  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    const prefix = `[${i}]`;

    if (!schema || typeof schema !== 'object') {
      errors.push(`${prefix} Invalid schema object`);
      continue;
    }

    // Every schema must have @context
    if (schema['@context'] !== 'https://schema.org') {
      errors.push(`${prefix} @context must be "https://schema.org"`);
    }

    const schemaType = schema['@type'];

    switch (schemaType) {
      case 'Product':
        hasProduct = true;
        validateProduct(schema, prefix, errors, warnings);
        break;

      case 'FAQPage':
        hasFAQPage = true;
        validateFAQPage(schema, prefix, errors, warnings);
        break;

      case 'BreadcrumbList':
        hasBreadcrumbList = true;
        validateBreadcrumbList(schema, prefix, errors, warnings);
        break;

      default:
        warnings.push(`${prefix} Unknown schema type: ${schemaType}`);
    }
  }

  // Product is required
  if (!hasProduct) {
    errors.push('Missing required Product schema');
  }

  // BreadcrumbList is recommended
  if (!hasBreadcrumbList) {
    warnings.push('Missing BreadcrumbList schema');
  }

  // Determine overall status
  let status = 'pass';
  if (warnings.length > 0) status = 'warn';
  if (errors.length > 0) status = 'fail';

  return { status, errors, warnings };
}

/**
 * Validate Product schema
 */
function validateProduct(schema, prefix, errors, warnings) {
  // name is required
  if (!schema.name || typeof schema.name !== 'string') {
    errors.push(`${prefix} Product.name is required and must be a string`);
  } else {
    if (schema.name.trim() !== schema.name) {
      warnings.push(`${prefix} Product.name has leading/trailing whitespace`);
    }
    if (schema.name.length > 150) {
      warnings.push(`${prefix} Product.name exceeds 150 characters`);
    }
  }

  // image is required for Rich Results
  if (!schema.image) {
    errors.push(`${prefix} Product.image is required`);
  } else if (Array.isArray(schema.image)) {
    if (schema.image.length === 0) {
      errors.push(`${prefix} Product.image array must not be empty`);
    }
    const invalidUrls = schema.image.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      errors.push(`${prefix} Product.image has ${invalidUrls.length} invalid URL(s)`);
    }
    const uniqueImages = new Set(schema.image);
    if (uniqueImages.size < schema.image.length) {
      warnings.push(`${prefix} Product.image array contains duplicates`);
    }
  } else if (typeof schema.image === 'string') {
    if (!isValidUrl(schema.image)) {
      errors.push(`${prefix} Product.image URL is invalid`);
    }
  }

  // offers validation
  if (schema.offers) {
    if (schema.offers['@type'] !== 'Offer') {
      errors.push(`${prefix} Product.offers.@type must be "Offer"`);
    }
    if (typeof schema.offers.price !== 'number' && typeof schema.offers.price !== 'string') {
      warnings.push(`${prefix} Product.offers.price should be a number or string`);
    }
    if (!schema.offers.priceCurrency) {
      warnings.push(`${prefix} Product.offers.priceCurrency is recommended`);
    }
    if (!schema.offers.availability) {
      warnings.push(`${prefix} Product.offers.availability is recommended`);
    }
    if (schema.offers.priceValidUntil) {
      const date = new Date(schema.offers.priceValidUntil);
      if (isNaN(date.getTime())) {
        warnings.push(`${prefix} Product.offers.priceValidUntil is not a valid date`);
      } else if (date < new Date()) {
        warnings.push(`${prefix} Product.offers.priceValidUntil is in the past`);
      }
    }
  } else {
    warnings.push(`${prefix} Product.offers is recommended for price display`);
  }

  // description validation
  if (!schema.description) {
    warnings.push(`${prefix} Product.description is recommended`);
  } else if (schema.description.length > 5000) {
    warnings.push(`${prefix} Product.description exceeds 5000 characters`);
  }

  // url validation
  if (schema.url && !isValidUrl(schema.url)) {
    errors.push(`${prefix} Product.url is invalid`);
  }

  // brand validation
  if (schema.brand) {
    if (!schema.brand['@type']) {
      warnings.push(`${prefix} Product.brand.@type should be "Brand" or "Organization"`);
    }
    if (!schema.brand.name) {
      warnings.push(`${prefix} Product.brand.name is recommended`);
    }
  }
}

/**
 * Validate FAQPage schema
 */
function validateFAQPage(schema, prefix, errors, warnings) {
  if (!schema.mainEntity || !Array.isArray(schema.mainEntity)) {
    errors.push(`${prefix} FAQPage.mainEntity must be an array`);
    return;
  }

  if (schema.mainEntity.length === 0) {
    warnings.push(`${prefix} FAQPage.mainEntity is empty`);
    return;
  }

  for (let i = 0; i < schema.mainEntity.length; i++) {
    const faq = schema.mainEntity[i];
    const faqPrefix = `${prefix} FAQ[${i}]`;

    if (faq['@type'] !== 'Question') {
      errors.push(`${faqPrefix} @type must be "Question"`);
    }
    if (!faq.name) {
      errors.push(`${faqPrefix} missing question (name)`);
    }
    if (!faq.acceptedAnswer?.text) {
      errors.push(`${faqPrefix} missing answer text`);
    }

    // Check for placeholder text
    if (faq.name && /unknown/i.test(faq.name)) {
      warnings.push(`${faqPrefix} contains "Unknown" in question`);
    }
    if (faq.acceptedAnswer?.text && /unknown/i.test(faq.acceptedAnswer.text)) {
      warnings.push(`${faqPrefix} contains "Unknown" in answer`);
    }
  }
}

/**
 * Validate BreadcrumbList schema
 */
function validateBreadcrumbList(schema, prefix, errors, warnings) {
  if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
    errors.push(`${prefix} BreadcrumbList.itemListElement must be an array`);
    return;
  }

  if (schema.itemListElement.length === 0) {
    warnings.push(`${prefix} BreadcrumbList.itemListElement is empty`);
    return;
  }

  for (let i = 0; i < schema.itemListElement.length; i++) {
    const item = schema.itemListElement[i];
    const itemPrefix = `${prefix} Breadcrumb[${i}]`;

    if (item['@type'] !== 'ListItem') {
      errors.push(`${itemPrefix} @type must be "ListItem"`);
    }
    if (typeof item.position !== 'number') {
      errors.push(`${itemPrefix} position must be a number`);
    }
    if (!item.name) {
      errors.push(`${itemPrefix} name is required`);
    }
    if (!item.item || !isValidUrl(item.item)) {
      errors.push(`${itemPrefix} item must be a valid URL`);
    }
  }
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
