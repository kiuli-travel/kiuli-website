'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'

interface EnhanceButtonProps {
  target: 'segment' | 'faq' | 'overview' | 'whyKiuli'
  dayIndex?: number
  segmentIndex?: number
  faqIndex?: number
  /** Optional: explicit field path (e.g., "days.0.segments.1.description") */
  fieldPath?: string
}

/**
 * Build fieldPath and voiceConfig from target and indices
 */
function buildEnhanceParams(
  target: string,
  dayIndex?: number,
  segmentIndex?: number,
  faqIndex?: number
): { fieldPath: string; voiceConfig: string } {
  switch (target) {
    case 'overview':
      return { fieldPath: 'overview.summary', voiceConfig: 'overview-summary' }
    case 'whyKiuli':
      return { fieldPath: 'whyKiuli', voiceConfig: 'why-kiuli' }
    case 'segment':
      if (dayIndex !== undefined && segmentIndex !== undefined) {
        return {
          fieldPath: `days.${dayIndex}.segments.${segmentIndex}.description`,
          voiceConfig: 'segment-description',
        }
      }
      throw new Error('dayIndex and segmentIndex required for segment target')
    case 'faq':
      if (faqIndex !== undefined) {
        return {
          fieldPath: `faqItems.${faqIndex}.answer`,
          voiceConfig: 'faq-answer',
        }
      }
      throw new Error('faqIndex required for faq target')
    default:
      throw new Error(`Unknown target: ${target}`)
  }
}

export const EnhanceButton: React.FC<EnhanceButtonProps> = ({
  target,
  dayIndex,
  segmentIndex,
  faqIndex,
  fieldPath: explicitFieldPath,
}) => {
  const { id } = useDocumentInfo()
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const handleEnhance = async () => {
    if (!id) {
      setMessage('Save the itinerary first before enhancing content.')
      setMessageType('error')
      return
    }

    setIsEnhancing(true)
    setMessage('')

    try {
      // Build the correct fieldPath and voiceConfig for the API
      const { fieldPath, voiceConfig } = explicitFieldPath
        ? { fieldPath: explicitFieldPath, voiceConfig: `${target}-description` }
        : buildEnhanceParams(target, dayIndex, segmentIndex, faqIndex)

      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          itineraryId: id,
          fieldPath,
          voiceConfig,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage(`Content enhanced successfully! Refreshing page...`)
        setMessageType('success')
        // Auto-refresh to show enhanced content
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage(result.error || 'Enhancement failed')
        setMessageType('error')
      }
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`)
      setMessageType('error')
    } finally {
      setIsEnhancing(false)
    }
  }

  const getButtonLabel = () => {
    if (isEnhancing) return 'Enhancing...'
    switch (target) {
      case 'segment':
        return 'Enhance Segment'
      case 'faq':
        return 'Enhance Answer'
      case 'overview':
        return 'Enhance Overview'
      case 'whyKiuli':
        return 'Enhance Why Kiuli'
      default:
        return 'Enhance'
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <Button
        buttonStyle="secondary"
        size="small"
        onClick={handleEnhance}
        disabled={isEnhancing}
      >
        {isEnhancing ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #ccc',
                borderTopColor: '#333',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            Enhancing...
          </span>
        ) : (
          <>
            <span style={{ marginRight: '0.25rem' }}>{'\u2728'}</span>
            {getButtonLabel()}
          </>
        )}
      </Button>

      {message && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor:
              messageType === 'success'
                ? '#d4edda'
                : messageType === 'error'
                  ? '#f8d7da'
                  : '#cce5ff',
            color:
              messageType === 'success'
                ? '#155724'
                : messageType === 'error'
                  ? '#721c24'
                  : '#004085',
            border: `1px solid ${
              messageType === 'success'
                ? '#c3e6cb'
                : messageType === 'error'
                  ? '#f5c6cb'
                  : '#b8daff'
            }`,
          }}
        >
          {message}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Pre-configured versions for different contexts
export const EnhanceOverviewButton: React.FC = () => <EnhanceButton target="overview" />
export const EnhanceWhyKiuliButton: React.FC = () => <EnhanceButton target="whyKiuli" />

// Segment button extracts indices from field path
interface EnhanceSegmentButtonProps {
  path: string // Payload provides this automatically
}

export const EnhanceSegmentButton: React.FC<EnhanceSegmentButtonProps> = ({ path }) => {
  // Parse path: "days.0.segments.1.enhanceUI"
  const parts = path.split('.')
  const daysIndex = parts.indexOf('days')
  const segmentsIndex = parts.indexOf('segments')

  if (daysIndex === -1 || segmentsIndex === -1) {
    return <div style={{ color: 'red', fontSize: '0.875rem' }}>Invalid path: {path}</div>
  }

  const dayIndex = parseInt(parts[daysIndex + 1], 10)
  const segmentIndex = parseInt(parts[segmentsIndex + 1], 10)

  if (isNaN(dayIndex) || isNaN(segmentIndex)) {
    return <div style={{ color: 'red', fontSize: '0.875rem' }}>Cannot parse indices from path: {path}</div>
  }

  return <EnhanceButton target="segment" dayIndex={dayIndex} segmentIndex={segmentIndex} />
}
