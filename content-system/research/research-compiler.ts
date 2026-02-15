import type {
  ResearchOptions,
  ResearchCompilation,
  ExternalSource,
  UncertaintyEntry,
} from './types'
import { queryPerplexity } from './perplexity-client'
import { semanticSearch } from '../embeddings/query'
import { callModel } from '../openrouter-client'

const SYNTHESIS_SYSTEM_PROMPT = `You are a research compiler for Kiuli, a luxury African safari travel company. Your job is to synthesize external research findings and existing site content into a comprehensive research brief.

Structure your synthesis as:

## Key Findings
The most important facts, statistics, and insights from external research.

## Existing Coverage
What Kiuli already has on this topic. Note gaps and opportunities.

## Contradictions
Any conflicting information between sources, or between external sources and existing Kiuli content.

## Proprietary Opportunities
Angles where Kiuli's designer expertise could add unique value that competitors cannot replicate.

## Time-Sensitive Information
Facts that may change — permit prices, visa requirements, seasonal access, conservation status.

## Uncertainty Notes
Claims that could not be verified from multiple sources, or where sources disagree. Mark each as [FACT], [INFERENCE], or [UNCERTAIN].

Write for an expert travel designer who will use this research to produce luxury safari content. Be specific — include numbers, dates, source names. Do not be generic.`

function extractUncertainties(synthesis: string): UncertaintyEntry[] {
  const entries: UncertaintyEntry[] = []

  // Find the Uncertainty Notes section
  const sectionMatch = synthesis.match(
    /## Uncertainty Notes\s*\n([\s\S]*?)(?=\n## |\n---|\z|$)/,
  )
  if (!sectionMatch) return entries

  const section = sectionMatch[1]
  // Match lines like: - Some claim [FACT] or [INFERENCE] or [UNCERTAIN]
  const linePattern = /[-*]\s*(.+?)\s*\[(FACT|INFERENCE|UNCERTAIN)\]\s*(.*)/gi
  let match: RegExpExecArray | null

  while ((match = linePattern.exec(section)) !== null) {
    const confidenceMap: Record<string, UncertaintyEntry['confidence']> = {
      FACT: 'fact',
      INFERENCE: 'inference',
      UNCERTAIN: 'uncertain',
    }
    entries.push({
      claim: match[1].trim(),
      confidence: confidenceMap[match[2].toUpperCase()] || 'uncertain',
      notes: match[3]?.trim() || '',
    })
  }

  // Also try inline tags anywhere in the text for broader capture
  if (entries.length === 0) {
    const inlinePattern = /\[([^\]]+)\]\s*\[(FACT|INFERENCE|UNCERTAIN)\]/gi
    while ((match = inlinePattern.exec(synthesis)) !== null) {
      const confidenceMap: Record<string, UncertaintyEntry['confidence']> = {
        FACT: 'fact',
        INFERENCE: 'inference',
        UNCERTAIN: 'uncertain',
      }
      entries.push({
        claim: match[1].trim(),
        confidence: confidenceMap[match[2].toUpperCase()] || 'uncertain',
        notes: '',
      })
    }
  }

  return entries
}

export async function compileResearch(
  options: ResearchOptions,
): Promise<ResearchCompilation> {
  // 1. Query Perplexity for external research
  const perplexityResult = await queryPerplexity({
    topic: options.query.topic,
    angle: options.query.angle,
    destinations: options.query.destinations,
    contentType: options.query.contentType,
  })

  // 2. Query embedding store for existing Kiuli content on this topic
  let existingSiteContent = ''
  if (options.includeExistingContent !== false) {
    try {
      const searchText = `${options.query.topic} ${options.query.angle}`
      const existingContent = await semanticSearch(searchText, {
        topK: 10,
        minScore: 0.3,
        excludeProjectId: parseInt(options.projectId, 10),
      })

      existingSiteContent = existingContent
        .map((r) => `[${r.chunkType}] ${r.chunkText}`)
        .join('\n\n')
    } catch (err) {
      console.warn('[research-compiler] Embedding search failed:', err)
      existingSiteContent = '(Embedding search unavailable)'
    }
  }

  // 3. Compile synthesis via OpenRouter
  const synthesisResult = await callModel(
    'research',
    [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `External research:\n${perplexityResult.answer}\n\nExisting Kiuli content:\n${existingSiteContent || '(No existing content found)'}\n\nTopic: ${options.query.topic}\nAngle: ${options.query.angle}`,
      },
    ],
    { maxTokens: 4096, temperature: 0.3 },
  )

  // 4. Extract uncertainty map from synthesis
  const uncertaintyMap = extractUncertainties(synthesisResult.content)

  return {
    synthesis: synthesisResult.content,
    sources: perplexityResult.sources,
    proprietaryAngles: [],
    uncertaintyMap,
    existingSiteContent,
  }
}

export async function researchForSection(
  sectionName: string,
  destinationOrProperty: string,
  existingContent: string,
): Promise<{
  perplexityFindings: string
  embeddingContext: string
  sources: ExternalSource[]
}> {
  // Query Perplexity for section-specific facts
  const perplexityResult = await queryPerplexity({
    topic: `${sectionName} for ${destinationOrProperty}`,
    angle: `Detailed information about the ${sectionName.toLowerCase()} section for a luxury safari destination/property page`,
    destinations: [destinationOrProperty],
    contentType: 'destination_page',
  })

  // Query embedding store for related existing content
  let embeddingContext = ''
  try {
    const results = await semanticSearch(
      `${sectionName} ${destinationOrProperty}`,
      { topK: 5, minScore: 0.3 },
    )
    embeddingContext = results
      .map((r) => `[${r.chunkType}] ${r.chunkText}`)
      .join('\n\n')
  } catch {
    embeddingContext = ''
  }

  return {
    perplexityFindings: perplexityResult.answer,
    embeddingContext,
    sources: perplexityResult.sources,
  }
}
