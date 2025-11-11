#!/usr/bin/env node

/**
 * Phase 4: AI-Driven Content Enhancement - Validation Script
 *
 * This script validates that content was successfully enhanced by Gemini AI
 * by comparing the byte lengths of original and enhanced descriptions.
 *
 * Usage: node validation_scripts/validate_phase_4.cjs
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

// Main validation function
async function validatePhase4() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 4: AI ENHANCEMENT VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Load raw itinerary
  log('\n[1/5] Loading raw itinerary...', colors.blue);
  const rawPath = path.join(process.cwd(), 'output', 'raw-itinerary.json');

  if (!fs.existsSync(rawPath)) {
    log(`  ✗ Raw itinerary not found: ${rawPath}`, colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: raw-itinerary.json does not exist', colors.red);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(rawPath, 'utf8');
    rawData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${rawPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse raw JSON: ${error.message}`, colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: Invalid JSON in raw-itinerary.json', colors.red);
    process.exit(1);
  }

  // Step 2: Load enhanced itinerary
  log('\n[2/5] Loading enhanced itinerary...', colors.blue);
  const enhancedPath = path.join(process.cwd(), 'output', 'enhanced-itinerary.json');

  if (!fs.existsSync(enhancedPath)) {
    log(`  ✗ Enhanced itinerary not found: ${enhancedPath}`, colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: enhanced-itinerary.json does not exist', colors.red);
    process.exit(1);
  }

  let enhancedData;
  try {
    const fileContent = fs.readFileSync(enhancedPath, 'utf8');
    enhancedData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${enhancedPath}`, colors.green);

    const fileSize = (fs.statSync(enhancedPath).size / 1024).toFixed(2);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to parse enhanced JSON: ${error.message}`, colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: Invalid JSON in enhanced-itinerary.json', colors.red);
    process.exit(1);
  }

  // Step 3: Extract segments
  log('\n[3/5] Extracting segments...', colors.blue);

  // Validate structure
  if (!rawData.itinerary?.itineraries?.[0]?.segments) {
    log('  ✗ Invalid raw itinerary structure', colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: Invalid itinerary structure in raw data', colors.red);
    process.exit(1);
  }

  if (!enhancedData.itinerary?.itineraries?.[0]?.segments) {
    log('  ✗ Invalid enhanced itinerary structure', colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: Invalid itinerary structure in enhanced data', colors.red);
    process.exit(1);
  }

  const rawSegments = rawData.itinerary.itineraries[0].segments;
  const enhancedSegments = enhancedData.itinerary.itineraries[0].segments;

  log(`  ✓ Found ${rawSegments.length} segments in raw data`, colors.green);
  log(`  ✓ Found ${enhancedSegments.length} segments in enhanced data`, colors.green);

  // Step 4: Find first segment with description
  log('\n[4/5] Comparing first segment with description...', colors.blue);

  let firstSegmentIndex = -1;
  let rawSegment = null;
  let enhancedSegment = null;

  for (let i = 0; i < rawSegments.length; i++) {
    if (rawSegments[i].description && rawSegments[i].description.trim().length > 0) {
      firstSegmentIndex = i;
      rawSegment = rawSegments[i];
      enhancedSegment = enhancedSegments[i];
      break;
    }
  }

  if (firstSegmentIndex === -1) {
    log('  ✗ No segments with descriptions found', colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: No segments with descriptions to validate', colors.red);
    process.exit(1);
  }

  const segmentName = rawSegment.title || rawSegment.name || `Segment ${firstSegmentIndex + 1}`;
  log(`  → Validating: ${segmentName}`, colors.cyan);

  // Check for description_enhanced field
  if (!enhancedSegment.description_enhanced) {
    log('  ✗ No description_enhanced field found', colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: description_enhanced field is missing', colors.red);
    process.exit(1);
  }

  log('  ✓ description_enhanced field exists', colors.green);

  // Step 5: Compare byte lengths
  log('\n[5/5] Comparing content lengths...', colors.blue);

  const originalDesc = rawSegment.description;
  const enhancedDesc = enhancedSegment.description_enhanced;

  const originalLength = Buffer.byteLength(originalDesc, 'utf8');
  const enhancedLength = Buffer.byteLength(enhancedDesc, 'utf8');

  log(`  → Original length: ${originalLength} bytes`, colors.cyan);
  log(`  → Enhanced length: ${enhancedLength} bytes`, colors.cyan);

  if (enhancedLength <= originalLength) {
    const diff = originalLength - enhancedLength;
    log(`  ✗ Enhanced content is shorter by ${diff} bytes`, colors.red);
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    log('FAIL: Enhanced content is not longer than original', colors.red);
    process.exit(1);
  }

  const growth = enhancedLength - originalLength;
  const growthPercent = ((growth / originalLength) * 100).toFixed(1);

  log(`  ✓ Enhanced content is longer by ${growth} bytes (+${growthPercent}%)`, colors.green);

  // Count all enhanced segments
  const enhancedCount = enhancedSegments.filter(s => s.description_enhanced).length;
  const withDescCount = rawSegments.filter(s => s.description && s.description.trim().length > 0).length;

  // All checks passed!
  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log('\n✓ All checks passed:', colors.green);
  log(`  • Enhanced itinerary file exists and is valid JSON`, colors.green);
  log(`  • Validated segment: ${segmentName}`, colors.green);
  log(`  • Original description: ${originalLength} bytes`, colors.green);
  log(`  • Enhanced description: ${enhancedLength} bytes (+${growthPercent}%)`, colors.green);
  log(`  • Total segments enhanced: ${enhancedCount}/${withDescCount}`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log('  Phase 4 AI Enhancement: PASS (Content enhanced)', colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  validatePhase4().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 4 AI Enhancement: FAIL', colors.red);
    process.exit(1);
  });
}
