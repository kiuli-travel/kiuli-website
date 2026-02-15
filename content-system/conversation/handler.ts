import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import { buildContext } from './context-builder'
import { markdownToLexical } from './lexical-utils'
import type {
  HandleMessageOptions,
  ConversationResponse,
  ConversationAction,
  ConversationContext,
} from './types'

// Stage transition maps (matching batch route)
const ARTICLE_ADVANCE: Record<string, string> = {
  idea: 'brief',
  brief: 'research',
  research: 'draft',
  draft: 'review',
  review: 'published',
}

const PAGE_ADVANCE: Record<string, string> = {
  idea: 'draft',
  draft: 'review',
  review: 'published',
}

function isValidTransition(
  currentStage: string,
  newStage: string,
  contentType: string,
): boolean {
  const isPage =
    contentType === 'destination_page' || contentType === 'property_page'
  const map = isPage ? PAGE_ADVANCE : ARTICLE_ADVANCE
  return map[currentStage] === newStage
}

// Parsed action from model response (looser than ConversationAction)
interface ParsedAction {
  type: string
  field?: string
  value?: string
  sectionName?: string
  index?: number
  question?: string
  answer?: string
  newStage?: string
}

const ALLOWED_FIELDS = [
  'metaTitle',
  'metaDescription',
  'answerCapsule',
  'briefSummary',
  'targetAngle',
  'competitiveNotes',
]

function buildSystemPrompt(ctx: ConversationContext): string {
  const parts: string[] = []

  parts.push(
    `You are Kiuli, a content assistant for a luxury African safari travel company. You are collaborating with a travel designer on a content project.`,
  )

  parts.push(`\nPROJECT:
Title: ${ctx.title}
Type: ${ctx.contentType}
Stage: ${ctx.stage}
Destinations: ${ctx.destinations?.join(', ') || 'Not specified'}
Properties: ${ctx.properties?.join(', ') || 'Not specified'}`)

  if (ctx.briefSummary || ctx.targetAngle || ctx.competitiveNotes) {
    parts.push(`\nBRIEF:`)
    if (ctx.briefSummary) parts.push(`Summary: ${ctx.briefSummary}`)
    if (ctx.targetAngle) parts.push(`Angle: ${ctx.targetAngle}`)
    if (ctx.competitiveNotes)
      parts.push(`Competitive notes: ${ctx.competitiveNotes}`)
  }

  if (ctx.synthesisText) {
    parts.push(`\nRESEARCH SYNTHESIS:\n${ctx.synthesisText}`)
    if (ctx.sourcesSummary) parts.push(`\nSources:\n${ctx.sourcesSummary}`)
  }

  if (ctx.draftText) {
    parts.push(`\nCURRENT DRAFT:\n${ctx.draftText}`)
  } else if (ctx.sections && Object.keys(ctx.sections).length > 0) {
    parts.push(`\nCURRENT SECTIONS:`)
    for (const [name, text] of Object.entries(ctx.sections)) {
      parts.push(`\n### ${name}\n${text}`)
    }
  }

  if (ctx.faqItems && ctx.faqItems.length > 0) {
    parts.push(`\nFAQ:`)
    for (const faq of ctx.faqItems) {
      parts.push(`Q: ${faq.question}\nA: ${faq.answer}`)
    }
  }

  if (ctx.metaTitle) parts.push(`\nMeta Title: ${ctx.metaTitle}`)
  if (ctx.metaDescription)
    parts.push(`Meta Description: ${ctx.metaDescription}`)
  if (ctx.answerCapsule) parts.push(`Answer Capsule: ${ctx.answerCapsule}`)

  if (ctx.relatedContent) {
    parts.push(
      `\nRELATED KIULI CONTENT (for consistency):\n${ctx.relatedContent}`,
    )
  }

  if (ctx.activeDirectives) {
    parts.push(
      `\nEDITORIAL DIRECTIVES (you must respect these):\n${ctx.activeDirectives}`,
    )
  }

  parts.push(`\n---

You can respond naturally to the designer. When they request changes to the content, include structured actions in your response.

RESPONSE FORMAT:
Always respond with a JSON object (and NOTHING else — no markdown fences, no preamble):

{
  "message": "Your natural language response to the designer",
  "actions": [],
  "suggestedNextStep": "Optional suggestion for what to do next"
}

AVAILABLE ACTIONS:

1. edit_field — Edit a simple text/textarea field
   { "type": "edit_field", "field": "metaTitle" | "metaDescription" | "answerCapsule" | "briefSummary" | "targetAngle" | "competitiveNotes", "value": "new text" }

2. edit_body — Rewrite the full article body (for articles)
   { "type": "edit_body", "value": "Full new body text in markdown format" }

3. edit_section — Edit a specific section (for compound types: destination_page, property_page)
   { "type": "edit_section", "sectionName": "overview" | "when_to_visit" | "why_choose" | "key_experiences" | "getting_there" | "health_safety" | "investment_expectation" | "top_lodges" | "faq", "value": "New section content" }

4. edit_faq — Replace an FAQ item or add a new one
   { "type": "edit_faq", "index": 0, "question": "...", "answer": "..." }
   { "type": "edit_faq", "index": -1, "question": "...", "answer": "..." }  // -1 means append new

5. stage_change — Advance or move the project to a different stage
   { "type": "stage_change", "newStage": "review" }
   Only suggest stage changes when the designer explicitly asks (e.g., "advance to review", "this looks good, move it forward")

RULES:
- Only include actions when the designer requests a change. Conversational messages (questions, feedback, discussion) need no actions.
- When editing, show the specific change in your message ("I've updated the meta title to: ...").
- Respect all editorial directives. If a designer request would violate a directive, explain why and suggest an alternative.
- Be specific about safari destinations, properties, and wildlife. Use your knowledge of the project context.
- Keep meta titles under 60 characters. Keep meta descriptions under 160 characters. Keep answer capsules between 50-70 words.
- For body/section edits, write in Kiuli's brand voice: understated luxury, expert but warm, specific not generic. No safari cliches.`)

  return parts.join('\n')
}

