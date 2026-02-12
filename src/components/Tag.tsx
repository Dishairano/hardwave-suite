import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

interface TagProps {
  children: ReactNode
  color?: string
  size?: 'xs' | 'sm' | 'md'
  removable?: boolean
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
}

const colorMap: Record<string, string> = {
  red: 'bg-tag-red/15 border-tag-red text-tag-red',
  orange: 'bg-tag-orange/15 border-tag-orange text-tag-orange',
  yellow: 'bg-tag-yellow/15 border-tag-yellow text-tag-yellow',
  green: 'bg-tag-green/15 border-tag-green text-tag-green',
  cyan: 'bg-tag-cyan/15 border-tag-cyan text-tag-cyan',
  blue: 'bg-tag-blue/15 border-tag-blue text-tag-blue',
  purple: 'bg-tag-purple/15 border-tag-purple text-tag-purple',
  pink: 'bg-tag-pink/15 border-tag-pink text-tag-pink',
}

export function Tag({
  children,
  color,
  size = 'sm',
  removable = false,
  active = false,
  onClick,
  onRemove,
}: TagProps) {
  const colorClass = color && colorMap[color.toLowerCase()]

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all',
        onClick && 'cursor-pointer',

        // Sizes
        {
          'px-2 py-0.5 text-xs': size === 'xs',
          'px-2.5 py-1 text-sm': size === 'sm',
          'px-3 py-1.5 text-base': size === 'md',
        },

        // Colors
        colorClass || 'bg-bg-secondary border-bg-hover text-text-primary',

        // Active state
        active && !colorClass && 'bg-accent-primary border-accent-primary text-black',

        // Hover
        onClick && 'hover:border-accent-primary hover:shadow-sm'
      )}
      onClick={onClick}
    >
      {children}

      {removable && onRemove && (
        <button
          className="hover:text-accent-error transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X size={size === 'xs' ? 12 : 14} />
        </button>
      )}
    </span>
  )
}
