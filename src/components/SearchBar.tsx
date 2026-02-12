import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from './Input'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onFilterClick?: () => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  onFilterClick,
  placeholder = 'Search files...',
}: SearchBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          icon={<Search size={16} />}
        />
      </div>

      <button
        className="px-4 py-2 bg-bg-tertiary border border-bg-hover rounded-lg text-text-primary hover:bg-bg-hover hover:border-accent-primary transition-all flex items-center gap-2"
        onClick={onFilterClick}
      >
        <SlidersHorizontal size={16} />
        <span className="text-sm font-medium">Filters</span>
      </button>
    </div>
  )
}
