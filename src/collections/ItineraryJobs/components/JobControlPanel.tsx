'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo, useForm } from '@payloadcms/ui'

type JobAction = 'cancel' | 'retry' | 'retry-failed'

export const JobControlPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const { getDataByPath } = useForm()
  const [isLoading, setIsLoading] = useState<JobAction | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const status = getDataByPath('status') as string
  const failedImages = (getDataByPath('failedImages') || 0) as number

  const handleAction = async (action: JobAction) => {
    if (!id) return

    const confirmMessages: Record<JobAction, string> = {
      cancel: 'Are you sure you want to cancel this job?',
      retry: 'This will restart the entire job from scratch. Continue?',
      'retry-failed': `This will retry ${failedImages} failed image(s). Continue?`,
    }

    if (!window.confirm(confirmMessages[action])) return

    setIsLoading(action)
    setMessage('')

    try {
      const response = await fetch(`/api/job-control/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage(result.message || `Action "${action}" completed successfully.`)
        setMessageType('success')
        // Reload the page to see updated status
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage(result.error || `Failed to ${action} job`)
        setMessageType('error')
      }
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`)
      setMessageType('error')
    } finally {
      setIsLoading(null)
    }
  }

  if (!id) {
    return null
  }

  const canCancel = status === 'pending' || status === 'processing'
  const canRetry = status === 'failed' || status === 'completed'
  const canRetryFailed = (status === 'completed' || status === 'failed') && failedImages > 0

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        marginTop: '1rem',
      }}
    >
      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Job Control</h4>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canCancel && (
          <Button
            buttonStyle="secondary"
            onClick={() => handleAction('cancel')}
            disabled={isLoading !== null}
          >
            {isLoading === 'cancel' ? 'Cancelling...' : '\u2717 Cancel Job'}
          </Button>
        )}

        {canRetry && (
          <Button
            buttonStyle="primary"
            onClick={() => handleAction('retry')}
            disabled={isLoading !== null}
          >
            {isLoading === 'retry' ? 'Restarting...' : '\u21bb Re-run Job'}
          </Button>
        )}

        {canRetryFailed && (
          <Button
            buttonStyle="secondary"
            onClick={() => handleAction('retry-failed')}
            disabled={isLoading !== null}
          >
            {isLoading === 'retry-failed'
              ? 'Retrying...'
              : `\u21bb Retry Failed (${failedImages})`}
          </Button>
        )}

        {!canCancel && !canRetry && !canRetryFailed && (
          <span style={{ color: '#666', fontSize: '0.875rem' }}>
            No actions available for this job status.
          </span>
        )}
      </div>

      {message && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
            color: messageType === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
