'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo, useForm } from '@payloadcms/ui'

export const RescrapeButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const form = useForm()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success')
  const [jobId, setJobId] = useState<string | null>(null)

  // Don't render if document isn't saved yet or no form context
  if (!id || !form) {
    return null
  }

  const { getDataByPath } = form

  const handleRescrape = async () => {
    // Read source data from form
    const itrvlUrl = getDataByPath('source.itrvlUrl') as string | undefined
    const lastScrapedAt = getDataByPath('source.lastScrapedAt') as string | undefined

    // Validate URL exists
    if (!itrvlUrl) {
      setMessage('No iTrvl URL found. This itinerary cannot be re-scraped.')
      setMessageType('error')
      return
    }

    // Format last scrape date for display
    const lastScrapedDate = lastScrapedAt
      ? new Date(lastScrapedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Unknown'

    // Confirmation dialog
    const confirmed = window.confirm(
      `This will re-scrape the itinerary from iTrvl and update the existing data.\n\n` +
        `Last scraped: ${lastScrapedDate}\n\n` +
        `Locked hero image/video and enhanced content will be preserved.\n\n` +
        `Continue?`,
    )

    if (!confirmed) return

    setIsProcessing(true)
    setMessage('')
    setJobId(null)

    try {
      const response = await fetch('/api/scrape-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          itrvlUrl,
          mode: 'update',
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setJobId(result.jobId)
        setMessage(`Re-scrape started! Job ID: ${result.jobId}`)
        setMessageType('success')
      } else if (response.status === 409) {
        // Job already running
        setJobId(result.existingJobId)
        setMessage(`A job is already running for this URL.`)
        setMessageType('warning')
      } else {
        setMessage(result.error || 'Failed to start re-scrape')
        setMessageType('error')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`Error: ${errorMessage}`)
      setMessageType('error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Get source info for display
  const itrvlUrl = getDataByPath('source.itrvlUrl') as string | undefined
  const lastScrapedAt = getDataByPath('source.lastScrapedAt') as string | undefined

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#fff3e0',
        borderRadius: '8px',
        border: '1px solid #ffcc80',
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
              color: '#e65100',
            }}
          >
            Refresh from iTrvl
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: '#bf360c',
              opacity: 0.8,
            }}
          >
            Re-scrape this itinerary to pull latest changes from source
          </p>
        </div>
        <Button
          buttonStyle="secondary"
          onClick={handleRescrape}
          disabled={isProcessing || !itrvlUrl}
        >
          {isProcessing ? 'Starting...' : 'Rescrape Itinerary'}
        </Button>
      </div>

      {/* Source info */}
      {itrvlUrl && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#bf360c',
            opacity: 0.7,
            marginTop: '0.5rem',
          }}
        >
          <div style={{ wordBreak: 'break-all' }}>
            Source:{' '}
            <a
              href={itrvlUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              {itrvlUrl}
            </a>
          </div>
          {lastScrapedAt && (
            <div>Last scraped: {new Date(lastScrapedAt).toLocaleString()}</div>
          )}
        </div>
      )}

      {!itrvlUrl && (
        <div
          style={{
            fontSize: '0.875rem',
            color: '#bf360c',
            marginTop: '0.5rem',
            fontStyle: 'italic',
          }}
        >
          No iTrvl source URL found for this itinerary
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
                : messageType === 'warning'
                  ? '#fff3cd'
                  : '#f8d7da',
            color:
              messageType === 'success'
                ? '#155724'
                : messageType === 'warning'
                  ? '#856404'
                  : '#721c24',
            border: `1px solid ${
              messageType === 'success'
                ? '#c3e6cb'
                : messageType === 'warning'
                  ? '#ffeeba'
                  : '#f5c6cb'
            }`,
          }}
        >
          {message}
          {jobId && (
            <div style={{ marginTop: '0.5rem' }}>
              <a
                href={`/admin/collections/itinerary-jobs/${jobId}`}
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                View Job Status
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
