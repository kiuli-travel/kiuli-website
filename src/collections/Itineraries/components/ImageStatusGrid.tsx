'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

interface JobStatus {
  jobId: string
  status: string
  images: {
    total: number
    processed: number
    skipped: number
    failed: number
    labeled: number
  }
  failedItems?: Array<{ sourceS3Key: string; error: string }>
}

export const ImageStatusGrid: React.FC = () => {
  const { id } = useDocumentInfo()
  const form = useForm()
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Get the itineraryId from the form data (guard against missing form)
  const itineraryId = form?.getDataByPath?.('itineraryId') as string | undefined

  const fetchJobStatus = useCallback(async () => {
    if (!id || !itineraryId || !form) return

    setIsLoading(true)

    try {
      // First, find the job for this itinerary
      const jobsResponse = await fetch(
        `/api/itinerary-jobs?where[itineraryId][equals]=${encodeURIComponent(itineraryId)}&sort=-createdAt&limit=1`,
        { credentials: 'include' }
      )
      if (!jobsResponse.ok) {
        setJobStatus(null)
        return
      }
      const jobsData = await jobsResponse.json()

      if (jobsData.docs && jobsData.docs.length > 0) {
        const job = jobsData.docs[0]
        // Fetch detailed status
        const statusResponse = await fetch(`/api/job-status/${job.id}`, {
          credentials: 'include',
        })
        if (!statusResponse.ok) {
          setJobStatus(null)
          return
        }
        const statusData = await statusResponse.json()
        // Ensure images object exists to prevent crashes
        if (statusData && !statusData.images) {
          statusData.images = { total: 0, processed: 0, skipped: 0, failed: 0, labeled: 0 }
        }
        setJobStatus(statusData)
      } else {
        setJobStatus(null)
      }
    } catch (err) {
      console.error('Failed to fetch job status:', err)
      setJobStatus(null)
    } finally {
      setIsLoading(false)
    }
  }, [id, itineraryId, form])

  useEffect(() => {
    fetchJobStatus()
    // Refresh every 10 seconds if processing
    const interval = setInterval(() => {
      if (jobStatus?.status === 'processing') {
        fetchJobStatus()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchJobStatus, jobStatus?.status])

  // Don't render if no document or no form context (e.g., on list view)
  if (!id || !form) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
      case 'completed':
        return { bg: '#d4edda', text: '#155724', border: '#c3e6cb' }
      case 'processing':
        return { bg: '#cce5ff', text: '#004085', border: '#b8daff' }
      case 'pending':
        return { bg: '#f0f0f0', text: '#666', border: '#d0d0d0' }
      case 'failed':
        return { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' }
      case 'skipped':
        return { bg: '#fff3cd', text: '#856404', border: '#ffeeba' }
      default:
        return { bg: '#f0f0f0', text: '#666', border: '#d0d0d0' }
    }
  }

  if (isLoading && !jobStatus) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#666',
        }}
      >
        Loading image status...
      </div>
    )
  }

  if (!jobStatus) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
        }}
      >
        <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
          No processing job found for this itinerary.
        </p>
      </div>
    )
  }

  const { images, failedItems = [] } = jobStatus
  const statusColor = getStatusColor(jobStatus.status)

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Image Processing Status</h4>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            backgroundColor: statusColor.bg,
            color: statusColor.text,
            border: `1px solid ${statusColor.border}`,
          }}
        >
          {jobStatus.status}
        </span>
      </div>

      {/* Progress bar */}
      {images.total > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              height: '8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${(images.processed / images.total) * 100}%`,
                  backgroundColor: '#28a745',
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  width: `${(images.skipped / images.total) * 100}%`,
                  backgroundColor: '#ffc107',
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  width: `${(images.failed / images.total) * 100}%`,
                  backgroundColor: '#dc3545',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fff',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #e0e0e0',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{images.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Total</div>
        </div>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #c3e6cb',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#155724' }}>
            {images.processed}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#155724' }}>Processed</div>
        </div>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ffeeba',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#856404' }}>
            {images.skipped}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#856404' }}>Skipped</div>
        </div>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: images.failed > 0 ? '#f8d7da' : '#fff',
            borderRadius: '4px',
            textAlign: 'center',
            border: `1px solid ${images.failed > 0 ? '#f5c6cb' : '#e0e0e0'}`,
          }}
        >
          <div
            style={{ fontSize: '1.5rem', fontWeight: 700, color: images.failed > 0 ? '#721c24' : '#333' }}
          >
            {images.failed}
          </div>
          <div style={{ fontSize: '0.75rem', color: images.failed > 0 ? '#721c24' : '#666' }}>
            Failed
          </div>
        </div>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#cce5ff',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #b8daff',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#004085' }}>
            {images.labeled || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#004085' }}>Labeled</div>
        </div>
      </div>

      {/* Failed images list */}
      {failedItems.length > 0 && (
        <div>
          <h5
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#721c24',
            }}
          >
            Failed Images ({failedItems.length})
          </h5>
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              backgroundColor: '#fff',
              borderRadius: '4px',
              border: '1px solid #f5c6cb',
            }}
          >
            {failedItems.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '0.5rem',
                  borderBottom: index < failedItems.length - 1 ? '1px solid #f5c6cb' : 'none',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 500, color: '#721c24', wordBreak: 'break-all' }}>
                  {item.sourceS3Key}
                </div>
                <div style={{ color: '#856404', marginTop: '0.25rem' }}>{item.error}</div>
              </div>
            ))}
          </div>
          <p
            style={{
              margin: '0.5rem 0 0 0',
              fontSize: '0.75rem',
              color: '#666',
            }}
          >
            Use the Job Control panel to retry failed images or replace them manually.
          </p>
        </div>
      )}

      {/* Refresh button */}
      <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
        <button
          onClick={fetchJobStatus}
          disabled={isLoading}
          style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.75rem',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
