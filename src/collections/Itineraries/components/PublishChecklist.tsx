'use client'

import React from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

interface ChecklistItem {
  key: string
  label: string
  description: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'allImagesProcessed',
    label: 'Images Processed',
    description: 'All images have been processed and uploaded',
  },
  {
    key: 'noFailedImages',
    label: 'No Failed Images',
    description: 'No images in failed state',
  },
  {
    key: 'heroImageSelected',
    label: 'Hero Image',
    description: 'Hero image has been selected',
  },
  {
    key: 'contentEnhanced',
    label: 'Content Enhanced',
    description: 'Content has been enhanced or reviewed',
  },
  {
    key: 'schemaGenerated',
    label: 'Schema Generated',
    description: 'JSON-LD schema has been generated',
  },
  {
    key: 'metaFieldsFilled',
    label: 'Meta Fields',
    description: 'Meta title and description are set',
  },
]

export const PublishChecklist: React.FC = () => {
  const { getDataByPath } = useForm()
  const { id } = useDocumentInfo()

  // Only show for saved documents
  if (!id) {
    return (
      <div style={{ padding: '1rem', color: '#666', fontSize: '0.875rem' }}>
        Save the itinerary to see the publish checklist.
      </div>
    )
  }

  const publishChecklist = (getDataByPath('publishChecklist') || {}) as Record<string, boolean>
  const publishBlockers = (getDataByPath('publishBlockers') || []) as Array<{
    reason: string
    severity: string
  }>

  const allPassed = CHECKLIST_ITEMS.every((item) => publishChecklist[item.key] === true)

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      }}
    >
      <h4
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>Publish Checklist</span>
        {allPassed ? (
          <span
            style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            Ready
          </span>
        ) : (
          <span
            style={{
              backgroundColor: '#fff3cd',
              color: '#856404',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            Not Ready
          </span>
        )}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {CHECKLIST_ITEMS.map((item) => {
          const passed = publishChecklist[item.key] === true
          return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                backgroundColor: passed ? '#d4edda' : '#f8d7da',
                borderRadius: '4px',
                border: `1px solid ${passed ? '#c3e6cb' : '#f5c6cb'}`,
              }}
            >
              <span
                style={{
                  fontSize: '1rem',
                  width: '20px',
                  textAlign: 'center',
                  color: passed ? '#155724' : '#721c24',
                }}
              >
                {passed ? '\u2713' : '\u2717'}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: passed ? '#155724' : '#721c24',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: passed ? '#155724' : '#721c24',
                    opacity: 0.8,
                  }}
                >
                  {item.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {publishBlockers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h5
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#721c24',
            }}
          >
            Blockers
          </h5>
          {publishBlockers.map((blocker, index) => (
            <div
              key={index}
              style={{
                padding: '0.5rem',
                marginBottom: '0.25rem',
                backgroundColor: blocker.severity === 'error' ? '#f8d7da' : '#fff3cd',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: blocker.severity === 'error' ? '#721c24' : '#856404',
              }}
            >
              {blocker.severity === 'error' ? '\u26a0' : '\u2139'} {blocker.reason}
            </div>
          ))}
        </div>
      )}

      {!allPassed && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#856404',
          }}
        >
          <strong>Note:</strong> Resolve all items above before publishing. The publish button will
          be enabled once all checklist items pass.
        </div>
      )}
    </div>
  )
}
