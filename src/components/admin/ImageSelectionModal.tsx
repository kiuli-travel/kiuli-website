'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

interface MediaItem {
  id: number
  filename: string
  alt?: string
  altText?: string
  imgixUrl?: string
  url?: string
  country?: string
  imageType?: string
  sourceProperty?: string
  quality?: string
}

interface ImageSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (imageIds: number[]) => void
  currentlySelected: number[]
}

const COUNTRY_OPTIONS = [
  { label: 'All Countries', value: '' },
  { label: 'Tanzania', value: 'Tanzania' },
  { label: 'Kenya', value: 'Kenya' },
  { label: 'Botswana', value: 'Botswana' },
  { label: 'Rwanda', value: 'Rwanda' },
  { label: 'South Africa', value: 'South Africa' },
  { label: 'Zimbabwe', value: 'Zimbabwe' },
  { label: 'Zambia', value: 'Zambia' },
  { label: 'Namibia', value: 'Namibia' },
  { label: 'Uganda', value: 'Uganda' },
  { label: 'Mozambique', value: 'Mozambique' },
]

const IMAGE_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Wildlife', value: 'wildlife' },
  { label: 'Landscape', value: 'landscape' },
  { label: 'Accommodation', value: 'accommodation' },
  { label: 'Activity', value: 'activity' },
  { label: 'People', value: 'people' },
  { label: 'Food', value: 'food' },
  { label: 'Aerial', value: 'aerial' },
  { label: 'Detail', value: 'detail' },
]

const LIMIT = 50

