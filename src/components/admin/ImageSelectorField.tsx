'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useField } from '@payloadcms/ui'
import Image from 'next/image'

interface MediaItem {
  id: number
  filename: string
  alt?: string
  imgixUrl?: string
  url?: string
}

interface ImageSelectorFieldProps {
  field: {
    label?: string
    required?: boolean
    name: string
  }
  path: string
}

export const ImageSelectorField: React.FC<ImageSelectorFieldProps> = ({ field, path }) => {
  const { value, setValue } = useField<number | null>({ path })

  // UI State - starts COLLAPSED
  const [showPicker, setShowPicker] = useState(false)
  const [images, setImages] = useState<MediaItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null)

  const LIMIT = 30

  // Fetch current selected image when value changes
  useEffect(() => {
    if (value && !selectedImage) {
      const fetchSelectedImage = async () => {
        try {
          const response = await fetch(`/api/media/${value}`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            setSelectedImage(data)
          }
        } catch (error) {
          console.error('Failed to fetch selected image:', error)
        }
      }
      fetchSelectedImage()
    } else if (!value) {
      setSelectedImage(null)
    }
  }, [value, selectedImage])

  // Fetch images for picker
  const fetchImages = useCallback(async (pageNum: number, append: boolean = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        page: pageNum.toString(),
        sort: '-createdAt',
      })

      const response = await fetch(`/api/media?${params}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.docs) {
          setImages(prev => (append ? [...prev, ...data.docs] : data.docs))
          setHasMore(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch images when picker opens
  useEffect(() => {
    if (showPicker && images.length === 0) {
      fetchImages(1)
    }
  }, [showPicker, images.length, fetchImages])

  // Filter images by search query
  const filteredImages = images.filter(img => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const filename = (img.filename || '').toLowerCase()
    const alt = (img.alt || '').toLowerCase()
    return filename.includes(query) || alt.includes(query)
  })

  // Handle image selection
  const handleSelect = (img: MediaItem) => {
    setValue(img.id)
    setSelectedImage(img)
    setShowPicker(false)
  }

  // Handle clear
  const handleClear = () => {
    setValue(null)
    setSelectedImage(null)
  }

  // Handle cancel
  const handleCancel = () => {
    setShowPicker(false)
    setSearchQuery('')
  }

  // Load more images
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchImages(nextPage, true)
    }
  }

  // Get image URL with thumbnail params
  const getImageUrl = (img: MediaItem, size: number = 150): string => {
    const url = img.imgixUrl || img.url || ''
    if (url.includes('imgix.net')) {
      return `${url}?w=${size}&h=${size}&fit=crop&auto=format`
    }
    return url
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Field Label */}
      <label
        style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: 500,
          fontSize: '0.875rem',
        }}
      >
        {field.label || field.name}
        {field.required && <span style={{ color: '#dc3545' }}> *</span>}
      </label>

      {/* Collapsed State */}
      {!showPicker && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.75rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
          }}
        >
          {/* Current Selection Thumbnail */}
          {selectedImage ? (
            <div
              style={{
                width: '80px',
                height: '80px',
                position: 'relative',
                borderRadius: '4px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <Image
                src={getImageUrl(selectedImage, 160)}
                alt={selectedImage.alt || selectedImage.filename || 'Selected image'}
                fill
                sizes="80px"
                style={{ objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                color: '#6c757d',
                fontSize: '0.75rem',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              No image
            </div>
          )}

          {/* Info and Actions */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {selectedImage ? (
                <span title={selectedImage.filename}>
                  {selectedImage.alt || selectedImage.filename || `Media #${selectedImage.id}`}
                </span>
              ) : (
                <span style={{ color: '#6c757d' }}>No image selected</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Select Image
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#fff',
                    color: '#dc3545',
                    border: '1px solid #dc3545',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Picker State */}
      {showPicker && (
        <div
          style={{
            border: '1px solid #007bff',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Picker Header */}
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Search by filename or alt text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Image Grid */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0.75rem',
            }}
          >
            {isLoading && images.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                Loading images...
              </div>
            ) : filteredImages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                {searchQuery ? 'No images match your search' : 'No images available'}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {filteredImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => handleSelect(img)}
                      style={{
                        position: 'relative',
                        paddingTop: '100%',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: value === img.id ? '#007bff' : 'transparent',
                        backgroundColor: '#f0f0f0',
                      }}
                    >
                      <Image
                        src={getImageUrl(img, 200)}
                        alt={img.alt || img.filename || 'Image'}
                        fill
                        sizes="100px"
                        style={{ objectFit: 'cover' }}
                      />
                      {value === img.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                          }}
                        >
                          {'\u2713'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={isLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {isLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Picker Footer */}
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: '#666' }}>
              {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#fff',
                    color: '#dc3545',
                    border: '1px solid #dc3545',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Selection
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
