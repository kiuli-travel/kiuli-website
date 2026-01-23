'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useField } from '@payloadcms/ui'

interface MediaItem {
  id: number
  filename: string
  alt?: string
  url?: string
  mimeType?: string
  thumbnailURL?: string
  sizes?: {
    thumbnail?: {
      url?: string
    }
  }
}

interface VideoSelectorFieldProps {
  field: {
    label?: string
    required?: boolean
    name: string
  }
  path: string
}

export const VideoSelectorField: React.FC<VideoSelectorFieldProps> = ({ field, path }) => {
  const { value, setValue } = useField<number | null>({ path })

  // UI State - starts COLLAPSED
  const [showPicker, setShowPicker] = useState(false)
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<MediaItem | null>(null)
  const [showPlayer, setShowPlayer] = useState(false)

  const LIMIT = 20

  // Fetch current selected video when value changes
  useEffect(() => {
    if (value && !selectedVideo) {
      const fetchSelectedVideo = async () => {
        try {
          const response = await fetch(`/api/media/${value}`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            setSelectedVideo(data)
          }
        } catch (error) {
          console.error('Failed to fetch selected video:', error)
        }
      }
      fetchSelectedVideo()
    } else if (!value) {
      setSelectedVideo(null)
    }
  }, [value, selectedVideo])

  // Fetch videos for picker (filtered by mediaType=video)
  const fetchVideos = useCallback(async (pageNum: number, append: boolean = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        page: pageNum.toString(),
        sort: '-createdAt',
        'where[mediaType][equals]': 'video',
      })

      const response = await fetch(`/api/media?${params}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.docs) {
          setVideos(prev => (append ? [...prev, ...data.docs] : data.docs))
          setHasMore(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch videos when picker opens
  useEffect(() => {
    if (showPicker && videos.length === 0) {
      fetchVideos(1)
    }
  }, [showPicker, videos.length, fetchVideos])

  // Filter videos by search query
  const filteredVideos = videos.filter(vid => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const filename = (vid.filename || '').toLowerCase()
    const alt = (vid.alt || '').toLowerCase()
    return filename.includes(query) || alt.includes(query)
  })

  // Handle video selection
  const handleSelect = (vid: MediaItem) => {
    setValue(vid.id)
    setSelectedVideo(vid)
    setShowPicker(false)
  }

  // Handle clear
  const handleClear = () => {
    setValue(null)
    setSelectedVideo(null)
    setShowPlayer(false)
  }

  // Handle cancel
  const handleCancel = () => {
    setShowPicker(false)
    setSearchQuery('')
  }

  // Load more videos
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchVideos(nextPage, true)
    }
  }

  // Get video thumbnail URL
  const getThumbnailUrl = (vid: MediaItem): string | null => {
    // Try to get thumbnail from sizes
    if (vid.sizes?.thumbnail?.url) {
      return vid.sizes.thumbnail.url
    }
    if (vid.thumbnailURL) {
      return vid.thumbnailURL
    }
    return null
  }

  // Check if it's a video file
  const isVideoFile = (vid: MediaItem): boolean => {
    return vid.mimeType?.startsWith('video/') || false
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
          {/* Current Selection Thumbnail/Preview */}
          {selectedVideo ? (
            <div
              style={{
                width: '120px',
                height: '80px',
                position: 'relative',
                borderRadius: '4px',
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#000',
              }}
            >
              {isVideoFile(selectedVideo) && selectedVideo.url ? (
                <video
                  src={selectedVideo.url}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : getThumbnailUrl(selectedVideo) ? (
                <img
                  src={getThumbnailUrl(selectedVideo)!}
                  alt={selectedVideo.alt || selectedVideo.filename || 'Video thumbnail'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#333',
                    color: '#fff',
                    fontSize: '0.75rem',
                  }}
                >
                  Video
                </div>
              )}
              {/* Play icon overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '120px',
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
              No video
            </div>
          )}

          {/* Info and Actions */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {selectedVideo ? (
                <span title={selectedVideo.filename}>
                  {selectedVideo.alt || selectedVideo.filename || `Video #${selectedVideo.id}`}
                </span>
              ) : (
                <span style={{ color: '#6c757d' }}>No video selected</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#6f42c1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Select Video
              </button>
              {selectedVideo && (
                <button
                  type="button"
                  onClick={() => setShowPlayer(!showPlayer)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#198754',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  {showPlayer ? 'Hide Video' : 'Watch Video'}
                </button>
              )}
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

      {/* Expandable Video Player */}
      {showPlayer && selectedVideo && !showPicker && (
        <div
          style={{
            marginTop: '0.75rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <video
            src={selectedVideo.url}
            controls
            style={{
              width: '100%',
              maxHeight: '400px',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Expanded Picker State */}
      {showPicker && (
        <div
          style={{
            border: '1px solid #6f42c1',
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

          {/* Video Grid */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0.75rem',
            }}
          >
            {isLoading && videos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                Loading videos...
              </div>
            ) : filteredVideos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                {searchQuery ? 'No videos match your search' : 'No videos available'}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {filteredVideos.map((vid) => (
                    <div
                      key={vid.id}
                      onClick={() => handleSelect(vid)}
                      style={{
                        position: 'relative',
                        paddingTop: '56.25%', // 16:9 aspect ratio
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: value === vid.id ? '#6f42c1' : 'transparent',
                        backgroundColor: '#000',
                      }}
                    >
                      {isVideoFile(vid) && vid.url ? (
                        <video
                          src={vid.url}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : getThumbnailUrl(vid) ? (
                        <img
                          src={getThumbnailUrl(vid)!}
                          alt={vid.alt || vid.filename || 'Video'}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#333',
                            color: '#fff',
                            fontSize: '0.75rem',
                          }}
                        >
                          {vid.filename || 'Video'}
                        </div>
                      )}
                      {/* Play icon overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      </div>
                      {/* Selection indicator */}
                      {value === vid.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#6f42c1',
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
                      {/* Filename */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '0.6875rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {vid.filename || `Video #${vid.id}`}
                      </div>
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
              {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
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
