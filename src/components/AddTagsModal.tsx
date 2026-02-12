import { useState } from 'react'
import { X, Tags } from 'lucide-react'
import { Button } from './Button'
import { Tag } from './Tag'
import type { Tag as TagType } from '../types'

interface AddTagsModalProps {
  isOpen: boolean
  onClose: () => void
  tags: TagType[]
  selectedFileCount: number
  onAddTags: (tagIds: number[]) => Promise<void>
}

export function AddTagsModal({
  isOpen,
  onClose,
  tags,
  selectedFileCount,
  onAddTags,
}: AddTagsModalProps) {
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [isAdding, setIsAdding] = useState(false)

  if (!isOpen) return null

  const handleToggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleAdd = async () => {
    if (selectedTags.length === 0) return
    setIsAdding(true)
    try {
      await onAddTags(selectedTags)
      setSelectedTags([])
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  const groupedTags = tags.reduce((acc, tag) => {
    const category = tag.category || 'custom'
    if (!acc[category]) acc[category] = []
    acc[category].push(tag)
    return acc
  }, {} as Record<string, TagType[]>)

  const categoryLabels: Record<string, string> = {
    genre: 'Genre',
    instrument: 'Instrument',
    energy: 'Energy',
    custom: 'Custom',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <div className="flex items-center gap-2">
            <Tags size={20} className="text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Add Tags</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-text-secondary">
          Adding tags to {selectedFileCount} file{selectedFileCount !== 1 ? 's' : ''}
        </p>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(groupedTags).map(([category, categoryTags]) => (
            <div key={category} className="mb-4">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                {categoryLabels[category] || category}
              </h4>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.id)}
                    className={`transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-secondary'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Tag color={tag.color} size="sm">
                      {tag.name}
                    </Tag>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">
              No tags available. Create tags first in the tag manager.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-bg-hover">
          <span className="text-sm text-text-tertiary">
            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={selectedTags.length === 0 || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add Tags'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
