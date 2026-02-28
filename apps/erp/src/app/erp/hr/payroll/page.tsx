'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HRPayrollRun } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

export default function PayrollPage() {
  const { toastError, toastSuccess } = useToast();
  const [runs, setRuns] = useState<HRPayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newRun, setNewRun] = useState({
    name: '',
    pay_period_start: '',
    pay_period_end: '',
    pay_date: '',
    notes: '',
  });

  const fetchRuns = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/hr/payroll/runs?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRuns(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRuns();
  }, [page, statusFilter]);

  const handleCreateRun = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/payroll/runs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRun),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewRun({
          name: '',
          pay_period_start: '',
          pay_period_end: '',
          pay_date: '',
          notes: '',
        });
        fetchRuns();
        toastSuccess('Payroll run created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create payroll run');
      }
    } catch (error) {
      console.error('Create payroll run error:', error);
      toastError('Failed to create payroll run');
    }

    setCreating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: Column<HRPayrollRun>[] = [
    {
      key: 'name',
      header: 'Payroll Run',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {row.employee_count} employees
          </div>
        </div>
      ),
    },
    {
      key: 'pay_period_start',
      header: 'Pay Period',
      render: (_, row) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {new Date(row.pay_period_start).toLocaleDateString()} - {new Date(row.pay_period_end).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'pay_date',
      header: 'Pay Date',
      width: 100,
      render: (value) => (
        <span style={{ color: tokens.colors.textPrimary }}>
          {new Date(value).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'total_net_pay',
      header: 'Total Net Pay',
      align: 'right',
      width: 150,
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.success, fontFamily: 'monospace' }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
          draft: 'warning',
          approved: 'info',
          processed: 'success',
          cancelled: 'error',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'created_by_name',
      header: 'Created By',
      width: 120,
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
  ];

  // Auto-generate payroll name when dates change
  const generatePayrollName = () => {
    if (newRun.pay_period_start && newRun.pay_period_end) {
      const start = new Date(newRun.pay_period_start);
      const month = start.toLocaleString('default', { month: 'short' });
      const year = start.getFullYear();
      return `Payroll ${month} ${year}`;
    }
    return '';
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Payroll
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Process employee payroll runs
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Payroll Run
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'approved', label: 'Approved' },
                { value: 'processed', label: 'Processed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Payroll Runs Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={runs}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No payroll runs found"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span style={{ padding: '8px 12px', color: tokens.colors.textSecondary }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Create Payroll Run Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Payroll Run"
        description="Process payroll for a pay period"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRun}
              loading={creating}
              disabled={!newRun.pay_period_start || !newRun.pay_period_end || !newRun.pay_date}
            >
              Create Payroll
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Payroll Name"
              required
              value={newRun.name || generatePayrollName()}
              onChange={(e) => setNewRun({ ...newRun, name: e.target.value })}
              placeholder="e.g., Payroll Jan 2026"
            />
          </div>

          <Input
            label="Period Start"
            type="date"
            required
            value={newRun.pay_period_start}
            onChange={(e) => setNewRun({ ...newRun, pay_period_start: e.target.value })}
          />

          <Input
            label="Period End"
            type="date"
            required
            value={newRun.pay_period_end}
            onChange={(e) => setNewRun({ ...newRun, pay_period_end: e.target.value })}
          />

          <Input
            label="Pay Date"
            type="date"
            required
            value={newRun.pay_date}
            onChange={(e) => setNewRun({ ...newRun, pay_date: e.target.value })}
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Notes"
              value={newRun.notes}
              onChange={(e) => setNewRun({ ...newRun, notes: e.target.value })}
              placeholder="Any notes for this payroll run..."
              rows={2}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: tokens.colors.warning + '15',
            borderRadius: 8,
            borderLeft: `3px solid ${tokens.colors.warning}`,
          }}
        >
          <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
            This will automatically generate payroll items for all active employees with a salary on record.
          </div>
        </div>
      </Modal>
    </div>
  );
}
