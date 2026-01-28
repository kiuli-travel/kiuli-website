'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'

export const RescrapeButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success')
  const [jobId, setJobId] = useState<string | null>(null)

  // Don't render if document isn't saved yet
  if (!id) {
    return null
  }

  const handleRescrape = async () => {
    setIsProcessing(true)
    setMessage('')
    setJobId(null)

    try {
      // Fetch the itinerary data to get the source URL
      const itineraryResponse = await fetch(`/api/itineraries/${id}`, {
        credentials: 'include',
      })

      if (!itineraryResponse.ok) {
        setMessage('Failed to load itinerary data')
        setMessageType('error')
        setIsProcessing(false)
        return
      }

      const itinerary = await itineraryResponse.json()
      const itrvlUrl = itinerary?.source?.itrvlUrl
      const lastScrapedAt = itinerary?.source?.lastScrapedAt

      // Validate URL exists
      if (!itrvlUrl) {
        setMessage('No iTrvl URL found. This itinerary cannot be re-scraped.')
        setMessageType('error')
        setIsProcessing(false)
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

      if (!confirmed) {
        setIsProcessing(false)
        return
      }

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
        <Button buttonStyle="secondary" onClick={handleRescrape} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Rescrape Itinerary'}
        </Button>
      </div>

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
