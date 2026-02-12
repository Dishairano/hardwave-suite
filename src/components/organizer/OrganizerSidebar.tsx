"use client"

import { useState } from "react"
import {
  Files,
  Music,
  FolderKanban,
  Heart,
  Clock,
  Plus,
  Settings,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowLeft,
} from "lucide-react"
import type { Tag, Collection } from "../../types"

type ViewType = 'all' | 'samples' | 'projects' | 'favorites' | 'recent'

interface OrganizerSidebarProps {
  collections: Collection[]
  tags: Tag[]
  currentView: ViewType
  selectedCollectionId: number | null
  selectedTagId: number | null
  stats: { totalFiles: number; totalFavorites: number }
  onViewChange: (view: ViewType) => void
  onAddFolder: () => void
  onCollectionClick: (id: number) => void
  onTagClick: (id: number) => void
  onCreateCollection: () => void
  onManageTags: () => void
  onBackToHub?: () => void
}

interface NavItem {
  icon: React.ElementType
  label: string
  view: ViewType
  count?: number
}

export function OrganizerSidebar({
  collections,
  tags,
  currentView,
  selectedCollectionId,
  selectedTagId,
  stats,
  onViewChange,
  onAddFolder,
  onCollectionClick,
  onTagClick,
  onCreateCollection,
  onManageTags,
  onBackToHub
}: OrganizerSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Genre: true,
    Type: true,
    Mood: false,
  })

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const navItems: NavItem[] = [
    { icon: Files, label: "All Files", view: "all", count: stats.totalFiles },
    { icon: Music, label: "Samples", view: "samples" },
    { icon: FolderKanban, label: "Projects", view: "projects" },
    { icon: Heart, label: "Favorites", view: "favorites", count: stats.totalFavorites },
    { icon: Clock, label: "Recent", view: "recent" },
  ]

  // Group tags by category
  const tagGroups = tags.reduce((acc, tag) => {
    const category = tag.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-bg-hover bg-bg-secondary/50 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-bg-hover/60">
        {onBackToHub && (
          <button
            onClick={onBackToHub}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-accent-primary transition-colors mr-1"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-primary/15 border border-accent-primary/25">
          <Zap className="w-4 h-4 text-accent-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-text-primary">
            Hardwave Suite
          </h1>
          <p className="text-[10px] text-text-tertiary font-mono">
            ORGANIZER
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {/* Navigation */}
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = currentView === item.view && !selectedCollectionId && !selectedTagId
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onViewChange(item.view)}
                  className={`
                    flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors
                    ${isActive
                      ? "bg-accent-primary/10 text-accent-primary font-medium"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        isActive ? "text-accent-primary/70" : "text-text-tertiary/60"
                      }`}
                    >
                      {item.count.toLocaleString()}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Collections */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Collections
              </h3>
              <button
                type="button"
                onClick={onCreateCollection}
                className="p-0.5 rounded text-text-tertiary hover:text-accent-primary transition-colors"
                aria-label="Add collection"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {collections.length === 0 ? (
                <p className="px-3 text-xs text-text-tertiary italic">No collections yet</p>
              ) : (
                collections.map((col) => {
                  const isActive = selectedCollectionId === col.id
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => onCollectionClick(col.id)}
                      className={`
                        flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-sm transition-colors
                        ${isActive
                          ? "bg-accent-primary/10 text-accent-primary"
                          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }
                      `}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: col.color || '#6366f1' }}
                      />
                      <span className="flex-1 text-left truncate">{col.name}</span>
                      <span className="text-[11px] font-mono text-text-tertiary/60 tabular-nums">
                        {col.file_count || 0}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Tags
              </h3>
              <button
                type="button"
                onClick={onManageTags}
                className="p-0.5 rounded text-text-tertiary hover:text-accent-primary transition-colors"
                aria-label="Tag settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
            {Object.keys(tagGroups).length === 0 ? (
              <p className="px-3 text-xs text-text-tertiary italic">No tags yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(tagGroups).map(([category, categoryTags]) => (
                  <div key={category}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(category)}
                      className="flex items-center gap-1.5 w-full px-3 py-1 text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      {expandedGroups[category] ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      {category}
                    </button>
                    {expandedGroups[category] && (
                      <div className="flex flex-wrap gap-1 px-3 py-1">
                        {categoryTags.map((tag) => {
                          const isActive = selectedTagId === tag.id
                          return (
                            <span
                              key={tag.id}
                              onClick={() => onTagClick(tag.id)}
                              className={`
                                px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all
                                ${isActive
                                  ? "ring-2 ring-accent-primary ring-offset-1 ring-offset-bg-secondary"
                                  : "hover:opacity-80"
                                }
                              `}
                              style={{
                                backgroundColor: `${tag.color || '#6366f1'}20`,
                                color: tag.color || '#6366f1'
                              }}
                            >
                              {tag.name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Folder button */}
      <div className="p-3 border-t border-bg-hover/60">
        <button
          onClick={onAddFolder}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-text-tertiary hover:text-text-primary border border-dashed border-bg-hover bg-transparent hover:bg-bg-hover transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          Add Folder
        </button>
      </div>
    </aside>
  )
}
