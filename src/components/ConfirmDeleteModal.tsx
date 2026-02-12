import { useState } from 'react'
import { X, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  fileCount: number
  onConfirm: () => Promise<void>
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  fileCount,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-hover">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-accent-error" />
            <h2 className="text-lg font-semibold text-text-primary">Confirm Delete</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-text-secondary">
            Are you sure you want to remove{' '}
            <span className="text-text-primary font-semibold">
              {fileCount} file{fileCount !== 1 ? 's' : ''}
            </span>{' '}
            from your library?
          </p>
          <p className="text-sm text-text-tertiary mt-2">
            This will only remove the files from your library index. The actual files on disk will not be deleted.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-bg-hover">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
