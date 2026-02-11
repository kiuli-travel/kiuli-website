/**
 * Payload REST API client for content system Lambdas.
 *
 * Provides CRUD helpers that talk to the Payload CMS REST API
 * using PAYLOAD_API_URL and PAYLOAD_API_KEY from environment.
 */

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
  };
}

async function findOne(collection, id) {
  const res = await fetch(`${PAYLOAD_API_URL}/api/${collection}/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function findMany(collection, query = {}) {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.page) params.set('page', String(query.page));
  if (query.sort) params.set('sort', query.sort);

  const res = await fetch(`${PAYLOAD_API_URL}/api/${collection}?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return { docs: [], totalDocs: 0 };
  return res.json();
}

async function create(collection, data) {
  const res = await fetch(`${PAYLOAD_API_URL}/api/${collection}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function update(collection, id, data) {
  const res = await fetch(`${PAYLOAD_API_URL}/api/${collection}/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getGlobal(slug) {
  const res = await fetch(`${PAYLOAD_API_URL}/api/globals/${slug}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

module.exports = { findOne, findMany, create, update, getGlobal };
