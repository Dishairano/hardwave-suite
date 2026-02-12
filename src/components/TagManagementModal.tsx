import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from './Button'
import { Tag } from './Tag'
import type { Tag as TagType } from '../types'

interface TagManagementModalProps {
  isOpen: boolean
  onClose: () => void
  tags: TagType[]
  onCreateTag: (name: string, category: string, color: string) => Promise<void>
  onDeleteTag: (id: number) => Promise<void>
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#f43f5e',
]

const CATEGORIES = [
  { value: 'genre', label: 'Genre' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'energy', label: 'Energy' },
  { value: 'custom', label: 'Custom' },
]

export function TagManagementModal({
  isOpen,
  onClose,
  tags,
  onCreateTag,
  onDeleteTag,
}: TagManagementModalProps) {
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState('custom')
  const [newTagColor, setNewTagColor] = useState(COLORS[0])
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!newTagName.trim()) return
    setIsCreating(true)
    try {
      await onCreateTag(newTagName.trim(), newTagCategory, newTagColor)
      setNewTagName('')
      setNewTagColor(COLORS[Math.floor(Math.random() * COLORS.length)])
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await onDeleteTag(id)
    } finally {
      setDeletingId(null)
    }
  }

  const groupedTags = tags.reduce((acc, tag) => {
    const category = tag.category || 'custom'
    if (!acc[category]) acc[category] = []
    acc[category].push(tag)
    return acc
  }, {} as Record<string, TagType[]>)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <h2 className="text-lg font-semibold text-text-primary">Manage Tags</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Create New Tag */}
        <div className="p-4 border-b border-bg-hover">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Create New Tag</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
              className="px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-primary"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-text-tertiary">Color:</span>
            <div className="flex gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newTagColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={!newTagName.trim() || isCreating}
            className="w-full"
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'Create Tag'}
          </Button>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(groupedTags).map(([category, categoryTags]) => (
            <div key={category} className="mb-4">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                {CATEGORIES.find((c) => c.value === category)?.label || category}
              </h4>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1 group"
                  >
                    <Tag color={tag.color} size="sm">
                      {tag.name}
                    </Tag>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      disabled={deletingId === tag.id}
                      className="p-1 text-text-tertiary hover:text-accent-error opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">
              No tags yet. Create your first tag above.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-bg-hover">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
