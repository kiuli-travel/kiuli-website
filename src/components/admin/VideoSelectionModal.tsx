'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

interface VideoItem {
  id: number
  filename: string
  alt?: string
  url?: string
  imgixUrl?: string
  mediaType?: string
}

interface VideoSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mediaIds: number[]) => void
  currentlySelected: number[]
}

const LIMIT = 30

export const VideoSelectionModal: React.FC<VideoSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentlySelected,
}) => {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(
    currentlySelected.length > 0 ? currentlySelected[0] : null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalDocs, setTotalDocs] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentlySelected.length > 0 ? currentlySelected[0] : null)
    }
  }, [isOpen, currentlySelected])

  // Build query URL
  const buildQueryUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        page: pageNum.toString(),
        sort: '-createdAt',
        'where[mediaType][equals]': 'video',
      })

      if (searchQuery.trim()) {
        params.append('where[or][0][filename][contains]', searchQuery.trim())
        params.append('where[or][1][alt][contains]', searchQuery.trim())
      }

      return `/api/media?${params.toString()}`
    },
    [searchQuery],
  )

  // Fetch videos
  const fetchVideos = useCallback(
    async (pageNum: number, append: boolean = false) => {
      setIsLoading(true)
      try {
        const response = await fetch(buildQueryUrl(pageNum), {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.docs) {
            setVideos((prev) => (append ? [...prev, ...data.docs] : data.docs))
            setHasMore(data.hasNextPage || false)
            setTotalDocs(data.totalDocs || 0)
          }
        }
      } catch (error) {
        console.error('Failed to fetch videos:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [buildQueryUrl],
  )

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    if (isOpen) {
      setPage(1)
      fetchVideos(1, false)
    }
  }, [isOpen, fetchVideos])

  // Debounced search
  useEffect(() => {
    if (!isOpen) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1)
      fetchVideos(1, false)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, isOpen, fetchVideos])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchVideos(nextPage, true)
  }

  const handleConfirm = () => {
    if (selectedId !== null) {
      onSelect([selectedId])
    }
    onClose()
  }

  const getVideoSrc = (video: VideoItem): string => {
    if (video.url) return video.url
    return `/api/media/file/${video.filename}`
  }

  if (!isOpen) return null

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
            Select Video from Library
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

        {/* Search */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <input
            type="text"
            placeholder="Search videos by filename or alt text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '0.875rem',
              color: '#666',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {selectedId !== null ? '1 selected' : '0 selected'}
            </span>
            <span>{totalDocs} videos found</span>
          </div>
        </div>

        {/* Video Grid */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
          }}
        >
          {isLoading && videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Loading videos...
            </div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No videos found in library.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {videos.map((video) => {
                  const isSelected = selectedId === video.id

                  return (
                    <div
                      key={video.id}
                      onClick={() => setSelectedId(isSelected ? null : video.id)}
                      style={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected
                          ? '3px solid #28a745'
                          : '1px solid #e0e0e0',
                        backgroundColor: '#000',
                      }}
                      title={video.alt || video.filename}
                    >
                      <video
                        src={getVideoSrc(video)}
                        muted
                        playsInline
                        preload="metadata"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
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
                            backgroundColor: 'rgba(40, 167, 69, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: '#28a745',
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

                      {/* Filename Label */}
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
                        {video.alt || video.filename}
                      </div>
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
              color: '#333',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedId === null}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: selectedId !== null ? '#007bff' : '#ccc',
              color: '#fff',
              cursor: selectedId !== null ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            Select Video
          </button>
        </div>
      </div>
    </div>
  )
}
