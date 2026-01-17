import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 60 // Allow up to 60s for AI enhancement

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

const ENHANCEMENT_PROMPTS = {
  segment: `You are a luxury travel content writer for high-net-worth safari travelers.

Enhance the following safari segment description:
- Expand by 100-200% with vivid sensory details
- Preserve ALL factual information exactly
- Add luxury keywords: exclusive, bespoke, curated, intimate, authentic
- Maintain elegant, sophisticated tone
- DO NOT add fictional details or pricing

Original:
{content}

Respond with ONLY the enhanced text, no explanation or preamble:`,

  overview: `You are a luxury travel content writer. Enhance this safari overview summary:
- Make it compelling and aspirational
- Highlight the exclusive nature of the experience
- Preserve all factual information
- Keep it concise but evocative (2-3 sentences)

Original:
{content}

Respond with ONLY the enhanced text:`,

  whyKiuli: `You are writing a persuasive "Why Book with Kiuli" section.
Enhance this text to emphasize:
- Kiuli's expertise in high-end African safaris
- Personalized service and attention to detail
- Exclusive access and insider knowledge
- White-glove client support

Original:
{content}

Respond with ONLY the enhanced text:`,

  faq: `You are enhancing an FAQ answer for luxury safari travelers.
- Make the answer more comprehensive and helpful
- Maintain professional, reassuring tone
- Keep accuracy paramount

Question: {question}
Original Answer: {content}

Respond with ONLY the enhanced answer:`,
}

/**
 * Validate authentication via Payload session OR API key
 */
async function validateAuth(request: NextRequest): Promise<boolean> {
  // First check for Bearer token (Lambda/external calls)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY) {
      return true
    }
  }

  // Then check for Payload session (admin UI)
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) {
      return true
    }
  } catch {
    // Session check failed
  }

  return false
}

// Legacy function for backward compatibility - not used
function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice(7)
  return token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY
}

async function enhanceWithAI(content: string, promptType: keyof typeof ENHANCEMENT_PROMPTS, extra?: { question?: string }): Promise<string> {
  let prompt = ENHANCEMENT_PROMPTS[promptType].replace('{content}', content)
  if (extra?.question) {
    prompt = prompt.replace('{question}', extra.question)
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kiuli.com',
      'X-Title': 'Kiuli Safari Content Enhancement',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || content
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlainText(richText: any): string {
  if (!richText?.root?.children) return ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getText(node: any): string {
    if (node.text) return node.text
    if (node.children) {
      return node.children.map(getText).join('')
    }
    return ''
  }

  return richText.root.children.map(getText).join('\n').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textToRichText(text: string): any {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: text.split('\n').filter(Boolean).map((para) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [{ text: para, type: 'text' }],
        direction: 'ltr',
      })),
      direction: 'ltr',
    },
  }
}

