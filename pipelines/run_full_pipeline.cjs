#!/usr/bin/env node

/**
 * Full Pipeline Orchestrator - Phases 2-7
 *
 * This script orchestrates the complete itinerary processing pipeline:
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
require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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

// Execute a Node.js script and return result
function executeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Script exited with code ${code}\n${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Validate Phase 5 schema
async function validateSchema(silent = false) {
  const Ajv = require('ajv');
  const addFormats = require('ajv-formats');

  const schemaPath = path.join(process.cwd(), 'schemas', 'kiuli-product.schema.json');
  const schemaJsonldPath = path.join(process.cwd(), 'output', 'schema.jsonld');

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
async function createFailedPayloadEntry(errorMessage, silent = false) {
  log('\n[!] Creating partial Payload entry with failure status...', colors.yellow, silent);

  const apiUrl = process.env.PAYLOAD_API_URL;
  const apiKey = process.env.PAYLOAD_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('Payload API credentials not configured');
  }

  const outputDir = path.join(process.cwd(), 'output');

  // Load whatever data is available
  let title = 'Failed Itinerary Processing';
  let rawItinerary = null;
  let enhancedItinerary = null;

  try {
    const rawPath = path.join(outputDir, 'raw-itinerary.json');
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
    const enhancedPath = path.join(outputDir, 'enhanced-itinerary.json');
    if (fs.existsSync(enhancedPath)) {
      enhancedItinerary = JSON.parse(fs.readFileSync(enhancedPath, 'utf8'));
    }
  } catch (e) {
    log(`  ⚠ Could not load enhanced itinerary: ${e.message}`, colors.yellow, silent);
  }

  // Load media mapping if available
  let mediaIds = [];
  try {
    const mappingPath = path.join(outputDir, 'media-mapping.json');
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
  const idFilePath = path.join(outputDir, 'payload_id.txt');
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

  const pipelineStartTime = Date.now();
  const timings = {};

  try {
    // Phase 2: Scraping
    log('\n[PHASE 2] Scraping itinerary data...', colors.blue, silent);
    const phase2Start = Date.now();

    // Use bundled scraper if available (production), otherwise use source file (development)
    const scraperPath = fs.existsSync(path.join(process.cwd(), 'scrapers', 'dist', 'index.cjs'))
      ? path.join(process.cwd(), 'scrapers', 'dist', 'index.cjs')
      : path.join(process.cwd(), 'scrapers', 'itrvl_scraper.cjs');

    await executeScript(scraperPath, [itrvlUrl]);
    timings.phase2 = ((Date.now() - phase2Start) / 1000).toFixed(2);
    log(`  ✓ Phase 2 (Scrape) completed in: ${timings.phase2}s`, colors.green, silent);

    // Phase 3: Media Rehosting
    log('\n[PHASE 3] Rehosting media files...', colors.blue, silent);
    const phase3Start = Date.now();
    await executeScript(
      path.join(process.cwd(), 'processors', 'media_rehoster.cjs')
    );
    timings.phase3 = ((Date.now() - phase3Start) / 1000).toFixed(2);
    log(`  ✓ Phase 3 (Media Rehost) completed in: ${timings.phase3}s`, colors.green, silent);

    // Phase 4: Content Enhancement
    log('\n[PHASE 4] Enhancing content with AI...', colors.blue, silent);
    const phase4Start = Date.now();
    await executeScript(
      path.join(process.cwd(), 'processors', 'content_enhancer.cjs')
    );
    timings.phase4 = ((Date.now() - phase4Start) / 1000).toFixed(2);
    log(`  ✓ Phase 4 (AI Enhance) completed in: ${timings.phase4}s`, colors.green, silent);

    // Phase 5-7: Processing and Ingestion
    log('\n[PHASE 5-7] Processing and ingestion...', colors.blue, silent);
    const phase567Start = Date.now();

    // Phase 5: Schema Generation
    log('\n  [PHASE 5] Generating JSON-LD schema...', colors.blue, silent);
    await executeScript(
      path.join(process.cwd(), 'processors', 'schema_generator.cjs')
    );
    log('    ✓ Schema generation complete', colors.green, silent);

    // Phase 5: Internal Schema Validation
    log('\n  [PHASE 5] Validating schema internally...', colors.blue, silent);
    try {
      await validateSchema(silent);
      log('    ✓ Phase 5 validation complete', colors.green, silent);
    } catch (validationError) {
      timings.phase567 = ((Date.now() - phase567Start) / 1000).toFixed(2);
      log(`  ✗ Schema validation failed: ${validationError.message}`, colors.red, silent);

      // Create partial Payload entry with failure status
      const failedId = await createFailedPayloadEntry(validationError.message, silent);

      const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

      log('\n' + '='.repeat(60), colors.bright, silent);
      log('  Pipeline Result: PARTIAL (Schema Validation Failed)', colors.yellow, silent);
      log('='.repeat(60), colors.bright, silent);
      log(`\n  Performance Breakdown:`, colors.cyan, silent);
      log(`  • Phase 2 (Scrape): ${timings.phase2}s`, colors.cyan, silent);
      log(`  • Phase 3 (Media Rehost): ${timings.phase3}s`, colors.cyan, silent);
      log(`  • Phase 4 (AI Enhance): ${timings.phase4}s`, colors.cyan, silent);
      log(`  • Phase 5-7 (Processing/Ingest): ${timings.phase567}s`, colors.cyan, silent);
      log(`  • Total Pipeline: ${totalDuration}s`, colors.cyan, silent);
      log(`\n  → Partial entry created with ID: ${failedId}`, colors.yellow, silent);
      log('', colors.reset, silent);

      return {
        success: false,
        payloadId: failedId,
        phase: 'validation',
        error: validationError.message,
        duration: parseFloat(totalDuration),
        timings: timings,
      };
    }

    // Phase 6: FAQ Formatting
    log('\n  [PHASE 6] Formatting FAQ content...', colors.blue, silent);
    await executeScript(
      path.join(process.cwd(), 'processors', 'faq_formatter.cjs')
    );
    log('    ✓ Phase 6 complete', colors.green, silent);

    // Phase 7: Payload Ingestion
    log('\n  [PHASE 7] Ingesting to Payload CMS...', colors.blue, silent);
    await executeScript(
      path.join(process.cwd(), 'loaders', 'payload_ingester.cjs')
    );
    log('    ✓ Phase 7 complete', colors.green, silent);

    timings.phase567 = ((Date.now() - phase567Start) / 1000).toFixed(2);
    log(`\n  ✓ Phase 5-7 (Processing/Ingest) completed in: ${timings.phase567}s`, colors.green, silent);

    // Read the created Payload ID
    const idFilePath = path.join(process.cwd(), 'output', 'payload_id.txt');
    const payloadId = fs.readFileSync(idFilePath, 'utf8').trim();

    const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(60), colors.bright, silent);
    log('  ✓ Pipeline completed successfully', colors.green, silent);
    log('='.repeat(60), colors.bright, silent);
    log(`\n  Performance Breakdown:`, colors.cyan, silent);
    log(`  • Phase 2 (Scrape) completed in: ${timings.phase2}s`, colors.cyan, silent);
    log(`  • Phase 3 (Media Rehost) completed in: ${timings.phase3}s`, colors.cyan, silent);
    log(`  • Phase 4 (AI Enhance) completed in: ${timings.phase4}s`, colors.cyan, silent);
    log(`  • Phase 5-7 (Processing/Ingest) completed in: ${timings.phase567}s`, colors.cyan, silent);
    log(`  • Total Pipeline completed in: ${totalDuration}s`, colors.cyan, silent);
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
