'use client';

import { useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

export interface Column<T> {
  key: string;
  header: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  rowKey?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
  };
  sortable?: boolean;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  stickyHeader?: boolean;
  mobileColumns?: string[];
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  rowKey = (row: any) => row.id,
  onRowClick,
  pagination,
  sortable = false,
  defaultSort,
  onSort,
  stickyHeader = false,
  mobileColumns,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort || { key: '', direction: 'asc' as const });
  const isMobile = useMediaQuery('(max-width: 768px)');

  const visibleColumns = isMobile && mobileColumns
    ? columns.filter(col => mobileColumns.includes(col.key))
    : columns;

  const cellPadding = isMobile ? '10px 12px' : '12px 16px';

  const handleSort = (key: string) => {
    if (!sortable) return;

    const direction = sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    setSort({ key, direction });
    onSort?.(key, direction);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedRows.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(rowKey)));
    }
  };

  const handleSelectRow = (row: T) => {
    if (!onSelectionChange) return;

    const key = rowKey(row);
    const newSelected = new Set(selectedRows);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }

    onSelectionChange(newSelected);
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                backgroundColor: tokens.colors.bgElevated,
                position: stickyHeader ? 'sticky' : 'relative',
                top: 0,
                zIndex: 10,
              }}
            >
              {selectable && (
                <th style={{ padding: cellPadding, width: 48 }}>
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedRows.size === data.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: cellPadding,
                    textAlign: col.align || 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: col.width,
                    cursor: sortable && col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                    <span>{col.header}</span>
                    {sortable && col.sortable !== false && sort.key === col.key && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ transform: sort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}
                      >
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: `3px solid ${tokens.colors.borderSubtle}`,
                        borderTopColor: tokens.colors.brandTurquoise,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span style={{ color: tokens.colors.textMuted, fontSize: 14 }}>Loading...</span>
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={tokens.colors.textFaint} strokeWidth="1">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <path d="M13 2v7h7" />
                    </svg>
                    <span style={{ color: tokens.colors.textMuted, fontSize: 14 }}>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = rowKey(row);
                const isSelected = selectedRows.has(key);

                return (
                  <tr
                    key={String(key)}
                    onClick={() => onRowClick?.(row)}
                    style={{
                      backgroundColor: isSelected ? `${tokens.colors.brandTurquoise}08` : 'transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected ? `${tokens.colors.brandTurquoise}08` : 'transparent';
                    }}
                  >
                    {selectable && (
                      <td style={{ padding: cellPadding, width: 48 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: cellPadding,
                          textAlign: col.align || 'left',
                          fontSize: 14,
                          color: tokens.colors.textSecondary,
                          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
                        }}
                      >
                        {col.render
                          ? col.render((row as any)[col.key], row, index)
                          : (row as any)[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 0 && (
        <div
          style={{
            padding: cellPadding,
            borderTop: `1px solid ${tokens.colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: tokens.colors.bgElevated,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>
              {isMobile
                ? `${pagination.page}/${totalPages}`
                : `Showing ${(pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`}
            </span>
            {!isMobile && pagination.onLimitChange && (
              <select
                value={pagination.limit}
                onChange={(e) => pagination.onLimitChange?.(parseInt(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: tokens.radius.default,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: tokens.colors.bgCard,
                  color: tokens.colors.textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {!isMobile && (
              <button
                onClick={() => pagination.onPageChange(1)}
                disabled={pagination.page === 1}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: tokens.radius.default,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: 'transparent',
                  color: pagination.page === 1 ? tokens.colors.textFaint : tokens.colors.textMuted,
                  cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
            )}
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: tokens.radius.default,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                backgroundColor: 'transparent',
                color: pagination.page === 1 ? tokens.colors.textFaint : tokens.colors.textMuted,
                cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span style={{ padding: '0 12px', fontSize: 13, color: tokens.colors.textSecondary }}>
              Page {pagination.page} of {totalPages}
            </span>

            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: tokens.radius.default,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                backgroundColor: 'transparent',
                color: pagination.page === totalPages ? tokens.colors.textFaint : tokens.colors.textMuted,
                cursor: pagination.page === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {!isMobile && (
              <button
                onClick={() => pagination.onPageChange(totalPages)}
                disabled={pagination.page === totalPages}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: tokens.radius.default,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: 'transparent',
                  color: pagination.page === totalPages ? tokens.colors.textFaint : tokens.colors.textMuted,
                  cursor: pagination.page === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper components
export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const colors = {
    default: { bg: tokens.colors.bgElevated, text: tokens.colors.textMuted, border: tokens.colors.borderSubtle },
    success: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
    info: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  };

  const c = colors[variant];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {children}
    </span>
  );
}
