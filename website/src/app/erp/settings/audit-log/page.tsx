'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Select, DataTable, Badge, Input } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
};

interface AuditEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

interface Filters {
  modules: string[];
  actions: string[];
  entityTypes: string[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filters, setFilters] = useState<Filters>({ modules: [], actions: [], entityTypes: [] });
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const [filterValues, setFilterValues] = useState({
    module: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: '',
  });

  const fetchEntries = useCallback(async (page = 1) => {
    setLoading(true);
    const token = localStorage.getItem('token');

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', '50');
    if (filterValues.module) params.set('module', filterValues.module);
    if (filterValues.action) params.set('action', filterValues.action);
    if (filterValues.entity_type) params.set('entity_type', filterValues.entity_type);
    if (filterValues.start_date) params.set('start_date', filterValues.start_date);
    if (filterValues.end_date) params.set('end_date', filterValues.end_date);

    try {
      const res = await fetch(`/api/erp/settings/audit-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEntries(data.items);
        setPagination(data.pagination);
        setFilters(data.filters);
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    }

    setLoading(false);
  }, [filterValues]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const getActionColor = (action: string): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    const actionColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
      create: 'success',
      update: 'info',
      delete: 'error',
      approve: 'success',
      reject: 'warning',
      assign_role: 'info',
      revoke_role: 'warning',
    };
    return actionColors[action] || 'default';
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      finance: '#10B981',
      projects: '#3B82F6',
      hr: '#8B5CF6',
      crm: '#EC4899',
      inventory: '#F59E0B',
      invoicing: '#06B6D4',
      admin: '#EF4444',
    };
    return colors[module] || tokens.colors.textMuted;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderValueChanges = (entry: AuditEntry) => {
    if (!entry.old_values && !entry.new_values) {
      return <span style={{ color: tokens.colors.textMuted }}>No data recorded</span>;
    }

    const allKeys = new Set([
      ...Object.keys(entry.old_values || {}),
      ...Object.keys(entry.new_values || {}),
    ]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from(allKeys).map(key => {
          const oldVal = entry.old_values?.[key];
          const newVal = entry.new_values?.[key];
          const hasChange = oldVal !== newVal;

          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 1fr',
                gap: 12,
                padding: '8px 12px',
                backgroundColor: hasChange ? 'rgba(236, 72, 153, 0.05)' : 'transparent',
                borderRadius: 4,
              }}
            >
              <span style={{ fontWeight: 500, color: tokens.colors.textMuted, fontSize: 13 }}>
                {key}
              </span>
              <span style={{ fontSize: 13, color: oldVal !== undefined ? tokens.colors.error : tokens.colors.textMuted }}>
                {oldVal !== undefined ? (typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)) : '-'}
              </span>
              <span style={{ fontSize: 13, color: newVal !== undefined ? tokens.colors.success : tokens.colors.textMuted }}>
                {newVal !== undefined ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : '-'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 'created_at',
      header: 'Time',
      width: 160,
      render: (value) => (
        <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>
          {formatDate(value)}
        </span>
      ),
    },
    {
      key: 'user_name',
      header: 'User',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value || 'System'}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.ip_address || '-'}</div>
        </div>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      width: 100,
      render: (value) => (
        <span
          style={{
            padding: '2px 8px',
            fontSize: 12,
            borderRadius: 4,
            backgroundColor: `${getModuleColor(value)}20`,
            color: getModuleColor(value),
            textTransform: 'capitalize',
          }}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: 100,
      render: (value) => <Badge variant={getActionColor(value)}>{value}</Badge>,
    },
    {
      key: 'entity_type',
      header: 'Entity',
      render: (value, row) => (
        <span style={{ color: tokens.colors.textPrimary }}>
          {value} {row.entity_id ? `#${row.entity_id}` : ''}
        </span>
      ),
    },
    {
      key: 'id',
      header: '',
      width: 80,
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpandedEntry(expandedEntry === row.id ? null : row.id)}
        >
          {expandedEntry === row.id ? 'Hide' : 'Details'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
          Audit Log
        </h1>
        <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
          View all ERP activity history
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Select
            label="Module"
            value={filterValues.module}
            onChange={(e) => setFilterValues({ ...filterValues, module: e.target.value })}
            options={[
              { value: '', label: 'All modules' },
              ...filters.modules.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) })),
            ]}
            style={{ width: 150 }}
          />
          <Select
            label="Action"
            value={filterValues.action}
            onChange={(e) => setFilterValues({ ...filterValues, action: e.target.value })}
            options={[
              { value: '', label: 'All actions' },
              ...filters.actions.map(a => ({ value: a, label: a })),
            ]}
            style={{ width: 150 }}
          />
          <Select
            label="Entity Type"
            value={filterValues.entity_type}
            onChange={(e) => setFilterValues({ ...filterValues, entity_type: e.target.value })}
            options={[
              { value: '', label: 'All types' },
              ...filters.entityTypes.map(t => ({ value: t, label: t })),
            ]}
            style={{ width: 150 }}
          />
          <Input
            label="From Date"
            type="date"
            value={filterValues.start_date}
            onChange={(e) => setFilterValues({ ...filterValues, start_date: e.target.value })}
            style={{ width: 160 }}
          />
          <Input
            label="To Date"
            type="date"
            value={filterValues.end_date}
            onChange={(e) => setFilterValues({ ...filterValues, end_date: e.target.value })}
            style={{ width: 160 }}
          />
          <Button
            variant="secondary"
            onClick={() => setFilterValues({ module: '', action: '', entity_type: '', start_date: '', end_date: '' })}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Results */}
      <div style={{ marginTop: 24 }}>
        <Card padding={false}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              Showing {entries.length} of {pagination.total} entries
            </span>
          </div>

          {entries.map((entry, index) => (
            <div key={entry.id}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 100px 100px 1fr 80px',
                  gap: 16,
                  padding: '12px 16px',
                  borderBottom: expandedEntry === entry.id ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>
                  {formatDate(entry.created_at)}
                </span>
                <div>
                  <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{entry.user_name || 'System'}</div>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{entry.ip_address || '-'}</div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: 12,
                    borderRadius: 4,
                    backgroundColor: `${getModuleColor(entry.module)}20`,
                    color: getModuleColor(entry.module),
                    textTransform: 'capitalize',
                    width: 'fit-content',
                  }}
                >
                  {entry.module}
                </span>
                <Badge variant={getActionColor(entry.action)}>{entry.action}</Badge>
                <span style={{ color: tokens.colors.textPrimary }}>
                  {entry.entity_type} {entry.entity_id ? `#${entry.entity_id}` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                >
                  {expandedEntry === entry.id ? 'Hide' : 'Details'}
                </Button>
              </div>

              {expandedEntry === entry.id && (
                <div
                  style={{
                    padding: '16px 24px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: tokens.colors.textMuted, fontSize: 12, textTransform: 'uppercase' }}>
                        Field
                      </span>
                      <span style={{ fontWeight: 600, color: tokens.colors.error, fontSize: 12, textTransform: 'uppercase' }}>
                        Old Value
                      </span>
                      <span style={{ fontWeight: 600, color: tokens.colors.success, fontSize: 12, textTransform: 'uppercase' }}>
                        New Value
                      </span>
                    </div>
                    {renderValueChanges(entry)}
                  </div>
                </div>
              )}
            </div>
          ))}

          {entries.length === 0 && !loading && (
            <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
              No audit log entries found
            </div>
          )}

          {loading && (
            <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
              Loading...
            </div>
          )}
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <Button
              variant="secondary"
              disabled={pagination.page === 1}
              onClick={() => fetchEntries(pagination.page - 1)}
            >
              Previous
            </Button>
            <span style={{ padding: '8px 16px', color: tokens.colors.textMuted }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => fetchEntries(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
