export interface DecomposeOptions {
  itineraryId: number
  jobId?: number
}

export interface DecompositionResult {
  itineraryId: number
  totalCandidates: number
  passed: number
  filtered: number
  projectsCreated: number[]
  filteredProjectIds: number[]
}

// Retained for source-monitor.ts stub compatibility
export interface SourceMonitorOptions {
  sourceIds?: string[]
  forceCheck?: boolean
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
