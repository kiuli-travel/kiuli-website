import type { EmbedOptions, EmbeddingRecord } from './types'
import { query } from '../db'
import type { BootstrapChunk } from './chunker'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/embeddings'
const MODEL = 'text-embedding-3-large'
const DIMENSIONS = 3072
const BATCH_SIZE = 20

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      dimensions: DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errBody}`)
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>
  }

  // Sort by index to maintain input order
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding)
}

async function embedTextsWithRetry(texts: string[]): Promise<number[][]> {
  try {
    return await embedTexts(texts)
  } catch (err) {
    console.warn('Embedding attempt 1 failed, retrying in 2s...', (err as Error).message)
    await new Promise(r => setTimeout(r, 2000))
    return await embedTexts(texts)
  }
}

export async function insertEmbeddings(chunks: BootstrapChunk[], embeddings: number[][]): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]
    await query(
      `INSERT INTO content_embeddings (
        chunk_type, chunk_text, embedding,
        itinerary_id, destination_id, property_id,
        destinations, properties, created_at, updated_at
      ) VALUES (
        $1, $2, $3::vector(3072),
        $4, $5, $6,
        $7, $8, NOW(), NOW()
      )`,
      [
        chunk.chunkType,
        chunk.text,
        `[${embedding.join(',')}]`,
        chunk.itineraryId ?? null,
        chunk.destinationId ?? null,
        chunk.propertyId ?? null,
        chunk.destinations ?? null,
        chunk.properties ?? null,
      ]
    )
  }
}

export async function embedAndInsertBatches(
  chunks: BootstrapChunk[],
  onProgress?: (batch: number, total: number) => void,
): Promise<void> {
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    if (onProgress) onProgress(batchNum, totalBatches)

    const texts = batch.map(c => c.text)
    const embeddings = await embedTextsWithRetry(texts)
    await insertEmbeddings(batch, embeddings)
  }
}

// --- ContentProject embedding (Phase 4) ---

export async function embedChunks(options: EmbedOptions): Promise<EmbeddingRecord[]> {
  const { chunks } = options
  if (chunks.length === 0) return []

  const batchSize = options.batchSize ?? BATCH_SIZE
  const records: EmbeddingRecord[] = []

  const totalBatches = Math.ceil(chunks.length / batchSize)
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    console.log(`Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)`)

    const texts = batch.map(c => c.text)
    const embeddings = await embedTextsWithRetry(texts)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const embedding = embeddings[j]

      const result = await query(
        `INSERT INTO content_embeddings (
          chunk_type, chunk_text, embedding,
          content_project_id, content_type,
          destinations, properties, species, freshness_category,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3::vector(3072),
          $4, $5,
          $6, $7, $8, $9,
          NOW(), NOW()
        ) RETURNING id, created_at, updated_at`,
        [
          chunk.chunkType,
          chunk.text,
          `[${embedding.join(',')}]`,
          chunk.sourceId ? parseInt(chunk.sourceId, 10) : null,
          chunk.metadata.contentType ?? null,
          chunk.metadata.destinations ?? null,
          chunk.metadata.properties ?? null,
          chunk.metadata.species ?? null,
          chunk.metadata.freshnessCategory ?? null,
        ]
      )

      const row = result.rows[0]
      records.push({
        id: row.id,
        chunkType: chunk.chunkType,
        chunkText: chunk.text,
        embedding,
        contentProjectId: chunk.sourceId ? parseInt(chunk.sourceId, 10) : undefined,
        contentType: chunk.metadata.contentType,
        destinations: chunk.metadata.destinations,
        properties: chunk.metadata.properties,
        species: chunk.metadata.species,
        freshnessCategory: chunk.metadata.freshnessCategory,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }
  }

  return records
}

export async function deleteProjectEmbeddings(contentProjectId: number): Promise<number> {
  const result = await query(
    'DELETE FROM content_embeddings WHERE content_project_id = $1',
    [contentProjectId]
  )
  return result.rowCount ?? 0
}
