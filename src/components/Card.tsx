import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  className?: string
}

export function Card({ children, selected = false, onClick, onContextMenu, className }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-bg-tertiary border rounded-lg p-3 transition-all duration-200',
        onClick && 'cursor-pointer',
        selected
          ? 'border-accent-primary shadow-glow-magenta'
          : 'border-bg-hover',
        onClick && !selected && 'hover:border-accent-primary hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </div>
  )
}
