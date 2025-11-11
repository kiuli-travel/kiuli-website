#!/usr/bin/env node

/**
 * Phase 8: Vercel Function Deployment - Validation Script
 *
 * This script validates that the API route correctly executes the full pipeline
 * by making a POST request to the local development server and verifying that
 * a draft entry was created in Payload CMS.
 *
 * Usage: node validation_scripts/validate_phase_8.cjs --url <TEST_URL>
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');

  if (urlIndex === -1 || urlIndex === args.length - 1) {
    throw new Error('Missing required argument: --url <TEST_URL>');
  }

  return {
    testUrl: args[urlIndex + 1],
  };
}

// Validate environment variables
function validateEnv() {
  const apiUrl = process.env.PAYLOAD_API_URL;
  const apiKey = process.env.PAYLOAD_API_KEY;

  if (!apiUrl) {
    throw new Error('PAYLOAD_API_URL environment variable not set');
  }

  if (!apiKey) {
    throw new Error('PAYLOAD_API_KEY environment variable not set');
  }

  return { apiUrl, apiKey };
}

// Main validation function
async function validatePhase8() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 8: VERCEL FUNCTION VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Parse arguments
  log('\n[1/6] Parsing command line arguments...', colors.blue);
  let testUrl;
  try {
    ({ testUrl } = parseArgs());
    log(`  ✓ Test URL: ${testUrl}`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    log('\nUsage: node validation_scripts/validate_phase_8.cjs --url <TEST_URL>', colors.yellow);
    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    process.exit(1);
  }

  // Step 2: Validate environment
  log('\n[2/6] Validating environment...', colors.blue);
  let apiUrl, apiKey;
  try {
    ({ apiUrl, apiKey } = validateEnv());
    log(`  ✓ PAYLOAD_API_URL: ${apiUrl}`, colors.green);
    log(`  ✓ PAYLOAD_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    log('FAIL: Environment validation error', colors.red);
    process.exit(1);
  }

  // Step 3: Make POST request to API route
  log('\n[3/6] Invoking API route /api/scrape-itinerary...', colors.blue);
  log(`  → URL: http://localhost:3000/api/scrape-itinerary`, colors.cyan);
  log(`  → Test itinerary: ${testUrl}`, colors.cyan);

  const startTime = Date.now();
  let apiResponse;

  try {
    apiResponse = await axios.post(
      'http://localhost:3000/api/scrape-itinerary',
      { itrvlUrl: testUrl },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5 minute timeout
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`  ✓ API route completed in ${duration}s`, colors.green);
    log(`  → Response status: ${apiResponse.status}`, colors.cyan);

    if (apiResponse.data) {
      log(`  → Success: ${apiResponse.data.success}`, colors.cyan);
      if (apiResponse.data.payloadId) {
        log(`  → Payload ID: ${apiResponse.data.payloadId}`, colors.cyan);
      }
      if (apiResponse.data.timings) {
        log(`\n  Performance Breakdown:`, colors.cyan);
        log(`  • Phase 2 (Scrape) completed in: ${apiResponse.data.timings.phase2}s`, colors.cyan);
        log(`  • Phase 3 (Media Rehost) completed in: ${apiResponse.data.timings.phase3}s`, colors.cyan);
        log(`  • Phase 4 (AI Enhance) completed in: ${apiResponse.data.timings.phase4}s`, colors.cyan);
        log(`  • Phase 5-7 (Processing/Ingest) completed in: ${apiResponse.data.timings.phase567}s`, colors.cyan);
        log(`  • Total Pipeline completed in: ${apiResponse.data.duration}s`, colors.cyan);
      }
      if (apiResponse.data.error) {
        log(`  → Error: ${apiResponse.data.error}`, colors.yellow);
      }
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`  ✗ API route failed after ${duration}s`, colors.red);

    if (error.response) {
      log(`  → Status code: ${error.response.status}`, colors.red);
      log(`  → Error: ${JSON.stringify(error.response.data, null, 2)}`, colors.red);
    } else if (error.code === 'ECONNREFUSED') {
      log(`  → Error: Cannot connect to server at http://localhost:3000`, colors.red);
      log(`  → Make sure the dev server is running (npm run dev)`, colors.yellow);
    } else {
      log(`  → Error: ${error.message}`, colors.red);
    }

    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    log('FAIL: API route invocation failed', colors.red);
    process.exit(1);
  }

  // Step 4: Read entry ID from file
  log('\n[4/6] Reading entry ID from file...', colors.blue);
  const idFilePath = path.join(process.cwd(), 'output', 'payload_id.txt');

  if (!fs.existsSync(idFilePath)) {
    log(`  ✗ ID file not found: ${idFilePath}`, colors.red);
    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    log('FAIL: payload_id.txt does not exist', colors.red);
    process.exit(1);
  }

  let entryId;
  try {
    entryId = fs.readFileSync(idFilePath, 'utf8').trim();
    log(`  ✓ Entry ID: ${entryId}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to read ID file: ${error.message}`, colors.red);
    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    log('FAIL: Could not read payload_id.txt', colors.red);
    process.exit(1);
  }

  // Step 5: Fetch entry from Payload API
  log('\n[5/6] Fetching entry from Payload API...', colors.blue);

  let entry;
  try {
    const response = await axios.get(
      `${apiUrl}/api/itineraries/${entryId}`,
      {
        headers: {
          'Authorization': `users API-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    entry = response.data;

    if (!entry || !entry.id) {
      throw new Error('Invalid response from Payload API - no entry returned');
    }

    log(`  ✓ Entry fetched successfully`, colors.green);
    log(`  → ID: ${entry.id}`, colors.cyan);
    log(`  → Title: ${entry.title}`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to fetch entry: ${error.message}`, colors.red);

    if (error.response) {
      log(`  → Status code: ${error.response.status}`, colors.red);

      if (error.response.status === 404) {
        log(`  → Entry not found with ID: ${entryId}`, colors.red);
      }
    }

    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    log('FAIL: Entry not found or could not be fetched', colors.red);
    process.exit(1);
  }

  // Step 6: Validate entry fields
  log('\n[6/6] Validating entry fields...', colors.blue);

  let validationErrors = [];

  // Check if entry is null
  if (!entry) {
    validationErrors.push('Entry is null');
  }

  // Check status field
  const status = entry._status;
  if (status !== 'draft') {
    validationErrors.push(`Status is "${status}", expected "draft"`);
  } else {
    log(`  ✓ Status: ${status}`, colors.green);
  }

  // Check googleInspectionStatus field
  const googleStatus = entry.googleInspectionStatus;
  if (googleStatus !== 'pending') {
    validationErrors.push(`googleInspectionStatus is "${googleStatus}", expected "pending"`);
  } else {
    log(`  ✓ Google Inspection Status: ${googleStatus}`, colors.green);
  }

  // Check schemaStatus field (should be "pass" or "fail")
  const schemaStatus = entry.schemaStatus;
  if (schemaStatus !== 'pass' && schemaStatus !== 'fail') {
    log(`  ⚠ schemaStatus is "${schemaStatus}", expected "pass" or "fail"`, colors.yellow);
  } else {
    log(`  ✓ Schema Status: ${schemaStatus}`, colors.green);
  }

  // If there are validation errors, fail
  if (validationErrors.length > 0) {
    log('\n  ✗ Validation failed:', colors.red);
    validationErrors.forEach(error => {
      log(`    • ${error}`, colors.red);
    });

    log('\n' + '='.repeat(60), colors.bright);
    log('  Phase 8 Vercel Function Validation: FAIL', colors.red);
    log('='.repeat(60), colors.bright);

    log('\n  Critical Validation Failures:', colors.red);
    validationErrors.forEach(error => {
      log(`  FAIL: ${error}`, colors.red);
    });

    log('', colors.reset);
    process.exit(1);
  }

  // All validations passed!
  log('  ✓ All validations passed', colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log('\n✓ API route and Payload entry validated:', colors.green);
  log(`  • Entry ID: ${entry.id}`, colors.green);
  log(`  • Title: ${entry.title}`, colors.green);
  log(`  • Status: ${entry._status}`, colors.green);
  log(`  • Schema Status: ${entry.schemaStatus}`, colors.green);
  log(`  • Google Inspection Status: ${entry.googleInspectionStatus}`, colors.green);
  log(`  • Build Timestamp: ${entry.buildTimestamp}`, colors.green);
  log(`  • Images: ${entry.images?.length || 0} linked`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log(`  Phase 8 Vercel Function Validation: PASS (Local invocation successful, draft created)`, colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  validatePhase8().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 8 Vercel Function Validation: FAIL', colors.red);
    process.exit(1);
  });
}
