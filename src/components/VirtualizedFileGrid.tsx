import { useRef, useState, useEffect, useCallback } from 'react'
import { FixedSizeGrid as Grid, GridOnScrollProps } from 'react-window'
import { FileCard } from './organizer/FileCard'
import { Loader2 } from 'lucide-react'
import type { File } from '../types'

interface VirtualizedFileGridProps {
  files: File[]
  selectedFiles: number[]
  currentlyPlaying: number | null
  onFileClick: (fileId: number) => void
  onFileDoubleClick: (file: File) => void
  onFavoriteToggle: (fileId: number) => void
  onContextMenu: (e: React.MouseEvent, fileId: number) => void
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

const CARD_MIN_WIDTH = 220
const CARD_HEIGHT = 300
const GAP = 16
const LOAD_MORE_THRESHOLD = 200

export function VirtualizedFileGrid({
  files,
  selectedFiles,
  currentlyPlaying,
  onFileClick,
  onFileDoubleClick,
  onFavoriteToggle,
  onContextMenu,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: VirtualizedFileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Measure container on mount and resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Calculate grid layout
  const columnCount = Math.max(1, Math.floor((dimensions.width + GAP) / (CARD_MIN_WIDTH + GAP)))
  const columnWidth = (dimensions.width - GAP * (columnCount - 1)) / columnCount
  const rowCount = Math.ceil(files.length / columnCount)
  const totalHeight = rowCount * (CARD_HEIGHT + GAP)

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    ({ scrollTop }: GridOnScrollProps) => {
      if (!hasMore || isLoadingMore || !onLoadMore) return

      const scrollBottom = scrollTop + dimensions.height
      if (scrollBottom >= totalHeight - LOAD_MORE_THRESHOLD) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore, dimensions.height, totalHeight]
  )

  // Cell renderer
  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * columnCount + columnIndex
      if (index >= files.length) return null

      const file = files[index]

      return (
        <div
          style={{
            ...style,
            left: Number(style.left) + GAP / 2,
            top: Number(style.top) + GAP / 2,
            width: Number(style.width) - GAP,
            height: Number(style.height) - GAP,
          }}
        >
          <FileCard
            file={file}
            selected={selectedFiles.includes(file.id)}
            isPlaying={currentlyPlaying === file.id}
            onSelect={onFileClick}
            onPlay={onFileDoubleClick}
            onToggleFavorite={onFavoriteToggle}
            onContextMenu={onContextMenu}
          />
        </div>
      )
    },
    [files, selectedFiles, currentlyPlaying, columnCount, onFileClick, onFileDoubleClick, onFavoriteToggle, onContextMenu]
  )

  if (dimensions.width === 0 || dimensions.height === 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Grid
        columnCount={columnCount}
        columnWidth={columnWidth + GAP}
        height={dimensions.height}
        rowCount={rowCount}
        rowHeight={CARD_HEIGHT + GAP}
        width={dimensions.width}
        overscanRowCount={2}
        onScroll={handleScroll}
      >
        {Cell}
      </Grid>

      {isLoadingMore && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-bg-secondary border border-bg-hover rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
          <Loader2 size={16} className="animate-spin text-accent-primary" />
          <span className="text-sm text-text-secondary">Loading more...</span>
        </div>
      )}
    </div>
  )
}
