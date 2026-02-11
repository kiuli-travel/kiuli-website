export interface ConversationMessage {
  role: 'designer' | 'kiuli'
  content: string
  timestamp: string
  actions?: ConversationAction[]
}

export interface ConversationAction {
  type: 'edit' | 'regenerate' | 'approve' | 'reject' | 'stage_change'
  field?: string
  before?: string
  after?: string
  details?: Record<string, unknown>
}

export interface ConversationContext {
  projectId: string
  stage: string
  contentType: string
  brief?: string
  research?: string
  draft?: string
  recentMessages: ConversationMessage[]
}

export interface ConversationResponse {
  message: string
  actions: ConversationAction[]
  suggestedNextStep?: string
}

export interface HandleMessageOptions {
  projectId: string
  message: string
  context?: Partial<ConversationContext>
}

export interface ContextBuilderOptions {
  projectId: string
  maxMessages?: number
  includeResearch?: boolean
  includeDraft?: boolean
}
