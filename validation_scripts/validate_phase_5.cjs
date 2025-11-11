#!/usr/bin/env node

/**
 * Phase 5: Product Schema Generation & Internal Validation - Validation Script
 *
 * This script validates the generated schema.jsonld against the kiuli-product.schema.json
 * using the AJV JSON Schema validator. This is the internal validator that runs before
 * any external API calls.
 *
 * Usage: node validation_scripts/validate_phase_5.cjs
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
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

// Format AJV validation errors in a readable way
function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || 'root';
    const message = error.message;
    const params = error.params;

    let detailedMessage = `  • Path: ${path}`;

    if (error.keyword === 'const') {
      detailedMessage += ` - must be "${params.allowedValue}"`;
    } else if (error.keyword === 'pattern') {
      detailedMessage += ` - ${message} (pattern: ${params.pattern})`;
    } else if (error.keyword === 'not') {
      detailedMessage += ` - must not match forbidden pattern`;
    } else {
      detailedMessage += ` - ${message}`;
    }

    if (params && Object.keys(params).length > 0) {
      detailedMessage += `\n    Params: ${JSON.stringify(params)}`;
    }

    return detailedMessage;
  });
}

// Main validation function
async function validatePhase5() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 5: INTERNAL SCHEMA VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Load the JSON Schema
  log('\n[1/4] Loading Kiuli Product schema definition...', colors.blue);
  const schemaPath = path.join(process.cwd(), 'schemas', 'kiuli-product.schema.json');

  if (!fs.existsSync(schemaPath)) {
    log(`  ✗ Schema definition not found: ${schemaPath}`, colors.red);
    log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
    log('FAIL: Schema definition file missing', colors.red);
    process.exit(1);
  }

  let schemaDefinition;
  try {
    const fileContent = fs.readFileSync(schemaPath, 'utf8');
    schemaDefinition = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${schemaPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse schema: ${error.message}`, colors.red);
    log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
    log('FAIL: Invalid schema definition', colors.red);
    process.exit(1);
  }

  // Step 2: Initialize AJV validator
  log('\n[2/4] Initializing AJV validator...', colors.blue);

  try {
    const ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // Add format validation (uri, email, etc.)
    addFormats(ajv);

    const validate = ajv.compile(schemaDefinition);
    log('  ✓ AJV validator initialized', colors.green);
    log('  ✓ Schema compiled successfully', colors.green);

    // Step 3: Load the generated schema.jsonld
    log('\n[3/4] Loading generated schema.jsonld...', colors.blue);
    const schemaJsonldPath = path.join(process.cwd(), 'output', 'schema.jsonld');

    if (!fs.existsSync(schemaJsonldPath)) {
      log(`  ✗ schema.jsonld not found: ${schemaJsonldPath}`, colors.red);
      log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
      log('FAIL: schema.jsonld does not exist', colors.red);
      process.exit(1);
    }

    let schemaData;
    try {
      const fileContent = fs.readFileSync(schemaJsonldPath, 'utf8');
      schemaData = JSON.parse(fileContent);
      const fileSize = (fs.statSync(schemaJsonldPath).size / 1024).toFixed(2);
      log(`  ✓ Loaded: ${schemaJsonldPath}`, colors.green);
      log(`  → File size: ${fileSize} KB`, colors.cyan);
    } catch (error) {
      log(`  ✗ Failed to parse schema.jsonld: ${error.message}`, colors.red);
      log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
      log('FAIL: Invalid JSON in schema.jsonld', colors.red);
      process.exit(1);
    }

    // Step 4: Validate the schema
    log('\n[4/4] Validating schema.jsonld against Kiuli Product schema...', colors.blue);

    const valid = validate(schemaData);

    if (!valid) {
      log('  ✗ Validation failed', colors.red);
      log('\n  Validation Errors:', colors.red);

      const formattedErrors = formatValidationErrors(validate.errors);
      formattedErrors.forEach((error) => {
        log(error, colors.red);
      });

      // Check for specific critical errors
      const errorMessages = validate.errors.map(e => `${e.instancePath} ${e.message}`);

      log('\n' + '='.repeat(60), colors.bright);
      log('  Phase 5 Internal Schema Validation: FAIL', colors.red);
      log('='.repeat(60), colors.bright);

      log('\n  Critical Validation Failures:', colors.red);
      validate.errors.forEach((error) => {
        log(`  FAIL: ${error.instancePath || 'data'}${error.instancePath ? '' : '.'} ${error.message}`, colors.red);
      });

      log('', colors.reset);
      process.exit(1);
    }

    // All validations passed!
    log('  ✓ All validations passed', colors.green);

    log('\n' + '='.repeat(60), colors.bright);
    log('  VALIDATION SUMMARY', colors.bright);
    log('='.repeat(60), colors.bright);

    log('\n✓ Schema structure validated:', colors.green);
    log(`  • @context: ${schemaData['@context']}`, colors.green);
    log(`  • @type: ${schemaData['@type']}`, colors.green);
    log(`  • name: "${schemaData.name}"`, colors.green);
    log(`  • description: ${schemaData.description.length} characters`, colors.green);
    log(`  • images: ${schemaData.image.length} rehosted URLs`, colors.green);
    log(`  • brand: ${schemaData.brand.name}`, colors.green);
    log(`  • sku: ${schemaData.sku}`, colors.green);
    log(`  • offers.price: $${schemaData.offers.price} ${schemaData.offers.priceCurrency}`, colors.green);
    log(`  • offers.availability: ${schemaData.offers.availability}`, colors.green);

    // Check for forbidden domains
    const hasForbiddenDomains = schemaData.image.some(url => url.includes('itrvl.imgix.net'));
    if (!hasForbiddenDomains) {
      log(`  • ✓ No forbidden domains (itrvl.imgix.net) detected`, colors.green);
    }

    log('\n' + '='.repeat(60), colors.bright);
    log('  Phase 5 Internal Schema Validation: PASS', colors.green);
    log('='.repeat(60) + '\n', colors.bright);

    process.exit(0);
  } catch (error) {
    log(`  ✗ AJV initialization failed: ${error.message}`, colors.red);
    log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
    log('FAIL: Validator initialization error', colors.red);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  validatePhase5().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 5 Internal Schema Validation: FAIL', colors.red);
    process.exit(1);
  });
}
