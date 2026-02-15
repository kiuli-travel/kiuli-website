'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@payloadcms/ui'
import ConversationPanel from '@/components/content-system/ConversationPanel'

const PROJECT_ID = 27

interface ProjectInfo {
  id: number
  title: string
  stage: string
  contentType: string
  metaTitle?: string
  metaDescription?: string
  answerCapsule?: string
  messages?: Array<{
    role: 'designer' | 'kiuli'
    content: string
    timestamp: string
    actions?: Array<{
      type: string
      field?: string
      sectionName?: string
      before?: string
      after?: string
    }>
  }>
}

export default function ConversationTestPage() {
  const { token } = useAuth()
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/content-projects/${PROJECT_ID}?depth=0`, {
        credentials: 'include',
        headers,
      })
      if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`)
      const data = await res.json()
      setProject(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Loading project...
      </div>
    )
  }

  if (error || !project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#C33' }}>
        Error: {error || 'Project not found'}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#404040',
              margin: 0,
            }}
          >
            Conversation Test — Project #{project.id}
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#666',
              margin: '4px 0 0',
            }}
          >
            {project.title}
          </p>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                padding: '2px 10px',
                borderRadius: '10px',
                backgroundColor: '#E8F0F0',
                color: '#486A6A',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {project.stage}
            </span>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: '10px',
                backgroundColor: '#F5F3EB',
                color: '#666',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {project.contentType}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setLoading(true)
            fetchProject()
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #E5E2DA',
            backgroundColor: '#fff',
            color: '#404040',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Refresh Project
        </button>
      </div>

      {/* Field values panel */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #E5E2DA',
          backgroundColor: '#fff',
          fontSize: '13px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#404040' }}>
          Current Field Values
        </div>
        <div style={{ display: 'grid', gap: '4px' }}>
          <div>
            <span style={{ color: '#999' }}>Meta Title:</span>{' '}
            {project.metaTitle || '(empty)'}
          </div>
          <div>
            <span style={{ color: '#999' }}>Meta Description:</span>{' '}
            {project.metaDescription || '(empty)'}
          </div>
          <div>
            <span style={{ color: '#999' }}>Answer Capsule:</span>{' '}
            {project.answerCapsule || '(empty)'}
          </div>
          <div>
            <span style={{ color: '#999' }}>Messages stored:</span>{' '}
            {project.messages?.length || 0}
          </div>
        </div>
      </div>

      {/* Conversation panel */}
      <div style={{ height: '500px' }}>
        <ConversationPanel
          projectId={PROJECT_ID}
          initialMessages={project.messages || []}
          onActionApplied={() => {
            // Refetch after a short delay to allow DB update
            setTimeout(fetchProject, 1000)
          }}
        />
      </div>
    </div>
  )
}
