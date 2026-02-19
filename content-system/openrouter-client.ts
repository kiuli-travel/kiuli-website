import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { ContentSystemSetting } from '../src/payload-types'

export interface OpenRouterRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface OpenRouterResponse {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export type ModelPurpose = 'ideation' | 'research' | 'drafting' | 'editing' | 'image'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'

const PURPOSE_TO_FIELD: Record<ModelPurpose, keyof ContentSystemSetting> = {
  ideation: 'ideationModel',
  research: 'researchModel',
  drafting: 'draftingModel',
  editing: 'editingModel',
  image: 'imageModel',
}

export async function getModel(purpose: ModelPurpose): Promise<string> {
  const payload = await getPayload({ config: configPromise })
  const settings = await payload.findGlobal({ slug: 'content-system-settings' })
  const field = PURPOSE_TO_FIELD[purpose]
  const value = settings[field]
  return (typeof value === 'string' && value) ? value : DEFAULT_MODEL
}

export async function callModel(
  purpose: ModelPurpose,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { maxTokens?: number; temperature?: number },
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  const model = await getModel(purpose)

  const body = {
    model,
    messages,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://kiuli.com',
    'X-Title': 'Kiuli Content Engine',
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      }
    }

    const status = response.status
    const errorBody = await response.text()

    // Non-retryable errors — throw immediately
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      throw new Error(`OpenRouter API error ${status}: ${errorBody}`)
    }

    // Retryable errors (429, 5xx) — retry once after 5s backoff
    if (status === 429 || status >= 500) {
      lastError = new Error(`OpenRouter API error ${status}: ${errorBody}`)
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
    }

    // Unexpected status
    throw new Error(`OpenRouter API unexpected status ${status}: ${errorBody}`)
  }

  throw lastError ?? new Error('OpenRouter API request failed after retry')
}

// ── Image Generation ─────────────────────────────────────────────────────────

export interface ImageGenerationResponse {
  imageBase64: string
  model: string
  prompt: string
}

export async function callImageGeneration(
  prompt: string,
  options?: {
    model?: string
    aspectRatio?: string
    imageSize?: string
  },
): Promise<ImageGenerationResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  const model = options?.model ?? await getModel('image')

  const body: Record<string, unknown> = {
    model,
    modalities: ['image'],
    messages: [{ role: 'user', content: prompt }],
  }

  if (options?.aspectRatio || options?.imageSize) {
    const imageConfig: Record<string, string> = {}
    if (options.aspectRatio) imageConfig.aspect_ratio = options.aspectRatio
    if (options.imageSize) imageConfig.image_size = options.imageSize
    body.image_config = imageConfig
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://kiuli.com',
    'X-Title': 'Kiuli Content Engine',
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()

      // OpenRouter image generation can return images in multiple formats:
      // 1. message.images array (data URLs or raw base64 strings)
      // 2. message.content as array with image_url type objects
      // 3. message.content as a data URL string
      let base64: string | undefined

      const message = data.choices?.[0]?.message

      // Try message.images first (OpenRouter returns objects with image_url.url)
      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        const img = message.images[0]
        if (typeof img === 'string') {
          base64 = img
        } else if (typeof img === 'object' && img !== null) {
          base64 = img.image_url?.url || img.b64_json || img.url || img.data
        }
      }

      // Try message.content as array (multimodal content blocks)
      if (!base64 && Array.isArray(message?.content)) {
        for (const block of message.content) {
          if (block.type === 'image_url' && block.image_url?.url) {
            base64 = block.image_url.url
            break
          }
          if (block.type === 'image' && (block.data || block.url)) {
            base64 = block.data || block.url
            break
          }
        }
      }

      // Try message.content as plain data URL string
      if (!base64 && typeof message?.content === 'string' && message.content.startsWith('data:image/')) {
        base64 = message.content
      }

      if (!base64) {
        throw new Error(`OpenRouter returned no images. Response structure: ${JSON.stringify(data.choices?.[0]?.message, null, 2).slice(0, 500)}`)
      }

      // Strip data URL prefix (e.g. "data:image/png;base64,") to get raw base64
      const dataUrlMatch = base64.match(/^data:[^;]+;base64,(.+)$/)
      if (dataUrlMatch) {
        base64 = dataUrlMatch[1]
      }

      return {
        imageBase64: base64,
        model: data.model || model,
        prompt,
      }
    }

    const status = response.status
    const errorBody = await response.text()

    if (status === 400 || status === 401 || status === 403 || status === 404) {
      throw new Error(`OpenRouter image API error ${status}: ${errorBody}`)
    }

    if (status === 429 || status >= 500) {
      lastError = new Error(`OpenRouter image API error ${status}: ${errorBody}`)
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
    }

    throw new Error(`OpenRouter image API unexpected status ${status}: ${errorBody}`)
  }

  throw lastError ?? new Error('OpenRouter image API request failed after retry')
}

// Legacy export for type compatibility
export async function callOpenRouter(request: OpenRouterRequest): Promise<OpenRouterResponse> {
  return callModel('ideation', request.messages, {
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  })
}
