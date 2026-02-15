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

export interface SourceMonitorOptions {
  sourceIds?: string[]
  forceCheck?: boolean
}

export interface SourceCheckResult {
  sourceId: number | string
  sourceName: string
  itemsFound: number
  newItems: number
  projectsCreated: number
  error: string | null
}

export interface FeedItem {
  id: string
  title: string
  url: string
  publishedAt: string
  summary: string
  category: string
}
