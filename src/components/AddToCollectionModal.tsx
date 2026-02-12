import { useState } from 'react'
import { X, Folder, Check } from 'lucide-react'
import { Button } from './Button'
import type { Collection } from '../types'

interface AddToCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  collections: Collection[]
  selectedFileCount: number
  onAddToCollection: (collectionId: number) => Promise<void>
}

export function AddToCollectionModal({
  isOpen,
  onClose,
  collections,
  selectedFileCount,
  onAddToCollection,
}: AddToCollectionModalProps) {
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  if (!isOpen) return null

  const handleAdd = async () => {
    if (selectedCollection === null) return
    setIsAdding(true)
    try {
      await onAddToCollection(selectedCollection)
      setSelectedCollection(null)
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <div className="flex items-center gap-2">
            <Folder size={20} className="text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Add to Collection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-text-secondary">
          Adding {selectedFileCount} file{selectedFileCount !== 1 ? 's' : ''} to collection
        </p>

        {/* Collection List */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {collections.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-4">
              No collections yet. Create a collection first.
            </p>
          ) : (
            <div className="space-y-1">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => setSelectedCollection(collection.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedCollection === collection.id
                      ? 'bg-accent-primary/20 border border-accent-primary'
                      : 'bg-bg-primary hover:bg-bg-hover border border-transparent'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: collection.color || '#6b7280' }}
                  />
                  <span className="flex-1 text-left text-sm text-text-primary truncate">
                    {collection.name}
                  </span>
                  {collection.file_count !== undefined && (
                    <span className="text-xs text-text-tertiary">
                      {collection.file_count} files
                    </span>
                  )}
                  {selectedCollection === collection.id && (
                    <Check size={16} className="text-accent-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-bg-hover">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={selectedCollection === null || isAdding}
          >
            {isAdding ? 'Adding...' : 'Add to Collection'}
          </Button>
        </div>
      </div>
    </div>
  )
}
