'use client'

import React, { useState, useCallback } from 'react'
import EditorialUnit from '@/components/admin/EditorialUnit'

interface FieldState {
  enhancedValue: string
  isReviewed: boolean
  isEnhancing: boolean
}

export default function EditorialDemoPage() {
  const [fields, setFields] = useState<Record<string, FieldState>>({
    title: {
      enhancedValue: '',
      isReviewed: false,
      isEnhancing: false,
    },
    metaDescription: {
      enhancedValue:
        'Seven nights of extraordinary encounters across Kenya\u2019s most iconic wilderness \u2014 Giraffe Manor, Lewa House, and the Masai Mara. Crafted exclusively for families who travel with intention.',
      isReviewed: false,
      isEnhancing: false,
    },
    metaTitle: {
      enhancedValue: 'Kenya Family Safari: Giraffe Manor, Lewa & the Masai Mara | Kiuli',
      isReviewed: true,
      isEnhancing: false,
    },
  })

  const updateField = useCallback((key: string, updates: Partial<FieldState>) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }))
  }, [])

  const simulateEnhance = useCallback(
    async (key: string) => {
      updateField(key, { isEnhancing: true })
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const mockEnhanced: Record<string, string> = {
        title:
          'Kenya Family Safari: Giraffe Manor, Lewa Wildlife Conservancy & Masai Mara | Kiuli',
        metaDescription:
          'Seven nights of extraordinary encounters across Kenya\u2019s most iconic wilderness \u2014 Giraffe Manor, Lewa House, and the Masai Mara. Crafted exclusively for families who travel with intention.',
        metaTitle: 'Kenya Family Safari: Giraffe Manor, Lewa & the Masai Mara | Kiuli',
      }
      updateField(key, {
        isEnhancing: false,
        enhancedValue: mockEnhanced[key] || 'Enhanced content here',
      })
    },
    [updateField],
  )

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#F5F3EB',
        fontFamily: "'Inter', 'General Sans', system-ui, sans-serif",
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Page Header */}
        <div className="mb-10">
          <h1
            className="mb-2"
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#404040',
              letterSpacing: '-0.01em',
            }}
          >
            Kiuli Admin &mdash; EditorialUnit Component
          </h1>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 400,
              color: '#888',
            }}
          >
            The core editorial pattern for the itinerary review workflow
          </p>
        </div>

        {/* Demo Fields */}
        <div className="flex flex-col gap-6">
          {/* 1. UNREVIEWED state */}
          <EditorialUnit
            fieldLabel="Title"
            itrvlValue="Family-Fun in Kenya"
            enhancedValue={fields.title.enhancedValue}
            isReviewed={fields.title.isReviewed}
            multiline={false}
            onEnhancedChange={(value) => updateField('title', { enhancedValue: value })}
            onReviewedChange={(checked) => updateField('title', { isReviewed: checked })}
            onEnhance={() => simulateEnhance('title')}
            isEnhancing={fields.title.isEnhancing}
          />

          {/* 2. ENHANCED_NOT_REVIEWED state */}
          <EditorialUnit
            fieldLabel="Meta Description"
            itrvlValue="Experience a 7-night luxury safari through Kenya. Exclusive lodges, expert guides, and unforgettable wildlife encounters. Inquire with Kiuli today."
            enhancedValue={fields.metaDescription.enhancedValue}
            isReviewed={fields.metaDescription.isReviewed}
            multiline={true}
            onEnhancedChange={(value) => updateField('metaDescription', { enhancedValue: value })}
            onReviewedChange={(checked) =>
              updateField('metaDescription', { isReviewed: checked })
            }
            onEnhance={() => simulateEnhance('metaDescription')}
            isEnhancing={fields.metaDescription.isEnhancing}
          />

          {/* 3. REVIEWED state */}
          <EditorialUnit
            fieldLabel="Meta Title"
            itrvlValue="Family-Fun in Kenya | 7-Night Luxury Safari"
            enhancedValue={fields.metaTitle.enhancedValue}
            isReviewed={fields.metaTitle.isReviewed}
            multiline={false}
            onEnhancedChange={(value) => updateField('metaTitle', { enhancedValue: value })}
            onReviewedChange={(checked) => updateField('metaTitle', { isReviewed: checked })}
            onEnhance={() => simulateEnhance('metaTitle')}
            isEnhancing={fields.metaTitle.isEnhancing}
          />
        </div>

        {/* Legend */}
        <div className="mt-10 rounded-lg border border-[#DADADA] bg-white p-5">
          <p
            className="mb-3 font-medium"
            style={{ fontSize: '13px', color: '#404040' }}
          >
            State Legend
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: '#DC2626' }}
              />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Unreviewed — checkbox unchecked, enhanced field empty
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: '#D97706' }}
              />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Enhanced — checkbox unchecked, enhanced field has content
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: '#16A34A' }}
              />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Reviewed — checkbox checked
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
