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

export declare function query<T = Record<string, unknown>>(options: PayloadQueryOptions): Promise<PayloadQueryResult<T>>

export declare function findById<T = Record<string, unknown>>(collection: string, id: string, depth?: number): Promise<T | null>

export declare function create<T = Record<string, unknown>>(collection: string, data: Record<string, unknown>): Promise<T>

export declare function update<T = Record<string, unknown>>(collection: string, id: string, data: Record<string, unknown>): Promise<T>

export declare function getGlobal<T = Record<string, unknown>>(slug: string): Promise<T>
