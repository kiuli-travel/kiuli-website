export interface IdeationCandidate {
  title: string
  contentType: string
  originPathway: string
  briefSummary: string
  targetAngle: string
  destinations: string[]
  properties: string[]
  species: string[]
  score: number
  filterResult?: FilterResult
}

export interface FilterResult {
  passed: boolean
  directivesApplied: DirectiveMatch[]
  duplicateCheck: DuplicateCheck
  reason?: string
}

export interface DirectiveMatch {
  directiveId: string
  directiveText: string
  matched: boolean
  matchReason: string
}

export interface DuplicateCheck {
  isDuplicate: boolean
  similarProjects: SimilarProject[]
  highestSimilarity: number
}

export interface SimilarProject {
  projectId: string
  title: string
  similarity: number
}

export interface BriefOutput {
  title: string
  slug: string
  contentType: string
  briefSummary: string
  targetAngle: string
  targetAudience: string[]
  competitiveNotes: string
  destinations: string[]
  properties: string[]
  freshnessCategory: string
  targetCollection: string
}

export interface GenerateCandidatesOptions {
  source: 'itinerary' | 'external' | 'cascade'
  sourceData: Record<string, unknown>
  maxCandidates?: number
}

export interface FilterCandidatesOptions {
  candidates: IdeationCandidate[]
  directives: Array<{ id: string; text: string; topicTags: string[]; destinationTags: string[]; contentTypeTags: string[] }>
}
