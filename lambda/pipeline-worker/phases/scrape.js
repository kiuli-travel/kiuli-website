const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

function parseItrvlUrl(url) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
  const portalIndex = pathParts.indexOf('portal');

  if (portalIndex === -1 || pathParts.length < portalIndex + 3) {
    throw new Error('Invalid iTrvl URL format');
  }

  return {
    accessKey: pathParts[portalIndex + 1],
    itineraryId: pathParts[portalIndex + 2]
  };
}

function extractS3Keys(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return keys;

  if (Array.isArray(obj)) {
    obj.forEach(item => extractS3Keys(item, keys));
  } else {
    for (const [key, value] of Object.entries(obj)) {
      // Skip agency branding
      if (key === 'agency') continue;

      if (key === 's3Key' && typeof value === 'string') {
        keys.push(value);
      } else if (key === 'images' && Array.isArray(value)) {
        value.forEach(v => typeof v === 'string' && keys.push(v));
      } else if (key === 'headerImage' && typeof value === 'string') {
        keys.push(value);
      } else if (typeof value === 'object') {
        extractS3Keys(value, keys);
      }
    }
  }

  return keys;
}

async function scrape(itrvlUrl) {
  console.log('[Scrape] Starting scrape for:', itrvlUrl);

  const parsed = parseItrvlUrl(itrvlUrl);
  console.log('[Scrape] Itinerary ID:', parsed.itineraryId);

  let browser = null;
  let itinerariesData = null;
  let renderDataClientData = null;

  try {
    console.log('[Scrape] Launching browser...');
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setRequestInterception(true);

    page.on('response', async (response) => {
      const responseUrl = response.url();
      try {
        if (responseUrl.includes('/api/Itineraries') && !responseUrl.includes('/api/Itineraries/')) {
          console.log('[Scrape] Captured: /api/Itineraries');
          itinerariesData = await response.json();
        }
        if (responseUrl.includes('/api/PresentationEdits/renderDataClient')) {
          console.log('[Scrape] Captured: /api/PresentationEdits/renderDataClient');
          renderDataClientData = await response.json();
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    page.on('request', request => request.continue());

    console.log('[Scrape] Navigating to URL...');
    await page.goto(itrvlUrl, { waitUntil: 'networkidle2', timeout: 120000 });

    console.log('[Scrape] Waiting for API responses...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.close();

    if (!renderDataClientData) {
      throw new Error('Failed to capture /api/PresentationEdits/renderDataClient response');
    }

    // Extract price
    let price = 0;
    if (itinerariesData && Array.isArray(itinerariesData)) {
      const itinerary = itinerariesData.find(
        item => item.id === parsed.itineraryId || item.itineraryId === parsed.itineraryId
      );
      if (itinerary?.finance?.sellingPrice) {
        const rawPrice = itinerary.finance.sellingPrice;
        price = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice) || 0;
        if (price > 0 && price < 100000) {
          price = Math.round(price * 100);
        }
      }
    }

    // Extract images
    const images = extractS3Keys(renderDataClientData);
    console.log(`[Scrape] Found ${images.length} image references`);

    return {
      itinerary: renderDataClientData,
      images,
      price,
      itineraryId: parsed.itineraryId
    };

  } finally {
    if (browser) {
      await browser.close();
      console.log('[Scrape] Browser closed');
    }
  }
}

module.exports = { scrape, parseItrvlUrl, extractS3Keys };
