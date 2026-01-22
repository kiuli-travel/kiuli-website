'use client'

import React, { useState, useEffect } from 'react'
import { useField } from '@payloadcms/ui'
import Image from 'next/image'
import { ImageSelectionModal } from './ImageSelectionModal'

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
 * Thumbnail preview with add/clear functionality for hasMany relationship fields.
 * Shows thumbnails of selected images and provides a modal for adding from library.
 * Use as a UI field placed before the actual relationship field.
 */
export const ImageThumbnailsPreview: React.FC<ImageThumbnailsPreviewProps> = ({ path }) => {
  // The path points to this UI field, but we need the images field path
  // UI field path: days.0.segments.0.imagePreviewUI
  // Images field path: days.0.segments.0.images
  const imagesPath = path.replace(/\.imagePreviewUI$/, '.images')

  // Debug: log path transformation
  console.log('[ImageThumbnailsPreview] path:', path, '-> imagesPath:', imagesPath)

  const { value, setValue } = useField<unknown>({ path: imagesPath })

  // Debug: log the raw value we receive
  console.log('[ImageThumbnailsPreview] raw value:', value, 'type:', typeof value, 'isArray:', Array.isArray(value))
  const [images, setImages] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Normalize value to array of IDs
  // Value can be: null, number[], or array of objects with id property
  const normalizeToIds = (val: unknown): number[] => {
    if (!val || !Array.isArray(val)) return []
    return val.map((item: unknown) => {
      if (typeof item === 'number') return item
      if (typeof item === 'string') return parseInt(item, 10)
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as { id: unknown }).id
        return typeof id === 'number' ? id : parseInt(String(id), 10)
      }
      return 0
    }).filter(id => id > 0)
  }

  const imageIds = normalizeToIds(value)
  console.log('[ImageThumbnailsPreview] normalized imageIds:', imageIds)

  const handleClearAll = () => {
    setValue([])
    setImages([])
  }

  const handleAddImages = (selectedIds: number[]) => {
    setValue(selectedIds)
  }

  const handleRemoveImage = (idToRemove: number) => {
    const newValue = imageIds.filter(id => id !== idToRemove)
    setValue(newValue)
  }

  // Fetch image data when value changes
  useEffect(() => {
    if (imageIds.length === 0) {
      setImages([])
      return
    }

    const fetchImages = async () => {
      setIsLoading(true)
      try {
        // Fetch each image by ID
        const imagePromises = imageIds.map(async (id) => {
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
  }, [imageIds.join(',')])  // Use joined string as dependency to avoid infinite loops

  const getImageSrc = (image: MediaItem): string => {
    if (image.imgixUrl) {
      return `${image.imgixUrl}?w=100&h=100&fit=crop&auto=format`
    }
    if (image.url) {
      return image.url
    }
    return `/api/media/file/${image.filename}`
  }

  const currentIds = imageIds

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {/* Debug info - remove after testing */}
      <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px', fontFamily: 'monospace' }}>
        DEBUG: path={path} | imagesPath={imagesPath} | ids={imageIds.length} | rawType={typeof value}
      </div>
      {/* Header with count and actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          {images.length} image{images.length !== 1 ? 's' : ''} selected
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: '#007bff',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '0.75rem',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            + Add Images
          </button>
          {currentIds.length > 0 && (
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
          )}
        </div>
      </div>

      {/* Thumbnails */}
      {isLoading ? (
        <div style={{ color: '#999', fontSize: '0.875rem' }}>Loading thumbnails...</div>
      ) : images.length > 0 ? (
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
              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveImage(image.id)
                }}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(220, 53, 69, 0.9)',
                  color: '#fff',
                  fontSize: '12px',
                  lineHeight: '1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Remove image"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: '0.75rem', fontStyle: 'italic' }}>
          No images selected. Click &quot;+ Add Images&quot; to browse the library.
        </div>
      )}

      {/* Selection Modal */}
      <ImageSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleAddImages}
        currentlySelected={currentIds}
      />
    </div>
  )
}
