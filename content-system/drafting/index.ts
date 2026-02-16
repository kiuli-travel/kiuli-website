import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { draftArticle } from './article-drafter'
import { draftDestinationPage } from './destination-page-drafter'
import { draftPropertyPage } from './property-page-drafter'
import { enhanceSegment } from './segment-enhancer'
import { generateSocialSummaries } from './social-summariser'

const ARTICLE_TYPES = ['itinerary_cluster', 'authority', 'designer_insight']

export async function dispatchDraft(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  const contentType = project.contentType as string

  if (ARTICLE_TYPES.includes(contentType)) {
    await draftArticle(projectId)
    // Generate social summaries after article draft completes
    await generateSocialSummaries(projectId)
  } else if (contentType === 'destination_page') {
    await draftDestinationPage(projectId)
  } else if (contentType === 'property_page') {
    await draftPropertyPage(projectId)
  } else if (contentType === 'itinerary_enhancement') {
    await enhanceSegment(projectId)
  } else {
    throw new Error(`No drafter available for contentType: ${contentType}`)
  }
}
