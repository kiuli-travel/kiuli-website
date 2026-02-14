// ── Types ────────────────────────────────────────────────────────────────────

export type ContentType =
  | 'itinerary_cluster'
  | 'authority'
  | 'destination_page'
  | 'property_page'

export type Stage =
  | 'ideas'
  | 'briefs'
  | 'research'
  | 'drafts'
  | 'review'
  | 'published'
  | 'filtered'

export type Origin = 'itinerary' | 'cascade' | 'external' | 'designer'

export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'failed'

export interface ContentProject {
  id: string
  title: string
  contentType: ContentType
  stage: Stage
  origin: Origin
  processingStatus: ProcessingStatus
  errorMessage?: string
  filterReason?: string
  destinationNames: string[]
  createdAt: Date
}

export type JobType = 'cascade' | 'decompose' | 'embed' | 'research'
export type JobStatus = 'completed' | 'running' | 'failed'

export interface RecentJob {
  id: string
  type: JobType
  status: JobStatus
  itinerary: string
  duration: string
  error?: string
}

export interface EmbeddingGroup {
  type: string
  count: number
}

export interface StaleBreakdown {
  stage: Stage
  count: number
}

export interface DashboardMetrics {
  embeddings: {
    total: number
    groups: EmbeddingGroup[]
    lastUpdated: Date | null
  }
  staleProjects: {
    total: number
    breakdown: StaleBreakdown[]
  }
  failedOperations: number
  directives: {
    totalActive: number
    pastReviewDate: number
    zeroFilterHits: number
  }
}

export interface DashboardData {
  projects: ContentProject[]
  stageCounts: Record<Stage, number>
  jobs: RecentJob[]
  metrics: DashboardMetrics
}

// ── Content Type Display ─────────────────────────────────────────────────────

export const contentTypeLabels: Record<ContentType, string> = {
  itinerary_cluster: 'Article',
  authority: 'Article',
  destination_page: 'Destination',
  property_page: 'Property',
}

export const contentTypeBadgeColors: Record<
  ContentType,
  { bg: string; text: string }
> = {
  itinerary_cluster: { bg: 'bg-kiuli-teal', text: 'text-white' },
  authority: { bg: 'bg-kiuli-teal', text: 'text-white' },
  destination_page: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  property_page: { bg: 'bg-sky-100', text: 'text-sky-800' },
}

export const originLabels: Record<Origin, string> = {
  itinerary: 'Itinerary',
  cascade: 'Cascade',
  external: 'External',
  designer: 'Designer',
}

export const stageLabels: Record<Stage, string> = {
  ideas: 'Ideas',
  briefs: 'Briefs',
  research: 'Research',
  drafts: 'Drafts',
  review: 'Review',
  published: 'Published',
  filtered: 'Filtered',
}

// ── DB stage to display stage mapping ────────────────────────────────────────

export const dbStageToDisplay: Record<string, Stage> = {
  idea: 'ideas',
  brief: 'briefs',
  research: 'research',
  draft: 'drafts',
  review: 'review',
  published: 'published',
  filtered: 'filtered',
}

export const displayStageToDb: Record<Stage, string> = {
  ideas: 'idea',
  briefs: 'brief',
  research: 'research',
  drafts: 'draft',
  review: 'review',
  published: 'published',
  filtered: 'filtered',
}
