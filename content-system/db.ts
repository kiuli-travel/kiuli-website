import { Pool, type QueryResult } from 'pg'

// --- Unpooled pg connection for vector operations ---
// Uses DATABASE_URL_UNPOOLED to bypass Neon's connection pooler.
// Payload uses its own managed connection via POSTGRES_URL — this supplements it.

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL_UNPOOLED,
      max: 3,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return getPool().query(text, params)
}

export async function end(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// --- Payload API type declarations (used by other content-system modules) ---

export interface PayloadQueryOptions {
  collection: string
  where?: Record<string, unknown>
  limit?: number
  page?: number
  sort?: string
  depth?: number
}

export interface PayloadQueryResult<T = Record<string, unknown>> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  hasNextPage: boolean
}

export declare function payloadQuery<T = Record<string, unknown>>(options: PayloadQueryOptions): Promise<PayloadQueryResult<T>>

export declare function findById<T = Record<string, unknown>>(collection: string, id: string, depth?: number): Promise<T | null>

export declare function create<T = Record<string, unknown>>(collection: string, data: Record<string, unknown>): Promise<T>

export declare function update<T = Record<string, unknown>>(collection: string, id: string, data: Record<string, unknown>): Promise<T>

export declare function getGlobal<T = Record<string, unknown>>(slug: string): Promise<T>
