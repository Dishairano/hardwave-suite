import { useEffect, useRef } from 'react'
import { Play, Star, Tags, Folder, Trash2, Info, Copy } from 'lucide-react'

interface ContextMenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position if menu would go off screen
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 40)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-secondary border border-bg-hover rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.divider && index > 0 && (
            <div className="my-1 border-t border-bg-hover" />
          )}
          <button
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              item.danger
                ? 'text-accent-error hover:bg-accent-error/10'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}

// Helper to create common menu items
export function createFileContextMenuItems(options: {
  onPlay: () => void
  onToggleFavorite: () => void
  isFavorite: boolean
  onAddTags: () => void
  onAddToCollection: () => void
  onShowDetails: () => void
  onCopyPath: () => void
  onDelete: () => void
}): ContextMenuItem[] {
  return [
    {
      label: 'Play',
      icon: <Play size={14} />,
      onClick: options.onPlay,
    },
    {
      label: options.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: <Star size={14} fill={options.isFavorite ? 'currentColor' : 'none'} />,
      onClick: options.onToggleFavorite,
    },
    {
      label: 'Add Tags',
      icon: <Tags size={14} />,
      onClick: options.onAddTags,
      divider: true,
    },
    {
      label: 'Add to Collection',
      icon: <Folder size={14} />,
      onClick: options.onAddToCollection,
    },
    {
      label: 'Show Details',
      icon: <Info size={14} />,
      onClick: options.onShowDetails,
      divider: true,
    },
    {
      label: 'Copy File Path',
      icon: <Copy size={14} />,
      onClick: options.onCopyPath,
    },
    {
      label: 'Remove from Library',
      icon: <Trash2 size={14} />,
      onClick: options.onDelete,
      danger: true,
      divider: true,
    },
  ]
}
