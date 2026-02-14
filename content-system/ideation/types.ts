export interface RawCandidate {
  title: string
  contentType: 'itinerary_cluster' | 'authority'
  briefSummary: string
  targetAngle: string
  targetAudience: ('customer' | 'professional' | 'guide')[]
  destinations: string[]
  properties: string[]
  species: string[]
  freshnessCategory: 'monthly' | 'quarterly' | 'annual' | 'evergreen'
  competitiveNotes: string
}

export interface FilteredCandidate extends RawCandidate {
  passed: boolean
  filterReason?: string
  directivesMatched: string[]
  duplicateScore: number
  duplicateTitle?: string
}
