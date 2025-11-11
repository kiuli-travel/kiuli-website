#!/usr/bin/env node

/**
 * Phase 3: Media Ingestion & Rehosting Pipeline - Validation Script
 *
 * This script validates that images were successfully uploaded to Payload CMS
 * by performing HTTP HEAD requests on a random sample of uploaded media.
 *
 * Usage: node validation_scripts/validate_phase_3.cjs
 */

const axios = require('axios');
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

// Perform HTTP HEAD request to check if URL is accessible
async function checkUrlAccessibility(url) {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      validateStatus: (status) => status < 600, // Don't throw on any status
    });

    return {
      url,
      statusCode: response.status,
      success: response.status === 200,
    };
  } catch (error) {
    if (error.response) {
      return {
        url,
        statusCode: error.response.status,
        success: false,
      };
    }
    return {
      url,
      statusCode: null,
      success: false,
      error: error.message,
    };
  }
}

// Randomly select N items from array
function randomSample(array, n) {
  if (array.length <= n) {
    return array;
  }

  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// Main validation function
async function validatePhase3() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 3: MEDIA VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Load media mapping file
  log('\n[1/4] Loading media mapping file...', colors.blue);
  const mappingPath = path.join(process.cwd(), 'output', 'media-mapping.json');

  if (!fs.existsSync(mappingPath)) {
    log(`  ✗ Mapping file not found: ${mappingPath}`, colors.red);
    log('\nPhase 3 Media Validation: FAIL', colors.red);
    log('FAIL: media-mapping.json does not exist', colors.red);
    process.exit(1);
  }

  let mappingData;
  try {
    const fileContent = fs.readFileSync(mappingPath, 'utf8');
    mappingData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${mappingPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    log('\nPhase 3 Media Validation: FAIL', colors.red);
    log('FAIL: Invalid JSON in media-mapping.json', colors.red);
    process.exit(1);
  }

  // Validate mapping structure
  if (!Array.isArray(mappingData)) {
    log('  ✗ Mapping data is not an array', colors.red);
    log('\nPhase 3 Media Validation: FAIL', colors.red);
    log('FAIL: media-mapping.json must be an array', colors.red);
    process.exit(1);
  }

  log(`  ✓ Found ${mappingData.length} entries in mapping`, colors.green);

  if (mappingData.length === 0) {
    log('  ⚠ No entries to validate (empty mapping)', colors.yellow);
    log('\nPhase 3 Media Validation: PASS (0/0 sample URLs checked)', colors.green);
    process.exit(0);
  }

  // Filter successful uploads only
  const successfulUploads = mappingData.filter(
    (entry) => entry.status === 'success' && entry.newS3Url
  );

  if (successfulUploads.length === 0) {
    log('  ✗ No successful uploads found in mapping', colors.red);
    log('\nPhase 3 Media Validation: FAIL', colors.red);
    log('FAIL: No successful uploads to validate', colors.red);
    process.exit(1);
  }

  log(`  ✓ Found ${successfulUploads.length} successful uploads`, colors.green);

  // Step 2: Select random sample
  log('\n[2/4] Selecting sample URLs to validate...', colors.blue);
  const sampleSize = Math.min(5, successfulUploads.length);
  const sampleEntries = randomSample(successfulUploads, sampleSize);

  log(`  ✓ Selected ${sampleEntries.length} URLs for validation`, colors.green);

  // Step 3: Validate each URL
  log('\n[3/4] Checking URL accessibility...', colors.blue);
  const results = [];

  for (let i = 0; i < sampleEntries.length; i++) {
    const entry = sampleEntries[i];
    const url = entry.newS3Url;

    log(`\n  [${i + 1}/${sampleEntries.length}] ${url}`, colors.cyan);

    const result = await checkUrlAccessibility(url);
    results.push(result);

    if (result.success) {
      log(`    ✓ HTTP ${result.statusCode} - OK`, colors.green);
    } else {
      if (result.statusCode) {
        log(`    ✗ HTTP ${result.statusCode} - Failed`, colors.red);
      } else {
        log(`    ✗ Request failed: ${result.error}`, colors.red);
      }
    }

    // Small delay between requests
    if (i < sampleEntries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Step 4: Analyze results
  log('\n[4/4] Analyzing results...', colors.blue);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  log(`  → Successful checks: ${successCount}`, colors.cyan);
  log(`  → Failed checks: ${failCount}`, colors.cyan);

  // Check for failures
  const failedResults = results.filter((r) => !r.success);

  if (failedResults.length > 0) {
    log('\n  ✗ Failed URL checks:', colors.red);
    failedResults.forEach((result) => {
      if (result.statusCode) {
        log(`    • ${result.url} - HTTP ${result.statusCode}`, colors.red);
      } else {
        log(`    • ${result.url} - ${result.error}`, colors.red);
      }
    });

    log('\n' + '='.repeat(60), colors.bright);
    log('  Phase 3 Media Validation: FAIL', colors.red);
    log(`  ${failCount} out of ${sampleEntries.length} URLs failed`, colors.red);
    log('='.repeat(60) + '\n', colors.bright);
    process.exit(1);
  }

  // All checks passed!
  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log('\n✓ All checks passed:', colors.green);
  log(`  • Mapping file: ${mappingPath}`, colors.green);
  log(`  • Total entries: ${mappingData.length}`, colors.green);
  log(`  • Successful uploads: ${successfulUploads.length}`, colors.green);
  log(`  • Sample size: ${sampleEntries.length}`, colors.green);
  log(`  • All sample URLs returned HTTP 200`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log(
    `  Phase 3 Media Validation: PASS (${successCount}/${sampleEntries.length} sample URLs checked)`,
    colors.green
  );
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  validatePhase3().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 3 Media Validation: FAIL', colors.red);
    process.exit(1);
  });
}
