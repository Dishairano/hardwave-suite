'use client';

import { useState, useRef } from 'react';
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
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

export interface KanbanColumn<T> {
  id: string;
  title: string;
  color?: string;
  items: T[];
}

export interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  onDragEnd?: (item: T, sourceColumn: string, targetColumn: string, targetIndex: number) => void;
  renderCard: (item: T, index: number) => ReactNode;
  itemKey: (item: T) => string | number;
  onAddItem?: (columnId: string) => void;
  onContextMenu?: (item: T, event: React.MouseEvent) => void;
  loading?: boolean;
  columnWidth?: number;
}

export function KanbanBoard<T>({
  columns,
  onDragEnd,
  renderCard,
  itemKey,
  onAddItem,
  onContextMenu,
  loading = false,
  columnWidth = 320,
}: KanbanBoardProps<T>) {
  const [draggedItem, setDraggedItem] = useState<T | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);

  const handleDragStart = (item: T, columnId: string) => {
    setDraggedItem(item);
    setDraggedFromColumn(columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string, index: number) => {
    e.preventDefault();
    setDragOverColumn(columnId);
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    // Don't clear immediately to prevent flickering
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedItem && draggedFromColumn && onDragEnd) {
      onDragEnd(draggedItem, draggedFromColumn, columnId, dragOverIndex);
    }
    setDraggedItem(null);
    setDraggedFromColumn(null);
    setDragOverColumn(null);
    setDragOverIndex(-1);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedFromColumn(null);
    setDragOverColumn(null);
    setDragOverIndex(-1);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        overflowX: 'auto',
        padding: '4px 4px 16px',
        minHeight: 400,
      }}
    >
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={(e) => handleDragOver(e, column.id, column.items.length)}
          onDrop={(e) => handleDrop(e, column.id)}
          onDragLeave={handleDragLeave}
          style={{
            width: columnWidth,
            minWidth: columnWidth,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: tokens.colors.bgElevated,
            borderRadius: tokens.radius.lg,
            border: dragOverColumn === column.id
              ? `2px dashed ${column.color || tokens.colors.brandTurquoise}`
              : `1px solid ${tokens.colors.borderSubtle}`,
            transition: 'border-color 0.15s',
          }}
        >
          {/* Column Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: column.color || tokens.colors.textMuted,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
                {column.title}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: tokens.colors.bgCard,
                  fontSize: 12,
                  fontWeight: 500,
                  color: tokens.colors.textMuted,
                }}
              >
                {column.items.length}
              </span>
            </div>
            {onAddItem && (
              <button
                onClick={() => onAddItem(column.id)}
                style={{
                  width: 28,
                  height: 28,
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>

          {/* Column Content */}
          <div
            style={{
              flex: 1,
              padding: 8,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 100,
                      backgroundColor: tokens.colors.bgCard,
                      borderRadius: tokens.radius.md,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
              </>
            ) : column.items.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 100,
                  border: `1px dashed ${tokens.colors.borderSubtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.textFaint,
                  fontSize: 13,
                }}
              >
                No items
              </div>
            ) : (
              column.items.map((item, index) => {
                const key = itemKey(item);
                const isDragging = draggedItem && itemKey(draggedItem) === key;
                const showDropIndicator = dragOverColumn === column.id && dragOverIndex === index;

                return (
                  <div key={String(key)}>
                    {showDropIndicator && (
                      <div
                        style={{
                          height: 4,
                          backgroundColor: column.color || tokens.colors.brandTurquoise,
                          borderRadius: 2,
                          marginBottom: 8,
                        }}
                      />
                    )}
                    <div
                      draggable
                      onDragStart={() => handleDragStart(item, column.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, column.id, index)}
                      onContextMenu={(e) => {
                        if (onContextMenu) {
                          e.preventDefault();
                          onContextMenu(item, e);
                        }
                      }}
                      style={{
                        opacity: isDragging ? 0.5 : 1,
                        cursor: 'grab',
                      }}
                    >
                      {renderCard(item, index)}
                    </div>
                  </div>
                );
              })
            )}
            {dragOverColumn === column.id && dragOverIndex === column.items.length && column.items.length > 0 && (
              <div
                style={{
                  height: 4,
                  backgroundColor: column.color || tokens.colors.brandTurquoise,
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Kanban Card component
interface KanbanCardProps {
  title: string;
  subtitle?: string;
  labels?: Array<{ text: string; color: string }>;
  assignee?: { name: string; avatar?: string };
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  progress?: number;
  onClick?: () => void;
  actions?: ReactNode;
}

const priorityColors = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export function KanbanCard({
  title,
  subtitle,
  labels,
  assignee,
  dueDate,
  priority,
  progress,
  onClick,
  actions,
}: KanbanCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        padding: 12,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.colors.borderDefault;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Labels */}
      {labels && labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {labels.map((label, i) => (
            <span
              key={i}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500,
                backgroundColor: `${label.color}20`,
                color: label.color,
              }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 500, color: tokens.colors.textPrimary, marginBottom: subtitle ? 4 : 0 }}>
        {title}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8 }}>
          {subtitle}
        </div>
      )}

      {/* Progress */}
      {progress !== undefined && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>Progress</span>
            <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>{progress}%</span>
          </div>
          <div
            style={{
              height: 4,
              backgroundColor: tokens.colors.bgElevated,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: tokens.colors.brandTurquoise,
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Priority */}
          {priority && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: priorityColors[priority],
              }}
              title={priority}
            />
          )}

          {/* Due Date */}
          {dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tokens.colors.textFaint} strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>{dueDate}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}

          {/* Assignee */}
          {assignee && (
            <div
              title={assignee.name}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: tokens.colors.brandPurple + '30',
                color: tokens.colors.brandPurple,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {assignee.name[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
