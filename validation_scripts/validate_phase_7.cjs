#!/usr/bin/env node

/**
 * Phase 7: Payload CMS Ingestion - Validation Script
 *
 * This script validates that the draft itinerary entry was created correctly
 * in Payload CMS by fetching it via the API and checking its status fields.
 *
 * Usage: node validation_scripts/validate_phase_7.cjs
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
async function validatePhase7() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 7: PAYLOAD INGESTION VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Validate environment
  log('\n[1/4] Validating environment...', colors.blue);
  let apiUrl, apiKey;
  try {
    ({ apiUrl, apiKey } = validateEnv());
    log(`  ✓ PAYLOAD_API_URL: ${apiUrl}`, colors.green);
    log(`  ✓ PAYLOAD_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    log('\nPhase 7 Payload Ingestion: FAIL', colors.red);
    log('FAIL: Environment validation error', colors.red);
    process.exit(1);
  }

  // Step 2: Read entry ID from file
  log('\n[2/4] Reading entry ID from file...', colors.blue);
  const idFilePath = path.join(process.cwd(), 'output', 'payload_id.txt');

  if (!fs.existsSync(idFilePath)) {
    log(`  ✗ ID file not found: ${idFilePath}`, colors.red);
    log('\nPhase 7 Payload Ingestion: FAIL', colors.red);
    log('FAIL: payload_id.txt does not exist', colors.red);
    process.exit(1);
  }

  let entryId;
  try {
    entryId = fs.readFileSync(idFilePath, 'utf8').trim();
    log(`  ✓ Entry ID: ${entryId}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to read ID file: ${error.message}`, colors.red);
    log('\nPhase 7 Payload Ingestion: FAIL', colors.red);
    log('FAIL: Could not read payload_id.txt', colors.red);
    process.exit(1);
  }

  // Step 3: Fetch entry from Payload API
  log('\n[3/4] Fetching entry from Payload API...', colors.blue);

  let entry;
  try {
    const response = await axios.get(
      `${apiUrl}/api/itineraries/${entryId}`,
      {
        headers: {
          'Authorization': `users API-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000, // 20 second timeout
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

    log('\nPhase 7 Payload Ingestion: FAIL', colors.red);
    log('FAIL: Entry not found or could not be fetched', colors.red);
    process.exit(1);
  }

  // Step 4: Validate entry fields
  log('\n[4/4] Validating entry fields...', colors.blue);

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

  // Check schemaStatus field (should be "pass" from Phase 5)
  const schemaStatus = entry.schemaStatus;
  if (schemaStatus !== 'pass') {
    log(`  ⚠ schemaStatus is "${schemaStatus}", expected "pass"`, colors.yellow);
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
    log('  Phase 7 Payload Ingestion: FAIL', colors.red);
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

  log('\n✓ Payload entry validated:', colors.green);
  log(`  • Entry ID: ${entry.id}`, colors.green);
  log(`  • Title: ${entry.title}`, colors.green);
  log(`  • Status: ${entry._status}`, colors.green);
  log(`  • Schema Status: ${entry.schemaStatus}`, colors.green);
  log(`  • Google Inspection Status: ${entry.googleInspectionStatus}`, colors.green);
  log(`  • Build Timestamp: ${entry.buildTimestamp}`, colors.green);
  log(`  • Images: ${entry.images?.length || 0} linked`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log(`  Phase 7 Payload Ingestion: PASS (Draft created with ID: ${entry.id})`, colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  validatePhase7().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 7 Payload Ingestion: FAIL', colors.red);
    process.exit(1);
  });
}
