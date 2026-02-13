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

// Legacy export for type compatibility
export async function callOpenRouter(request: OpenRouterRequest): Promise<OpenRouterResponse> {
  return callModel('ideation', request.messages, {
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  })
}
