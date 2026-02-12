import { InputHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {icon}
          </div>
        )}

        <input
          className={clsx(
            'w-full bg-bg-secondary border border-bg-hover rounded-lg',
            'px-3 py-2 text-base text-text-primary',
            'placeholder:text-text-tertiary',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon && 'pl-10',
            error && 'border-accent-error focus:ring-accent-error/30',
            className
          )}
          {...props}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-accent-error">{error}</p>
      )}
    </div>
  )
}
