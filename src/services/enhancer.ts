import { loadVoiceForSection } from '../../content-system/voice/loader'
import { buildVoicePrompt } from '../../content-system/voice/prompt-builder'

// Types
interface EnhanceResult {
  enhanced: string
  tokensUsed: number
  configUsed: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    total_tokens: number
  }
}

// Legacy voice-configuration name → BrandVoice sectionKey mapping
const VOICE_CONFIG_TO_SECTION_KEY: Record<string, string> = {
  'overview-summary': 'overview',
  'segment-description': 'segment_description',
  'day-title': 'day_title',
  'faq-answer': 'faq_answer',
  'investment-includes': 'investment_includes',
  'why-kiuli': 'why_kiuli',
}

/**
 * Resolve a config name — accepts either legacy voice-configuration names
 * or new BrandVoice sectionKeys. Returns a sectionKey.
 */
function resolveSectionKey(configNameOrKey: string): string {
  return VOICE_CONFIG_TO_SECTION_KEY[configNameOrKey] || configNameOrKey
}

/**
 * Build user prompt from section template and context.
 * Falls back to a generic template if no promptTemplate is defined.
 */
function buildUserPrompt(
  template: string | undefined,
  content: string,
  context: Record<string, string>,
  wordCountRange?: string,
): string {
  if (template) {
    let prompt = template
    // Replace context placeholders
    for (const [key, value] of Object.entries(context)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
    }
    prompt = prompt.replace(/\{\{content\}\}/g, content)
    if (wordCountRange) {
      prompt = prompt.replace(/\{\{maxWords\}\}/g, wordCountRange)
    }
    return prompt
  }

  // Generic fallback
  let fallback = `Enhance the following content for Kiuli's luxury safari website.\n\n`
  if (Object.keys(context).length > 0) {
    fallback += `CONTEXT:\n`
    for (const [key, value] of Object.entries(context)) {
      if (value) fallback += `- ${key}: ${value}\n`
    }
    fallback += '\n'
  }
  fallback += `ORIGINAL TEXT:\n${content}\n\n`
  if (wordCountRange) {
    fallback += `TARGET LENGTH: ${wordCountRange} words\n\n`
  }
  fallback += `Return ONLY the enhanced text, no explanations.`
  return fallback
}

/**
 * Main enhancement function using BrandVoice + OpenRouter
 */
export async function enhanceContent(
  content: string,
  configNameOrKey: string,
  context: Record<string, string> = {},
): Promise<EnhanceResult> {
  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set')
  }

  const sectionKey = resolveSectionKey(configNameOrKey)

  // Load voice context from BrandVoice global
  const voice = await loadVoiceForSection('itinerary_enhancement', sectionKey)

  // Build system prompt from voice context
  const systemPrompt = buildVoicePrompt(voice)

  // Find the matching section guidance for the prompt template
  const section = voice.sections?.find((s) => s.sectionKey === sectionKey)

  // Build user prompt
  const userPrompt = buildUserPrompt(
    section?.promptTemplate,
    content,
    context,
    section?.wordCountRange,
  )

  // Determine temperature from content type guidance or default
  const temperature = voice.contentType?.temperature ?? 0.7

  // Call OpenRouter API
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kiuli.com',
      'X-Title': 'Kiuli Enhancement Service',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as OpenRouterResponse

  const enhanced = data.choices[0]?.message?.content?.trim()
  if (!enhanced) {
    throw new Error('No content in OpenRouter response')
  }

  const tokensUsed = data.usage?.total_tokens || 0

  return {
    enhanced,
    tokensUsed,
    configUsed: sectionKey,
  }
}

/**
 * Extract plain text from Payload RichText format
 */
export function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return ''

  const root = (richText as { root?: unknown }).root
  if (!root || typeof root !== 'object') return ''

  function extractText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''

    const n = node as { type?: string; text?: string; children?: unknown[] }

    if (n.type === 'text' && typeof n.text === 'string') {
      return n.text
    }

    if (Array.isArray(n.children)) {
      return n.children.map(extractText).join(' ')
    }

    return ''
  }

  return extractText(root).trim()
}
