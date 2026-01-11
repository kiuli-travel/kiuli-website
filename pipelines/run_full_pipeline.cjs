#!/usr/bin/env node

/**
 * Full Pipeline Orchestrator - Phases 2-7
 *
 * This script orchestrates the complete itinerary processing pipeline by
 * calling processor functions directly (NOT via child_process.spawn).
 *
 * Phase 2: Scraping
 * Phase 3: Media Rehosting
 * Phase 4: Content Enhancement
 * Phase 5: Schema Generation & Validation
 * Phase 6: FAQ Formatting
 * Phase 7: Payload Ingestion
 *
 * Usage: Can be called programmatically or via CLI
 */

// Load environment variables
require('dotenv').config({ path: '.env.local', override: true });

const path = require('path');
const fs = require('fs');
const { getOutputDir, getOutputFilePath } = require('../utils/outputDir.cjs');
const { parseItrvlUrl } = require('../scrapers/itrvl_scraper.cjs');

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
function log(message, color = colors.reset, silent = false) {
  if (!silent) {
    console.log(`${color}${message}${colors.reset}`);
  }
}

// Validate Phase 5 schema using Ajv
async function validateSchema(itineraryId, silent = false) {
  const Ajv = require('ajv');
  const addFormats = require('ajv-formats');

  const schemaPath = path.join(process.cwd(), 'schemas', 'kiuli-product.schema.json');
  const schemaJsonldPath = getOutputFilePath(itineraryId, 'schema.jsonld');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema definition not found: ${schemaPath}`);
  }

  if (!fs.existsSync(schemaJsonldPath)) {
    throw new Error(`schema.jsonld not found: ${schemaJsonldPath}`);
  }

  const schemaDefinition = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const schemaData = JSON.parse(fs.readFileSync(schemaJsonldPath, 'utf8'));

  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
  });

  addFormats(ajv);
  const validate = ajv.compile(schemaDefinition);
  const valid = validate(schemaData);

  if (!valid) {
    const errors = validate.errors.map(e => `${e.instancePath || 'root'}: ${e.message}`);
    throw new Error(`Schema validation failed: ${errors.join('; ')}`);
  }

  log('  ✓ Schema validation passed', colors.green, silent);
  return true;
}

// Create a partial Payload entry with failure status
async function createFailedPayloadEntry(itineraryId, errorMessage, silent = false) {
  log('\n[!] Creating partial Payload entry with failure status...', colors.yellow, silent);

  const { ingestToPayload: ingestToPayloadFn } = require('../loaders/payload_ingester.cjs');
  const axios = require('axios');

  const apiUrl = process.env.PAYLOAD_API_URL?.trim();
  const apiKey = process.env.PAYLOAD_API_KEY?.trim();

  if (!apiUrl || !apiKey) {
    throw new Error('Payload API credentials not configured');
  }

  // Load whatever data is available
  let title = 'Failed Itinerary Processing';
  let rawItinerary = null;
  let enhancedItinerary = null;

  try {
    const rawPath = getOutputFilePath(itineraryId, 'raw-itinerary.json');
    if (fs.existsSync(rawPath)) {
      rawItinerary = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
      const itinerary = rawItinerary.itinerary?.itineraries?.[0];
      if (itinerary) {
        title = itinerary.itineraryName || itinerary.name || title;
      }
    }
  } catch (e) {
    log(`  ⚠ Could not load raw itinerary: ${e.message}`, colors.yellow, silent);
  }

  try {
    const enhancedPath = getOutputFilePath(itineraryId, 'enhanced-itinerary.json');
    if (fs.existsSync(enhancedPath)) {
      enhancedItinerary = JSON.parse(fs.readFileSync(enhancedPath, 'utf8'));
    }
  } catch (e) {
    log(`  ⚠ Could not load enhanced itinerary: ${e.message}`, colors.yellow, silent);
  }

  // Load media mapping if available
  let mediaIds = [];
  try {
    const mappingPath = getOutputFilePath(itineraryId, 'media-mapping.json');
    if (fs.existsSync(mappingPath)) {
      const mediaMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      mediaIds = mediaMapping
        .filter(entry => entry.status === 'success' && entry.payloadMediaID)
        .map(entry => entry.payloadMediaID);
    }
  } catch (e) {
    log(`  ⚠ Could not load media mapping: ${e.message}`, colors.yellow, silent);
  }

  const buildTimestamp = new Date().toISOString();

  const payloadData = {
    title: title + ' (FAILED)',
    images: mediaIds,
    rawItinerary: rawItinerary,
    enhancedItinerary: enhancedItinerary,
    schema: null,
    faq: null,
    schemaStatus: 'fail',
    googleInspectionStatus: 'pending',
    buildTimestamp: buildTimestamp,
    googleFailureLog: errorMessage,
    _status: 'draft',
  };

  const response = await axios.post(
    `${apiUrl}/api/itineraries`,
    payloadData,
    {
      headers: {
        'Authorization': `users API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  if (!response.data || !response.data.doc || !response.data.doc.id) {
    throw new Error('Invalid response from Payload API');
  }

  const createdId = response.data.doc.id;
  log(`  ✓ Failed entry created with ID: ${createdId}`, colors.green, silent);

  // Write ID to file
  const idFilePath = getOutputFilePath(itineraryId, 'payload_id.txt');
  fs.writeFileSync(idFilePath, createdId.toString());

  return createdId;
}

