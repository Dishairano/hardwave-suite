import { useState } from 'react'
import { X, Star, Play, Pause, Folder, Clock, Music, Hash, Tag as TagIcon } from 'lucide-react'
import { Tag } from './Tag'
import type { File } from '../types'

interface FileDetailsPanelProps {
  isOpen: boolean
  onClose: () => void
  file: File | null
  isPlaying: boolean
  onPlay: () => void
  onToggleFavorite: () => Promise<void>
  onUpdateRating: (rating: number) => Promise<void>
  onRemoveTag: (tagId: number) => Promise<void>
}

export function FileDetailsPanel({
  isOpen,
  onClose,
  file,
  isPlaying,
  onPlay,
  onToggleFavorite,
  onUpdateRating,
  onRemoveTag,
}: FileDetailsPanelProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)

  if (!isOpen || !file) return null

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--'
    const mb = bytes / 1024 / 1024
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '--'
    return new Date(timestamp).toLocaleDateString()
  }

  const displayRating = hoveredRating ?? file.rating ?? 0

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-bg-secondary border-l border-bg-hover shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bg-hover">
        <h2 className="text-lg font-semibold text-text-primary truncate">{file.filename}</h2>
        <button
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Waveform & Play Button */}
        <div className="p-4">
          <div className="h-24 bg-bg-primary rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Simple waveform visualization */}
            <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full ${isPlaying ? 'bg-accent-primary' : 'bg-accent-primary/30'}`}
                  style={{
                    height: `${Math.random() * 80 + 10}%`,
                    transition: 'height 0.1s',
                  }}
                />
              ))}
            </div>
            <button
              onClick={onPlay}
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isPlaying ? 'bg-accent-warning' : 'bg-accent-primary hover:bg-accent-primary/80'
              }`}
            >
              {isPlaying ? (
                <Pause size={24} className="text-black" fill="currentColor" />
              ) : (
                <Play size={24} className="text-black ml-1" fill="currentColor" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <button
            onClick={onToggleFavorite}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              file.is_favorite
                ? 'bg-accent-warning/20 text-accent-warning'
                : 'bg-bg-primary text-text-tertiary hover:text-accent-warning'
            }`}
          >
            <Star size={16} fill={file.is_favorite ? 'currentColor' : 'none'} />
            <span className="text-sm">{file.is_favorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {/* Rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                onClick={() => onUpdateRating(star === file.rating ? 0 : star)}
                className="p-0.5"
              >
                <Star
                  size={18}
                  className={`transition-colors ${
                    star <= displayRating ? 'text-accent-warning' : 'text-text-tertiary'
                  }`}
                  fill={star <= displayRating ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="px-4 pb-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
            Audio Info
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {file.bpm && (
              <div className="bg-bg-primary p-2 rounded-lg">
                <div className="flex items-center gap-1.5 text-text-tertiary mb-0.5">
                  <Hash size={12} />
                  <span className="text-xs">BPM</span>
                </div>
                <span className="text-sm font-semibold text-bpm-raw">{Math.round(file.bpm)}</span>
              </div>
            )}
            {file.detected_key && (
              <div className="bg-bg-primary p-2 rounded-lg">
                <div className="flex items-center gap-1.5 text-text-tertiary mb-0.5">
                  <Music size={12} />
                  <span className="text-xs">Key</span>
                </div>
                <span className="text-sm font-semibold text-accent-secondary">{file.detected_key}</span>
              </div>
            )}
            <div className="bg-bg-primary p-2 rounded-lg">
              <div className="flex items-center gap-1.5 text-text-tertiary mb-0.5">
                <Clock size={12} />
                <span className="text-xs">Duration</span>
              </div>
              <span className="text-sm font-semibold text-text-primary">{formatDuration(file.duration)}</span>
            </div>
            <div className="bg-bg-primary p-2 rounded-lg">
              <div className="flex items-center gap-1.5 text-text-tertiary mb-0.5">
                <Folder size={12} />
                <span className="text-xs">Size</span>
              </div>
              <span className="text-sm font-semibold text-text-primary">{formatFileSize(file.file_size)}</span>
            </div>
          </div>

          {/* Technical Info */}
          <div className="text-xs text-text-tertiary space-y-1 pt-2">
            {file.sample_rate && <p>Sample Rate: {file.sample_rate / 1000}kHz</p>}
            {file.bit_depth && <p>Bit Depth: {file.bit_depth}-bit</p>}
            {file.channels && <p>Channels: {file.channels === 1 ? 'Mono' : 'Stereo'}</p>}
            <p>Type: {file.file_type}</p>
            <p>Modified: {formatDate(file.modified_at)}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide flex items-center gap-1.5">
              <TagIcon size={12} />
              Tags
            </h3>
          </div>
          {file.tags && file.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {file.tags.map((tag) => (
                <div key={tag.id} className="group relative">
                  <Tag color={tag.color} size="sm">
                    {tag.name}
                  </Tag>
                  <button
                    onClick={() => onRemoveTag(tag.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-accent-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No tags</p>
          )}
        </div>

        {/* File Path */}
        <div className="px-4 pb-4">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
            Location
          </h3>
          <p className="text-xs text-text-tertiary break-all bg-bg-primary p-2 rounded-lg">
            {file.file_path}
          </p>
        </div>
      </div>
    </div>
  )
}
