export interface ResearchQuery {
  topic: string
  angle: string
  destinations: string[]
  contentType: string
}

export interface PerplexityResponse {
  answer: string
  sources: ExternalSource[]
  followUpQuestions: string[]
}

export interface ExternalSource {
  title: string
  url: string
  snippet: string
  credibility: 'authoritative' | 'peer_reviewed' | 'preprint' | 'trade' | 'other'
}

export interface ResearchCompilation {
  synthesis: string
  sources: ExternalSource[]
  proprietaryAngles: ProprietaryAngle[]
  uncertaintyMap: UncertaintyEntry[]
  existingSiteContent: string
}

export interface ProprietaryAngle {
  angle: string
  source: 'designer' | 'client' | 'booking' | 'supplier'
}

export interface UncertaintyEntry {
  claim: string
  confidence: 'fact' | 'inference' | 'uncertain'
  notes: string
}

export interface ResearchOptions {
  projectId: string
  query: ResearchQuery
  includeExistingContent?: boolean
  maxSources?: number
}
