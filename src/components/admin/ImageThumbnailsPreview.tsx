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

interface ImageThumbnailsPreviewProps {
  path: string
}

/**
 * Read-only thumbnail preview for hasMany relationship fields.
 * Shows thumbnails of selected images without replacing the relationship picker.
 * Use as a UI field placed before the actual relationship field.
 */
export const ImageThumbnailsPreview: React.FC<ImageThumbnailsPreviewProps> = ({ path }) => {
  // The path points to this UI field, but we need the images field path
  // UI field path: days.0.segments.0.imagePreviewUI
  // Images field path: days.0.segments.0.images
  const imagesPath = path.replace(/\.imagePreviewUI$/, '.images')

  const { value, setValue } = useField<number[] | null>({ path: imagesPath })
  const [images, setImages] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleClearAll = () => {
    setValue([])
    setImages([])
  }

  // Fetch image data when value changes
  useEffect(() => {
    if (!value || value.length === 0) {
      setImages([])
      return
    }

    const fetchImages = async () => {
      setIsLoading(true)
      try {
        // Fetch each image by ID
        const imagePromises = value.map(async (id) => {
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

  // Don't render anything if no images
  if (!value || value.length === 0) {
    return null
  }

  const getImageSrc = (image: MediaItem): string => {
    if (image.imgixUrl) {
      return `${image.imgixUrl}?w=100&h=100&fit=crop&auto=format`
    }
    if (image.url) {
      return image.url
    }
    return `/api/media/file/${image.filename}`
  }

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          {images.length} image{images.length !== 1 ? 's' : ''} selected
        </span>
        <button
          type="button"
          onClick={handleClearAll}
          style={{
            background: 'transparent',
            border: '1px solid #dc3545',
            borderRadius: '4px',
            color: '#dc3545',
            fontSize: '0.75rem',
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Clear All
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: '#999', fontSize: '0.875rem' }}>Loading thumbnails...</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {images.map((image) => (
            <div
              key={image.id}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #e0e0e0',
                backgroundColor: '#f5f5f5',
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
        </div>
      )}
    </div>
  )
}
