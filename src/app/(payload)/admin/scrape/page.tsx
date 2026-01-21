'use client'

import React, { useState } from 'react'

export default function ScrapePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    jobId?: number
    itineraryId?: string
    message?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/scrape-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ itrvlUrl: url }),
      })

      // Check for empty response
      const text = await res.text()

      if (!text) {
        throw new Error(`Server returned empty response (status ${res.status})`)
      }

      // Try to parse as JSON
      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.error('Non-JSON response:', text)
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
      }

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }

      setResult(data)
    } catch (err) {
      console.error('Scrape error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 600 }}>
        Import Itinerary from iTrvl
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="itrvl-url"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}
          >
            iTrvl Itinerary URL
          </label>
          <input
            id="itrvl-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://itrvl.com/client/portal/..."
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Paste the full iTrvl client portal URL provided by your travel designer
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !url}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || !url ? '#ccc' : '#486A6A',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: loading || !url ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Processing...' : 'Import Itinerary'}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '4px',
          }}
        >
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Import Started</h2>
          <p>
            <strong>Job ID:</strong> {result.jobId}
          </p>
          <p>
            <strong>Itinerary ID:</strong> {result.itineraryId}
          </p>
          <p style={{ marginTop: '1rem' }}>
            <a
              href={`/admin/collections/itinerary-jobs/${result.jobId}`}
              style={{ color: '#0066cc', textDecoration: 'underline' }}
            >
              View Job Status &rarr;
            </a>
          </p>
        </div>
      )}

      <div
        style={{
          marginTop: '3rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>How This Works</h3>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
          <li>Paste the iTrvl client portal URL above</li>
          <li>Click &quot;Import Itinerary&quot; to start processing</li>
          <li>Monitor progress on the Job Status page</li>
          <li>Once complete, review and enhance content in the itinerary editor</li>
          <li>Publish when all content is reviewed</li>
        </ol>
      </div>
    </div>
  )
}
