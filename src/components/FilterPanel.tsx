import { useState, useEffect } from 'react'
import { X, Filter, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { Tag } from './Tag'
import type { Tag as TagType } from '../types'

export interface FilterState {
  bpmMin: number | null
  bpmMax: number | null
  keys: string[]
  fileTypes: string[]
  tagIds: number[]
  isFavorite: boolean | null
  minRating: number | null
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  tags: TagType[]
  filters: FilterState
  onApplyFilters: (filters: FilterState) => void
  onResetFilters: () => void
}

const MUSICAL_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
]

const FILE_TYPES = [
  { value: 'sample', label: 'Sample' },
  { value: 'one_shot', label: 'One Shot' },
  { value: 'loop', label: 'Loop' },
  { value: 'project', label: 'Project' },
  { value: 'flp', label: 'FLP' },
  { value: 'midi', label: 'MIDI' },
  { value: 'preset', label: 'Preset' },
]

export function FilterPanel({
  isOpen,
  onClose,
  tags,
  filters,
  onApplyFilters,
  onResetFilters,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  if (!isOpen) return null

  const handleApply = () => {
    onApplyFilters(localFilters)
    onClose()
  }

  const handleReset = () => {
    const resetFilters: FilterState = {
      bpmMin: null,
      bpmMax: null,
      keys: [],
      fileTypes: [],
      tagIds: [],
      isFavorite: null,
      minRating: null,
    }
    setLocalFilters(resetFilters)
    onResetFilters()
  }

  const toggleKey = (key: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      keys: prev.keys.includes(key)
        ? prev.keys.filter((k) => k !== key)
        : [...prev.keys, key],
    }))
  }

  const toggleFileType = (type: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(type)
        ? prev.fileTypes.filter((t) => t !== type)
        : [...prev.fileTypes, type],
    }))
  }

  const toggleTag = (tagId: number) => {
    setLocalFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }))
  }

  const hasActiveFilters =
    localFilters.bpmMin !== null ||
    localFilters.bpmMax !== null ||
    localFilters.keys.length > 0 ||
    localFilters.fileTypes.length > 0 ||
    localFilters.tagIds.length > 0 ||
    localFilters.isFavorite !== null ||
    localFilters.minRating !== null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Filters</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw size={14} />
                Reset
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* BPM Range */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">BPM Range</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={localFilters.bpmMin ?? ''}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    bpmMin: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="Min"
                min={60}
                max={200}
                className="w-24 px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
              <span className="text-text-tertiary">to</span>
              <input
                type="number"
                value={localFilters.bpmMax ?? ''}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    bpmMax: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="Max"
                min={60}
                max={200}
                className="w-24 px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
              <span className="text-xs text-text-tertiary">BPM</span>
            </div>
            {/* Quick BPM presets */}
            <div className="flex gap-2 mt-2">
              {[
                { label: 'Hardstyle', min: 150, max: 160 },
                { label: 'Rawstyle', min: 150, max: 155 },
                { label: 'Hardcore', min: 160, max: 200 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      bpmMin: preset.min,
                      bpmMax: preset.max,
                    }))
                  }
                  className="px-2 py-1 text-xs bg-bg-primary hover:bg-bg-hover rounded border border-bg-hover text-text-secondary"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Musical Key */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Musical Key</h3>
            <div className="grid grid-cols-12 gap-1">
              {MUSICAL_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => toggleKey(key)}
                  className={`px-2 py-1.5 text-xs rounded transition-colors ${
                    localFilters.keys.includes(key)
                      ? 'bg-accent-primary text-black font-semibold'
                      : 'bg-bg-primary hover:bg-bg-hover text-text-secondary'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* File Type */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">File Type</h3>
            <div className="flex flex-wrap gap-2">
              {FILE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleFileType(type.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    localFilters.fileTypes.includes(type.value)
                      ? 'bg-accent-primary text-black font-semibold'
                      : 'bg-bg-primary hover:bg-bg-hover text-text-secondary border border-bg-hover'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`transition-opacity ${
                      localFilters.tagIds.includes(tag.id)
                        ? 'ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-secondary'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Tag color={tag.color} size="sm">
                      {tag.name}
                    </Tag>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Other Options */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Other</h3>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localFilters.isFavorite === true}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      isFavorite: e.target.checked ? true : null,
                    }))
                  }
                  className="w-4 h-4 rounded border-bg-hover bg-bg-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-bg-secondary"
                />
                <span className="text-sm text-text-secondary">Favorites only</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Min rating:</span>
                <select
                  value={localFilters.minRating ?? ''}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      minRating: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  className="px-2 py-1 bg-bg-primary border border-bg-hover rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                >
                  <option value="">Any</option>
                  <option value="1">1+ stars</option>
                  <option value="2">2+ stars</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="5">5 stars</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-bg-hover">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
