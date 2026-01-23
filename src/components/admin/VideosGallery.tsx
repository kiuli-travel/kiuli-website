'use client'

import React, { useState, useEffect } from 'react'
import { useField } from '@payloadcms/ui'

interface MediaItem {
  id: number
  filename: string
  alt?: string
  imgixUrl?: string
  url?: string
  mimeType?: string
  thumbnailURL?: string
  sizes?: {
    thumbnail?: {
      url?: string
    }
  }
}

/**
 * Gallery preview for the videos field in Itineraries.
 * Shows thumbnails of all videos with playable video player.
 */
export const VideosGallery: React.FC = () => {
  const { value } = useField<number[] | null>({ path: 'videos' })
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null)

  // Fetch video data when value changes
  useEffect(() => {
    if (!value || value.length === 0) {
      setVideos([])
      return
    }

    const fetchVideos = async () => {
      setIsLoading(true)
      try {
        const videoPromises = value.map(async (id) => {
          try {
            const response = await fetch(`/api/media/${id}`, {
              credentials: 'include',
            })
            if (response.ok) {
              return await response.json()
            }
          } catch (error) {
            console.error(`Failed to fetch video ${id}:`, error)
          }
          return null
        })

        const results = await Promise.all(videoPromises)
        // Filter to only include actual video files
        const videoResults = results.filter(
          (item): item is MediaItem => item && item.mimeType?.startsWith('video/')
        )
        setVideos(videoResults)
      } catch (error) {
        console.error('Failed to fetch videos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideos()
  }, [value])

  const getVideoUrl = (video: MediaItem): string => {
    if (video.imgixUrl) {
      return video.imgixUrl
    }
    if (video.url) {
      return video.url
    }
    return `/api/media/file/${video.filename}`
  }

  const totalCount = videos.length

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
          All Videos ({totalCount} total)
        </span>
      </div>

      {isLoading ? (
        <div style={{ color: '#999', fontSize: '0.875rem' }}>Loading videos...</div>
      ) : videos.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
          }}
        >
          {videos.map((video) => (
            <div
              key={video.id}
              style={{
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #e0e0e0',
                backgroundColor: '#000',
              }}
            >
              {/* Video Header */}
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{video.alt || video.filename}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPlayingVideoId(playingVideoId === video.id ? null : video.id)
                  }
                  style={{
                    padding: '4px 12px',
                    backgroundColor: playingVideoId === video.id ? '#dc3545' : '#198754',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {playingVideoId === video.id ? 'Hide Player' : 'Watch Video'}
                </button>
              </div>

              {/* Video Thumbnail (when not playing) */}
              {playingVideoId !== video.id && (
                <div
                  style={{
                    position: 'relative',
                    paddingTop: '56.25%', // 16:9 aspect ratio
                    backgroundColor: '#1a1a1a',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPlayingVideoId(video.id)}
                >
                  <video
                    src={getVideoUrl(video)}
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
                  {/* Play button overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Video Player (when playing) */}
              {playingVideoId === video.id && (
                <video
                  src={getVideoUrl(video)}
                  controls
                  autoPlay
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    display: 'block',
                  }}
                />
              )}
            </div>
          ))}
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
          No videos in this itinerary yet.
        </div>
      )}
    </div>
  )
}
