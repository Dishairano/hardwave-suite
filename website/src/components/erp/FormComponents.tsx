'use client';

import { ReactNode, forwardRef } from 'react';

const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgElevated: '#0c0c12',
    bgCard: '#101018',
    bgHover: '#14141c',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandTurquoise: '#40E0D0',
    brandGreen: '#00FF00',
    error: '#EF4444',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, style, ...props }, ref) => {
    return (
      <div style={{ marginBottom: 16 }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: tokens.colors.textSecondary,
              marginBottom: 6,
            }}
          >
            {label}
            {props.required && <span style={{ color: tokens.colors.error, marginLeft: 4 }}>*</span>}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: tokens.colors.textFaint,
              }}
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            style={{
              width: '100%',
              padding: `10px ${rightIcon ? '40px' : '14px'} 10px ${leftIcon ? '40px' : '14px'}`,
              borderRadius: tokens.radius.md,
              border: `1px solid ${error ? tokens.colors.error : tokens.colors.borderSubtle}`,
              backgroundColor: tokens.colors.bgCard,
              color: tokens.colors.textPrimary,
              fontSize: 14,
              outline: 'none',
              transition: 'all 0.15s',
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.brandTurquoise + '50';
              e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? tokens.colors.error : tokens.colors.brandTurquoise}15`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.borderSubtle;
              e.currentTarget.style.boxShadow = 'none';
            }}
            {...props}
          />
          {rightIcon && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: tokens.colors.textFaint,
              }}
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p style={{ fontSize: 12, color: tokens.colors.error, marginTop: 4 }}>{error}</p>
        )}
        {hint && !error && (
          <p style={{ fontSize: 12, color: tokens.colors.textFaint, marginTop: 4 }}>{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, style, ...props }, ref) => {
    return (
      <div style={{ marginBottom: 16 }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: tokens.colors.textSecondary,
              marginBottom: 6,
            }}
          >
            {label}
            {props.required && <span style={{ color: tokens.colors.error, marginLeft: 4 }}>*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: tokens.radius.md,
            border: `1px solid ${error ? tokens.colors.error : tokens.colors.borderSubtle}`,
            backgroundColor: tokens.colors.bgCard,
            color: tokens.colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            minHeight: 100,
            transition: 'all 0.15s',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.brandTurquoise + '50';
            e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? tokens.colors.error : tokens.colors.brandTurquoise}15`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.borderSubtle;
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        />
        {error && (
          <p style={{ fontSize: 12, color: tokens.colors.error, marginTop: 4 }}>{error}</p>
        )}
        {hint && !error && (
          <p style={{ fontSize: 12, color: tokens.colors.textFaint, marginTop: 4 }}>{hint}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, style, ...props }, ref) => {
    return (
      <div style={{ marginBottom: 16 }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: tokens.colors.textSecondary,
              marginBottom: 6,
            }}
          >
            {label}
            {props.required && <span style={{ color: tokens.colors.error, marginLeft: 4 }}>*</span>}
          </label>
        )}
        <select
          ref={ref}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: tokens.radius.md,
            border: `1px solid ${error ? tokens.colors.error : tokens.colors.borderSubtle}`,
            backgroundColor: tokens.colors.bgCard,
            color: tokens.colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = tokens.colors.brandTurquoise + '50';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? tokens.colors.error : tokens.colors.borderSubtle;
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled} style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p style={{ fontSize: 12, color: tokens.colors.error, marginTop: 4 }}>{error}</p>
        )}
        {hint && !error && (
          <p style={{ fontSize: 12, color: tokens.colors.textFaint, marginTop: 4 }}>{hint}</p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

// Checkbox Component
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, style, ...props }, ref) => {
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
          marginBottom: 12,
        }}
      >
        <input
          ref={ref}
          type="checkbox"
          style={{
            width: 18,
            height: 18,
            marginTop: 2,
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            accentColor: tokens.colors.brandTurquoise,
            ...style,
          }}
          {...props}
        />
        <div>
          <span style={{ fontSize: 14, color: tokens.colors.textPrimary }}>{label}</span>
          {description && (
            <p style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>
              {description}
            </p>
          )}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, style, disabled, ...props }, ref) => {
    const variants = {
      primary: {
        bg: tokens.colors.brandTurquoise,
        color: '#000',
        border: 'transparent',
        hoverBg: '#5CE8D8',
      },
      secondary: {
        bg: 'transparent',
        color: tokens.colors.textSecondary,
        border: tokens.colors.borderDefault,
        hoverBg: tokens.colors.bgHover,
      },
      danger: {
        bg: tokens.colors.error,
        color: '#fff',
        border: 'transparent',
        hoverBg: '#DC2626',
      },
      ghost: {
        bg: 'transparent',
        color: tokens.colors.textMuted,
        border: 'transparent',
        hoverBg: tokens.colors.bgHover,
      },
    };

    const sizes = {
      sm: { padding: '6px 12px', fontSize: 12, gap: 6 },
      md: { padding: '10px 16px', fontSize: 14, gap: 8 },
      lg: { padding: '12px 24px', fontSize: 15, gap: 10 },
    };

    const v = variants[variant];
    const s = sizes[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          padding: s.padding,
          fontSize: s.fontSize,
          fontWeight: 500,
          borderRadius: tokens.radius.md,
          border: `1px solid ${v.border}`,
          backgroundColor: v.bg,
          color: v.color,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.5 : 1,
          transition: 'all 0.15s',
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.backgroundColor = v.hoverBg;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = v.bg;
        }}
        {...props}
      >
        {loading ? (
          <div
            style={{
              width: 16,
              height: 16,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  }
);
Button.displayName = 'Button';

// Form Group Component
export function FormGroup({
  children,
  columns = 1,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
}) {
  return (
    <div
      className="erp-form-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

// Card Component
export function Card({
  children,
  title,
  description,
  actions,
  padding = true,
  style,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  padding?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || description || actions) && (
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {title && (
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                {title}
              </h3>
            )}
            {description && (
              <p style={{ fontSize: 13, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                {description}
              </p>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: padding ? 20 : 0 }}>{children}</div>
    </div>
  );
}

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 400,
    md: 500,
    lg: 640,
    xl: 800,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal Content */}
      <div
        className="erp-modal-content"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: sizes[size],
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: tokens.colors.bgCard,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.borderDefault}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
              {title}
            </h2>
            {description && (
              <p style={{ fontSize: 13, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.default,
              border: 'none',
              backgroundColor: 'transparent',
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
              e.currentTarget.style.color = tokens.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = tokens.colors.textMuted;
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="erp-modal-footer"
            style={{
              padding: '16px 20px',
              borderTop: `1px solid ${tokens.colors.borderSubtle}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Empty State Component
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        textAlign: 'center',
      }}
    >
      {icon && (
        <div style={{ color: tokens.colors.textFaint, marginBottom: 16 }}>{icon}</div>
      )}
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          margin: 0,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 14,
            color: tokens.colors.textMuted,
            margin: '8px 0 0',
            maxWidth: 400,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
