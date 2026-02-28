'use client';

import { ReactNode } from 'react';

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
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
    brandBlue: '#3B82F6',
    brandPurple: '#8B5CF6',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  loading?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = tokens.colors.brandTurquoise,
  trend,
  loading = false,
  onClick,
  size = 'md',
}: StatCardProps) {
  const sizeStyles = {
    sm: { padding: '16px', titleSize: 12, valueSize: 24, iconSize: 36 },
    md: { padding: '20px', titleSize: 13, valueSize: 28, iconSize: 44 },
    lg: { padding: '24px', titleSize: 14, valueSize: 36, iconSize: 52 },
  };

  const s = sizeStyles[size];

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        padding: s.padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = `${color}40`;
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 8px 32px ${color}15`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Background Gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 120,
          height: 120,
          background: `radial-gradient(circle at top right, ${color}08, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          {/* Title */}
          <div
            style={{
              fontSize: s.titleSize,
              fontWeight: 500,
              color: tokens.colors.textMuted,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {title}
          </div>

          {/* Value */}
          {loading ? (
            <div
              style={{
                width: '60%',
                height: s.valueSize,
                backgroundColor: tokens.colors.bgHover,
                borderRadius: tokens.radius.default,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: s.valueSize,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.2,
              }}
            >
              {value}
            </div>
          )}

          {/* Subtitle & Trend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            {subtitle && (
              <span style={{ fontSize: 12, color: tokens.colors.textFaint }}>
                {subtitle}
              </span>
            )}
            {trend && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  borderRadius: 9999,
                  backgroundColor: trend.positive !== false
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={trend.positive !== false ? tokens.colors.success : tokens.colors.error}
                  strokeWidth="2"
                  style={{ transform: trend.positive !== false ? 'none' : 'rotate(180deg)' }}
                >
                  <path d="m18 15-6-6-6 6" />
                </svg>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: trend.positive !== false ? tokens.colors.success : tokens.colors.error,
                  }}
                >
                  {Math.abs(trend.value)}%
                </span>
                {trend.label && (
                  <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Icon */}
        {icon && (
          <div
            style={{
              width: s.iconSize,
              height: s.iconSize,
              borderRadius: tokens.radius.md,
              backgroundColor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Grid wrapper for stat cards
export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 20,
      }}
    >
      {children}
    </div>
  );
}

// Quick mini stat for inline use
export function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {color && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      )}
      <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textPrimary }}>{value}</span>
    </div>
  );
}
