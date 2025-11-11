#!/usr/bin/env node

/**
 * Phase 2: Scraper Foundation & API Interception - Validation Script
 *
 * This script validates the iTrvl scraper functionality by:
 * 1. Executing the scraper with a test URL
 * 2. Validating the output file structure and content
 * 3. Asserting all required data fields are present
 *
 * Usage: node validation_scripts/validate_phase_2.cjs --url <ITRVL_URL>
 */

const { execSync } = require('child_process');
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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let url = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      break;
    }
  }

  return { url };
}

// Delete the output file if it exists
function cleanupOutputFile(outputPath) {
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    log(`  → Deleted corrupt output file: ${outputPath}`, colors.yellow);
  }
}

// Main validation function
async function validatePhase2(testUrl) {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 2: SCRAPER VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  const outputPath = path.join(process.cwd(), 'output', 'raw-itinerary.json');
  const scraperPath = path.join(process.cwd(), 'scrapers', 'itrvl_scraper.cjs');

  // Clean up any existing output file before starting
  if (fs.existsSync(outputPath)) {
    log('\n→ Cleaning up previous output file...', colors.yellow);
    fs.unlinkSync(outputPath);
  }

  // Step 1: Execute the scraper
  log('\n[1/5] Executing iTrvl scraper...', colors.blue);
  log(`  → URL: ${testUrl}`, colors.cyan);

  try {
    execSync(`node "${scraperPath}" "${testUrl}"`, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout
    });
    log('  ✓ Scraper executed successfully', colors.green);
  } catch (error) {
    log(`  ✗ Scraper execution failed: ${error.message}`, colors.red);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: Scraper script execution error', colors.red);
    process.exit(1);
  }

  // Step 2: Check that output file exists
  log('\n[2/5] Checking output file...', colors.blue);

  if (!fs.existsSync(outputPath)) {
    log(`  ✗ Output file not found: ${outputPath}`, colors.red);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: Output file was not created', colors.red);
    process.exit(1);
  }

  log(`  ✓ Output file exists: ${outputPath}`, colors.green);

  // Step 3: Check that output file is not empty
  const fileStats = fs.statSync(outputPath);
  const fileSizeKB = (fileStats.size / 1024).toFixed(2);

  if (fileStats.size === 0) {
    log('  ✗ Output file is empty', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: Output file is empty', colors.red);
    process.exit(1);
  }

  log(`  ✓ Output file is not empty (${fileSizeKB} KB)`, colors.green);

  // Step 4: Parse the file as JSON
  log('\n[3/5] Parsing JSON...', colors.blue);
  let jsonData;

  try {
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    jsonData = JSON.parse(fileContent);
    log('  ✓ Valid JSON format', colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: Invalid JSON format', colors.red);
    process.exit(1);
  }

  // Step 5: Assert expected structure
  log('\n[4/5] Validating data structure...', colors.blue);

  // Check for required top-level keys
  const requiredKeys = ['itinerary', 'images', 'price'];
  const missingKeys = requiredKeys.filter((key) => !(key in jsonData));

  if (missingKeys.length > 0) {
    log(`  ✗ Missing required keys: ${missingKeys.join(', ')}`, colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log(`FAIL: Missing required keys: ${missingKeys.join(', ')}`, colors.red);
    process.exit(1);
  }

  log('  ✓ All required keys present: itinerary, images, price', colors.green);

  // Validate itinerary is an object
  if (typeof jsonData.itinerary !== 'object' || jsonData.itinerary === null) {
    log('  ✗ "itinerary" is not an object', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: "itinerary" must be an object', colors.red);
    process.exit(1);
  }

  log('  ✓ "itinerary" is an object', colors.green);

  // Validate images is an array
  if (!Array.isArray(jsonData.images)) {
    log('  ✗ "images" is not an array', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: "images" must be an array', colors.red);
    process.exit(1);
  }

  log('  ✓ "images" is an array', colors.green);

  // Validate price is a number
  if (typeof jsonData.price !== 'number') {
    log('  ✗ "price" is not a number', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: "price" must be a number', colors.red);
    process.exit(1);
  }

  log('  ✓ "price" is a number', colors.green);

  // Step 6: Assert specific data requirements
  log('\n[5/5] Validating data content...', colors.blue);

  // Assert images.length > 0
  if (jsonData.images.length === 0) {
    log('  ✗ "images" array is empty', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: images array is empty', colors.red);
    process.exit(1);
  }

  log(`  ✓ "images" array contains ${jsonData.images.length} item(s)`, colors.green);

  // Assert price is an integer (in cents)
  if (!Number.isInteger(jsonData.price)) {
    log('  ✗ "price" is not an integer (must be in cents)', colors.red);
    cleanupOutputFile(outputPath);
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    log('FAIL: price must be an integer (in cents)', colors.red);
    process.exit(1);
  }

  const priceInDollars = (jsonData.price / 100).toFixed(2);
  log(`  ✓ "price" is an integer: ${jsonData.price} cents ($${priceInDollars})`, colors.green);

  // All validations passed!
  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log('\n✓ All checks passed:', colors.green);
  log(`  • Output file created: ${outputPath}`, colors.green);
  log(`  • File size: ${fileSizeKB} KB`, colors.green);
  log(`  • Valid JSON structure`, colors.green);
  log(`  • itinerary: object with ${Object.keys(jsonData.itinerary).length} keys`, colors.green);
  log(`  • images: array with ${jsonData.images.length} items`, colors.green);
  log(`  • price: ${jsonData.price} cents ($${priceInDollars})`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log('  Phase 2 Scraper Validation: PASS', colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  const { url } = parseArgs();

  if (!url) {
    log('\n✗ Error: No URL provided', colors.red);
    log('\nUsage: node validation_scripts/validate_phase_2.cjs --url <ITRVL_URL>', colors.yellow);
    log('\nExample:', colors.yellow);
    log('  node validation_scripts/validate_phase_2.cjs --url "https://portal.itrvl.com/share?accessKey=ABC123&itineraryId=12345"\n', colors.cyan);
    process.exit(1);
  }

  validatePhase2(url).catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 2 Scraper Validation: FAIL', colors.red);
    process.exit(1);
  });
}
