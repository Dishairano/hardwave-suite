import { useState } from 'react'
import { X, Folder } from 'lucide-react'
import { Button } from './Button'

interface CreateCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, color: string, description: string) => Promise<void>
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#f43f5e',
]

export function CreateCollectionModal({
  isOpen,
  onClose,
  onCreate,
}: CreateCollectionModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[5])
  const [isCreating, setIsCreating] = useState(false)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      await onCreate(name.trim(), color, description.trim())
      setName('')
      setDescription('')
      setColor(COLORS[5])
      onClose()
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <div className="flex items-center gap-2">
            <Folder size={20} className="text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">New Collection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              className="w-full px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this collection for?"
              rows={2}
              className="w-full px-3 py-2 bg-bg-primary border border-bg-hover rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-bg-hover">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Collection'}
          </Button>
        </div>
      </div>
    </div>
  )
}