// Main pipeline function
async function runFullPipeline(itrvlUrl, options = {}) {
  const silent = options.silent || false;

  log('\n' + '='.repeat(60), colors.bright, silent);
  log('  Full Pipeline Orchestrator (Phases 2-7)', colors.bright, silent);
  log('='.repeat(60), colors.bright, silent);

  log(`\n→ Input URL: ${itrvlUrl}`, colors.cyan, silent);

  // Extract itinerary ID from URL
  const { itineraryId } = parseItrvlUrl(itrvlUrl);
  log(`→ Itinerary ID: ${itineraryId}`, colors.cyan, silent);

  const pipelineStartTime = Date.now();
  const timings = {};

  try {
    // Phase 2: Scraping - Call function directly
    log('\n[PHASE 2] Scraping itinerary data...', colors.blue, silent);
    const phase2Start = Date.now();

    const { scrapeItrvl } = require('../scrapers/itrvl_scraper.cjs');
    await scrapeItrvl(itrvlUrl);

    timings.phase2 = ((Date.now() - phase2Start) / 1000).toFixed(2);
    log(`  ✓ Phase 2 (Scrape) completed in: ${timings.phase2}s`, colors.green, silent);

    // Phase 3: Media Rehosting - Call function directly
    log('\n[PHASE 3] Rehosting media files...', colors.blue, silent);
    const phase3Start = Date.now();

    const { rehostMedia } = require('../processors/media_rehoster.cjs');
    await rehostMedia(itineraryId);

    timings.phase3 = ((Date.now() - phase3Start) / 1000).toFixed(2);
    log(`  ✓ Phase 3 (Media Rehost) completed in: ${timings.phase3}s`, colors.green, silent);

    // Phase 4: Content Enhancement - Call function directly
    log('\n[PHASE 4] Enhancing content with AI...', colors.blue, silent);
    const phase4Start = Date.now();

    const { enhanceContent } = require('../processors/content_enhancer.cjs');
    await enhanceContent(itineraryId);

    timings.phase4 = ((Date.now() - phase4Start) / 1000).toFixed(2);
    log(`  ✓ Phase 4 (AI Enhance) completed in: ${timings.phase4}s`, colors.green, silent);

    // Phase 5-7: Processing and Ingestion
    log('\n[PHASE 5-7] Processing and ingestion...', colors.blue, silent);
    const phase567Start = Date.now();

    // Phase 5: Schema Generation with Validation Retry Loop
    log('\n  [PHASE 5] Generating and validating JSON-LD schema...', colors.blue, silent);

    const { generateSchema } = require('../processors/schema_generator.cjs');
    const MAX_VALIDATION_ATTEMPTS = 3;
    let validationPassed = false;
    let validationErrors = [];

    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          log(`\n  → Validation retry attempt ${attempt}/${MAX_VALIDATION_ATTEMPTS}...`, colors.yellow, silent);
        }

        // Generate schema
        await generateSchema(itineraryId);
        log(`    ✓ Schema generation complete (attempt ${attempt})`, colors.green, silent);

        // Validate schema
        await validateSchema(itineraryId, silent);
        log(`    ✓ Schema validation passed (attempt ${attempt})`, colors.green, silent);

        validationPassed = true;
        if (attempt > 1) {
          log(`    ✓ Validation succeeded after ${attempt} attempts`, colors.green, silent);
        }
        break;
      } catch (validationError) {
        validationErrors.push({
          attempt: attempt,
          error: validationError.message,
          timestamp: new Date().toISOString(),
        });

        log(`    ✗ Attempt ${attempt} validation failed: ${validationError.message}`, colors.red, silent);

        if (attempt < MAX_VALIDATION_ATTEMPTS) {
          log(`    → Retrying schema generation...`, colors.yellow, silent);
        }
      }
    }

    // If validation failed after all attempts, create failed entry
    if (!validationPassed) {
      timings.phase567 = ((Date.now() - phase567Start) / 1000).toFixed(2);

      // Build detailed failure report
      const failureReport = {
        totalAttempts: MAX_VALIDATION_ATTEMPTS,
        errors: validationErrors,
        summary: `Schema validation failed after ${MAX_VALIDATION_ATTEMPTS} attempts`,
      };

      const failureReportText = [
        `Schema Validation Failed After ${MAX_VALIDATION_ATTEMPTS} Attempts`,
        '',
        'Attempts:',
        ...validationErrors.map(e =>
          `  Attempt ${e.attempt} (${e.timestamp}):\n    ${e.error}`
        ),
      ].join('\n');

      log(`\n  ✗ Schema validation failed after ${MAX_VALIDATION_ATTEMPTS} attempts`, colors.red, silent);
      log(`\n${failureReportText}`, colors.red, silent);

      // Create failed Payload entry with detailed report
      const failedId = await createFailedPayloadEntry(itineraryId, failureReportText, silent);

      const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

      log('\n' + '='.repeat(60), colors.bright, silent);
      log('  Pipeline Result: FAILED (Schema Validation)', colors.red, silent);
      log('='.repeat(60), colors.bright, silent);
      log(`\n  Performance Breakdown:`, colors.cyan, silent);
      log(`  • Phase 2 (Scrape): ${timings.phase2}s`, colors.cyan, silent);
      log(`  • Phase 3 (Media Rehost): ${timings.phase3}s`, colors.cyan, silent);
      log(`  • Phase 4 (AI Enhance): ${timings.phase4}s`, colors.cyan, silent);
      log(`  • Phase 5-7 (Processing/Ingest): ${timings.phase567}s`, colors.cyan, silent);
      log(`  • Total Pipeline: ${totalDuration}s`, colors.cyan, silent);
      log(`\n  → Failed entry created with ID: ${failedId}`, colors.yellow, silent);
      log('', colors.reset, silent);

      return {
        success: false,
        payloadId: failedId,
        phase: 'validation',
        error: failureReportText,
        validationAttempts: MAX_VALIDATION_ATTEMPTS,
        validationErrors: validationErrors,
        duration: parseFloat(totalDuration),
        timings: timings,
      };
    }

    // Phase 6: FAQ Formatting - Call function directly
    log('\n  [PHASE 6] Formatting FAQ content...', colors.blue, silent);

    const { formatFAQ } = require('../processors/faq_formatter.cjs');
    await formatFAQ(itineraryId);

    log('    ✓ Phase 6 complete', colors.green, silent);

    // Phase 7: Payload Ingestion - Call function directly
    log('\n  [PHASE 7] Ingesting to Payload CMS...', colors.blue, silent);

    const { ingestToPayload } = require('../loaders/payload_ingester.cjs');
    await ingestToPayload(itineraryId);

    log('    ✓ Phase 7 complete', colors.green, silent);

    timings.phase567 = ((Date.now() - phase567Start) / 1000).toFixed(2);
    log(`\n  ✓ Phase 5-7 (Processing/Ingest) completed in: ${timings.phase567}s`, colors.green, silent);

    // Read the created Payload ID
    const idFilePath = getOutputFilePath(itineraryId, 'payload_id.txt');
    const payloadId = fs.readFileSync(idFilePath, 'utf8').trim();

    const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(60), colors.bright, silent);
    log('  ✓ Pipeline completed', colors.green, silent);
    log('='.repeat(60), colors.bright, silent);
    log(`\n  Performance Breakdown:`, colors.cyan, silent);
    log(`  • Phase 2 (Scrape): ${timings.phase2}s`, colors.cyan, silent);
    log(`  • Phase 3 (Media Rehost): ${timings.phase3}s`, colors.cyan, silent);
    log(`  • Phase 4 (AI Enhance): ${timings.phase4}s`, colors.cyan, silent);
    log(`  • Phase 5-7 (Processing/Ingest): ${timings.phase567}s`, colors.cyan, silent);
    log(`  • Total Pipeline: ${totalDuration}s`, colors.cyan, silent);
    log(`\n  → Payload Entry ID: ${payloadId}`, colors.cyan, silent);
    log('', colors.reset, silent);

    return {
      success: true,
      payloadId: payloadId,
      duration: parseFloat(totalDuration),
      timings: timings,
    };

  } catch (error) {
    const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(60), colors.bright, silent);
    log('  ✗ Pipeline failed', colors.red, silent);
    log('='.repeat(60), colors.bright, silent);
    log(`\n  Error: ${error.message}`, colors.red, silent);

    if (Object.keys(timings).length > 0) {
      log(`\n  Performance Breakdown (before failure):`, colors.cyan, silent);
      if (timings.phase2) log(`  • Phase 2 (Scrape): ${timings.phase2}s`, colors.cyan, silent);
      if (timings.phase3) log(`  • Phase 3 (Media Rehost): ${timings.phase3}s`, colors.cyan, silent);
      if (timings.phase4) log(`  • Phase 4 (AI Enhance): ${timings.phase4}s`, colors.cyan, silent);
      if (timings.phase567) log(`  • Phase 5-7 (Processing/Ingest): ${timings.phase567}s`, colors.cyan, silent);
    }

    log(`  • Total Duration: ${totalDuration}s`, colors.cyan, silent);
    log('', colors.reset, silent);

    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red, silent);
    }

    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node pipelines/run_full_pipeline.cjs <itrvl_url>');
    process.exit(1);
  }

  const itrvlUrl = args[0];

  runFullPipeline(itrvlUrl)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`\n✗ Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runFullPipeline };
