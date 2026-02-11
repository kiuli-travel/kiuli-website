export type ChunkType =
  | 'research_extract'
  | 'article_section'
  | 'faq_answer'
  | 'designer_insight'
  | 'itinerary_context'
  | 'editorial_directive'
  | 'conversation_insight'
  | 'destination_section'
  | 'itinerary_segment'
  | 'page_section'
  | 'property_section'

export interface EmbeddingRecord {
  id: string
  chunkType: ChunkType
  chunkText: string
  embedding: number[]

  contentProjectId?: number
  itineraryId?: number
  destinationId?: number
  propertyId?: number

  contentType?: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  freshnessCategory?: string
  audienceRelevance?: string[]

  publishedAt?: string
  createdAt: string
  updatedAt: string
}

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
  contentType?: string
  freshnessCategory?: string
  audienceRelevance?: string[]
  sectionName?: string
  wordCount: number
}

export interface SimilarityResult {
  id: string
  chunkType: ChunkType
  chunkText: string
  score: number
  contentProjectId?: number
  itineraryId?: number
  destinationId?: number
  propertyId?: number
  contentType?: string
  destinations?: string[]
  properties?: string[]
}

export interface QueryFilter {
  contentTypes?: string[]
  chunkTypes?: ChunkType[]
  destinations?: string[]
  properties?: string[]
  species?: string[]
  contentProjectId?: number
  itineraryId?: number
  destinationId?: number
  propertyId?: number
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
