'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { FinBudget, FinAccount } from '@/lib/erp-types';

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

interface BudgetLine {
  account_id: string;
  period: string;
  amount: string;
  notes: string;
}

export default function BudgetsPage() {
  const { toastError, toastSuccess } = useToast();
  const [budgets, setBudgets] = useState<FinBudget[]>([]);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [newBudget, setNewBudget] = useState({
    name: '',
    fiscal_year: currentYear.toString(),
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
    description: '',
  });

  const [lines, setLines] = useState<BudgetLine[]>([
    { account_id: '', period: 'annual', amount: '', notes: '' },
  ]);

  const fetchBudgets = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/finance/budgets?page=${page}&limit=20`;
      if (yearFilter) url += `&fiscal_year=${yearFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setBudgets(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    }

    setLoading(false);
  };

  const fetchAccounts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/finance/accounts?type=expense&is_active=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.flat || data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [page, yearFilter]);

  const addLine = () => {
    setLines([...lines, { account_id: '', period: 'annual', amount: '', notes: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof BudgetLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const getTotalBudget = () => {
    return lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  };

  const handleCreateBudget = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/finance/budgets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newBudget,
          fiscal_year: parseInt(newBudget.fiscal_year),
          lines: lines
            .filter(l => l.account_id && l.amount)
            .map(l => ({
              account_id: parseInt(l.account_id),
              period: l.period,
              amount: parseFloat(l.amount),
              notes: l.notes,
            })),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewBudget({
          name: '',
          fiscal_year: currentYear.toString(),
          start_date: `${currentYear}-01-01`,
          end_date: `${currentYear}-12-31`,
          description: '',
        });
        setLines([{ account_id: '', period: 'annual', amount: '', notes: '' }]);
        fetchBudgets();
        toastSuccess('Budget created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create budget');
      }
    } catch (error) {
      console.error('Create budget error:', error);
      toastError('Failed to create budget');
    }

    setCreating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<FinBudget>[] = [
    {
      key: 'name',
      header: 'Budget Name',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {row.lines?.length || 0} line items
          </div>
        </div>
      ),
    },
    {
      key: 'fiscal_year',
      header: 'Year',
      width: 100,
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'start_date',
      header: 'Period',
      width: 200,
      render: (_, row) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {new Date(row.start_date).toLocaleDateString()} - {new Date(row.end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'total_budget',
      header: 'Total Budget',
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
        const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
          draft: 'warning',
          active: 'success',
          closed: 'default',
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

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Budgets
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Plan and track departmental and project budgets
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Budget
        </Button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24 }}>
      <Card>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 150 }}>
            <Select
              label="Fiscal Year"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Years' },
                ...years.map(y => ({ value: y.toString(), label: y.toString() })),
              ]}
            />
          </div>
        </div>
      </Card>
      </div>

      {/* Budgets Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={budgets}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No budgets found"
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

      {/* Create Budget Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Budget"
        description="Set up a new budget with line items"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBudget}
              loading={creating}
              disabled={!newBudget.name || getTotalBudget() === 0}
            >
              Create Budget
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Input
            label="Budget Name"
            required
            value={newBudget.name}
            onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })}
            placeholder="e.g., Marketing FY2026"
          />

          <Select
            label="Fiscal Year"
            required
            value={newBudget.fiscal_year}
            onChange={(e) => {
              const year = e.target.value;
              setNewBudget({
                ...newBudget,
                fiscal_year: year,
                start_date: `${year}-01-01`,
                end_date: `${year}-12-31`,
              });
            }}
            options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              label="Start Date"
              type="date"
              required
              value={newBudget.start_date}
              onChange={(e) => setNewBudget({ ...newBudget, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={newBudget.end_date}
              onChange={(e) => setNewBudget({ ...newBudget, end_date: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Textarea
            label="Description"
            value={newBudget.description}
            onChange={(e) => setNewBudget({ ...newBudget, description: e.target.value })}
            placeholder="Budget purpose and notes..."
            rows={2}
          />
        </div>

        {/* Budget Lines */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
              Budget Line Items
            </span>
            <Button variant="ghost" size="sm" onClick={addLine}>
              + Add Line
            </Button>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 150px 1fr 40px',
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Account</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Period</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Amount</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Notes</span>
              <span></span>
            </div>

            {/* Lines */}
            {lines.map((line, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 150px 1fr 40px',
                  padding: '8px 12px',
                  borderBottom: index < lines.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                  }}
                >
                  <option value="">Select account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>

                <select
                  value={line.period}
                  onChange={(e) => updateLine(index, 'period', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                  }}
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                </select>

                <input
                  type="number"
                  value={line.amount}
                  onChange={(e) => updateLine(index, 'amount', e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                  }}
                />

                <input
                  type="text"
                  value={line.notes}
                  onChange={(e) => updateLine(index, 'notes', e.target.value)}
                  placeholder="Line notes..."
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                  }}
                />

                <button
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: lines.length > 1 ? 'pointer' : 'not-allowed',
                    color: lines.length > 1 ? tokens.colors.error : tokens.colors.textMuted,
                    padding: 4,
                    opacity: lines.length > 1 ? 1 : 0.3,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Total */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 150px 1fr 40px',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                gap: 8,
              }}
            >
              <span></span>
              <span style={{ fontWeight: 600, color: tokens.colors.textPrimary, textAlign: 'right' }}>
                Total:
              </span>
              <span
                style={{
                  fontWeight: 600,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  color: tokens.colors.success,
                }}
              >
                {formatCurrency(getTotalBudget())}
              </span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
