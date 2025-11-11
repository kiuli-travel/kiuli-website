#!/usr/bin/env node

/**
 * FAQ Formatter - Phase 6
 *
 * This script consumes enhanced-itinerary.json and formats the enhanced segment
 * data into a single, structured HTML block using <details> and <summary> tags
 * for Q&A pairs.
 *
 * Usage: node processors/faq_formatter.cjs
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
  magenta: '\x1b[35m',
};

// Helper function to log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Escape HTML special characters in text
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate question text from segment data
function generateQuestion(segment, index) {
  const day = segment.day || Math.floor(index / 3) + 1; // Approximate day if not provided
  const title = segment.title || segment.name || segment.type || 'Experience';

  return `What's included in Day ${day}: ${title}?`;
}

// Format a single segment as a Q&A pair
function formatSegmentAsQA(segment, index) {
  const question = generateQuestion(segment, index);
  const answer = segment.description_enhanced || segment.description || '';

  // Convert markdown-style formatting to basic HTML
  let formattedAnswer = answer
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // Italic
    .replace(/\n\n/g, '</p><p>'); // Paragraphs

  return `  <details>
    <summary>${escapeHtml(question)}</summary>
    <div class="faq-answer">
      <p>${formattedAnswer}</p>
    </div>
  </details>`;
}

// Main FAQ formatting function
async function formatFAQ() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  FAQ Formatter - Phase 6', colors.bright);
  log('='.repeat(60), colors.bright);

  // Step 1: Load enhanced itinerary data
  log('\n[1/3] Loading enhanced itinerary data...', colors.blue);
  const inputPath = path.join(process.cwd(), 'output', 'enhanced-itinerary.json');

  if (!fs.existsSync(inputPath)) {
    log(`  ✗ Enhanced itinerary not found: ${inputPath}`, colors.red);
    process.exit(1);
  }

  let enhancedData;
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    enhancedData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${inputPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract segments from the nested itinerary structure
  if (!enhancedData.itinerary || !enhancedData.itinerary.itineraries || !Array.isArray(enhancedData.itinerary.itineraries)) {
    log('  ✗ Invalid itinerary structure', colors.red);
    process.exit(1);
  }

  const itinerary = enhancedData.itinerary.itineraries[0];
  if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
    log('  ✗ No segments found in itinerary', colors.red);
    process.exit(1);
  }

  const segments = itinerary.segments;

  // Filter segments with enhanced descriptions
  const segmentsWithEnhancedDesc = segments.filter(
    s => s.description_enhanced && s.description_enhanced.trim().length > 0
  );

  log(`  ✓ Found ${segments.length} total segments`, colors.green);
  log(`  ✓ Found ${segmentsWithEnhancedDesc.length} segments with enhanced descriptions`, colors.green);

  if (segmentsWithEnhancedDesc.length === 0) {
    log('  ⚠ No segments with enhanced descriptions to format', colors.yellow);
    // Create empty FAQ file
    const outputPath = path.join(process.cwd(), 'output', 'faq.html');
    fs.writeFileSync(outputPath, '<div class="faq-container">\n  <!-- No FAQ items available -->\n</div>');
    log(`  ✓ Created empty FAQ file: ${outputPath}`, colors.green);
    process.exit(0);
  }

  // Step 2: Format segments as Q&A pairs
  log('\n[2/3] Formatting segments as Q&A pairs...', colors.blue);

  const faqItems = segmentsWithEnhancedDesc.map((segment, index) => {
    const segmentName = segment.title || segment.name || `Segment ${index + 1}`;
    log(`  → Processing: ${segmentName}`, colors.cyan);
    return formatSegmentAsQA(segment, index);
  });

  log(`  ✓ Formatted ${faqItems.length} Q&A pairs`, colors.green);

  // Step 3: Build complete HTML structure and write to file
  log('\n[3/3] Writing FAQ HTML file...', colors.blue);

  const htmlContent = `<div class="faq-container">
${faqItems.join('\n\n')}
</div>`;

  const outputPath = path.join(process.cwd(), 'output', 'faq.html');

  try {
    fs.writeFileSync(outputPath, htmlContent);
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    log(`  ✓ FAQ HTML written: ${outputPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
    log(`  → Q&A pairs: ${faqItems.length}`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to write FAQ file: ${error.message}`, colors.red);
    process.exit(1);
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  ✓ FAQ formatting completed successfully', colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  formatFAQ().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  });
}

module.exports = { formatFAQ };
