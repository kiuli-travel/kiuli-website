'use client'

import React, { useState, useEffect } from 'react'
import { useField } from '@payloadcms/ui'
import Image from 'next/image'

interface MediaItem {
  id: number
  filename: string
  alt?: string
  imgixUrl?: string
  url?: string
}

/**
 * Gallery preview for the root-level images field in Itineraries.
 * Shows thumbnails of all selected images with count.
 */
export const RootImagesGallery: React.FC = () => {
  // Root-level images field
  const { value } = useField<number[] | null>({ path: 'images' })
  const [images, setImages] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Fetch image data when value changes
  useEffect(() => {
    if (!value || value.length === 0) {
      setImages([])
      return
    }

    const fetchImages = async () => {
      setIsLoading(true)
      try {
        // Fetch first 20 images to show preview
        const idsToFetch = value.slice(0, 20)
        const imagePromises = idsToFetch.map(async (id) => {
          try {
            const response = await fetch(`/api/media/${id}`, {
              credentials: 'include',
            })
            if (response.ok) {
              return await response.json()
            }
          } catch (error) {
            console.error(`Failed to fetch image ${id}:`, error)
          }
          return null
        })

        const results = await Promise.all(imagePromises)
        setImages(results.filter(Boolean) as MediaItem[])
      } catch (error) {
        console.error('Failed to fetch images:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchImages()
  }, [value])

  const getImageSrc = (image: MediaItem): string => {
    if (image.imgixUrl) {
      return `${image.imgixUrl}?w=80&h=80&fit=crop&auto=format`
    }
    if (image.url) {
      return image.url
    }
    return `/api/media/file/${image.filename}`
  }

  const totalCount = value?.length || 0
  const displayedImages = showAll ? images : images.slice(0, 10)

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
          All Images ({totalCount} total)
        </span>
        {totalCount > 10 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              fontSize: '0.75rem',
              textDecoration: 'underline',
            }}
          >
            {showAll ? 'Show less' : `Show more (${totalCount - 10} hidden)`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: '#999', fontSize: '0.875rem' }}>Loading image gallery...</div>
      ) : images.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
          }}
        >
          {displayedImages.map((image) => (
            <div
              key={image.id}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #e0e0e0',
                backgroundColor: '#fff',
                position: 'relative',
              }}
              title={image.alt || image.filename}
            >
              <Image
                src={getImageSrc(image)}
                alt={image.alt || image.filename}
                fill
                style={{ objectFit: 'cover' }}
                sizes="60px"
                unoptimized={!image.imgixUrl}
              />
            </div>
          ))}
          {!showAll && totalCount > images.length && (
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                border: '1px dashed #999',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              +{totalCount - images.length}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
            color: '#999',
            fontSize: '0.875rem',
            fontStyle: 'italic',
          }}
        >
          No images in this itinerary yet.
        </div>
      )}
    </div>
  )
}
