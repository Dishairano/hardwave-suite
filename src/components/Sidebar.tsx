import { Home, Star, Clock, Folder, Plus, Music, FileAudio } from 'lucide-react'
import { Tag } from './Tag'
import { Button } from './Button'

type ViewType = 'all' | 'samples' | 'projects' | 'favorites' | 'recent'

interface SidebarProps {
  collections: Array<{ id: number; name: string; color?: string; file_count?: number }>
  tags: Array<{ id: number; name: string; color?: string }>
  currentView: ViewType
  selectedCollectionId?: number | null
  selectedTagId?: number | null
  onViewChange: (view: ViewType) => void
  onAddFolder: () => void
  onCollectionClick?: (id: number) => void
  onTagClick?: (id: number) => void
  onCreateCollection?: () => void
  onManageTags?: () => void
}

export function Sidebar({
  collections,
  tags,
  currentView,
  selectedCollectionId,
  selectedTagId,
  onViewChange,
  onAddFolder,
  onCollectionClick,
  onTagClick,
  onCreateCollection,
  onManageTags,
}: SidebarProps) {
  return (
    <div className="w-60 bg-bg-secondary border-r border-bg-hover flex flex-col h-full">
      {/* Top Navigation */}
      <div className="p-4 border-b border-bg-hover">
        <Button
          variant="primary"
          className="w-full"
          onClick={onAddFolder}
        >
          <Plus size={18} />
          Add Folder
        </Button>
      </div>

      {/* Quick Links */}
      <div className="p-4 border-b border-bg-hover">
        <nav className="space-y-1">
          <NavItem icon={<Home size={18} />} label="All Files" active={currentView === 'all'} onClick={() => onViewChange('all')} />
          <NavItem icon={<FileAudio size={18} />} label="Samples" active={currentView === 'samples'} onClick={() => onViewChange('samples')} />
          <NavItem icon={<Music size={18} />} label="Projects" active={currentView === 'projects'} onClick={() => onViewChange('projects')} />
          <NavItem icon={<Star size={18} />} label="Favorites" active={currentView === 'favorites'} onClick={() => onViewChange('favorites')} />
          <NavItem icon={<Clock size={18} />} label="Recent" active={currentView === 'recent'} onClick={() => onViewChange('recent')} />
        </nav>
      </div>

      {/* Collections */}
      <div className="p-4 border-b border-bg-hover overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Collections
          </h3>
          <button
            className="text-text-tertiary hover:text-accent-primary transition-colors"
            onClick={onCreateCollection}
            title="Create collection"
          >
            <Plus size={14} />
          </button>
        </div>

        {collections.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">No collections yet</p>
        ) : (
          <div className="space-y-1">
            {collections.map((collection) => (
              <CollectionItem
                key={collection.id}
                name={collection.name}
                count={collection.file_count || 0}
                color={collection.color}
                active={selectedCollectionId === collection.id}
                onClick={() => onCollectionClick?.(collection.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Tags
          </h3>
          <button
            className="text-xs text-text-tertiary hover:text-accent-primary transition-colors"
            onClick={onManageTags}
          >
            Manage
          </button>
        </div>

        {tags.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">No tags yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 20).map((tag) => (
              <div
                key={tag.id}
                className={selectedTagId === tag.id ? 'ring-2 ring-accent-primary ring-offset-1 ring-offset-bg-secondary rounded' : ''}
              >
                <Tag
                  color={tag.color}
                  size="xs"
                  onClick={() => onTagClick?.(tag.id)}
                >
                  {tag.name}
                </Tag>
              </div>
            ))}
            {tags.length > 20 && (
              <button className="text-xs text-accent-primary hover:underline">
                +{tags.length - 20} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-bg-hover">
        <div className="text-xs text-text-tertiary space-y-1">
          <div className="flex justify-between">
            <span>Files</span>
            <span className="text-text-secondary font-medium">
              {collections.reduce((sum, c) => sum + (c.file_count || 0), 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tags</span>
            <span className="text-text-secondary font-medium">{tags.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
        transition-all
        ${
          active
            ? 'bg-bg-hover text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }
      `}
    >
      {icon}
      {label}
    </button>
  )
}

function CollectionItem({
  name,
  count,
  color,
  active,
  onClick,
}: {
  name: string
  count: number
  color?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
        active ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Folder
          size={16}
          className={active ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-accent-primary transition-colors'}
          style={{ color: active ? undefined : color }}
        />
        <span className={active ? 'text-accent-primary font-medium' : 'text-text-primary'}>{name}</span>
      </div>
      <span className="text-xs text-text-tertiary">{count}</span>
    </button>
  )
}
