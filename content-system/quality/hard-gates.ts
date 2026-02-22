import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadCoreVoice } from '../voice/loader'
import type { HardGatesOptions, HardGateResult, QualityViolation, BannedWordMatch, LengthViolation } from './types'

const ARTICLE_TYPES = new Set(['itinerary_cluster', 'authority', 'designer_insight'])

// Superlative and fear-forward patterns (word-boundary, case-insensitive)
const SUPERLATIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bthe best\b/i, label: 'the best' },
  { pattern: /\bthe most\b/i, label: 'the most' },
  { pattern: /\bonce in a lifetime\b/i, label: 'once in a lifetime' },
  { pattern: /\bbucket list\b/i, label: 'bucket list' },
  { pattern: /\bdon't miss\b/i, label: "don't miss" },
  { pattern: /\byou won't believe\b/i, label: "you won't believe" },
  { pattern: /\blimited availability\b/i, label: 'limited availability' },
  { pattern: /\bbook now before\b/i, label: 'book now before' },
  { pattern: /\bfomo\b/i, label: 'FOMO' },
  { pattern: /\bfear of missing\b/i, label: 'fear of missing' },
]

export async function checkHardGates(options: HardGatesOptions): Promise<HardGateResult> {
  const violations: QualityViolation[] = []

  // ── Gate 1: Banned Phrase Detection ──────────────────────────────────
  const voice = await loadCoreVoice()

  for (const banned of voice.bannedPhrases) {
    if (!banned.phrase) continue
    const regex = new RegExp(escapeRegex(banned.phrase), 'gi')

    for (const [fieldName, fieldValue] of fieldsToCheck(options)) {
      let match: RegExpExecArray | null
      while ((match = regex.exec(fieldValue)) !== null) {
        const start = Math.max(0, match.index - 25)
        const end = Math.min(fieldValue.length, match.index + match[0].length + 25)
        const context = fieldValue.slice(start, end)

        violations.push({
          gate: 'banned_phrase',
          severity: 'error',
          message: `Banned phrase "${banned.phrase}" found in ${fieldName}: ${banned.reason}`,
          field: fieldName,
          details: {
            word: banned.phrase,
            context,
            position: match.index,
          } as BannedWordMatch,
        })
      }
    }
  }

  // ── Gate 2: Superlative and Fear-Forward Language ────────────────────
  for (const { pattern, label } of SUPERLATIVE_PATTERNS) {
    if (pattern.test(options.body)) {
      violations.push({
        gate: 'superlative_language',
        severity: 'warning',
        message: `Superlative/fear-forward phrase "${label}" found in body`,
        field: 'body',
      })
    }
  }

  // ── Gate 3: Meta Field Length Validation ─────────────────────────────
  if (options.metaTitle) {
    if (options.metaTitle.length > 60) {
      violations.push({
        gate: 'meta_length',
        severity: 'error',
        message: `metaTitle is ${options.metaTitle.length} chars (max 60)`,
        field: 'metaTitle',
        details: { field: 'metaTitle', actual: options.metaTitle.length, max: 60 } as LengthViolation,
      })
    }
  } else {
    violations.push({
      gate: 'meta_length',
      severity: 'warning',
      message: 'metaTitle is empty',
      field: 'metaTitle',
    })
  }

  if (options.metaDescription) {
    if (options.metaDescription.length > 160) {
      violations.push({
        gate: 'meta_length',
        severity: 'error',
        message: `metaDescription is ${options.metaDescription.length} chars (max 160)`,
        field: 'metaDescription',
        details: { field: 'metaDescription', actual: options.metaDescription.length, max: 160 } as LengthViolation,
      })
    }
  } else {
    violations.push({
      gate: 'meta_length',
      severity: 'warning',
      message: 'metaDescription is empty',
      field: 'metaDescription',
    })
  }

  // ── Gate 4: FAQ Count Validation ────────────────────────────────────
  const payload = await getPayload({ config: configPromise })
  const project = await payload.findByID({
    collection: 'content-projects',
    id: Number(options.projectId),
    depth: 0,
  }) as unknown as Record<string, unknown>

  const contentType = project.contentType as string
  const faqSection = Array.isArray(project.faqSection) ? project.faqSection : []
  const faqCount = faqSection.filter((f: Record<string, unknown>) => f.question && f.answer).length

  if (ARTICLE_TYPES.has(contentType) && faqCount < 5) {
    violations.push({
      gate: 'faq_count',
      severity: 'error',
      message: `Articles require at least 5 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  } else if (contentType === 'destination_page' && faqCount < 3) {
    violations.push({
      gate: 'faq_count',
      severity: 'warning',
      message: `Destination pages should have at least 3 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  } else if (contentType === 'property_page' && faqCount < 2) {
    violations.push({
      gate: 'faq_count',
      severity: 'warning',
      message: `Property pages should have at least 2 FAQ items (found ${faqCount})`,
      field: 'faqSection',
    })
  }

  // ── Gate 5: Required Fields Check ───────────────────────────────────
  if (ARTICLE_TYPES.has(contentType)) {
    if (!project.body) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "body" is empty', field: 'body' })
    if (!project.metaTitle) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaTitle" is empty', field: 'metaTitle' })
    if (!project.metaDescription) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaDescription" is empty', field: 'metaDescription' })
    if (!project.answerCapsule) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "answerCapsule" is empty', field: 'answerCapsule' })
  } else if (contentType === 'destination_page' || contentType === 'property_page') {
    if (!project.sections) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "sections" is empty', field: 'sections' })
    if (!project.metaTitle) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaTitle" is empty', field: 'metaTitle' })
    if (!project.metaDescription) violations.push({ gate: 'required_field', severity: 'error', message: 'Required field "metaDescription" is empty', field: 'metaDescription' })
  }

  // ── Aggregation ─────────────────────────────────────────────────────
  const hasErrors = violations.some((v) => v.severity === 'error')

  return {
    passed: !hasErrors,
    violations,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function* fieldsToCheck(options: HardGatesOptions): Generator<[string, string]> {
  if (options.body) yield ['body', options.body]
  if (options.metaTitle) yield ['metaTitle', options.metaTitle]
  if (options.metaDescription) yield ['metaDescription', options.metaDescription]
}
