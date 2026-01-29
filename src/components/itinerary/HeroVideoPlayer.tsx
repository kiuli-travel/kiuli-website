'use client'

import { useState, useRef } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface HeroVideoPlayerProps {
  src: string
  poster?: string
  className?: string
}

/**
 * Hero video player with luxury-appropriate controls.
 * - Does NOT autoplay
 * - Shows poster image until play is clicked
 * - Subtle controls (play/pause, mute/unmute)
 * - Loops when playing
 */
export function HeroVideoPlayer({ src, poster, className }: HeroVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showControls, setShowControls] = useState(true)

  const handlePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      setShowControls(true)
    } else {
      video.play()
      setIsPlaying(true)
      // Hide controls after a delay when playing
      setTimeout(() => setShowControls(false), 2000)
    }
  }

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video) return

    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (isPlaying) {
      // Hide controls after inactivity
      setTimeout(() => {
        if (isPlaying) setShowControls(false)
      }, 2000)
    }
  }

  const handleVideoEnd = () => {
    // Loop the video
    const video = videoRef.current
    if (video) {
      video.currentTime = 0
      video.play()
    }
  }

  return (
    <div
      className={`cursor-pointer ${className || ''}`}
      onClick={handlePlayPause}
      onMouseMove={handleMouseMove}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        poster={poster}
        muted={isMuted}
        playsInline
        onEnded={handleVideoEnd}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Play button overlay (shown when paused) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white transition-all hover:bg-white/30 hover:scale-105"
            aria-label="Play video"
          >
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </button>
        </div>
      )}

      {/* Controls overlay (bottom) */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Play/Pause button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePlayPause()
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white transition-colors hover:bg-white/20"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            )}
          </button>

          {/* Mute/Unmute button */}
          <button
            onClick={handleMuteToggle}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white transition-colors hover:bg-white/20"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
