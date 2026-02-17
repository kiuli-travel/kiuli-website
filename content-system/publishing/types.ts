export interface PublishResult {
  success: boolean
  targetCollection: string
  targetId: number
  publishedAt: string
  error?: string
}

export interface OptimisticLockError {
  targetCollection: string
  targetId: number
  expectedUpdatedAt: string
  actualUpdatedAt: string
}
