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

// Scraper configuration - externalized for easy updates
const SCRAPER_CONFIG = {
  version: '1.1.0',
  endpoints: {
    itineraries: {
      pattern: '/api/Itineraries',
      exclude: '/api/Itineraries/',
      required: true,
      description: 'Pricing data'
    },
    renderData: {
      pattern: '/api/PresentationEdits/renderDataClient',
      exclude: null,
      required: true,
      description: 'Itinerary content'
    }
  },
  timing: {
    navigationTimeout: 120000,
    postLoadWait: 5000,
    retryDelay: 3000,
    maxRetries: 3
  },
  fallbackPatterns: [
    '/api/itineraries',
    '/api/presentation',
    '/graphql'
  ]
};

/**
 * Check if URL matches an endpoint configuration
 */
function matchesEndpoint(url, endpointConfig) {
  if (!url.includes(endpointConfig.pattern)) return false;
  if (endpointConfig.exclude && url.includes(endpointConfig.exclude)) return false;
  return true;
}

/**
 * Analyze captured responses to suggest possible endpoint changes
 */
function discoverEndpoints(capturedResponses) {
  const candidates = capturedResponses.filter(r =>
    r.status === 200 &&
    r.contentType?.includes('application/json') &&
    r.url.includes('/api/')
  );

  console.log('[Discovery] Candidate API endpoints:');
  candidates.forEach(c => console.log(`  ${c.status} ${c.url}`));

  const possibleItineraries = candidates.find(c =>
    c.url.toLowerCase().includes('itinerar') ||
    c.url.toLowerCase().includes('trip') ||
    c.url.toLowerCase().includes('booking')
  );

  const possibleContent = candidates.find(c =>
    c.url.toLowerCase().includes('presentation') ||
    c.url.toLowerCase().includes('render') ||
    c.url.toLowerCase().includes('content')
  );

  return {
    suggestedItineraries: possibleItineraries?.url || null,
    suggestedContent: possibleContent?.url || null,
    allCandidates: candidates.map(c => c.url)
  };
}

/**
 * HLS Video URL construction
 * iTrvl uses HLS streaming with pattern: assembled_{itineraryId}_{quality}.m3u8
 * Externalized for resilience if iTrvl changes their CDN
 */
const HLS_CDN_BASE = process.env.ITRVL_VIDEO_CDN_BASE || 'https://cdn-media.itrvl.com/video/hls';

function getHlsVideoUrl(itineraryId, quality = '480') {
  if (!itineraryId) return null;
  return `${HLS_CDN_BASE}/assembled_${itineraryId}_${quality}.m3u8`;
}

/**
 * Check if HLS video exists for this itinerary
 * Uses HEAD request to avoid downloading the entire manifest
 */
