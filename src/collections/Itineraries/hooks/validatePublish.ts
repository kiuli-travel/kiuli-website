import type { CollectionBeforeChangeHook } from 'payload'

interface Segment {
  blockType: string
  descriptionReviewed?: boolean
  accommodationNameReviewed?: boolean
  inclusionsReviewed?: boolean
  titleReviewed?: boolean
  imagesReviewed?: boolean
}

interface Day {
  dayNumber?: number
  titleReviewed?: boolean
  segments?: Segment[]
}

interface FaqItem {
  questionReviewed?: boolean
  answerReviewed?: boolean
}

interface Overview {
  summaryReviewed?: boolean
}

interface InvestmentLevel {
  includesReviewed?: boolean
}

interface ItineraryData {
  _status?: string
  titleReviewed?: boolean
  metaTitleReviewed?: boolean
  metaDescriptionReviewed?: boolean
  heroImageReviewed?: boolean
  whyKiuliReviewed?: boolean
  overview?: Overview
  investmentLevel?: InvestmentLevel
  days?: Day[]
  faqItems?: FaqItem[]
  publishChecklist?: Record<string, boolean>
}

/**
 * Validate that all content is reviewed before publishing.
 * Blocks status change to 'published' if any required reviews are missing.
 */
export const validatePublish: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}) => {
  const typedData = data as ItineraryData

  // Only validate when changing to published status
  const isPublishing =
    typedData._status === 'published' &&
    (operation === 'create' || (operation === 'update' && originalDoc?._status !== 'published'))

  if (!isPublishing) {
    return data
  }

  const blockers: string[] = []

  // Check core field reviews
  if (!typedData.titleReviewed) {
    blockers.push('Title not reviewed')
  }
  if (!typedData.metaTitleReviewed) {
    blockers.push('Meta title not reviewed')
  }
  if (!typedData.metaDescriptionReviewed) {
    blockers.push('Meta description not reviewed')
  }
  if (!typedData.heroImageReviewed) {
    blockers.push('Hero image not reviewed')
  }

  // Check overview summary
  if (typedData.overview && !typedData.overview.summaryReviewed) {
    blockers.push('Overview summary not reviewed')
  }

  // Check investment includes
  if (typedData.investmentLevel && !typedData.investmentLevel.includesReviewed) {
    blockers.push('Investment includes not reviewed')
  }

  // Check days and segments
  typedData.days?.forEach((day, dayIndex) => {
    const dayNum = day.dayNumber || dayIndex + 1

    if (!day.titleReviewed) {
      blockers.push(`Day ${dayNum} title not reviewed`)
    }

    day.segments?.forEach((segment, segIndex) => {
      const segNum = segIndex + 1
      const blockType = segment.blockType || 'segment'

      // All segments need description reviewed
      if (!segment.descriptionReviewed) {
        blockers.push(`Day ${dayNum} ${blockType} ${segNum} description not reviewed`)
      }

      // Stay-specific fields
      if (blockType === 'stay') {
        if (!segment.accommodationNameReviewed) {
          blockers.push(`Day ${dayNum} stay ${segNum} name not reviewed`)
        }
        if (!segment.inclusionsReviewed) {
          blockers.push(`Day ${dayNum} stay ${segNum} inclusions not reviewed`)
        }
      }

      // Activity and transfer title
      if ((blockType === 'activity' || blockType === 'transfer') && !segment.titleReviewed) {
        blockers.push(`Day ${dayNum} ${blockType} ${segNum} title not reviewed`)
      }
    })
  })

  // Check FAQ items
  typedData.faqItems?.forEach((faq, faqIndex) => {
    const faqNum = faqIndex + 1
    if (!faq.questionReviewed) {
      blockers.push(`FAQ ${faqNum} question not reviewed`)
    }
    if (!faq.answerReviewed) {
      blockers.push(`FAQ ${faqNum} answer not reviewed`)
    }
  })

  // Check pipeline checklist items
  const checklist = typedData.publishChecklist || {}
  if (!checklist.allImagesProcessed) {
    blockers.push('Not all images processed')
  }
  if (!checklist.noFailedImages) {
    blockers.push('Some images failed processing')
  }
  if (!checklist.schemaGenerated) {
    blockers.push('Schema not generated')
  }
  if (!checklist.tripTypesSelected) {
    blockers.push('No trip types selected')
  }

  // If blockers exist, throw error to prevent publish
  if (blockers.length > 0) {
    const maxBlockersToShow = 5
    const blockerList =
      blockers.length > maxBlockersToShow
        ? blockers.slice(0, maxBlockersToShow).join(', ') +
          `, and ${blockers.length - maxBlockersToShow} more`
        : blockers.join(', ')

    throw new Error(`Cannot publish: ${blockerList}. Review all content before publishing.`)
  }

  return data
}
