export interface LibraryMatch {
  mediaId: string
  url: string
  score: number
  labels: Record<string, string>
  alt: string
}

export interface ImageGenerationRequest {
  prompt: string
  style?: string
  aspectRatio?: string
}

export interface ImageGenerationResult {
  imageUrl: string
  prompt: string
  status: 'candidate' | 'selected' | 'rejected'
}

export interface LibrarySearchOptions {
  query: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  maxResults?: number
}

export interface ImageGeneratorOptions {
  projectId: string
  contentType: string
  title: string
  promptPrefix?: string
  count?: number
}
