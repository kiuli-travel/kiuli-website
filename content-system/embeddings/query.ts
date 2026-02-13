import type { QueryOptions, SimilarityResult } from './types'
import { query } from '../db'
import { embedTexts } from './embedder'

export async function semanticSearch(
  queryText: string,
  options?: {
    topK?: number
    minScore?: number
    chunkTypes?: string[]
    destinationId?: number
    propertyId?: number
    itineraryId?: number
    excludeProjectId?: number
  },
): Promise<SimilarityResult[]> {
  const topK = options?.topK ?? 10
  const minScore = options?.minScore ?? 0.0

  // Embed the query text
  const [queryEmbedding] = await embedTexts([queryText])
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  // Build parameterized query
  const conditions: string[] = ['1=1']
  const params: unknown[] = [embeddingStr]
  let paramIdx = 2

  if (options?.chunkTypes && options.chunkTypes.length > 0) {
    conditions.push(`chunk_type = ANY($${paramIdx})`)
    params.push(options.chunkTypes)
    paramIdx++
  }
  if (options?.destinationId != null) {
    conditions.push(`destination_id = $${paramIdx}`)
    params.push(options.destinationId)
    paramIdx++
  }
  if (options?.propertyId != null) {
    conditions.push(`property_id = $${paramIdx}`)
    params.push(options.propertyId)
    paramIdx++
  }
  if (options?.itineraryId != null) {
    conditions.push(`itinerary_id = $${paramIdx}`)
    params.push(options.itineraryId)
    paramIdx++
  }
  if (options?.excludeProjectId != null) {
    conditions.push(`content_project_id != $${paramIdx}`)
    params.push(options.excludeProjectId)
    paramIdx++
  }

  params.push(topK)

  const sql = `
    SELECT id, chunk_type, chunk_text,
           1 - (embedding::halfvec(3072) <=> $1::halfvec(3072)) as similarity,
           itinerary_id, destination_id, property_id,
           destinations, properties, content_project_id, content_type
    FROM content_embeddings
    WHERE ${conditions.join(' AND ')}
    ORDER BY embedding::halfvec(3072) <=> $1::halfvec(3072)
    LIMIT $${paramIdx}
  `

  const result = await query(sql, params)

  return result.rows
    .filter((row: any) => row.similarity >= minScore)
    .map((row: any) => ({
      id: String(row.id),
      chunkType: row.chunk_type,
      chunkText: row.chunk_text,
      score: parseFloat(row.similarity),
      contentProjectId: row.content_project_id ?? undefined,
      itineraryId: row.itinerary_id ?? undefined,
      destinationId: row.destination_id ?? undefined,
      propertyId: row.property_id ?? undefined,
      contentType: row.content_type ?? undefined,
      destinations: row.destinations ?? undefined,
      properties: row.properties ?? undefined,
    }))
}

// Keep original export for type compatibility
export async function querySimilar(options: QueryOptions): Promise<SimilarityResult[]> {
  return semanticSearch(options.text, {
    topK: options.topK,
    minScore: options.filter?.minScore,
    chunkTypes: options.filter?.chunkTypes,
    destinationId: options.filter?.destinationId,
    propertyId: options.filter?.propertyId,
    itineraryId: options.filter?.itineraryId,
  })
}
