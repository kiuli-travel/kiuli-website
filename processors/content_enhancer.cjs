#!/usr/bin/env node

/**
 * Content Enhancer - Phase 4 (V7: Passthrough Mode)
 *
 * V7 NOTE: Automatic AI enhancement has been removed.
 * Enhancement is now manual-only via the admin UI FieldPairEditor component.
 *
 * This script now simply passes through raw-itinerary.json to enhanced-itinerary.json
 * without AI processing. The *_itrvl fields will be populated by the ingester,
 * and *_enhanced fields will remain null until manually enhanced by editors.
 *
 * Usage: node processors/content_enhancer.cjs <itineraryId>
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { getOutputDir, getOutputFilePath } = require('../utils/outputDir.cjs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Helper function to log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Main function - passthrough mode
async function enhanceContent(itineraryId) {
  if (!itineraryId) {
    throw new Error('itineraryId is required');
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  Content Enhancer - Phase 4 (V7 Passthrough Mode)', colors.bright);
  log('='.repeat(60), colors.bright);
  log(`  → Itinerary ID: ${itineraryId}`, colors.cyan);
  log('  → Mode: Passthrough (no automatic AI enhancement)', colors.yellow);

  // Load raw itinerary data
  log('\n[1/2] Loading raw itinerary data...', colors.blue);
  const inputPath = getOutputFilePath(itineraryId, 'raw-itinerary.json');

  if (!fs.existsSync(inputPath)) {
    log(`  ✗ Input file not found: ${inputPath}`, colors.red);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    rawData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${inputPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Validate structure
  if (!rawData.itinerary || !rawData.itinerary.itineraries || !Array.isArray(rawData.itinerary.itineraries)) {
    log('  ✗ Invalid itinerary structure', colors.red);
    process.exit(1);
  }

  const itinerary = rawData.itinerary.itineraries[0];
  if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
    log('  ✗ No segments found in itinerary', colors.red);
    process.exit(1);
  }

  const segments = itinerary.segments;
  const segmentsWithDesc = segments.filter(s => s.description && s.description.trim().length > 0);

  log(`  ✓ Found ${segments.length} total segments`, colors.green);
  log(`  ✓ Found ${segmentsWithDesc.length} segments with descriptions`, colors.green);
  log('  ⊘ Skipping AI enhancement (V7: manual-only)', colors.yellow);

  // Write output file (passthrough - no enhancement)
  log('\n[2/2] Writing passthrough output file...', colors.blue);
  const outputPath = getOutputFilePath(itineraryId, 'enhanced-itinerary.json');

  try {
    // Add metadata about V7 passthrough mode
    const outputData = {
      ...rawData,
      _enhancementMetadata: {
        mode: 'passthrough',
        version: 'v7',
        note: 'Automatic AI enhancement disabled. Use admin UI for manual enhancement.',
        processedAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    log(`  ✓ Output file written: ${outputPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to write output file: ${error.message}`, colors.red);
    process.exit(1);
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  ✓ Passthrough completed successfully', colors.green);
  log('  → Content ready for manual enhancement in admin UI', colors.cyan);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  const itineraryId = process.argv[2];
  enhanceContent(itineraryId).catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  });
}

module.exports = { enhanceContent };
