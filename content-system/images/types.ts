// ── Image Library Types ──────────────────────────────────────────────────────

// === Search Types ===

export interface LibrarySearchOptions {
  country?: string | string[]
  imageType?: string | string[]
  composition?: string | string[]
  mood?: string | string[]
  timeOfDay?: string | string[]
  setting?: string | string[]
  suitableFor?: string | string[]
  quality?: string
  isHero?: boolean
  species?: string[]
  properties?: string[]
  query?: string
  source?: 'scraped' | 'generated' | 'all'
  excludeIds?: number[]
  limit?: number
}

export interface LibraryMatch {
  mediaId: number
  url: string
  imgixUrl: string | null
  thumbnailUrl: string | null
  alt: string
  altText: string | null
  country: string | null
  imageType: string | null
  composition: string | null
  animals: string[]
  tags: string[]
  scene: string | null
  sourceProperty: string | null
  isHero: boolean
  quality: string | null
  mood: string[]
  timeOfDay: string | null
  suitableFor: string[]
  setting: string[]
  width: number | null
  height: number | null
  source: 'scraped' | 'generated'
  score: number
  generationPrompt?: string | null
  generationModel?: string | null
  generatedAt?: string | null
}

export interface LibrarySearchResult {
  matches: LibraryMatch[]
  total: number
  facets: {
    countries: Array<{ value: string; count: number }>
    imageTypes: Array<{ value: string; count: number }>
    species: Array<{ value: string; count: number }>
    properties: Array<{ value: string; count: number }>
  }
}

// === Prompt Generation Types ===

export type GeneratableImageType = 'wildlife' | 'landscape' | 'destination' | 'country'

export interface PhotographicSubject {
  type: GeneratableImageType
  species?: string
  destination?: string
  country?: string
  mood?: string
  timeOfDay?: string
  description?: string
}

export interface PhotographicPrompt {
  prompt: string
  intent: string
  aspectRatio: string
  cameraSpec: string
}

// === Image Generation Types ===

export interface ImageGenerationOptions {
  model?: string
  aspectRatio?: string
  imageSize?: string
}

export interface ImageGenerationResult {
  imageBase64: string
  model: string
  prompt: string
}

// === Upload Types ===

export interface UploadMetadata {
  type: GeneratableImageType
  species?: string[]
  country?: string
  destination?: string
  prompt: string
  aspectRatio?: string
  model?: string
}

export interface UploadResult {
  mediaId: number
  imgixUrl: string
}

// === Property Guard ===

const PROPERTY_TYPES = new Set([
  'accommodation',
  'room',
  'dining',
  'spa',
  'lodge-interior',
  'lodge-exterior',
  'pool-deck',
  'bedroom',
])

export function isPropertyType(type: string): boolean {
  return PROPERTY_TYPES.has(type.toLowerCase())
}

export const PROPERTY_GUARD_MESSAGE =
  'Property images cannot be generated. Only scraped property images are used to ensure accuracy. Generate wildlife, landscape, destination, or country images instead.'
