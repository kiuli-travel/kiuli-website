/**
 * Reset all images to pending for re-labeling with GPT-4o
 */

const PAYLOAD_API = 'https://admin.kiuli.com/api';
const API_KEY = 'cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=';

async function main() {
  // Get all media
  const res = await fetch(`${PAYLOAD_API}/media?limit=200`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const media = await res.json();

  if (!media.docs) {
    console.error('Failed to fetch media:', media);
    return;
  }

  console.log(`Resetting ${media.docs.length} images to pending...`);

  let count = 0;
  for (const m of media.docs) {
    const patchRes = await fetch(`${PAYLOAD_API}/media/${m.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labelingStatus: 'pending' })
    });

    if (!patchRes.ok) {
      console.error(`Failed to reset ${m.id}: ${patchRes.status}`);
    }

    count++;
    if (count % 20 === 0) {
      console.log(`Reset ${count}/${media.docs.length}...`);
    }
  }

  console.log(`Complete: ${count} images reset to pending`);
}

main().catch(console.error);
