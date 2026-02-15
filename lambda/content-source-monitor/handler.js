/**
 * Content Source Monitor Lambda
 *
 * Checks registered external sources (RSS feeds, APIs) for new items
 * and creates content project candidates from relevant discoveries.
 *
 * This Lambda calls the Vercel endpoint /api/content/source-monitor
 * which handles the full pipeline including ContentJob tracking.
 *
 * Environment variables:
 *   SITE_URL          - e.g. https://admin.kiuli.com
 *   CONTENT_API_KEY   - Bearer token for authentication (CONTENT_SYSTEM_SECRET)
 */

const https = require('https');
const http = require('http');

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(240000, () => {
      req.destroy(new Error('Request timed out after 240s'));
    });

    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;
  console.log(`[content-source-monitor] Invoked, requestId=${requestId}`);

  const siteUrl = process.env.SITE_URL;
  const apiKey = process.env.CONTENT_API_KEY;

  if (!siteUrl || !apiKey) {
    console.error('[content-source-monitor] Missing SITE_URL or CONTENT_API_KEY');
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Missing required environment variables: SITE_URL, CONTENT_API_KEY',
        requestId,
      }),
    };
  }

  try {
    // Call the Vercel source-monitor endpoint.
    // The endpoint creates and manages a ContentJob internally.
    const url = `${siteUrl}/api/content/source-monitor`;
    const res = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }, JSON.stringify({}));

    console.log(`[content-source-monitor] Endpoint returned ${res.statusCode}`);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const result = JSON.parse(res.body);
      console.log(`[content-source-monitor] Results:`, JSON.stringify(result, null, 2));

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'completed',
          jobId: result.jobId || null,
          results: result.results || result,
          requestId,
        }),
      };
    }

    const errorMsg = `Source monitor endpoint returned ${res.statusCode}: ${res.body}`;
    console.error(`[content-source-monitor] ${errorMsg}`);

    return {
      statusCode: res.statusCode,
      body: JSON.stringify({
        status: 'failed',
        error: errorMsg,
        requestId,
      }),
    };
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error(`[content-source-monitor] Failed:`, errorMsg);

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'failed',
        error: errorMsg,
        requestId,
      }),
    };
  }
};
