#!/usr/bin/env node

/**
 * Content Enhancer - Phase 4
 *
 * This script consumes raw-itinerary.json and uses Gemini AI to enhance
 * content descriptions, expanding them by 100-200% while preserving factual data.
 *
 * Usage: node processors/content_enhancer.cjs
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Check if running in serverless environment
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Helper function to get output directory (serverless uses /tmp, local uses current dir)
function getOutputDir() {
  const baseDir = isVercel ? '/tmp' : process.cwd();
  return path.join(baseDir, 'output');
}

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

// Validate environment variables
function validateEnv() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  return { apiKey };
}

// Create enhancement prompt
function createEnhancementPrompt(segment) {
  const { description, title, name, location, country, type } = segment;

  // Get segment identifier
  const segmentName = title || name || type || 'segment';
  const locationInfo = location && country ? `in ${location}, ${country}` : '';

  return `You are a luxury travel content writer. Enhance the following travel itinerary description.

**Guidelines:**
- Expand the content by 100-200% (aim for substantial growth)
- Preserve ALL factual information exactly as stated (accommodation names, locations, activities, times, etc.)
- Add vivid sensory details, emotions, and immersive storytelling
- Include luxury travel keywords naturally: "exclusive", "bespoke", "curated", "intimate", "authentic"
- Maintain an elegant, sophisticated tone
- Keep the same perspective (2nd person "you" or 3rd person)
- DO NOT add fictitious details or change any factual information
- DO NOT add pricing or booking information

**Segment Type:** ${type}
**Title:** ${segmentName}
**Location:** ${locationInfo}

**Original Description:**
${description || '(No description provided)'}

**Enhanced Description (100-200% longer):**`.trim();
}

// Enhance content using Gemini AI
async function enhanceWithGemini(segment, genAI) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = createEnhancementPrompt(segment);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const enhancedText = response.text();

    return enhancedText.trim();
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// Process a single segment
async function processSegment(segment, index, total, genAI) {
  const segmentId = segment.title || segment.name || segment.type || `Segment ${index + 1}`;

  log(`\n  [${index + 1}/${total}] Processing: ${segmentId}`, colors.magenta);

  // Skip segments without descriptions
  if (!segment.description || segment.description.trim().length === 0) {
    log(`    ⊘ Skipped: No description`, colors.yellow);
    return { ...segment, description_enhanced: null };
  }

  const originalLength = segment.description.length;
  log(`    → Original length: ${originalLength} chars`, colors.cyan);

  try {
    const enhanced = await enhanceWithGemini(segment, genAI);
    const enhancedLength = enhanced.length;
    const growthPercent = ((enhancedLength - originalLength) / originalLength * 100).toFixed(0);

    log(`    ✓ Enhanced length: ${enhancedLength} chars (+${growthPercent}%)`, colors.green);

    return {
      ...segment,
      description_enhanced: enhanced,
    };
  } catch (error) {
    log(`    ✗ Enhancement failed: ${error.message}`, colors.red);
    return {
      ...segment,
      description_enhanced: null,
      enhancement_error: error.message,
    };
  }
}

// Enhance all segments in parallel using Promise.all
async function enhanceSegments(segments, genAI) {
  // Create array of promises for parallel processing
  const enhancementPromises = segments.map((segment, index) => {
    return processSegment(segment, index, segments.length, genAI);
  });

  // Wait for all enhancements to complete in parallel
  const enhanced = await Promise.all(enhancementPromises);

  return enhanced;
}

// Main enhancement function
async function enhanceContent() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  Content Enhancer - Phase 4', colors.bright);
  log('='.repeat(60), colors.bright);

  // Validate environment
  log('\n[1/5] Validating environment...', colors.blue);
  let apiKey;
  try {
    ({ apiKey } = validateEnv());
    log(`  ✓ GEMINI_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    process.exit(1);
  }

  // Initialize Gemini AI
  log('\n[2/5] Initializing Gemini AI...', colors.blue);
  const genAI = new GoogleGenerativeAI(apiKey);
  log('  ✓ Using model: gemini-2.0-flash', colors.green);

  // Load raw itinerary data
  log('\n[3/5] Loading raw itinerary data...', colors.blue);
  const outputDir = getOutputDir();
  const inputPath = path.join(outputDir, 'raw-itinerary.json');

  if (!fs.existsSync(inputPath)) {
    log(`  ✗ Input file not found: ${inputPath}`, colors.red);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    rawData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${inputPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract segments from the nested itinerary structure
  if (!rawData.itinerary || !rawData.itinerary.itineraries || !Array.isArray(rawData.itinerary.itineraries)) {
    log('  ✗ Invalid itinerary structure', colors.red);
    process.exit(1);
  }

  const itinerary = rawData.itinerary.itineraries[0]; // First itinerary
  if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
    log('  ✗ No segments found in itinerary', colors.red);
    process.exit(1);
  }

  const segments = itinerary.segments;
  const segmentsWithDesc = segments.filter(s => s.description && s.description.trim().length > 0);

  log(`  ✓ Found ${segments.length} total segments`, colors.green);
  log(`  ✓ Found ${segmentsWithDesc.length} segments with descriptions`, colors.green);

  if (segmentsWithDesc.length === 0) {
    log('  ⚠ No segments to enhance', colors.yellow);
    // Still create output with original data
    const outputPath = path.join(outputDir, 'enhanced-itinerary.json');
    fs.writeFileSync(outputPath, JSON.stringify(rawData, null, 2));
    log(`  ✓ Created output file: ${outputPath}`, colors.green);
    process.exit(0);
  }

  // Enhance all segments in parallel
  log('\n[4/5] Enhancing content with AI (parallel processing)...', colors.blue);
  log(`  → Processing ${segmentsWithDesc.length} segments in parallel`, colors.cyan);
  const enhancedSegments = await enhanceSegments(segments, genAI);

  // Update the itinerary with enhanced segments
  const enhancedData = {
    ...rawData,
    itinerary: {
      ...rawData.itinerary,
      itineraries: [
        {
          ...itinerary,
          segments: enhancedSegments,
        },
        ...rawData.itinerary.itineraries.slice(1), // Keep other itineraries if any
      ],
    },
  };

  // Write enhanced data
  log('\n[5/5] Writing enhanced itinerary file...', colors.blue);
  const outputPath = path.join(outputDir, 'enhanced-itinerary.json');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2));
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    log(`  ✓ Enhanced file written: ${outputPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);

    // Count enhanced segments
    const enhanced = enhancedSegments.filter(s => s.description_enhanced);
    log(`  → Enhanced segments: ${enhanced.length}/${segmentsWithDesc.length}`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to write output file: ${error.message}`, colors.red);
    process.exit(1);
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  ✓ Content enhancement completed successfully', colors.green);
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(0);
}

// Main execution
if (require.main === module) {
  enhanceContent().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  });
}

module.exports = { enhanceContent };
