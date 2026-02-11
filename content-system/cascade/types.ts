export interface EntityMap {
  destinations: DestinationEntity[]
  properties: PropertyEntity[]
  species: string[]
  activities: string[]
}

export interface DestinationEntity {
  name: string
  country: string
  aliases: string[]
  confidence: number
}

export interface PropertyEntity {
  name: string
  destination: string
  aliases: string[]
  confidence: number
}

export interface CascadeResult {
  itineraryId: string
  entitiesExtracted: EntityMap
  destinationsResolved: DestinationResolution[]
  propertiesResolved: PropertyResolution[]
  relationshipsVerified: RelationshipVerification[]
  projectsCreated: string[]
  errors: CascadeError[]
}

export interface DestinationResolution {
  extractedName: string
  canonicalName: string | null
  payloadId: string | null
  created: boolean
  confidence: number
}

export interface PropertyResolution {
  extractedName: string
  canonicalName: string | null
  payloadId: string | null
  destinationId: string | null
  created: boolean
  confidence: number
}

export interface RelationshipVerification {
  sourceCollection: string
  sourceId: string
  targetCollection: string
  targetId: string
  relationshipField: string
  existed: boolean
  created: boolean
}

export interface CascadeError {
  step: string
  entity: string
  message: string
}

export interface CascadeOptions {
  itineraryId: string
  dryRun?: boolean
  skipRelationships?: boolean
}