async function checkVideoExists(itineraryId) {
  const hlsUrl = getHlsVideoUrl(itineraryId);
  if (!hlsUrl) return null;

  try {
    const response = await fetch(hlsUrl, { method: 'HEAD' });
    if (response.ok) {
      console.log(`[Scraper] HLS video found: ${hlsUrl}`);
      return {
        hlsUrl,
        itineraryId,
        context: 'hero',
        quality: '480',
      };
    }
    console.log(`[Scraper] No video at ${hlsUrl} (status: ${response.status})`);
  } catch (e) {
    console.log(`[Scraper] Video check failed for ${hlsUrl}:`, e.message);
  }
  return null;
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
 * Main scraping function with comprehensive logging
 */
async function scrapeItrvl(browser, url, parsedUrl, options = {}) {
  const { extendedWait = false, discoveryMode = false } = options;

  let itinerariesData = null;
  let renderDataClientData = null;
  const capturedResponses = []; // Track ALL API responses for discovery

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Enable request interception
  await page.setRequestInterception(true);

  // Intercept and capture API responses with comprehensive logging
  page.on('response', async (response) => {
    const responseUrl = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    // Log ALL API responses for discovery (exclude static assets)
    if (responseUrl.includes('/api/') || responseUrl.includes('api.itrvl.com')) {
      const responseInfo = {
        url: responseUrl.substring(0, 250),
        status,
        contentType: contentType.substring(0, 50)
      };
      capturedResponses.push(responseInfo);
      console.log(`[Response] ${status} ${contentType.split(';')[0]} ${responseUrl.substring(0, 150)}`);
    }

    // Also log non-200 responses from itrvl.com for debugging
    if (responseUrl.includes('itrvl.com') && status >= 400) {
      console.log(`[Warning] ${status} ${responseUrl.substring(0, 150)}`);
    }

    try {
      // Check against configured endpoints
      if (matchesEndpoint(responseUrl, SCRAPER_CONFIG.endpoints.itineraries)) {
        console.log('[Capture] Matched /api/Itineraries endpoint');
        itinerariesData = await response.json();
        console.log(`[Capture] Itineraries data: ${JSON.stringify(itinerariesData).substring(0, 200)}...`);
      }

      if (matchesEndpoint(responseUrl, SCRAPER_CONFIG.endpoints.renderData)) {
        console.log('[Capture] Matched /api/PresentationEdits/renderDataClient endpoint');
        renderDataClientData = await response.json();
        console.log(`[Capture] RenderData keys: ${Object.keys(renderDataClientData || {}).join(', ')}`);
      }
    } catch (error) {
      // Log JSON parse errors for API endpoints (might indicate issue)
      if (responseUrl.includes('/api/')) {
        console.log(`[Parse Error] ${responseUrl.substring(0, 100)}: ${error.message}`);
      }
    }
  });

  // Log all requests for debugging
  page.on('request', (request) => {
    const reqUrl = request.url();
    if (reqUrl.includes('/api/')) {
      console.log(`[Request] ${request.method()} ${reqUrl.substring(0, 150)}`);
    }
    request.continue();
  });

  // Navigate to the iTrvl portal URL
  console.log(`[Navigation] Loading: ${url}`);
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: SCRAPER_CONFIG.timing.navigationTimeout,
  });
  console.log('[Navigation] Page loaded (networkidle2)');

  // Wait for API responses - extended wait on retries
  const waitTime = extendedWait ? 10000 : SCRAPER_CONFIG.timing.postLoadWait;
  console.log(`[Wait] Waiting ${waitTime}ms for API responses...`);
  await new Promise(resolve => setTimeout(resolve, waitTime));

  // If capture failed, log discovery info
  if (!itinerariesData || !renderDataClientData) {
    console.log('\n[Discovery] ========== RESPONSE SUMMARY ==========');
    console.log(`[Discovery] Total API responses captured: ${capturedResponses.length}`);
    capturedResponses.forEach((r, i) => {
      console.log(`[Discovery] ${i + 1}. ${r.status} ${r.contentType} ${r.url}`);
    });

    const discovery = discoverEndpoints(capturedResponses);
    console.log(`[Discovery] Suggested itineraries endpoint: ${discovery.suggestedItineraries || 'none found'}`);
    console.log(`[Discovery] Suggested content endpoint: ${discovery.suggestedContent || 'none found'}`);
    console.log('[Discovery] =====================================\n');
  }

  await page.close();

  // Build detailed error message
  if (!itinerariesData) {
    const errorMsg = `Failed to capture /api/Itineraries response. Captured ${capturedResponses.length} API responses.`;
    const error = new Error(errorMsg);
    error.capturedResponses = capturedResponses;
    throw error;
  }

  if (!renderDataClientData) {
    const errorMsg = `Failed to capture /api/PresentationEdits/renderDataClient response. Captured ${capturedResponses.length} API responses.`;
    const error = new Error(errorMsg);
    error.capturedResponses = capturedResponses;
    throw error;
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

  // Check for HLS video
  const videoInfo = await checkVideoExists(parsedUrl.itineraryId);
  const videos = videoInfo ? [videoInfo] : [];

  if (videos.length > 0) {
    console.log(`[Scraper] Found ${videos.length} video(s) for itinerary`);
  } else {
    console.log('[Scraper] No videos found for itinerary');
  }

  return {
    itinerary: renderDataClientData,
    images: images,
    videos: videos,
    price: price,
  };
}

/**
 * Scrape with retry logic and exponential backoff
 */
async function scrapeWithRetry(browser, url, parsedUrl) {
  const maxRetries = SCRAPER_CONFIG.timing.maxRetries;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n[Retry] ========== Attempt ${attempt}/${maxRetries} ==========`);

    try {
      const result = await scrapeItrvl(browser, url, parsedUrl, {
        extendedWait: attempt > 1,           // Wait longer on retries
        discoveryMode: attempt === maxRetries // Full logging on final attempt
      });
      console.log(`[Retry] Attempt ${attempt} succeeded`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[Retry] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * SCRAPER_CONFIG.timing.retryDelay; // 6s, 12s
        console.log(`[Retry] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries failed
  console.log(`[Retry] All ${maxRetries} attempts failed`);
  throw lastError;
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log(`Lambda invoked - Scraper v${SCRAPER_CONFIG.version}`);

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
    console.log(`[Init] Parsing URL: ${itrvlUrl}`);
    const parsedUrl = parseItrvlUrl(itrvlUrl);
    console.log(`[Init] Itinerary ID: ${parsedUrl.itineraryId}`);

    // Launch browser using @sparticuz/chromium
    console.log('[Init] Launching browser...');
    const executablePath = await chromium.executablePath();
    console.log('[Init] Chromium executable path:', executablePath);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
    console.log('[Init] Browser launched');

    // Scrape with retry logic
    const result = await scrapeWithRetry(browser, itrvlUrl, parsedUrl);

    console.log(`[Complete] Scraping successful. Images: ${result.images.length}, Videos: ${result.videos.length}, Price: ${result.price}`);

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
    console.error(`[Error] Scraping failed after retries: ${error.message}`);

    // Include discovery info in error response
    const errorResponse = {
      success: false,
      error: error.message,
      scraperVersion: SCRAPER_CONFIG.version
    };

    if (error.capturedResponses) {
      errorResponse.capturedResponses = error.capturedResponses.length;
      errorResponse.apiEndpoints = error.capturedResponses.map(r => r.url);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorResponse)
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Cleanup] Browser closed');
    }
  }
};
