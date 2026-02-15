// ── Workspace Types ──────────────────────────────────────────────────────────
// Aligned with real Payload DB field names (singular stage values)

export type WorkspaceContentType =
  | 'itinerary_cluster'
  | 'authority'
  | 'designer_insight'
  | 'destination_page'
  | 'property_page'
  | 'itinerary_enhancement'
  | 'page_update'

export type WorkspaceStage =
  | 'idea'
  | 'brief'
  | 'research'
  | 'draft'
  | 'review'
  | 'published'
  | 'rejected'
  | 'filtered'

export type WorkspaceProcessingStatus =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'failed'

export type SourceCredibility =
  | 'authoritative'
  | 'peer_reviewed'
  | 'preprint'
  | 'trade'
  | 'other'

export type ClaimConfidence = 'fact' | 'inference' | 'uncertain'

export interface MessageAction {
  type: string
  field?: string
  sectionName?: string
  before?: string
  after?: string
  details?: Record<string, unknown>
}

export interface ConversationMessage {
  role: 'designer' | 'kiuli'
  content: string
  timestamp: string
  actions?: MessageAction[]
  suggestedNextStep?: string
}

export interface ResearchSource {
  title: string
  url: string
  credibility: SourceCredibility
  notes: string
}

export interface UncertaintyItem {
  claim: string
  confidence: ClaimConfidence
  notes: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface DistributionData {
  linkedinSummary: string
  facebookSummary: string
  facebookPinnedComment: string
  linkedinPosted: boolean
  facebookPosted: boolean
}

export interface WorkspaceProject {
  id: number
  title: string
  contentType: WorkspaceContentType
  stage: WorkspaceStage
  processingStatus: WorkspaceProcessingStatus
  errorMessage?: string
  destinations: string[]
  properties: string[]
  species: string[]
  freshnessCategory?: string
  publishedAt?: string
  lastReviewedAt?: string
  originPathway?: string
  originSource?: string

  // Brief (articles)
  briefSummary?: string
  targetAngle?: string
  targetAudience?: string[]
  competitiveNotes?: string

  // Research (articles)
  researchSynthesis?: string
  researchSources?: ResearchSource[]
  uncertaintyMap?: UncertaintyItem[]
  editorialNotes?: string
  existingSiteContent?: string

  // Draft
  draftBody?: string
  sections?: Record<string, string>
  metaTitle?: string
  metaDescription?: string
  answerCapsule?: string

  // Page update
  targetCurrentContent?: string
  targetCollection?: string
  targetField?: string
  targetRecordId?: number

  // FAQ
  faq?: FAQItem[]

  // Distribution (articles)
  distribution?: DistributionData

  // Conversation
  messages: ConversationMessage[]
}

// ── Display Labels ───────────────────────────────────────────────────────────

export const contentTypeBadgeStyles: Record<
  WorkspaceContentType,
  { bg: string; text: string }
> = {
  itinerary_cluster: { bg: 'bg-amber-100', text: 'text-amber-800' },
  authority: { bg: 'bg-amber-100', text: 'text-amber-800' },
  designer_insight: { bg: 'bg-amber-100', text: 'text-amber-800' },
  destination_page: { bg: 'bg-blue-100', text: 'text-blue-800' },
  property_page: { bg: 'bg-kiuli-teal/10', text: 'text-kiuli-teal' },
  itinerary_enhancement: { bg: 'bg-purple-100', text: 'text-purple-800' },
  page_update: { bg: 'bg-gray-100', text: 'text-gray-800' },
}

export const contentTypeLabels: Record<WorkspaceContentType, string> = {
  itinerary_cluster: 'Article',
  authority: 'Article',
  designer_insight: 'Article',
  destination_page: 'Destination',
  property_page: 'Property',
  itinerary_enhancement: 'Enhancement',
  page_update: 'Page Update',
}

export const stageLabels: Record<WorkspaceStage, string> = {
  idea: 'Idea',
  brief: 'Brief',
  research: 'Research',
  draft: 'Draft',
  review: 'Review',
  published: 'Published',
  rejected: 'Rejected',
  filtered: 'Filtered',
}

export const sectionLabels: Record<string, string> = {
  overview: 'Overview',
  when_to_visit: 'When to Visit',
  why_choose: 'Why Choose',
  key_experiences: 'Key Experiences',
  getting_there: 'Getting There',
  health_safety: 'Health & Safety',
  investment_expectation: 'Investment Expectation',
  top_lodges: 'Top Lodges',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isArticleType(type: WorkspaceContentType | string): boolean {
  return type === 'itinerary_cluster' || type === 'authority' || type === 'designer_insight'
}

export function isCompoundType(type: WorkspaceContentType | string): boolean {
  return type === 'destination_page' || type === 'property_page'
}

export function getTabsForContentType(type: WorkspaceContentType | string): string[] {
  if (isArticleType(type)) {
    return ['Brief', 'Research', 'Draft', 'FAQ', 'Images', 'Distribution', 'Metadata']
  }
  if (isCompoundType(type)) {
    return ['Draft', 'FAQ', 'Images', 'Metadata']
  }
  if (type === 'itinerary_enhancement') {
    return ['Draft', 'Metadata']
  }
  if (type === 'page_update') {
    return ['Current vs Proposed', 'Metadata']
  }
  return ['Draft', 'Metadata']
}

// Stage transition maps (must match batch/route.ts)
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

const ENHANCEMENT_ADVANCE: Record<string, string> = {
  draft: 'review',
  review: 'published',
}

const PAGE_UPDATE_ADVANCE: Record<string, string> = {
  proposed: 'review',
  review: 'published',
}

export function getNextStage(stage: string, contentType: string): string | null {
  if (isArticleType(contentType)) return ARTICLE_ADVANCE[stage] || null
  if (isCompoundType(contentType)) return PAGE_ADVANCE[stage] || null
  if (contentType === 'itinerary_enhancement') return ENHANCEMENT_ADVANCE[stage] || null
  if (contentType === 'page_update') return PAGE_UPDATE_ADVANCE[stage] || null
  return null
}

export function getAdvanceButtonLabel(stage: string, contentType: string): string | null {
  const next = getNextStage(stage, contentType)
  if (!next) return null
  if (next === 'published') return 'Publish'
  return `Advance to ${stageLabels[next as WorkspaceStage] || next}`
}
