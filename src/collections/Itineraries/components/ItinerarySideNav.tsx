'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

interface Segment {
  id?: string
  blockType: 'stay' | 'activity' | 'transfer'
  accommodationName?: string
  title?: string
  type?: string
  from?: string
  to?: string
}

interface Day {
  id?: string
  dayNumber: number
  title?: string
  location?: string
  segments?: Segment[]
}

/**
 * Side navigation for itinerary editor.
 * Shows collapsible day list with segments for quick navigation.
 */
export const ItinerarySideNav: React.FC = () => {
  const { id } = useDocumentInfo()
  const form = useForm()
  const [days, setDays] = useState<Day[]>([])
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Fetch days data from form
  const refreshDays = useCallback(() => {
    if (!form) return
    const daysData = form.getDataByPath('days') as Day[] | undefined
    if (daysData && Array.isArray(daysData)) {
      setDays(daysData)
      // Expand first 3 days by default
      const initialExpanded = new Set<number>()
      daysData.slice(0, 3).forEach((_, index) => initialExpanded.add(index))
      if (expandedDays.size === 0) {
        setExpandedDays(initialExpanded)
      }
    }
  }, [form, expandedDays.size])

  useEffect(() => {
    refreshDays()
    // Refresh on interval to catch form changes
    const interval = setInterval(refreshDays, 2000)
    return () => clearInterval(interval)
  }, [refreshDays])

  // Scroll position tracking for active section highlight
  useEffect(() => {
    const handleScroll = () => {
      // Find day/segment sections based on Payload's row structure
      const dayRows = document.querySelectorAll('[data-row-field="days"] > .array-field__draggable-rows > div')

      let closestSection: string | null = null
      let closestDistance = Infinity
      const viewportTop = window.scrollY + 100 // Offset for header

      dayRows.forEach((row, dayIndex) => {
        const rect = row.getBoundingClientRect()
        const absoluteTop = rect.top + window.scrollY
        const distance = Math.abs(absoluteTop - viewportTop)

        if (distance < closestDistance && rect.top < window.innerHeight / 2) {
          closestDistance = distance
          closestSection = `day-${dayIndex}`
        }

        // Check segments within this day
        const segmentRows = row.querySelectorAll('[data-row-field="segments"] > .blocks-field__rows > div')
        segmentRows.forEach((segRow, segIndex) => {
          const segRect = segRow.getBoundingClientRect()
          const segAbsoluteTop = segRect.top + window.scrollY
          const segDistance = Math.abs(segAbsoluteTop - viewportTop)

          if (segDistance < closestDistance && segRect.top < window.innerHeight / 2) {
            closestDistance = segDistance
            closestSection = `day-${dayIndex}-seg-${segIndex}`
          }
        })
      })

      setActiveSection(closestSection)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Don't render if no document or no form context (e.g., on list view)
  if (!id || !form) {
    return null
  }

  const toggleDay = (dayIndex: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dayIndex)) {
        next.delete(dayIndex)
      } else {
        next.add(dayIndex)
      }
      return next
    })
  }

  const scrollToDay = (dayIndex: number) => {
    const dayRows = document.querySelectorAll('[data-row-field="days"] > .array-field__draggable-rows > div')
    const targetRow = dayRows[dayIndex]
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Expand this day
      setExpandedDays(prev => new Set(prev).add(dayIndex))
    }
  }

  const scrollToSegment = (dayIndex: number, segmentIndex: number) => {
    const dayRows = document.querySelectorAll('[data-row-field="days"] > .array-field__draggable-rows > div')
    const dayRow = dayRows[dayIndex]
    if (dayRow) {
      const segmentRows = dayRow.querySelectorAll('[data-row-field="segments"] > .blocks-field__rows > div')
      const targetSegment = segmentRows[segmentIndex]
      if (targetSegment) {
        targetSegment.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  const getSegmentIcon = (blockType: string) => {
    switch (blockType) {
      case 'stay':
        return '🏨'
      case 'activity':
        return '🎯'
      case 'transfer':
        return '✈️'
      default:
        return '📍'
    }
  }

  const getSegmentLabel = (segment: Segment): string => {
    switch (segment.blockType) {
      case 'stay':
        return segment.accommodationName || 'Stay'
      case 'activity':
        return segment.title || 'Activity'
      case 'transfer':
        if (segment.from && segment.to) {
          return `${segment.from} → ${segment.to}`
        }
        return segment.title || segment.type || 'Transfer'
      default:
        return 'Segment'
    }
  }

  // Don't render if no document or no days
  if (!id || days.length === 0) {
    return null
  }

  if (isCollapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '80px',
          left: '10px',
          zIndex: 100,
          backgroundColor: '#fff',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '8px',
          cursor: 'pointer',
        }}
        onClick={() => setIsCollapsed(false)}
        title="Expand navigation"
      >
        <span style={{ fontSize: '1rem' }}>📋</span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '10px',
        width: '220px',
        maxHeight: 'calc(100vh - 100px)',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        zIndex: 100,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#333' }}>
          Days ({days.length})
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#666',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          title="Collapse navigation"
        >
          ×
        </button>
      </div>

      {/* Scrollable days list */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '8px 0',
        }}
      >
        {days.map((day, dayIndex) => {
          const isExpanded = expandedDays.has(dayIndex)
          const isDayActive = activeSection === `day-${dayIndex}` ||
            (activeSection?.startsWith(`day-${dayIndex}-`) ?? false)
          const segments = day.segments || []

          return (
            <div key={day.id || dayIndex} style={{ marginBottom: '2px' }}>
              {/* Day header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  backgroundColor: isDayActive ? '#e8f4ff' : 'transparent',
                  borderLeft: isDayActive ? '3px solid #007bff' : '3px solid transparent',
                  transition: 'background-color 0.15s',
                }}
                onClick={() => scrollToDay(dayIndex)}
              >
                {/* Expand/collapse toggle */}
                {segments.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDay(dayIndex)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 4px 0 0',
                      fontSize: '0.625rem',
                      color: '#666',
                      width: '16px',
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                )}
                {segments.length === 0 && <span style={{ width: '16px' }} />}

                {/* Day info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Day {day.dayNumber}
                  </div>
                  {day.title && (
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: '#666',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {day.title}
                    </div>
                  )}
                </div>

                {/* Segment count badge */}
                {segments.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      color: '#999',
                      backgroundColor: '#f0f0f0',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      marginLeft: '4px',
                    }}
                  >
                    {segments.length}
                  </span>
                )}
              </div>

              {/* Segments list (collapsed/expanded) */}
              {isExpanded && segments.length > 0 && (
                <div style={{ paddingLeft: '20px' }}>
                  {segments.map((segment, segIndex) => {
                    const isSegmentActive = activeSection === `day-${dayIndex}-seg-${segIndex}`
                    return (
                      <div
                        key={segment.id || segIndex}
                        onClick={() => scrollToSegment(dayIndex, segIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          backgroundColor: isSegmentActive ? '#e8f4ff' : 'transparent',
                          borderLeft: isSegmentActive ? '2px solid #007bff' : '2px solid transparent',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem' }}>{getSegmentIcon(segment.blockType)}</span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: '#555',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                          }}
                        >
                          {getSegmentLabel(segment)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Expand all / Collapse all buttons */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={() => {
            const allIndices = new Set(days.map((_, i) => i))
            setExpandedDays(allIndices)
          }}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '0.6875rem',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#333',
          }}
        >
          Expand All
        </button>
        <button
          onClick={() => setExpandedDays(new Set())}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '0.6875rem',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#333',
          }}
        >
          Collapse All
        </button>
      </div>
    </div>
  )
}
