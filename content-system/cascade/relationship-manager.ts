import type { RelationshipVerification } from './types'

export declare function verifyRelationships(
  itineraryId: string,
  destinationIds: string[],
  propertyIds: string[],
): Promise<RelationshipVerification[]>
