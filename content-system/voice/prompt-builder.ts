import type { VoiceContext } from './loader'

/**
 * Converts a VoiceContext into system prompt text that can be prepended to any LLM call.
 * Does NOT include project-specific context — that's the caller's job.
 */
export function buildVoicePrompt(voice: VoiceContext): string {
  const parts: string[] = []

  // ── Core Identity ──────────────────────────────────────────────────────

  if (voice.core.summary) {
    parts.push(`KIULI VOICE IDENTITY:\n${voice.core.summary}`)
  }

  if (voice.core.principles.length > 0) {
    parts.push('PRINCIPLES:')
    for (const p of voice.core.principles) {
      let line = `- ${p.principle}: ${p.explanation}`
      if (p.example) {
        line += `\n  Example: ${p.example}`
      }
      parts.push(line)
    }
  }

  if (voice.core.audience) {
    parts.push(`AUDIENCE:\n${voice.core.audience}`)
  }

  if (voice.core.positioning) {
    parts.push(`POSITIONING:\n${voice.core.positioning}`)
  }

  if (voice.core.bannedPhrases.length > 0) {
    parts.push('BANNED PHRASES (never use these):')
    for (const b of voice.core.bannedPhrases) {
      let line = `- "${b.phrase}" — ${b.reason}`
      if (b.alternative) {
        line += `. Use instead: ${b.alternative}`
      }
      parts.push(line)
    }
  }

  if (voice.core.antiPatterns.length > 0) {
    parts.push('ANTI-PATTERNS (avoid these writing patterns):')
    for (const a of voice.core.antiPatterns) {
      parts.push(`- ${a.pattern}: ${a.explanation}`)
    }
  }

  // Filter gold standard to relevant content type if available
  const relevantGold = voice.contentType
    ? voice.core.goldStandard.filter(
        (g) => g.contentType === 'general' || g.contentType === voice.contentType?.contentType,
      )
    : voice.core.goldStandard

  if (relevantGold.length > 0) {
    parts.push('GOLD STANDARD EXAMPLES (this is what great Kiuli writing looks like):')
    for (const g of relevantGold) {
      parts.push(`---\n${g.excerpt}\n[Context: ${g.context}]\n---`)
    }
  }

  // ── Content Type Guidance ──────────────────────────────────────────────

  if (voice.contentType) {
    const ct = voice.contentType
    parts.push(`CONTENT TYPE: ${ct.label}`)
    parts.push(`OBJECTIVE: ${ct.objective}`)
    if (ct.toneShift) parts.push(`TONE: ${ct.toneShift}`)
    if (ct.structuralNotes) parts.push(`STRUCTURE: ${ct.structuralNotes}`)
  }

  // ── Section Guidance ───────────────────────────────────────────────────

  if (voice.sections && voice.sections.length > 0) {
    for (const s of voice.sections) {
      parts.push(`\nSECTION: ${s.sectionLabel} (${s.sectionKey})`)
      parts.push(`OBJECTIVE: ${s.objective}`)
      if (s.toneNotes) parts.push(`TONE: ${s.toneNotes}`)
      if (s.wordCountRange) parts.push(`WORD COUNT: ${s.wordCountRange}`)

      if (s.doList.length > 0) {
        parts.push('DO:')
        for (const item of s.doList) {
          parts.push(`- ${item}`)
        }
      }

      if (s.dontList.length > 0) {
        parts.push("DON'T:")
        for (const item of s.dontList) {
          parts.push(`- ${item}`)
        }
      }

      if (s.examples.length > 0) {
        parts.push('EXAMPLES:')
        for (const ex of s.examples) {
          parts.push(`BEFORE: ${ex.before}`)
          parts.push(`AFTER: ${ex.after}`)
        }
      }
    }
  }

  return parts.join('\n\n')
}