export async function POST(request: NextRequest) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { itineraryId, target, dayIndex, segmentIndex, faqIndex } = body

  if (!itineraryId) {
    return NextResponse.json(
      { success: false, error: 'itineraryId is required' },
      { status: 400 }
    )
  }

  if (!target || !['segment', 'overview', 'whyKiuli', 'faq', 'all'].includes(target)) {
    return NextResponse.json(
      { success: false, error: 'target must be one of: segment, overview, whyKiuli, faq, all' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })

  try {
    const itinerary = await payload.findByID({
      collection: 'itineraries',
      id: itineraryId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as Record<string, any>

    if (!itinerary) {
      return NextResponse.json(
        { success: false, error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateData: Record<string, any> = {}
    let enhanced = 0

    if (target === 'segment') {
      // Enhance a specific segment
      if (dayIndex === undefined || segmentIndex === undefined) {
        return NextResponse.json(
          { success: false, error: 'dayIndex and segmentIndex required for segment enhancement' },
          { status: 400 }
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const days = (itinerary.days as any[]) || []
      if (!days[dayIndex]?.segments?.[segmentIndex]) {
        return NextResponse.json(
          { success: false, error: 'Segment not found' },
          { status: 404 }
        )
      }

      const segment = days[dayIndex].segments[segmentIndex]
      const originalText = extractPlainText(segment.descriptionOriginal)

      if (!originalText || originalText.length < 20) {
        return NextResponse.json(
          { success: false, error: 'Segment has no content to enhance' },
          { status: 400 }
        )
      }

      const enhancedText = await enhanceWithAI(originalText, 'segment')
      days[dayIndex].segments[segmentIndex].descriptionEnhanced = textToRichText(enhancedText)
      updateData = { days }
      enhanced = 1
    } else if (target === 'overview') {
      // Enhance overview summary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overview = itinerary.overview as any
      const originalText = extractPlainText(overview?.summaryOriginal)

      if (!originalText) {
        return NextResponse.json(
          { success: false, error: 'Overview has no content to enhance' },
          { status: 400 }
        )
      }

      const enhancedText = await enhanceWithAI(originalText, 'overview')
      updateData = {
        overview: {
          ...overview,
          summaryEnhanced: textToRichText(enhancedText),
        },
      }
      enhanced = 1
    } else if (target === 'whyKiuli') {
      // Enhance Why Kiuli section
      const originalText = extractPlainText(itinerary.whyKiuliOriginal)

      if (!originalText) {
        return NextResponse.json(
          { success: false, error: 'Why Kiuli section has no content to enhance' },
          { status: 400 }
        )
      }

      const enhancedText = await enhanceWithAI(originalText, 'whyKiuli')
      updateData = { whyKiuliEnhanced: textToRichText(enhancedText) }
      enhanced = 1
    } else if (target === 'faq') {
      // Enhance a specific FAQ
      if (faqIndex === undefined) {
        return NextResponse.json(
          { success: false, error: 'faqIndex required for FAQ enhancement' },
          { status: 400 }
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const faqs = (itinerary.faqItems as any[]) || []
      if (!faqs[faqIndex]) {
        return NextResponse.json(
          { success: false, error: 'FAQ not found' },
          { status: 404 }
        )
      }

      const faq = faqs[faqIndex]
      const originalAnswer = extractPlainText(faq.answerOriginal)

      if (!originalAnswer) {
        return NextResponse.json(
          { success: false, error: 'FAQ has no content to enhance' },
          { status: 400 }
        )
      }

      const enhancedText = await enhanceWithAI(originalAnswer, 'faq', { question: faq.question })
      faqs[faqIndex].answerEnhanced = textToRichText(enhancedText)
      updateData = { faqs }
      enhanced = 1
    } else if (target === 'all') {
      // Enhance all content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const days = JSON.parse(JSON.stringify((itinerary.days as any[]) || []))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const faqs = JSON.parse(JSON.stringify((itinerary.faqItems as any[]) || []))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overview = JSON.parse(JSON.stringify(itinerary.overview as any || {}))

      // Enhance overview
      const overviewText = extractPlainText(overview?.summaryOriginal)
      if (overviewText) {
        overview.summaryEnhanced = textToRichText(await enhanceWithAI(overviewText, 'overview'))
        enhanced++
      }

      // Enhance segments (with rate limiting)
      for (const day of days) {
        for (const segment of day.segments || []) {
          const segmentText = extractPlainText(segment.descriptionOriginal)
          if (segmentText && segmentText.length >= 20) {
            try {
              segment.descriptionEnhanced = textToRichText(await enhanceWithAI(segmentText, 'segment'))
              enhanced++
              // Small delay to avoid rate limits
              await new Promise((r) => setTimeout(r, 500))
            } catch (err) {
              console.error('[enhance] Failed segment:', err)
            }
          }
        }
      }

      // Enhance FAQs
      for (const faq of faqs) {
        const faqText = extractPlainText(faq.answerOriginal)
        if (faqText) {
          try {
            faq.answerEnhanced = textToRichText(await enhanceWithAI(faqText, 'faq', { question: faq.question }))
            enhanced++
            await new Promise((r) => setTimeout(r, 500))
          } catch (err) {
            console.error('[enhance] Failed FAQ:', err)
          }
        }
      }

      updateData = { days, faqs, overview }
    }

    // Update itinerary
    await payload.update({
      collection: 'itineraries',
      id: itineraryId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      enhanced,
      target,
      message: `Enhanced ${enhanced} item(s)`,
    })
  } catch (error) {
    console.error('[enhance] Error:', error)
    return NextResponse.json(
      { success: false, error: `Enhancement failed: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
