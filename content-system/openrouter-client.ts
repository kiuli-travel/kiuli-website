export interface OpenRouterRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface OpenRouterResponse {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export declare function callOpenRouter(request: OpenRouterRequest): Promise<OpenRouterResponse>
