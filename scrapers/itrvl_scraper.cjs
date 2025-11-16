#!/usr/bin/env node

/**
 * iTrvl Scraper - Phase 2
 *
 * This script uses Puppeteer to intercept API responses from iTrvl portal.
 * It captures pricing and itinerary data through API interception (NO DOM scraping).
 *
 * Usage: node scrapers/itrvl_scraper.cjs <ITRVL_URL>
 *
 * Example URL format:
 * https://portal.itrvl.com/share?accessKey=ABC123&itineraryId=12345
 */

// Use serverless Chromium for Vercel, regular Puppeteer for local
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
let puppeteer;
let chromium;

if (isVercel) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer');
}

const fs = require('fs');
const path = require('path');
const { getOutputFilePath } = require('../utils/outputDir.cjs');

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

// Parse iTrvl URL to extract Access Key and Itinerary ID
function parseItrvlUrl(url) {
  try {
    const urlObj = new URL(url);

    let accessKey = null;
    let itineraryId = null;

    // Try to extract from query parameters first
    // Format: https://portal.itrvl.com/share?accessKey=ABC&itineraryId=123
    accessKey = urlObj.searchParams.get('accessKey');
    itineraryId = urlObj.searchParams.get('itineraryId');

    // If not found in query params, try path-based format
    // Format: https://itrvl.com/client/portal/{accessKey}/{itineraryId}
    if (!accessKey || !itineraryId) {
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

      // Look for /portal/{accessKey}/{itineraryId} pattern
      const portalIndex = pathParts.indexOf('portal');
      if (portalIndex !== -1 && pathParts.length >= portalIndex + 3) {
        accessKey = pathParts[portalIndex + 1];
        itineraryId = pathParts[portalIndex + 2];
      }
    }

    if (!accessKey) {
      throw new Error('accessKey not found in URL (tried query params and path)');
    }

    if (!itineraryId) {
      throw new Error('itineraryId not found in URL (tried query params and path)');
    }

    return {
      accessKey,
      itineraryId,
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
    };
  } catch (error) {
    throw new Error(`Failed to parse iTrvl URL: ${error.message}`);
  }
}

// Main scraper function
async function scrapeItrvl(url) {
  log('\n' + '='.repeat(60), colors.bright);
  log('  iTrvl API Scraper - Phase 2', colors.bright);
  log('='.repeat(60), colors.bright);

  // Parse URL
  log('\n[1/5] Parsing iTrvl URL...', colors.blue);
  let parsedUrl;
  try {
    parsedUrl = parseItrvlUrl(url);
    log(`  ✓ Access Key: ${parsedUrl.accessKey}`, colors.green);
    log(`  ✓ Itinerary ID: ${parsedUrl.itineraryId}`, colors.green);
    log(`  ✓ Base URL: ${parsedUrl.baseUrl}`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    process.exit(1);
  }

  // Initialize data capture containers
  let itinerariesData = null;
  let renderDataClientData = null;

  // Launch Puppeteer
  log('\n[2/5] Launching headless browser...', colors.blue);
  let browser;
  try {
    if (isVercel) {
      // Use serverless Chromium for Vercel/Lambda
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Use regular Puppeteer for local development
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
    }
    log('  ✓ Browser launched successfully', colors.green);
  } catch (error) {
    log(`  ✗ Failed to launch browser: ${error.message}`, colors.red);
    process.exit(1);
  }

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable request interception
    log('\n[3/5] Setting up API interception...', colors.blue);
    await page.setRequestInterception(true);

    // Intercept and capture API responses
    page.on('response', async (response) => {
      const url = response.url();

      try {
        // Intercept /api/Itineraries for pricing data
        if (url.includes('/api/Itineraries') && !url.includes('/api/Itineraries/')) {
          log('  → Captured: /api/Itineraries (pricing data)', colors.cyan);
          const data = await response.json();
          itinerariesData = data;
        }

        // Intercept /api/PresentationEdits/renderDataClient for descriptions and s3Keys
        if (url.includes('/api/PresentationEdits/renderDataClient')) {
          log('  → Captured: /api/PresentationEdits/renderDataClient (itinerary data)', colors.cyan);
          const data = await response.json();
          renderDataClientData = data;
        }
      } catch (error) {
        // Ignore JSON parse errors for non-JSON responses
      }
    });

    // Allow all requests to continue
    page.on('request', (request) => {
      request.continue();
    });

    log('  ✓ API interception configured', colors.green);

    // Navigate to the iTrvl portal URL
    log('\n[4/5] Loading iTrvl portal page...', colors.blue);
    log(`  → Navigating to: ${url}`, colors.yellow);

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      log('  ✓ Page loaded successfully', colors.green);
    } catch (error) {
      log(`  ✗ Failed to load page: ${error.message}`, colors.red);
      throw error;
    }

    // Wait a bit to ensure all API calls complete
    log('  → Waiting for all API responses...', colors.yellow);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify we captured both responses
    if (!itinerariesData) {
      throw new Error('Failed to capture /api/Itineraries response');
    }

    if (!renderDataClientData) {
      throw new Error('Failed to capture /api/PresentationEdits/renderDataClient response');
    }

    log('  ✓ All required API responses captured', colors.green);

    // Merge and process the data
    log('\n[5/5] Processing and merging data...', colors.blue);

    const mergedData = mergeItineraryData(itinerariesData, renderDataClientData, parsedUrl);

    log('  ✓ Data processed successfully', colors.green);
    log(`  → Itinerary items: ${mergedData.itinerary?.days?.length || 0} days`, colors.cyan);
    log(`  → Images found: ${mergedData.images?.length || 0}`, colors.cyan);
    log(`  → Price: $${(mergedData.price / 100).toFixed(2)}`, colors.cyan);

    // Use unique output directory based on itineraryId
    const outputPath = getOutputFilePath(parsedUrl.itineraryId, 'raw-itinerary.json');
    fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2));

    log(`  ✓ Output written to: ${outputPath}`, colors.green);

    log('\n' + '='.repeat(60), colors.bright);
    log('  ✓ Scraping completed successfully', colors.green);
    log('='.repeat(60) + '\n', colors.bright);

  } catch (error) {
    log(`\n✗ Scraping failed: ${error.message}`, colors.red);
    throw error;
  } finally {
    await browser.close();
    log('  ✓ Browser closed', colors.green);
  }
}

