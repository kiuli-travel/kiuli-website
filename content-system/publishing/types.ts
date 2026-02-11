export interface PublishResult {
  success: boolean
  targetCollection: string
  targetId: string
  publishedAt: string
  error?: string
}

export interface OptimisticLockError {
  targetCollection: string
  targetId: string
  expectedUpdatedAt: string
  actualUpdatedAt: string
  message: string
}

export interface CompoundWritePayload {
  collection: string
  id?: string
  fields: Record<string, unknown>
  relationships?: RelationshipWrite[]
}

export interface RelationshipWrite {
  field: string
  value: string | string[]
  mode: 'set' | 'add' | 'remove'
}

export interface ArticlePublishOptions {
  projectId: string
  targetCollection: 'posts'
  body: string
  metaTitle: string
  metaDescription: string
  answerCapsule: string
  faqSection: Array<{ question: string; answer: string }>
  heroImageId?: string
  slug: string
}

export interface DestinationPagePublishOptions {
  projectId: string
  destinationId: string
  sections: Record<string, unknown>
  metaTitle: string
  metaDescription: string
  expectedUpdatedAt?: string
}

export interface PropertyPagePublishOptions {
  projectId: string
  propertyId: string
  sections: Record<string, unknown>
  metaTitle: string
  metaDescription: string
  expectedUpdatedAt?: string
}

export interface EnhancementPublishOptions {
  projectId: string
  targetCollection: string
  targetId: string
  field: string
  enhancedContent: string
  expectedUpdatedAt?: string
}

export interface UpdatePublishOptions {
  projectId: string
  targetCollection: string
  targetId: string
  targetField: string
  newContent: string
  expectedUpdatedAt?: string
}