export const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentlySelected,
}) => {
  const [images, setImages] = useState<MediaItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(currentlySelected))
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [properties, setProperties] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalDocs, setTotalDocs] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch distinct sourceProperty values on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/media?limit=500&depth=0', {
          credentials: 'include',
        })
        const data = await res.json()
        const uniqueProperties = [...new Set(
          data.docs
            .map((m: MediaItem & { sourceProperty?: string }) => m.sourceProperty)
            .filter((p: string | null | undefined) => p && p.trim() !== '')
        )].sort() as string[]
        setProperties(uniqueProperties)
      } catch (err) {
        console.error('Failed to fetch properties:', err)
      }
    }
    fetchProperties()
  }, [])

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(currentlySelected))
    }
  }, [isOpen, currentlySelected])

  // Build query URL
  const buildQueryUrl = useCallback((pageNum: number) => {
    const params = new URLSearchParams({
      limit: LIMIT.toString(),
      page: pageNum.toString(),
      sort: '-createdAt',
    })

    // Add search
    if (searchQuery.trim()) {
      // Search in filename, alt, altText, sourceProperty
      params.append('where[or][0][filename][contains]', searchQuery.trim())
      params.append('where[or][1][alt][contains]', searchQuery.trim())
      params.append('where[or][2][altText][contains]', searchQuery.trim())
      params.append('where[or][3][sourceProperty][contains]', searchQuery.trim())
    }

    // Add filters
    if (countryFilter) {
      params.append('where[country][equals]', countryFilter)
    }
    if (typeFilter) {
      params.append('where[imageType][equals]', typeFilter)
    }
    if (propertyFilter) {
      params.append('where[sourceProperty][equals]', propertyFilter)
    }

    return `/api/media?${params.toString()}`
  }, [searchQuery, countryFilter, typeFilter, propertyFilter])

  // Fetch images
  const fetchImages = useCallback(async (pageNum: number, append: boolean = false) => {
    setIsLoading(true)
    try {
      const response = await fetch(buildQueryUrl(pageNum), {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.docs) {
          setImages(prev => append ? [...prev, ...data.docs] : data.docs)
          setHasMore(data.hasNextPage || false)
          setTotalDocs(data.totalDocs || 0)
        }
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryUrl])

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    if (isOpen) {
      setPage(1)
      fetchImages(1, false)
    }
  }, [isOpen, countryFilter, typeFilter, propertyFilter, fetchImages])

  // Debounced search
  useEffect(() => {
    if (!isOpen) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1)
      fetchImages(1, false)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, isOpen, fetchImages])

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchImages(nextPage, true)
  }

  // Toggle selection
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Select all visible
  const selectAllVisible = () => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      images.forEach(img => newSet.add(img.id))
      return newSet
    })
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Handle confirm
  const handleConfirm = () => {
    onSelect(Array.from(selectedIds))
    onClose()
  }

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setCountryFilter('')
    setTypeFilter('')
    setPropertyFilter('')
  }

  // Get image src
  const getImageSrc = (image: MediaItem): string => {
    if (image.imgixUrl) {
      return `${image.imgixUrl}?w=150&h=150&fit=crop&auto=format`
    }
    if (image.url) {
      return image.url
    }
    return `/api/media/file/${image.filename}`
  }

  if (!isOpen) return null

  const newlySelected = Array.from(selectedIds).filter(id => !currentlySelected.includes(id))

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            Select Images from Library
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Search and Filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search images by name, description, or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '0.875rem',
              marginBottom: '12px',
            }}
          />

          {/* Filters */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#666', fontWeight: 500 }}>Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  minWidth: '140px',
                }}
              >
                {COUNTRY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#666', fontWeight: 500 }}>Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  minWidth: '140px',
                }}
              >
                {IMAGE_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#666', fontWeight: 500 }}>Lodge/Property</label>
              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  minWidth: '180px',
                  maxWidth: '220px',
                }}
              >
                <option value="">All Properties</option>
                {properties.map(prop => (
                  <option key={prop} value={prop}>{prop}</option>
                ))}
              </select>
            </div>

            {(searchQuery || countryFilter || typeFilter || propertyFilter) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  backgroundColor: '#f5f5f5',
                  cursor: 'pointer',
                  alignSelf: 'flex-end',
                }}
              >
                Clear Filters
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#666', alignSelf: 'flex-end' }}>
              {totalDocs} images found
            </div>
          </div>
        </div>

        {/* Selection Actions */}
        <div
          style={{
            padding: '8px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            fontSize: '0.875rem',
          }}
        >
          <span style={{ fontWeight: 500 }}>
            {selectedIds.size} selected
            {newlySelected.length > 0 && (
              <span style={{ color: '#28a745' }}> ({newlySelected.length} new)</span>
            )}
          </span>
          <button
            onClick={selectAllVisible}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Select All Visible
          </button>
          <button
            onClick={clearSelection}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dc3545',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Clear Selection
          </button>
        </div>

        {/* Image Grid */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
          }}
        >
          {isLoading && images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Loading images...
            </div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No images found. Try adjusting your search or filters.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px',
                }}
              >
                {images.map((image) => {
                  const isSelected = selectedIds.has(image.id)
                  const wasAlreadySelected = currentlySelected.includes(image.id)

                  return (
                    <div
                      key={image.id}
                      onClick={() => toggleSelection(image.id)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected
                          ? wasAlreadySelected
                            ? '3px solid #6c757d'
                            : '3px solid #28a745'
                          : '1px solid #e0e0e0',
                        backgroundColor: '#f5f5f5',
                      }}
                      title={image.alt || image.altText || image.filename}
                    >
                      <Image
                        src={getImageSrc(image)}
                        alt={image.alt || image.altText || image.filename}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="120px"
                        unoptimized={!image.imgixUrl}
                      />

                      {/* Selection Overlay */}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: wasAlreadySelected
                              ? 'rgba(108, 117, 125, 0.3)'
                              : 'rgba(40, 167, 69, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: wasAlreadySelected ? '#6c757d' : '#28a745',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                            }}
                          >
                            {'\u2713'}
                          </span>
                        </div>
                      )}

                      {/* Property Label */}
                      {image.sourceProperty && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: '#fff',
                            fontSize: '0.625rem',
                            padding: '2px 4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {image.sourceProperty}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    style={{
                      padding: '10px 24px',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                      color: '#007bff',
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

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: selectedIds.size > 0 ? '#007bff' : '#ccc',
              color: '#fff',
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            {newlySelected.length > 0
              ? `Add ${newlySelected.length} New Image${newlySelected.length !== 1 ? 's' : ''}`
              : `Confirm Selection (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
