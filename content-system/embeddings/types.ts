export type ChunkType =
  | 'article_section'
  | 'faq'
  | 'meta'
  | 'property_description'
  | 'destination_description'
  | 'itinerary_segment'

export interface ContentChunk {
  id: string
  sourceCollection: string
  sourceId: string
  sourceField: string
  chunkType: ChunkType
  text: string
  metadata: ChunkMetadata
}

export interface ChunkMetadata {
  title?: string
  slug?: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  sectionName?: string
  wordCount: number
}

export interface EmbeddingRecord {
  chunkId: string
  embedding: number[]
  model: string
  dimensions: number
  createdAt: string
}

export interface SimilarityResult {
  chunkId: string
  sourceCollection: string
  sourceId: string
  text: string
  score: number
  metadata: ChunkMetadata
}

export interface QueryFilter {
  collections?: string[]
  destinations?: string[]
  properties?: string[]
  chunkTypes?: ChunkType[]
  minScore?: number
}

export interface ChunkerOptions {
  sourceCollection: string
  sourceId: string
  content: Record<string, unknown>
  maxChunkWords?: number
  overlapWords?: number
}

export interface EmbedOptions {
  chunks: ContentChunk[]
  model?: string
  batchSize?: number
}

export interface QueryOptions {
  text: string
  filter?: QueryFilter
  topK?: number
}
