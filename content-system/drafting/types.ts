export interface DraftOutput {
  body: string
  metaTitle: string
  metaDescription: string
  answerCapsule: string
  faqSection: FaqItem[]
  socialSummaries?: SocialOutput
}

export interface FaqItem {
  question: string
  answer: string
}

export interface SocialOutput {
  linkedinSummary: string
  facebookSummary: string
  facebookPinnedComment: string
}

export interface SectionContent {
  [sectionName: string]: string
}

export interface CompoundDraftOutput {
  sections: SectionContent
  metaTitle: string
  metaDescription: string
  answerCapsule: string
  faqSection: FaqItem[]
}

export interface EnhancementOutput {
  enhancedText: string
  changesDescription: string
}

export interface ArticleDraftOptions {
  projectId: string
  brief: string
  research: string
  voiceConfig?: Record<string, unknown>
}

export interface DestinationPageDraftOptions {
  projectId: string
  destinationId: string
  brief: string
  research: string
  existingContent?: Record<string, unknown>
}

export interface PropertyPageDraftOptions {
  projectId: string
  propertyId: string
  brief: string
  research: string
  existingContent?: Record<string, unknown>
}

export interface SegmentEnhanceOptions {
  projectId: string
  segmentText: string
  context: string
}

export interface SocialSummariseOptions {
  projectId: string
  articleBody: string
  title: string
}
