'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo, useForm } from '@payloadcms/ui'

export const ProcessButton: React.FC = () => {
  const { docID } = useDocumentInfo()
  const { getData, getDataByPath } = useForm()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')

  const handleProcess = async () => {
    try {
      setIsProcessing(true)
      setMessage('')

      // Get the current form data
      const formData = getData()
      const itrvlUrl = getDataByPath('itrvlUrl')

      if (!itrvlUrl) {
        setMessage('Error: iTrvl URL is required')
        return
      }

      // Call the processing API
      const response = await fetch('/api/scrape-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itrvlUrl }),
      })

      const result = await response.json()

      if (response.ok) {
        if (result.success) {
          setMessage(
            `Success! Processing completed in ${result.duration}s. Payload ID: ${result.payloadId}`,
          )
        } else {
          setMessage(`Warning: Processing completed with errors. ${result.error || ''}`)
        }
      } else {
        setMessage(`Error: ${result.error || 'Failed to trigger processing'}`)
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message || 'Failed to trigger processing'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <Button
        buttonStyle="primary"
        onClick={handleProcess}
        disabled={isProcessing}
        style={{ marginBottom: '0.5rem' }}
      >
        {isProcessing ? 'Processing...' : 'Trigger Processing Pipeline'}
      </Button>

      {message && (
        <div
          style={{
            padding: '0.75rem',
            marginTop: '0.5rem',
            borderRadius: '4px',
            backgroundColor: message.startsWith('Success')
              ? '#d4edda'
              : message.startsWith('Warning')
                ? '#fff3cd'
                : '#f8d7da',
            color: message.startsWith('Success')
              ? '#155724'
              : message.startsWith('Warning')
                ? '#856404'
                : '#721c24',
            border: `1px solid ${message.startsWith('Success') ? '#c3e6cb' : message.startsWith('Warning') ? '#ffeeba' : '#f5c6cb'}`,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        This will trigger the full processing pipeline (Phases 2-7):
        <br />
        Scrape → Media Rehost → AI Enhance → Schema Gen → Validate → FAQ → Payload Ingest
      </div>
    </div>
  )
}
