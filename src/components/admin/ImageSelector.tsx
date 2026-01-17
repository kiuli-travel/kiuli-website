'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface MediaImage {
  id: number
  filename: string
  alt?: string
  imgixUrl?: string
  url?: string
  labels?: string[]
  sourceItinerary?: { id: number; title?: string }
  usedInItineraries?: { id: number; title?: string }[]
  processingStatus?: string
  labelingStatus?: string
}

interface ImageSelectorProps {
  onSelect: (mediaId: number) => void
  onClose: () => void
  currentItineraryId?: number
  excludeIds?: number[]
}

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  onSelect,
  onClose,
  currentItineraryId,
  excludeIds = [],
}) => {
  const [images, setImages] = useState<MediaImage[]>([])
  const [filteredImages, setFilteredImages] = useState<MediaImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used'>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50

  const fetchImages = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        page: pageNum.toString(),
        sort: '-createdAt',
      })

      const response = await fetch(`/api/media?${params}`, {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.docs) {
        const newImages = data.docs.filter((img: MediaImage) => !excludeIds.includes(img.id))
        setImages(prev => (append ? [...prev, ...newImages] : newImages))
        setHasMore(data.hasNextPage || false)
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setIsLoading(false)
    }
  }, [excludeIds])

  useEffect(() => {
    fetchImages(1)
  }, [fetchImages])

  useEffect(() => {
    let result = images

    // Filter by search query (filename, alt, labels)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(img => {
        const filename = (img.filename || '').toLowerCase()
        const alt = (img.alt || '').toLowerCase()
        const labels = (img.labels || []).join(' ').toLowerCase()
        return filename.includes(query) || alt.includes(query) || labels.includes(query)
      })
    }

    // Filter by usage status
    if (filterStatus === 'available') {
      result = result.filter(img => {
        const usedIn = img.usedInItineraries || []
        return usedIn.length === 0 || (usedIn.length === 1 && usedIn[0]?.id === currentItineraryId)
      })
    } else if (filterStatus === 'used') {
      result = result.filter(img => {
        const usedIn = img.usedInItineraries || []
        return usedIn.length > 0 && !(usedIn.length === 1 && usedIn[0]?.id === currentItineraryId)
      })
    }

    setFilteredImages(result)
  }, [images, searchQuery, filterStatus, currentItineraryId])

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchImages(nextPage, true)
    }
  }

  const getImageUrl = (img: MediaImage): string => {
    const url = img.imgixUrl || img.url || ''
    // Add imgix params for thumbnail
    if (url.includes('imgix.net')) {
      return `${url}?w=150&h=150&fit=crop&auto=format`
    }
    return url
  }

  const getUsageText = (img: MediaImage): string => {
    const usedIn = img.usedInItineraries || []
    if (usedIn.length === 0) return 'Not used'
    if (usedIn.length === 1) {
      const itin = usedIn[0]
      if (itin?.id === currentItineraryId) return 'This itinerary'
      return itin?.title || `Itinerary ${itin?.id}`
    }
    return `${usedIn.length} itineraries`
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '1000px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Select Image</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
            }}
          >
            {'\u00d7'}
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="Search by filename, alt text, or labels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['all', 'available', 'used'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid',
                  borderColor: filterStatus === status ? '#007bff' : '#ccc',
                  backgroundColor: filterStatus === status ? '#007bff' : '#fff',
                  color: filterStatus === status ? '#fff' : '#333',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Image Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
          }}
        >
          {isLoading && images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading images...</div>
          ) : filteredImages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              {searchQuery || filterStatus !== 'all' ? 'No images match your filters' : 'No images available'}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                }}
              >
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedId(img.id)}
                    style={{
                      border: '2px solid',
                      borderColor: selectedId === img.id ? '#007bff' : '#e0e0e0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, transform 0.2s',
                      transform: selectedId === img.id ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        paddingTop: '100%',
                        position: 'relative',
                        backgroundColor: '#f0f0f0',
                      }}
                    >
                      <Image
                        src={getImageUrl(img)}
                        alt={img.alt || img.filename || 'Image'}
                        fill
                        sizes="150px"
                        style={{ objectFit: 'cover' }}
                      />
                      {selectedId === img.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                          }}
                        >
                          {'\u2713'}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0.5rem' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#333',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={img.alt || img.filename}
                      >
                        {img.alt || img.filename || 'Untitled'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: '#999',
                          marginTop: '0.25rem',
                        }}
                      >
                        {getUsageText(img)}
                      </div>
                      {img.labels && img.labels.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.625rem',
                            color: '#666',
                            marginTop: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {img.labels.slice(0, 3).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
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
            padding: '1rem',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
          }}
        >
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''} found
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => selectedId && onSelect(selectedId)}
              disabled={!selectedId}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: selectedId ? '#007bff' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedId ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
              }}
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
