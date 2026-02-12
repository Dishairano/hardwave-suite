"use client"

import { Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react"

interface ToolbarProps {
  fileCount: number
  viewMode: "grid" | "list"
  searchValue: string
  onViewChange: (mode: "grid" | "list") => void
  onSearchChange: (query: string) => void
  onFilterClick: () => void
}

export function Toolbar({
  fileCount,
  viewMode,
  searchValue,
  onViewChange,
  onSearchChange,
  onFilterClick
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-bg-hover bg-bg-secondary/30">
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, BPM, key, tags..."
          className="w-full h-9 pl-9 pr-4 rounded-lg bg-bg-hover/50 border border-bg-hover text-sm text-text-primary placeholder:text-text-tertiary/70 focus:outline-none focus:ring-1 focus:ring-accent-primary/50 focus:border-accent-primary/40 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-bg-hover bg-bg-hover/80 text-[10px] text-text-tertiary font-mono">
          /
        </kbd>
      </div>

      {/* Filter button */}
      <button
        onClick={onFilterClick}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-bg-hover bg-transparent hover:bg-bg-hover transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filter
      </button>

      {/* View toggle */}
      <div className="flex items-center rounded-lg border border-bg-hover bg-bg-hover/30 p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === "grid"
              ? "bg-bg-secondary text-text-primary"
              : "text-text-tertiary hover:text-text-primary"
          }`}
          aria-label="Grid view"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("list")}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === "list"
              ? "bg-bg-secondary text-text-primary"
              : "text-text-tertiary hover:text-text-primary"
          }`}
          aria-label="List view"
        >
          <List className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File count */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-bg-hover/40">
        <span className="text-sm font-medium text-text-primary tabular-nums">
          {fileCount.toLocaleString()}
        </span>
        <span className="text-sm text-text-tertiary">files</span>
      </div>
    </div>
  )
}
