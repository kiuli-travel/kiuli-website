'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'

export const EnhanceAll: React.FC = () => {
  const { id } = useDocumentInfo()
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [progress, setProgress] = useState<{ enhanced: number; total: number } | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success')

  const handleEnhanceAll = async () => {
    if (!id) {
      setMessage('Save the itinerary first before enhancing content.')
      setMessageType('error')
      return
    }

    const confirmed = window.confirm(
      'This will enhance ALL content (overview, segments, FAQs, Why Kiuli). This may take several minutes. Continue?',
    )

    if (!confirmed) return

    setIsEnhancing(true)
    setMessage('')
    setProgress({ enhanced: 0, total: 0 })

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itineraryId: id,
          target: 'all',
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setProgress({ enhanced: result.enhanced, total: result.enhanced })
        setMessage(
          `Successfully enhanced ${result.enhanced} item(s). Reload the page to see changes.`,
        )
        setMessageType('success')
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

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        border: '1px solid #b8daff',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}
      >
        <div>
          <h4
            style={{
              margin: '0 0 0.25rem 0',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#004085',
            }}
          >
            {'\u2728'} AI Content Enhancement
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: '#004085',
              opacity: 0.8,
            }}
          >
            Enhance all descriptions with luxury travel copywriting
          </p>
        </div>
        <Button
          buttonStyle="primary"
          onClick={handleEnhanceAll}
          disabled={isEnhancing}
        >
          {isEnhancing ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Enhancing...
            </span>
          ) : (
            'Enhance All Content'
          )}
        </Button>
      </div>

      {isEnhancing && progress && (
        <div style={{ marginTop: '0.75rem' }}>
          <div
            style={{
              height: '4px',
              backgroundColor: '#cce5ff',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#004085',
                width: progress.total > 0 ? `${(progress.enhanced / progress.total) * 100}%` : '0%',
                transition: 'width 0.3s ease',
                animation: progress.total === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
          </div>
          <div
            style={{
              marginTop: '0.25rem',
              fontSize: '0.75rem',
              color: '#004085',
              textAlign: 'center',
            }}
          >
            {progress.total > 0
              ? `${progress.enhanced} of ${progress.total} items enhanced`
              : 'Starting enhancement...'}
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor:
              messageType === 'success'
                ? '#d4edda'
                : messageType === 'error'
                  ? '#f8d7da'
                  : '#fff3cd',
            color:
              messageType === 'success'
                ? '#155724'
                : messageType === 'error'
                  ? '#721c24'
                  : '#856404',
            border: `1px solid ${
              messageType === 'success'
                ? '#c3e6cb'
                : messageType === 'error'
                  ? '#f5c6cb'
                  : '#ffeeba'
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
        @keyframes pulse {
          0%, 100% { opacity: 0.4; width: 20%; }
          50% { opacity: 1; width: 80%; }
        }
      `}</style>
    </div>
  )
}
