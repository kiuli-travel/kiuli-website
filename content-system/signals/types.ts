export interface DecompositionResult {
  itineraryId: string
  candidates: ContentCandidate[]
  entitiesExtracted: string[]
  timestamp: string
}

export interface ContentCandidate {
  title: string
  contentType: string
  originPathway: 'itinerary' | 'cascade'
  briefSummary: string
  destinations: string[]
  properties: string[]
  species: string[]
  confidence: number
}

export interface SourceCheckResult {
  sourceId: string
  sourceName: string
  newItems: FeedItem[]
  lastCheckedAt: string
  cursor: string
}

export interface FeedItem {
  id: string
  title: string
  url: string
  publishedAt: string
  summary: string
  category: string
}

export interface SourceMonitorOptions {
  sourceIds?: string[]
  forceCheck?: boolean
}

export interface DecomposeOptions {
  itineraryId: string
  includeEnhancements?: boolean
}
