'use client'

import React, { useMemo } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

interface ChecklistItem {
  key: string
  label: string
  description: string
}

interface Segment {
  blockType: string
  reviewed?: boolean
  // V7 per-field review flags
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
  reviewed?: boolean
  questionReviewed?: boolean
  answerReviewed?: boolean
}

interface Overview {
  summaryReviewed?: boolean
}

interface InvestmentLevel {
  includesReviewed?: boolean
}

const STATIC_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'allImagesProcessed',
    label: 'Images Processed',
    description: 'All images have been processed and uploaded',
  },
  {
    key: 'noFailedImages',
    label: 'No Failed Images',
    description: 'No images in failed state',
  },
  {
    key: 'schemaGenerated',
    label: 'Schema Generated',
    description: 'JSON-LD schema has been generated',
  },
  {
    key: 'tripTypesSelected',
    label: 'Trip Types Selected',
    description: 'At least one trip type has been selected',
  },
]

interface ReviewItem {
  name: string
  reviewed: boolean
  category: 'core' | 'day' | 'segment' | 'faq'
}

export const PublishChecklist: React.FC = () => {
  const { getDataByPath } = useForm()
  const { id } = useDocumentInfo()

  const publishChecklist = (getDataByPath('publishChecklist') || {}) as Record<string, boolean>
  const publishBlockers = (getDataByPath('publishBlockers') || []) as Array<{
    reason: string
    severity: string
  }>

  // Build review items for V7 per-field tracking
  const reviewItems = useMemo<ReviewItem[]>(() => {
    // If no ID, return empty array (hooks must be called unconditionally)
    if (!id) return []
    const items: ReviewItem[] = []

    // Core fields
    const coreFields = [
      { name: 'Title', path: 'titleReviewed' },
      { name: 'Meta Title', path: 'metaTitleReviewed' },
      { name: 'Meta Description', path: 'metaDescriptionReviewed' },
      { name: 'Hero Image', path: 'heroImageReviewed' },
      { name: 'Why Kiuli', path: 'whyKiuliReviewed' },
    ]

    coreFields.forEach(({ name, path }) => {
      const value = getDataByPath(path)
      items.push({
        name,
        reviewed: Boolean(value),
        category: 'core',
      })
    })

    // Overview summary
    const overview = getDataByPath('overview') as Overview | undefined
    if (overview) {
      items.push({
        name: 'Overview Summary',
        reviewed: Boolean(overview.summaryReviewed),
        category: 'core',
      })
    }

    // Investment includes
    const investmentLevel = getDataByPath('investmentLevel') as InvestmentLevel | undefined
    if (investmentLevel) {
      items.push({
        name: 'Investment Includes',
        reviewed: Boolean(investmentLevel.includesReviewed),
        category: 'core',
      })
    }

    // Days and segments
    const days = (getDataByPath('days') || []) as Day[]
    days.forEach((day, dayIndex) => {
      const dayNum = day.dayNumber || dayIndex + 1

      // Day title
      items.push({
        name: `Day ${dayNum} Title`,
        reviewed: Boolean(day.titleReviewed),
        category: 'day',
      })

      // Segments
      const segments = day.segments || []
      segments.forEach((segment, segIndex) => {
        const segNum = segIndex + 1
        const blockType = segment.blockType || 'segment'
        const blockLabel = blockType.charAt(0).toUpperCase() + blockType.slice(1)

        // All segments have description
        items.push({
          name: `Day ${dayNum} ${blockLabel} ${segNum} Description`,
          reviewed: Boolean(segment.descriptionReviewed),
          category: 'segment',
        })

        // Stay-specific fields
        if (blockType === 'stay') {
          items.push({
            name: `Day ${dayNum} ${blockLabel} ${segNum} Name`,
            reviewed: Boolean(segment.accommodationNameReviewed),
            category: 'segment',
          })
          items.push({
            name: `Day ${dayNum} ${blockLabel} ${segNum} Inclusions`,
            reviewed: Boolean(segment.inclusionsReviewed),
            category: 'segment',
          })
        }

        // Activity and Transfer have title
        if (blockType === 'activity' || blockType === 'transfer') {
          items.push({
            name: `Day ${dayNum} ${blockLabel} ${segNum} Title`,
            reviewed: Boolean(segment.titleReviewed),
            category: 'segment',
          })
        }

        // Images reviewed (all segment types)
        if (segment.imagesReviewed !== undefined) {
          items.push({
            name: `Day ${dayNum} ${blockLabel} ${segNum} Images`,
            reviewed: Boolean(segment.imagesReviewed),
            category: 'segment',
          })
        }
      })
    })

    // FAQ items
    const faqItems = (getDataByPath('faqItems') || []) as FaqItem[]
    faqItems.forEach((faq, faqIndex) => {
      const faqNum = faqIndex + 1
      // FAQ is reviewed only if both question AND answer are reviewed
      const faqReviewed = Boolean(faq.questionReviewed) && Boolean(faq.answerReviewed)
      items.push({
        name: `FAQ ${faqNum}`,
        reviewed: faqReviewed,
        category: 'faq',
      })
    })

    return items
  }, [getDataByPath, id])

  // Only show for saved documents (after all hooks are called)
  if (!id) {
    return (
      <div style={{ padding: '1rem', color: '#666', fontSize: '0.875rem' }}>
        Save the itinerary to see the publish checklist.
      </div>
    )
  }

  // Calculate stats
  const totalReviewItems = reviewItems.length
  const reviewedCount = reviewItems.filter((i) => i.reviewed).length
  const reviewPercentage = totalReviewItems > 0 ? Math.round((reviewedCount / totalReviewItems) * 100) : 100

  // Group by category
  const coreItems = reviewItems.filter((i) => i.category === 'core')
  const dayItems = reviewItems.filter((i) => i.category === 'day')
  const segmentItems = reviewItems.filter((i) => i.category === 'segment')
  const faqItemsReview = reviewItems.filter((i) => i.category === 'faq')

  // Check static items
  const allStaticPassed = STATIC_CHECKLIST_ITEMS.every((item) => publishChecklist[item.key] === true)
  const allReviewed = reviewedCount === totalReviewItems
  const allPassed = allStaticPassed && allReviewed

  const renderReviewSection = (title: string, items: ReviewItem[]) => {
    if (items.length === 0) return null
    const sectionReviewed = items.filter((i) => i.reviewed).length
    const sectionTotal = items.length

    return (
      <div style={{ marginBottom: '0.75rem' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#666',
            marginBottom: '0.25rem',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{title}</span>
          <span
            style={{
              color: sectionReviewed === sectionTotal ? '#155724' : '#856404',
            }}
          >
            {sectionReviewed}/{sectionTotal}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: item.reviewed ? '#d4edda' : '#f8d7da',
                borderRadius: '3px',
                fontSize: '0.75rem',
              }}
            >
              <span style={{ color: item.reviewed ? '#155724' : '#721c24' }}>
                {item.reviewed ? '✓' : '○'}
              </span>
              <span style={{ color: item.reviewed ? '#155724' : '#721c24' }}>{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      }}
    >
      <h4
        style={{
          margin: '0 0 0.75rem 0',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>Publish Checklist</span>
        {allPassed ? (
          <span
            style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            Ready
          </span>
        ) : (
          <span
            style={{
              backgroundColor: '#fff3cd',
              color: '#856404',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            Not Ready
          </span>
        )}
      </h4>

      {/* Progress bar */}
      <div
        style={{
          height: '8px',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '0.75rem',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${reviewPercentage}%`,
            backgroundColor: allReviewed ? '#28a745' : '#486A6A',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div
        style={{
          fontSize: '0.875rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Content Review Progress</span>
        <span
          style={{
            fontWeight: 600,
            color: allReviewed ? '#155724' : '#856404',
          }}
        >
          {reviewedCount}/{totalReviewItems} ({reviewPercentage}%)
        </span>
      </div>

      {/* Review sections */}
      {renderReviewSection('Core Fields', coreItems)}
      {renderReviewSection('Day Titles', dayItems)}
      {renderReviewSection('Segments', segmentItems)}
      {renderReviewSection('FAQs', faqItemsReview)}

      {/* Static checklist items */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#666',
            marginBottom: '0.5rem',
          }}
        >
          Pipeline Checks
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {STATIC_CHECKLIST_ITEMS.map((item) => {
            const passed = publishChecklist[item.key] === true
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: passed ? '#d4edda' : '#f8d7da',
                  borderRadius: '4px',
                  border: `1px solid ${passed ? '#c3e6cb' : '#f5c6cb'}`,
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    width: '20px',
                    textAlign: 'center',
                    color: passed ? '#155724' : '#721c24',
                  }}
                >
                  {passed ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: passed ? '#155724' : '#721c24',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: passed ? '#155724' : '#721c24',
                      opacity: 0.8,
                    }}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {publishBlockers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h5
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#721c24',
            }}
          >
            Blockers
          </h5>
          {publishBlockers.map((blocker, index) => (
            <div
              key={index}
              style={{
                padding: '0.5rem',
                marginBottom: '0.25rem',
                backgroundColor: blocker.severity === 'error' ? '#f8d7da' : '#fff3cd',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: blocker.severity === 'error' ? '#721c24' : '#856404',
              }}
            >
              {blocker.severity === 'error' ? '⚠' : 'ℹ'} {blocker.reason}
            </div>
          ))}
        </div>
      )}

      {allReviewed ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#155724',
            border: '1px solid #28a745',
          }}
        >
          ✓ All content reviewed!{' '}
          {allStaticPassed ? 'Ready to publish.' : 'Complete pipeline checks to publish.'}
        </div>
      ) : (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#856404',
          }}
        >
          ⚠ {totalReviewItems - reviewedCount} item{totalReviewItems - reviewedCount !== 1 ? 's' : ''}{' '}
          need review before publishing.
        </div>
      )}
    </div>
  )
}
