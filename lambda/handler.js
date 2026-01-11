'use strict';

const puppeteer = require('puppeteer-core');

// Load @sparticuz/chromium from Lambda layer or bundled
let chromium;
try {
  // Try loading from Lambda layer first (at /opt/nodejs/node_modules)
  chromium = require('@sparticuz/chromium');
  console.log('Loaded @sparticuz/chromium successfully');
} catch (e) {
  console.error('Failed to load @sparticuz/chromium:', e.message);
  throw new Error('Could not load @sparticuz/chromium. Ensure the Lambda layer is attached.');
}

/**
 * Parse iTrvl URL to extract Access Key and Itinerary ID
 */
function parseItrvlUrl(url) {
  const urlObj = new URL(url);
  let accessKey = null;
  let itineraryId = null;

  // Try query parameters first
  accessKey = urlObj.searchParams.get('accessKey');
  itineraryId = urlObj.searchParams.get('itineraryId');

  // Try path-based format: /client/portal/{accessKey}/{itineraryId}
  if (!accessKey || !itineraryId) {
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    const portalIndex = pathParts.indexOf('portal');
    if (portalIndex !== -1 && pathParts.length >= portalIndex + 3) {
      accessKey = pathParts[portalIndex + 1];
      itineraryId = pathParts[portalIndex + 2];
    }
  }

  if (!accessKey || !itineraryId) {
    throw new Error('Could not extract accessKey and itineraryId from URL');
  }

  return { accessKey, itineraryId };
}

/**
 * Recursively extract all s3Keys from the data structure
 * Excludes agency branding assets
 */
function extractS3Keys(obj, keys = [], path = '') {
  if (!obj || typeof obj !== 'object') {
    return keys;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => extractS3Keys(item, keys, `${path}[${idx}]`));
  } else {
    Object.keys(obj).forEach((key) => {
      const newPath = path ? `${path}.${key}` : key;

      // Skip agency branding assets
      if (newPath.includes('.agency.')) {
        return;
      }

      if (key === 's3Key' && typeof obj[key] === 'string') {
        keys.push(obj[key]);
      } else if (key === 'images' && Array.isArray(obj[key])) {
        obj[key].forEach((imageKey) => {
          if (typeof imageKey === 'string') {
            keys.push(imageKey);
          }
        });
      } else if (key === 'headerImage' && typeof obj[key] === 'string') {
        keys.push(obj[key]);
      } else if (typeof obj[key] === 'object') {
        extractS3Keys(obj[key], keys, newPath);
      }
    });
  }

  return keys;
}

/**
 * Main scraping function
 */
async function scrapeItrvl(browser, url, parsedUrl) {
  let itinerariesData = null;
  let renderDataClientData = null;

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Enable request interception
  await page.setRequestInterception(true);

  // Intercept and capture API responses
  page.on('response', async (response) => {
    const responseUrl = response.url();

    try {
      if (responseUrl.includes('/api/Itineraries') && !responseUrl.includes('/api/Itineraries/')) {
        console.log('Captured: /api/Itineraries');
        itinerariesData = await response.json();
      }

      if (responseUrl.includes('/api/PresentationEdits/renderDataClient')) {
        console.log('Captured: /api/PresentationEdits/renderDataClient');
        renderDataClientData = await response.json();
      }
    } catch (error) {
      // Ignore JSON parse errors for non-JSON responses
    }
  });

  // Allow all requests to continue
  page.on('request', (request) => {
    request.continue();
  });

  // Navigate to the iTrvl portal URL
  console.log(`Navigating to: ${url}`);
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 120000, // 2 minutes for navigation
  });

  // Wait for API responses
  console.log('Waiting for API responses...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait

  await page.close();

  // Verify we captured both responses
  if (!itinerariesData) {
    throw new Error('Failed to capture /api/Itineraries response');
  }

  if (!renderDataClientData) {
    throw new Error('Failed to capture /api/PresentationEdits/renderDataClient response');
  }

  // Extract price - FIXED: No parseInt, use finance.sellingPrice
  let price = 0;
  if (itinerariesData && Array.isArray(itinerariesData)) {
    const itinerary = itinerariesData.find(
      (item) => item.id === parsedUrl.itineraryId || item.itineraryId === parsedUrl.itineraryId
    );

    if (itinerary && itinerary.finance && itinerary.finance.sellingPrice) {
      const rawPrice = itinerary.finance.sellingPrice;
      price = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice) || 0;
      // Convert to cents if price appears to be in dollars
      if (price > 0 && price < 100000) {
        price = Math.round(price * 100);
      }
    }
  }

  // Extract images
  const images = extractS3Keys(renderDataClientData);

  return {
    itinerary: renderDataClientData,
    images: images,
    price: price,
  };
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Lambda invoked');

  // Parse request body
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
    };
  }

  // Validate secret
  const expectedSecret = process.env.SCRAPER_SECRET;
  if (!expectedSecret || body.secret !== expectedSecret) {
    console.log('Unauthorized request');
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Unauthorized' })
    };
  }

  // Validate URL
  const { itrvlUrl } = body;
  if (!itrvlUrl) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'itrvlUrl is required' })
    };
  }

  let browser = null;

  try {
    // Parse URL
    console.log(`Parsing URL: ${itrvlUrl}`);
    const parsedUrl = parseItrvlUrl(itrvlUrl);
    console.log(`Itinerary ID: ${parsedUrl.itineraryId}`);

    // Launch browser using @sparticuz/chromium
    console.log('Launching browser...');
    const executablePath = await chromium.executablePath();
    console.log('Chromium executable path:', executablePath);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
    console.log('Browser launched');

    // Scrape
    const result = await scrapeItrvl(browser, itrvlUrl, parsedUrl);

    console.log(`Scraping complete. Images: ${result.images.length}, Price: ${result.price}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: result,
        itineraryId: parsedUrl.itineraryId
      })
    };

  } catch (error) {
    console.error('Scraping failed:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
};
