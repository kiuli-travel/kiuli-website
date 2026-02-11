export interface HardGateResult {
  passed: boolean
  violations: QualityViolation[]
}

export interface QualityViolation {
  gate: string
  severity: 'error' | 'warning'
  message: string
  field?: string
  details?: BannedWordMatch | LengthViolation
}

export interface BannedWordMatch {
  word: string
  context: string
  position: number
}

export interface LengthViolation {
  field: string
  actual: number
  min?: number
  max?: number
}

export interface ConsistencyResult {
  overallResult: 'pass' | 'hard_contradiction' | 'soft_contradiction'
  issues: ConsistencyIssue[]
}

export interface ConsistencyIssue {
  issueType: 'hard' | 'soft' | 'staleness'
  existingContent: string
  newContent: string
  sourceRecord: string
  resolution: 'pending' | 'updated_draft' | 'updated_existing' | 'overridden'
  resolutionNote?: string
}

export interface HardGatesOptions {
  projectId: string
  body: string
  metaTitle?: string
  metaDescription?: string
}

export interface ConsistencyCheckOptions {
  projectId: string
  draftContent: string
  targetCollection: string
  targetRecordId?: string
}
