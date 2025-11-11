#!/usr/bin/env node

/**
 * Phase 6: FAQ Content Formatting - Validation Script
 *
 * This script validates that the FAQ HTML file was generated correctly by checking
 * for the presence of <details> and <summary> tags.
 *
 * Usage: node validation_scripts/validate_phase_6.cjs
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

// Count occurrences of a tag in HTML content
function countTags(content, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

// Main validation function
async function validatePhase6() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  PHASE 6: FAQ VALIDATION', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Check if FAQ file exists
  log('\n[1/3] Checking for FAQ HTML file...', colors.blue);
  const faqPath = path.join(process.cwd(), 'output', 'faq.html');

  if (!fs.existsSync(faqPath)) {
    log(`  ✗ FAQ file not found: ${faqPath}`, colors.red);
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    log('FAIL: faq.html does not exist', colors.red);
    process.exit(1);
  }

  log(`  ✓ Found: ${faqPath}`, colors.green);

  // Step 2: Read and validate file content
  log('\n[2/3] Reading and analyzing FAQ content...', colors.blue);

  let content;
  try {
    content = fs.readFileSync(faqPath, 'utf8');
    const fileSize = (fs.statSync(faqPath).size / 1024).toFixed(2);
    log(`  ✓ Loaded: ${faqPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to read FAQ file: ${error.message}`, colors.red);
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    log('FAIL: Could not read faq.html', colors.red);
    process.exit(1);
  }

  // Check if file is empty
  if (!content || content.trim().length === 0) {
    log('  ✗ FAQ file is empty', colors.red);
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    log('FAIL: faq.html is empty', colors.red);
    process.exit(1);
  }

  log(`  ✓ Content length: ${content.length} characters`, colors.green);

  // Step 3: Count tags and validate structure
  log('\n[3/3] Validating HTML structure...', colors.blue);

  const detailsCount = countTags(content, 'details');
  const summaryCount = countTags(content, 'summary');

  log(`  → Found <details> tags: ${detailsCount}`, colors.cyan);
  log(`  → Found <summary> tags: ${summaryCount}`, colors.cyan);

  // Validate tag counts
  if (detailsCount === 0) {
    log('  ✗ No <details> tags found', colors.red);
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    log('FAIL: No <details> tags found in faq.html', colors.red);
    process.exit(1);
  }

  if (summaryCount === 0) {
    log('  ✗ No <summary> tags found', colors.red);
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    log('FAIL: No <summary> tags found in faq.html', colors.red);
    process.exit(1);
  }

  // Check if counts match (each <details> should have a <summary>)
  if (detailsCount !== summaryCount) {
    log(`  ⚠ Warning: <details> count (${detailsCount}) does not match <summary> count (${summaryCount})`, colors.yellow);
  }

  log('  ✓ Valid HTML structure detected', colors.green);

  // All validations passed!
  log('\n' + '='.repeat(60), colors.bright);
  log('  VALIDATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log('\n✓ FAQ structure validated:', colors.green);
  log(`  • File exists: ${faqPath}`, colors.green);
  log(`  • Content length: ${content.length} characters`, colors.green);
  log(`  • <details> tags: ${detailsCount}`, colors.green);
  log(`  • <summary> tags: ${summaryCount}`, colors.green);
  log(`  • Q&A pairs: ${Math.min(detailsCount, summaryCount)}`, colors.green);

  log('\n' + '='.repeat(60), colors.bright);
  log(`  Phase 6 FAQ Validation: PASS (Found ${detailsCount} details tags, ${summaryCount} summary tags)`, colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  validatePhase6().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    log('\nPhase 6 FAQ Validation: FAIL', colors.red);
    process.exit(1);
  });
}
