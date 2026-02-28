'use client';

import { useEffect, useRef } from 'react';

const tokens = {
  bgCard: '#101018',
  bgHover: '#14141c',
  textPrimary: '#ffffff',
  textMuted: '#71717a',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  error: '#EF4444',
};

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuSeparatorEntry {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparatorEntry;

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuWidth = 172;
  const itemHeight = 36;
  const nonSeparatorCount = items.filter((i) => !('separator' in i)).length;
  const separatorCount = items.filter((i) => 'separator' in i).length;
  const menuHeight = nonSeparatorCount * itemHeight + separatorCount * 9 + 8;

  const adjustedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - menuWidth - 8);
  const adjustedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: Math.max(8, adjustedY),
        left: Math.max(8, adjustedX),
        zIndex: 9999,
        backgroundColor: tokens.bgCard,
        border: `1px solid ${tokens.borderSubtle}`,
        borderRadius: 8,
        padding: '4px 0',
        minWidth: menuWidth,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {items.map((entry, i) => {
        if ('separator' in entry) {
          return (
            <div
              key={i}
              style={{ height: 1, backgroundColor: tokens.borderSubtle, margin: '4px 0' }}
            />
          );
        }
        const item = entry as ContextMenuItem;
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: item.disabled
                ? tokens.textMuted
                : item.danger
                ? tokens.error
                : tokens.textPrimary,
              fontSize: 13,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: item.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = tokens.bgHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {item.icon && (
              <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
