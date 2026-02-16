export interface DraftResult {
  success: boolean
  error?: string
}

export interface SectionDraft {
  sectionKey: string
  content: string
}

export interface ArticleDraftOutput {
  body: string
  faqSection: Array<{ question: string; answer: string }>
  metaTitle: string
  metaDescription: string
  answerCapsule: string
}

export interface CompoundDraftOutput {
  sections: Record<string, string>
  faqSection: Array<{ question: string; answer: string }>
  metaTitle: string
  metaDescription: string
  answerCapsule: string
}
