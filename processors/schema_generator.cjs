#!/usr/bin/env node

/**
 * Schema Generator - Phase 5
 *
 * This script generates a JSON-LD Product schema from the processed itinerary data.
 * It consumes raw-itinerary.json, media-mapping.json, and enhanced-itinerary.json
 * to create a valid schema.org Product that passes internal validation.
 *
 * Usage: node processors/schema_generator.cjs
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper function to log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Convert price from cents to decimal string
function formatPrice(priceInCents) {
  const dollars = priceInCents / 100;
  return dollars.toFixed(2);
}

// Truncate description to max length
function truncateDescription(description, maxLength = 500) {
  if (!description) return '';

  if (description.length <= maxLength) {
    return description;
  }

  // Truncate at word boundary, accounting for "..." (3 chars)
  const truncated = description.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

// Generate canonical Kiuli URL (placeholder template)
function generateProductUrl(sku) {
  return `https://kiuli.com/travel-packages/${sku}`;
}

// Main schema generation function
async function generateSchema() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  Schema Generator - Phase 5', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Load raw itinerary (for price, sku)
  log('\n[1/5] Loading raw itinerary data...', colors.blue);
  const rawPath = path.join(process.cwd(), 'output', 'raw-itinerary.json');

  if (!fs.existsSync(rawPath)) {
    log(`  ✗ Raw itinerary not found: ${rawPath}`, colors.red);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(rawPath, 'utf8');
    rawData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${rawPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse raw JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract price and itinerary ID from raw data
  const price = rawData.price || 0;
  const itinerary = rawData.itinerary?.itineraries?.[0];
  const sku = itinerary?.id || itinerary?.bookingNumber?.toString() || 'UNKNOWN';

  log(`  → SKU: ${sku}`, colors.cyan);
  log(`  → Price: ${price} cents`, colors.cyan);

  // Step 2: Load media mapping (for images)
  log('\n[2/5] Loading media mapping...', colors.blue);
  const mappingPath = path.join(process.cwd(), 'output', 'media-mapping.json');

  if (!fs.existsSync(mappingPath)) {
    log(`  ✗ Media mapping not found: ${mappingPath}`, colors.red);
    process.exit(1);
  }

  let mediaMapping;
  try {
    const fileContent = fs.readFileSync(mappingPath, 'utf8');
    mediaMapping = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${mappingPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse media mapping JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract successful image URLs (exclude itrvl.imgix.net and non-image files)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const imageUrls = mediaMapping
    .filter(entry => entry.status === 'success' && entry.newS3Url)
    .map(entry => entry.newS3Url)
    .filter(url => !url.includes('itrvl.imgix.net'))
    .filter(url => {
      const urlLower = url.toLowerCase();
      return imageExtensions.some(ext => urlLower.endsWith(ext));
    });

  log(`  → Found ${imageUrls.length} rehosted images`, colors.cyan);

  if (imageUrls.length === 0) {
    log('  ⚠ Warning: No rehosted images found', colors.yellow);
  }

  // Step 3: Load enhanced itinerary (for name, description)
  log('\n[3/5] Loading enhanced itinerary data...', colors.blue);
  const enhancedPath = path.join(process.cwd(), 'output', 'enhanced-itinerary.json');

  if (!fs.existsSync(enhancedPath)) {
    log(`  ✗ Enhanced itinerary not found: ${enhancedPath}`, colors.red);
    process.exit(1);
  }

  let enhancedData;
  try {
    const fileContent = fs.readFileSync(enhancedPath, 'utf8');
    enhancedData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${enhancedPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse enhanced JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract name and description
  const enhancedItinerary = enhancedData.itinerary?.itineraries?.[0];
  const name = enhancedItinerary?.itineraryName || enhancedItinerary?.name || 'Luxury Travel Experience';

  // Try to find first segment with enhanced description
  const firstSegmentWithDesc = enhancedItinerary?.segments?.find(
    s => s.description_enhanced || s.description
  );

  const rawDescription = firstSegmentWithDesc?.description_enhanced ||
                         firstSegmentWithDesc?.description ||
                         enhancedItinerary?.description ||
                         'An exclusive luxury travel experience curated for discerning travelers.';

  const description = truncateDescription(rawDescription, 500);

  log(`  → Name: ${name}`, colors.cyan);
  log(`  → Description: ${description.substring(0, 80)}...`, colors.cyan);
  log(`  → Description length: ${description.length} chars`, colors.cyan);

  // Step 4: Generate JSON-LD schema
  log('\n[4/5] Generating JSON-LD Product schema...', colors.blue);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: name,
    description: description,
    image: imageUrls,
    brand: {
      '@type': 'Brand',
      name: 'Kiuli'
    },
    sku: sku,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: formatPrice(price),
      availability: 'https://schema.org/InStock',
      url: generateProductUrl(sku)
    }
  };

  log('  ✓ Schema generated successfully', colors.green);
  log(`  → @type: ${schema['@type']}`, colors.cyan);
  log(`  → Brand: ${schema.brand.name}`, colors.cyan);
  log(`  → Price: $${schema.offers.price} USD`, colors.cyan);
  log(`  → Images: ${schema.image.length}`, colors.cyan);

  // Step 5: Write schema to file
  log('\n[5/5] Writing schema to file...', colors.blue);
  const outputPath = path.join(process.cwd(), 'output', 'schema.jsonld');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    log(`  ✓ Schema written: ${outputPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to write schema file: ${error.message}`, colors.red);
    process.exit(1);
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  ✓ Schema generation completed successfully', colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  generateSchema().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  });
}

module.exports = { generateSchema };
