/**
 * OpenRouter API Client for V6 Pipeline
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(payload, retries = MAX_RETRIES) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kiuli.com',
          'X-Title': 'Kiuli Pipeline V6'
        },
        body: JSON.stringify(payload)
      });

      // Rate limited
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const delay = Math.max(retryAfter * 1000, BASE_DELAY_MS * Math.pow(2, attempt - 1));
        console.log(`[OpenRouter] Rate limited, waiting ${delay}ms (attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue;
      }

      // Other errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';

    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`[OpenRouter] Error, retrying: ${error.message}`);
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw new Error('OpenRouter: max retries exceeded');
}

/**
 * Text completion using Llama 3.3 70B
 */
async function completeText(prompt) {
  return callOpenRouter({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000
  });
}

/**
 * Vision analysis using Nemotron 12B
 */
async function analyzeImage(imageBase64, prompt) {
  return callOpenRouter({
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ],
    max_tokens: 500
  });
}

module.exports = { callOpenRouter, completeText, analyzeImage };
