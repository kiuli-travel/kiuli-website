'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

interface Segment {
  blockType: string
  reviewed?: boolean
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

const STATIC_CHECKLIST_ITEMS = [
  { key: 'allImagesProcessed', label: 'Images Processed' },
  { key: 'noFailedImages', label: 'No Failed Images' },
  { key: 'schemaGenerated', label: 'Schema Generated' },
  { key: 'tripTypesSelected', label: 'Trip Types Selected' },
]

interface ReviewItem {
  name: string
  reviewed: boolean
  category: 'core' | 'day' | 'segment' | 'faq'
  fieldId?: string // Used for scrolling to the field
}

function scrollToField(fieldId: string | undefined) {
  if (!fieldId) return
  // Try multiple strategies to find the field in Payload admin
  const selectors = [
    `[data-field-name="${fieldId}"]`,
    `[name="${fieldId}"]`,
    `#field-${fieldId}`,
    `[id*="${fieldId}"]`,
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Flash highlight
      const htmlEl = el as HTMLElement
      const prev = htmlEl.style.outline
      htmlEl.style.outline = '2px solid #DA7A5A'
      setTimeout(() => { htmlEl.style.outline = prev }, 2000)
      return
    }
  }
}

export const PublishChecklist: React.FC = () => {
  const form = useForm()
  const { id } = useDocumentInfo()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const reviewItems = useMemo<ReviewItem[]>(() => {
    if (!id || !form) return []
    const { getDataByPath } = form
    const items: ReviewItem[] = []

    // Core fields
    const coreFields = [
      { name: 'Title', path: 'titleReviewed', fieldId: 'title' },
      { name: 'Meta Title', path: 'metaTitleReviewed', fieldId: 'metaTitle' },
      { name: 'Meta Description', path: 'metaDescriptionReviewed', fieldId: 'metaDescription' },
      { name: 'Hero Image', path: 'heroImageReviewed', fieldId: 'heroImage' },
      { name: 'Why Kiuli', path: 'whyKiuliReviewed', fieldId: 'whyKiuli' },
    ]
    coreFields.forEach(({ name, path, fieldId }) => {
      items.push({ name, reviewed: Boolean(getDataByPath(path)), category: 'core', fieldId })
    })

    const overview = getDataByPath('overview') as Overview | undefined
    if (overview) {
      items.push({ name: 'Overview Summary', reviewed: Boolean(overview.summaryReviewed), category: 'core', fieldId: 'overview' })
    }

    const investmentLevel = getDataByPath('investmentLevel') as InvestmentLevel | undefined
    if (investmentLevel) {
      items.push({ name: 'Investment Includes', reviewed: Boolean(investmentLevel.includesReviewed), category: 'core', fieldId: 'investmentLevel' })
    }

    // Days and segments
    const days = (getDataByPath('days') || []) as Day[]
    days.forEach((day, dayIndex) => {
      const dayNum = day.dayNumber || dayIndex + 1
      items.push({ name: `Day ${dayNum} Title`, reviewed: Boolean(day.titleReviewed), category: 'day', fieldId: `days-row-${dayIndex}` })

      const segments = day.segments || []
      segments.forEach((segment, segIndex) => {
        const blockType = segment.blockType || 'segment'
        const blockLabel = blockType.charAt(0).toUpperCase() + blockType.slice(1)
        const prefix = `D${dayNum} ${blockLabel} ${segIndex + 1}`
        const fieldBase = `days-row-${dayIndex}-segments-row-${segIndex}`

        items.push({ name: `${prefix} Desc`, reviewed: Boolean(segment.descriptionReviewed), category: 'segment', fieldId: fieldBase })
        if (blockType === 'stay') {
          items.push({ name: `${prefix} Name`, reviewed: Boolean(segment.accommodationNameReviewed), category: 'segment', fieldId: fieldBase })
          items.push({ name: `${prefix} Incl`, reviewed: Boolean(segment.inclusionsReviewed), category: 'segment', fieldId: fieldBase })
        }
        if (blockType === 'activity' || blockType === 'transfer') {
          items.push({ name: `${prefix} Title`, reviewed: Boolean(segment.titleReviewed), category: 'segment', fieldId: fieldBase })
        }
      })
    })

    // FAQ
    const faqItems = (getDataByPath('faqItems') || []) as FaqItem[]
    faqItems.forEach((faq, faqIndex) => {
      items.push({
        name: `FAQ ${faqIndex + 1}`,
        reviewed: Boolean(faq.questionReviewed) && Boolean(faq.answerReviewed),
        category: 'faq',
        fieldId: `faqItems-row-${faqIndex}`,
      })
    })

    return items
  }, [form, id])

  if (!id || !form) {
    return <div style={{ padding: '0.75rem', color: '#666', fontSize: '0.8rem' }}>Save to see checklist.</div>
  }

  const { getDataByPath } = form
  const publishChecklist = (getDataByPath('publishChecklist') || {}) as Record<string, boolean>
  const publishBlockers = (getDataByPath('publishBlockers') || []) as Array<{ reason: string; severity: string }>

  const totalReviewItems = reviewItems.length
  const reviewedCount = reviewItems.filter(i => i.reviewed).length
  const reviewPercentage = totalReviewItems > 0 ? Math.round((reviewedCount / totalReviewItems) * 100) : 100

  const coreItems = reviewItems.filter(i => i.category === 'core')
  const dayItems = reviewItems.filter(i => i.category === 'day')
  const segmentItems = reviewItems.filter(i => i.category === 'segment')
  const faqItemsReview = reviewItems.filter(i => i.category === 'faq')

  const allStaticPassed = STATIC_CHECKLIST_ITEMS.every(item => publishChecklist[item.key] === true)
  const allReviewed = reviewedCount === totalReviewItems

  const renderSection = (key: string, title: string, items: ReviewItem[]) => {
    if (items.length === 0) return null
    const reviewed = items.filter(i => i.reviewed).length
    const total = items.length
    const unreviewedItems = items.filter(i => !i.reviewed)
    const isComplete = reviewed === total
    const isExpanded = expandedSections[key] ?? false

    return (
      <div key={key} style={{ borderBottom: '1px solid #eee' }}>
        <button
          onClick={() => toggleSection(key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '6px 8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#444',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.65rem', color: '#999' }}>{isExpanded ? '▼' : '▶'}</span>
            {title}
            {!isComplete && (
              <span style={{
                background: '#f8d7da',
                color: '#721c24',
                padding: '1px 6px',
                borderRadius: '8px',
                fontSize: '0.65rem',
                fontWeight: 500,
              }}>
                {total - reviewed} left
              </span>
            )}
          </span>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 500,
            color: isComplete ? '#155724' : '#856404',
          }}>
            {reviewed}/{total}
          </span>
        </button>

        {isExpanded && (
          <div style={{ padding: '0 8px 6px' }}>
            {/* Show unreviewed first, then reviewed */}
            {unreviewedItems.map((item, i) => (
              <button
                key={`unrev-${i}`}
                onClick={() => scrollToField(item.fieldId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  marginBottom: '1px',
                  background: '#f8d7da',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '0.7rem',
                  color: '#721c24',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
                title="Click to scroll to field"
              >
                <span>○</span>
                <span>{item.name}</span>
              </button>
            ))}
            {items.filter(i => i.reviewed).map((item, i) => (
              <button
                key={`rev-${i}`}
                onClick={() => scrollToField(item.fieldId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  marginBottom: '1px',
                  background: '#d4edda',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '0.7rem',
                  color: '#155724',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
                title="Click to scroll to field"
              >
                <span>✓</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px',
      backgroundColor: '#f8f9fa',
      borderRadius: '6px',
      border: '1px solid #e0e0e0',
      fontSize: '0.8rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <span style={{ fontWeight: 600, color: '#333', fontSize: '0.85rem' }}>
          Review Checklist
        </span>
        <span style={{
          background: allReviewed ? '#d4edda' : '#fff3cd',
          color: allReviewed ? '#155724' : '#856404',
          padding: '1px 8px',
          borderRadius: '10px',
          fontSize: '0.7rem',
          fontWeight: 500,
        }}>
          {reviewPercentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        background: '#e0e0e0',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <div style={{
          height: '100%',
          width: `${reviewPercentage}%`,
          background: allReviewed ? '#28a745' : '#486A6A',
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Compact summary */}
      <div style={{
        fontSize: '0.7rem',
        color: '#666',
        marginBottom: '6px',
        display: 'flex',
        gap: '8px',
      }}>
        <span>{reviewedCount}/{totalReviewItems} reviewed</span>
        {!allReviewed && (
          <span style={{ color: '#721c24' }}>
            {totalReviewItems - reviewedCount} remaining
          </span>
        )}
      </div>

      {/* Accordion sections */}
      <div style={{ border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden', background: '#fff' }}>
        {renderSection('core', 'Core Fields', coreItems)}
        {renderSection('days', 'Day Titles', dayItems)}
        {renderSection('segments', `Segments (${segmentItems.filter(i => !i.reviewed).length} unreviewed)`, segmentItems)}
        {renderSection('faqs', 'FAQs', faqItemsReview)}
      </div>

      {/* Pipeline checks — compact */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#666', marginBottom: '4px' }}>Pipeline</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {STATIC_CHECKLIST_ITEMS.map(item => {
            const passed = publishChecklist[item.key] === true
            return (
              <span key={item.key} style={{
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '0.65rem',
                fontWeight: 500,
                background: passed ? '#d4edda' : '#f8d7da',
                color: passed ? '#155724' : '#721c24',
              }}>
                {passed ? '✓' : '✗'} {item.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Blockers */}
      {publishBlockers.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          {publishBlockers.map((b, i) => (
            <div key={i} style={{
              padding: '3px 6px',
              marginBottom: '2px',
              background: b.severity === 'error' ? '#f8d7da' : '#fff3cd',
              borderRadius: '3px',
              fontSize: '0.7rem',
              color: b.severity === 'error' ? '#721c24' : '#856404',
            }}>
              {b.severity === 'error' ? '⚠' : 'ℹ'} {b.reason}
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      <div style={{
        marginTop: '6px',
        padding: '4px 8px',
        borderRadius: '3px',
        fontSize: '0.7rem',
        background: allReviewed ? '#d4edda' : '#fff3cd',
        color: allReviewed ? '#155724' : '#856404',
      }}>
        {allReviewed
          ? `✓ All reviewed. ${allStaticPassed ? 'Ready to publish.' : 'Complete pipeline checks.'}`
          : `${totalReviewItems - reviewedCount} item${totalReviewItems - reviewedCount !== 1 ? 's' : ''} need review.`
        }
      </div>
    </div>
  )
}
