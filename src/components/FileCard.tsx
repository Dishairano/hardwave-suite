import { memo, useMemo } from 'react'
import { Music, FileAudio, Play, Pause, Star } from 'lucide-react'
import { Tag } from './Tag'
import { Card } from './Card'
import type { File } from '../types'

interface FileCardProps {
  file: File
  selected?: boolean
  isPlaying?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onFavoriteToggle?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

// Generate stable waveform heights based on file hash
function generateWaveformHeights(seed: string, count: number): number[] {
  const heights: number[] = []
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }

  for (let i = 0; i < count; i++) {
    // Simple PRNG based on file hash
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    heights.push(20 + (hash % 80)) // 20-100% height
  }
  return heights
}

function FileCardComponent({
  file,
  selected = false,
  isPlaying = false,
  onClick,
  onDoubleClick,
  onFavoriteToggle,
  onContextMenu,
}: FileCardProps) {
  // Memoize waveform heights based on file hash - stable across rerenders
  const waveformHeights = useMemo(
    () => generateWaveformHeights(file.hash || file.filename, 40),
    [file.hash, file.filename]
  )

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu?.(e)
  }

  return (
    <Card
      selected={selected}
      onClick={onClick}
      className="group relative"
      onContextMenu={handleContextMenu}
    >
      {/* Waveform Placeholder */}
      <div className="h-16 bg-bg-primary rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
        {/* Memoized waveform bars */}
        <div className="flex items-center gap-0.5 h-full">
          {waveformHeights.map((height, i) => (
            <div
              key={i}
              className="w-0.5 bg-accent-primary/30 rounded-full"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Play button overlay (on hover or when playing) */}
        <div className={`absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform ${isPlaying ? 'bg-accent-warning' : 'bg-accent-primary'}`}
            onClick={(e) => {
              e.stopPropagation()
              onDoubleClick?.()
            }}
          >
            {isPlaying ? (
              <Pause size={18} className="text-black" fill="currentColor" />
            ) : (
              <Play size={18} className="text-black ml-0.5" fill="currentColor" />
            )}
          </button>
        </div>

        {/* Favorite star button */}
        <button
          className={`absolute top-2 right-2 p-1 rounded transition-all ${
            file.is_favorite
              ? 'opacity-100 text-accent-warning'
              : 'opacity-0 group-hover:opacity-100 text-white/70 hover:text-accent-warning'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onFavoriteToggle?.()
          }}
        >
          <Star size={16} fill={file.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* File Type Icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-bg-secondary border border-bg-hover flex items-center justify-center">
          {file.file_type === 'sample' || file.file_type === 'one_shot' || file.file_type === 'loop' ? (
            <Music size={16} className="text-accent-secondary" />
          ) : (
            <FileAudio size={16} className="text-accent-tertiary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {file.filename}
          </h3>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        {file.bpm && (
          <span className="px-2 py-0.5 rounded bg-bpm-raw/15 border border-bpm-raw/30 text-bpm-raw font-mono font-semibold">
            {Math.round(file.bpm)} BPM
          </span>
        )}
        {file.detected_key && (
          <span className="px-2 py-0.5 rounded bg-accent-secondary/15 border border-accent-secondary/30 text-accent-secondary font-semibold">
            {file.detected_key}
          </span>
        )}
        <span className="text-text-tertiary ml-auto">
          {formatDuration(file.duration)}
        </span>
      </div>

      {/* Tags */}
      {file.tags && file.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {file.tags.slice(0, 3).map((tag) => (
            <Tag key={tag.id} color={tag.color} size="xs">
              {tag.name}
            </Tag>
          ))}
          {file.tags.length > 3 && (
            <span className="text-xs text-text-tertiary">+{file.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-bg-hover">
        <span>{formatFileSize(file.file_size)}</span>
        {file.rating > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: file.rating }).map((_, i) => (
              <Star key={i} size={10} className="text-accent-warning" fill="currentColor" />
            ))}
          </div>
        )}
      </div>

      {/* Selection Checkbox */}
      {selected && (
        <div className="absolute top-2 left-2 w-5 h-5 rounded bg-accent-primary flex items-center justify-center">
          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </Card>
  )
}

// Memoize the entire component to prevent unnecessary rerenders
export const FileCard = memo(FileCardComponent, (prev, next) => {
  return (
    prev.file.id === next.file.id &&
    prev.file.is_favorite === next.file.is_favorite &&
    prev.file.rating === next.file.rating &&
    prev.selected === next.selected &&
    prev.isPlaying === next.isPlaying
  )
})