// Merge data from both API responses
function mergeItineraryData(itinerariesData, renderDataClientData, parsedUrl) {
  // Extract pricing information from /api/Itineraries
  let price = 0;

  if (itinerariesData && Array.isArray(itinerariesData)) {
    // Find the itinerary matching our ID
    const itinerary = itinerariesData.find(
      (item) => item.id === parseInt(parsedUrl.itineraryId) || item.itineraryId === parseInt(parsedUrl.itineraryId)
    );

    if (itinerary && itinerary.price) {
      // Price should be in cents
      price = typeof itinerary.price === 'number' ? itinerary.price : parseInt(itinerary.price) || 0;
    } else if (itinerary && itinerary.totalPrice) {
      price = typeof itinerary.totalPrice === 'number' ? itinerary.totalPrice : parseInt(itinerary.totalPrice) || 0;
    }
  }

  // Extract itinerary details and images from /api/PresentationEdits/renderDataClient
  let itinerary = {};
  let images = [];

  if (renderDataClientData) {
    // Store the full itinerary data
    itinerary = renderDataClientData;

    // Extract all s3Keys (images) from the data
    images = extractS3Keys(renderDataClientData);
  }

  return {
    itinerary,
    images,
    price,
  };
}

// Recursively extract all s3Keys from the data structure
function extractS3Keys(obj, keys = []) {
  if (!obj || typeof obj !== 'object') {
    return keys;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractS3Keys(item, keys));
  } else {
    Object.keys(obj).forEach((key) => {
      if (key === 's3Key' && typeof obj[key] === 'string') {
        keys.push(obj[key]);
      } else if (typeof obj[key] === 'object') {
        extractS3Keys(obj[key], keys);
      }
    });
  }

  return keys;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log('\n✗ Error: No URL provided', colors.red);
    log('\nUsage: node scrapers/itrvl_scraper.cjs <ITRVL_URL>', colors.yellow);
    log('\nExample:', colors.yellow);
    log('  node scrapers/itrvl_scraper.cjs "https://portal.itrvl.com/share?accessKey=ABC123&itineraryId=12345"\n', colors.cyan);
    process.exit(1);
  }

  const url = args[0];

  scrapeItrvl(url)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      log(`\n✗ Fatal error: ${error.message}`, colors.red);
      if (error.stack) {
        log(`\nStack trace:\n${error.stack}`, colors.red);
      }
      process.exit(1);
    });
}

module.exports = { scrapeItrvl, parseItrvlUrl };