function parseModelResponse(raw: string): {
  message: string
  actions: ParsedAction[]
  suggestedNextStep?: string
} {
  let text = raw.trim()

  // Strip markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(text)
    return {
      message: parsed.message || text,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      suggestedNextStep: parsed.suggestedNextStep,
    }
  } catch {
    // Model returned non-JSON — treat as plain message
    return { message: raw, actions: [] }
  }
}

function validateAction(action: ParsedAction): boolean {
  if (!action.type) return false

  switch (action.type) {
    case 'edit_field':
      return (
        typeof action.field === 'string' && typeof action.value === 'string'
      )
    case 'edit_body':
      return typeof action.value === 'string'
    case 'edit_section':
      return (
        typeof action.sectionName === 'string' &&
        typeof action.value === 'string'
      )
    case 'edit_faq':
      return (
        typeof action.index === 'number' &&
        typeof action.question === 'string' &&
        typeof action.answer === 'string'
      )
    case 'stage_change':
      return typeof action.newStage === 'string'
    default:
      return false
  }
}

async function applyActions(
  payload: Payload,
  projectId: number,
  project: Record<string, unknown>,
  actions: ParsedAction[],
): Promise<ConversationAction[]> {
  const appliedActions: ConversationAction[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'edit_field': {
          if (!ALLOWED_FIELDS.includes(action.field!)) {
            console.warn(
              `[conversation] Rejected edit to disallowed field: ${action.field}`,
            )
            continue
          }
          const before = (project[action.field!] as string) || ''
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { [action.field!]: action.value },
          })
          appliedActions.push({
            type: 'edit_field',
            field: action.field,
            before: before.substring(0, 200),
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_body': {
          const beforeText = project.body
            ? extractTextFromLexical(project.body).substring(0, 200)
            : ''
          const lexicalBody = markdownToLexical(action.value!)
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { body: lexicalBody },
          })
          appliedActions.push({
            type: 'edit_field',
            field: 'body',
            before: beforeText,
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_section': {
          const currentSections =
            typeof project.sections === 'string'
              ? JSON.parse((project.sections as string) || '{}')
              : ((project.sections as Record<string, unknown>) || {})
          const before = currentSections[action.sectionName!] || ''
          const beforeStr =
            typeof before === 'string'
              ? before
              : extractTextFromLexical(before)
          currentSections[action.sectionName!] = action.value
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { sections: currentSections },
          })
          appliedActions.push({
            type: 'rewrite_section',
            sectionName: action.sectionName,
            before: beforeStr.substring(0, 200),
            after: (action.value as string).substring(0, 200),
          })
          break
        }

        case 'edit_faq': {
          const currentFaq = Array.isArray(project.faqSection)
            ? [...(project.faqSection as Record<string, unknown>[])]
            : []
          if (action.index === -1) {
            currentFaq.push({
              question: action.question,
              answer: action.answer,
            })
          } else if (action.index! >= 0 && action.index! < currentFaq.length) {
            currentFaq[action.index!] = {
              question: action.question,
              answer: action.answer,
            }
          }
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { faqSection: currentFaq },
          })
          appliedActions.push({
            type: 'edit_field',
            field: `faqSection[${action.index}]`,
            after: `Q: ${action.question}`.substring(0, 200),
          })
          break
        }

        case 'stage_change': {
          const currentStage = project.stage as string
          const contentType = project.contentType as string
          if (isValidTransition(currentStage, action.newStage!, contentType)) {
            const newStage = action.newStage as 'idea' | 'brief' | 'research' | 'draft' | 'review' | 'published'
            await payload.update({
              collection: 'content-projects',
              id: projectId,
              data: {
                stage: newStage,
                ...(newStage === 'published'
                  ? { publishedAt: new Date().toISOString() }
                  : {}),
              },
            })
            appliedActions.push({
              type: 'stage_change',
              before: currentStage,
              after: action.newStage,
            })
          } else {
            console.warn(
              `[conversation] Invalid stage transition: ${currentStage} → ${action.newStage} for ${contentType}`,
            )
          }
          break
        }
      }
    } catch (err) {
      console.error(`[conversation] Action failed:`, action, err)
    }
  }

  return appliedActions
}

