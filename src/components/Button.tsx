import { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        // Base styles
        'inline-flex items-center justify-center gap-2',
        'font-medium rounded-lg transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',

        // Variants
        {
          // Primary
          'bg-gradient-to-r from-accent-primary to-accent-tertiary text-white':
            variant === 'primary',
          'hover:shadow-glow-magenta hover:-translate-y-0.5':
            variant === 'primary' && !props.disabled,

          // Secondary
          'bg-bg-tertiary border border-bg-hover text-text-primary':
            variant === 'secondary',
          'hover:bg-bg-hover hover:border-accent-primary':
            variant === 'secondary' && !props.disabled,

          // Ghost
          'bg-transparent text-text-secondary': variant === 'ghost',
          'hover:bg-bg-hover hover:text-text-primary':
            variant === 'ghost' && !props.disabled,

          // Danger
          'bg-accent-error text-white': variant === 'danger',
          'hover:bg-red-600': variant === 'danger' && !props.disabled,
        },

        // Sizes
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },

        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
