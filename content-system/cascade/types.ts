/**
 * Type definitions for the Itinerary Cascade pipeline.
 * All IDs are number (Payload auto-increment).
 */

// --- Entity extraction types ---

export interface CountryEntity {
  name: string
  normalized: string
}

export interface LocationEntity {
  name: string
  normalized: string
  country: string
}

export interface PropertyEntity {
  name: string
  normalized: string
  location: string
  country: string
  existingPropertyId: number | null
}

export interface EntityMap {
  countries: CountryEntity[]
  locations: LocationEntity[]
  properties: PropertyEntity[]
  activities: string[]
}

// --- Resolution types ---

export interface ResolutionResult {
  entityName: string
  entityType: 'country' | 'destination' | 'property'
  action: 'found' | 'created' | 'skipped'
  payloadId: number | null
  collection: string
  note?: string
}

// --- Relationship types ---

export interface RelationshipAction {
  sourceCollection: string
  sourceId: number
  field: string
  targetCollection: string
  addedIds: number[]
  action: 'updated' | 'already_current' | 'skipped'
}

// --- ContentProject types ---

export interface ContentProjectAction {
  targetCollection: string
  targetRecordId: number
  action: 'created' | 'already_exists'
  contentProjectId?: number
}

// --- Step result ---

export interface CascadeStepResult {
  step: number
  name: string
  status: 'completed' | 'failed'
  duration: number
  detail: unknown
}

// --- Overall cascade result ---

export interface CascadeResult {
  itineraryId: number
  dryRun: boolean
  steps: CascadeStepResult[]
  entities: EntityMap | null
  resolutions: ResolutionResult[]
  relationships: RelationshipAction[]
  contentProjects: ContentProjectAction[]
  error?: string
}

// --- Options ---

export interface CascadeOptions {
  itineraryId: number
  dryRun?: boolean
  jobId?: number
}
