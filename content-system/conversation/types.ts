export interface ConversationMessage {
  role: 'designer' | 'kiuli'
  content: string
  timestamp: string
  actions?: ConversationAction[]
}

export interface ConversationAction {
  type:
    | 'edit_field'
    | 'rewrite_section'
    | 'stage_change'
    | 'trigger_research'
    | 'trigger_draft'
  field?: string
  sectionName?: string
  before?: string
  after?: string
  details?: Record<string, unknown>
}

export interface ConversationContext {
  projectId: number
  title: string
  stage: string
  contentType: string
  briefSummary?: string
  targetAngle?: string
  competitiveNotes?: string
  synthesisText?: string
  sourcesSummary?: string
  draftText?: string
  sections?: Record<string, string>
  faqItems?: Array<{ question: string; answer: string }>
  metaTitle?: string
  metaDescription?: string
  answerCapsule?: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  relatedContent?: string
  activeDirectives?: string
  recentMessages: ConversationMessage[]
}

export interface ConversationResponse {
  message: string
  actions: ConversationAction[]
  suggestedNextStep?: string
}

export interface HandleMessageOptions {
  projectId: number
  message: string
}

export interface ContextBuilderOptions {
  projectId: number
  maxMessages?: number
}