export async function handleMessage(
  options: HandleMessageOptions,
): Promise<ConversationResponse> {
  const { projectId, message } = options

  // 1. Build context
  const ctx = await buildContext({ projectId })

  // 2. Format system prompt + conversation history
  const systemPrompt = buildSystemPrompt(ctx)

  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }> = [{ role: 'system', content: systemPrompt }]

  // Add recent conversation history
  for (const msg of ctx.recentMessages) {
    messages.push({
      role: msg.role === 'designer' ? 'user' : 'assistant',
      content: msg.content,
    })
  }

  // Add current message
  messages.push({ role: 'user', content: message })

  // 3. Call OpenRouter
  const result = await callModel('editing', messages, {
    maxTokens: 4096,
    temperature: 0.4,
  })

  // 4. Parse response
  const parsed = parseModelResponse(result.content)

  // 5. Validate and apply actions
  const validActions = parsed.actions.filter((a) => {
    if (!validateAction(a)) {
      console.warn('[conversation] Invalid action discarded:', a)
      return false
    }
    return true
  })

  const payload = await getPayload({ config: configPromise })

  // Re-fetch project for action application (fresh state)
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  const appliedActions =
    validActions.length > 0
      ? await applyActions(payload, projectId, project, validActions)
      : []

  // 6. Store messages
  const designerMessage = {
    role: 'designer' as const,
    content: message,
    timestamp: new Date().toISOString(),
  }

  const kiuliMessage = {
    role: 'kiuli' as const,
    content: parsed.message,
    timestamp: new Date().toISOString(),
    actions: appliedActions.length > 0 ? appliedActions : undefined,
  }

  const currentMessages = Array.isArray(project.messages)
    ? [...(project.messages as Record<string, unknown>[])]
    : []
  currentMessages.push(designerMessage)
  currentMessages.push(kiuliMessage)

  await payload.update({
    collection: 'content-projects',
    id: projectId,
    data: { messages: currentMessages },
  })

  return {
    message: parsed.message,
    actions: appliedActions,
    suggestedNextStep: parsed.suggestedNextStep,
  }
}
