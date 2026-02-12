"use client"

import { Play, Pause, Star, FileAudio } from "lucide-react"
import { Waveform } from "./Waveform"
import type { File } from "../../types"

const tagColorMap: Record<string, string> = {
  Hardstyle: "bg-accent-primary/15 text-accent-primary border-accent-primary/20",
  Rawstyle: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/20",
  Hardcore: "bg-red-500/15 text-red-400 border-red-500/20",
  Kick: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Snare: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Lead: "bg-accent-primary/15 text-accent-primary border-accent-primary/20",
  FX: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/20",
  Dark: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  Euphoric: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  Aggressive: "bg-red-500/15 text-red-400 border-red-500/20",
}

interface FileCardProps {
  file: File
  selected: boolean
  isPlaying: boolean
  onSelect: (id: number) => void
  onPlay: (file: File) => void
  onToggleFavorite: (id: number) => void
  onContextMenu?: (e: React.MouseEvent, fileId: number) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileCard({
  file,
  selected,
  isPlaying,
  onSelect,
  onPlay,
  onToggleFavorite,
  onContextMenu
}: FileCardProps) {
  const tags = file.tags || []

  return (
    <div
      className={`
        group relative flex flex-col rounded-xl border bg-bg-secondary transition-all duration-200 cursor-pointer overflow-hidden
        ${selected
          ? "border-accent-primary/50 ring-1 ring-accent-primary/20 bg-accent-primary/[0.03]"
          : "border-bg-hover hover:border-text-tertiary hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
        }
      `}
      onClick={() => onSelect(file.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e, file.id)
      }}
      role="button"
      tabIndex={0}
      aria-label={`Sample: ${file.filename}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(file.id)
        }
      }}
    >
      {/* Waveform area */}
      <div className="relative h-24 bg-bg-hover/40 p-2">
        <Waveform seed={file.id} isPlaying={isPlaying} />

        {/* Play button overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPlay(file)
          }}
          className={`
            absolute inset-0 flex items-center justify-center transition-opacity duration-150
            ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
          `}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-primary text-white shadow-lg shadow-accent-primary/30">
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </div>
        </button>

        {/* Favorite button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(file.id)
          }}
          className={`
            absolute top-2 right-2 p-1 rounded transition-all
            ${file.is_favorite
              ? "text-yellow-400 opacity-100"
              : "text-text-tertiary/40 opacity-0 group-hover:opacity-100 hover:text-yellow-400"
            }
          `}
          aria-label={file.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className="w-4 h-4"
            fill={file.is_favorite ? "currentColor" : "none"}
          />
        </button>

        {/* Selection checkbox */}
        <div
          className={`
            absolute top-2 left-2 w-4 h-4 rounded border-2 transition-all flex items-center justify-center
            ${selected
              ? "bg-accent-primary border-accent-primary"
              : "border-text-tertiary/30 opacity-0 group-hover:opacity-100"
            }
          `}
        >
          {selected && (
            <svg
              viewBox="0 0 12 12"
              className="w-2.5 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-2 p-3">
        {/* Filename */}
        <div className="flex items-center gap-1.5">
          <FileAudio className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">
            {file.filename}
          </span>
        </div>

        {/* BPM / Key badges */}
        <div className="flex items-center gap-1.5">
          {file.bpm && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20 tabular-nums">
              {Math.round(file.bpm)} BPM
            </span>
          )}
          {file.detected_key && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-tertiary/15 text-accent-tertiary border border-accent-tertiary/20">
              {file.detected_key}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={typeof tag === 'string' ? tag : tag.id}
                className={`
                  px-1.5 py-0.5 rounded text-[10px] font-medium border
                  ${tagColorMap[typeof tag === 'string' ? tag : tag.name] ||
                    "bg-bg-hover text-text-secondary border-bg-hover"
                  }
                `}
              >
                {typeof tag === 'string' ? tag : tag.name}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-text-tertiary">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: size + rating */}
        <div className="flex items-center justify-between pt-1 border-t border-bg-hover/40">
          <span className="text-[11px] text-text-tertiary font-mono tabular-nums">
            {formatFileSize(file.file_size)}
          </span>
          <div className="flex gap-0.5" aria-label={`Rating: ${file.rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i < file.rating
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-text-tertiary/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
