/**
 * Payload API Client for V6 Pipeline
 * With retry logic for resilience
 */

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'https://admin.kiuli.com';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `users API-Key ${PAYLOAD_API_KEY}`
  };
}

/**
 * Fetch with exponential backoff retry
 * Retries on 5xx errors and network failures
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) - those are usually permanent
      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error - will retry
      lastError = new Error(`Server error: ${response.status}`);
      console.log(`[Payload] Attempt ${attempt}/${maxRetries} failed: ${response.status}`);

    } catch (error) {
      // Network error - will retry
      lastError = error;
      console.log(`[Payload] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
    }

    // Don't wait after last attempt
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`[Payload] Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Generic find one document
 */
async function findOne(collection, query = {}) {
  const params = new URLSearchParams({ ...query, limit: '1' });
  const response = await fetchWithRetry(`${PAYLOAD_API_URL}/api/${collection}?${params}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to find ${collection}: ${response.status}`);
  }

  const data = await response.json();
  return data.docs?.[0] || null;
}

/**
 * Generic find documents
 */
async function find(collection, query = {}) {
  const params = new URLSearchParams(query);
  const response = await fetchWithRetry(`${PAYLOAD_API_URL}/api/${collection}?${params}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to find ${collection}: ${response.status}`);
  }

  return response.json();
}

/**
 * Generic create document
 */
async function create(collection, data) {
  const response = await fetchWithRetry(`${PAYLOAD_API_URL}/api/${collection}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create ${collection}: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Generic update document
 */
async function update(collection, id, data) {
  const response = await fetchWithRetry(`${PAYLOAD_API_URL}/api/${collection}/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update ${collection}/${id}: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get document by ID
 * @param {string} collection - Collection name
 * @param {string|number} id - Document ID
 * @param {object} options - Query options
 * @param {number} options.depth - Relationship depth (default: 1, use 0 for large docs)
 */
async function getById(collection, id, options = {}) {
  const params = new URLSearchParams();
  if (options.depth !== undefined) {
    params.set('depth', options.depth.toString());
  }
  const queryString = params.toString();
  const url = `${PAYLOAD_API_URL}/api/${collection}/${id}${queryString ? '?' + queryString : ''}`;

  const response = await fetchWithRetry(url, {
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get ${collection}/${id}: ${response.status}`);
  }

  return response.json();
}

// === Job Helpers ===

async function getJob(jobId) {
  return getById('itinerary-jobs', jobId);
}

async function updateJob(jobId, data) {
  return update('itinerary-jobs', jobId, data);
}

async function updateJobPhase(jobId, phase, extra = {}) {
  return updateJob(jobId, {
    currentPhase: phase,
    status: 'processing',
    ...extra
  });
}

async function updateJobProgress(jobId, processed, total, failed = 0) {
  const progress = Math.round((processed / total) * 100);
  return updateJob(jobId, {
    progress,
    processedImages: processed,
    totalImages: total,
    failedImages: failed
  });
}

async function completeJob(jobId, payloadId, duration, timing = {}) {
  return updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentPhase: 'complete',
    payloadId,
    processedItinerary: payloadId,
    completedAt: new Date().toISOString(),
    duration,
    timings: timing
  });
}

async function failJob(jobId, error, phase) {
  return updateJob(jobId, {
    status: 'failed',
    errorMessage: error,
    errorPhase: phase,
    failedAt: new Date().toISOString()
  });
}

// === Itinerary Helpers ===

/**
 * Get itinerary by ID
 * @param {string|number} id - Itinerary ID
 * @param {object} options - Query options
 * @param {number} options.depth - Relationship depth (default: 0 to avoid 413 errors)
 */
async function getItinerary(id, options = {}) {
  // Default to depth=0 to mitigate 413 Payload Too Large errors
  const depth = options.depth !== undefined ? options.depth : 0;
  return getById('itineraries', id, { depth });
}

async function createItinerary(data) {
  const result = await create('itineraries', data);
  // Payload returns { doc: {...}, message: "..." }
  return result.doc || result;
}

async function updateItinerary(id, data) {
  const result = await update('itineraries', id, data);
  // Payload returns { doc: {...}, message: "..." }
  return result.doc || result;
}

async function findItineraryByItineraryId(itineraryId) {
  // Use bracket notation - Payload doesn't parse JSON where clauses correctly
  return findOne('itineraries', {
    'where[itineraryId][equals]': itineraryId
  });
}

// === Media Helpers ===

async function getMedia(id) {
  return getById('media', id);
}

async function findMediaBySourceS3Key(sourceS3Key) {
  // Use bracket notation - Payload doesn't parse JSON where clauses correctly
  return findOne('media', {
    'where[sourceS3Key][equals]': sourceS3Key
  });
}

async function updateMedia(id, data) {
  return update('media', id, data);
}

module.exports = {
  // Generic
  findOne,
  find,
  create,
  update,
  getById,
  // Jobs
  getJob,
  updateJob,
  updateJobPhase,
  updateJobProgress,
  completeJob,
  failJob,
  // Itineraries
  getItinerary,
  createItinerary,
  updateItinerary,
  findItineraryByItineraryId,
  // Media
  getMedia,
  findMediaBySourceS3Key,
  updateMedia,
  // Config
  PAYLOAD_API_URL,
  PAYLOAD_API_KEY
};
