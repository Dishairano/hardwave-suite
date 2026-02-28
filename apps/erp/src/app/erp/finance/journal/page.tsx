'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { FinJournalEntry, FinAccount } from '@/lib/erp-types';

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

interface JournalLine {
  account_id: string;
  account_name?: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
}

export default function JournalEntriesPage() {
  const { toastError, toastSuccess } = useToast();
  const [entries, setEntries] = useState<FinJournalEntry[]>([]);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const [newEntry, setNewEntry] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    auto_post: false,
  });

  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
  ]);

  const fetchEntries = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/finance/journal?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEntries(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    }

    setLoading(false);
  };

  const fetchAccounts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/finance/accounts?is_active=true', {
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
    fetchEntries();
  }, [page, statusFilter]);

  const addLine = () => {
    setLines([...lines, { account_id: '', description: '', debit_amount: '', credit_amount: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const getTotals = () => {
    const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const handleCreateEntry = async () => {
    const totals = getTotals();
    if (!totals.balanced) {
      toastError('Journal entry does not balance. Debits must equal credits.');
      return;
    }

    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/finance/journal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newEntry,
          lines: lines.filter(l => l.account_id && (l.debit_amount || l.credit_amount)),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewEntry({
          entry_date: new Date().toISOString().split('T')[0],
          description: '',
          reference: '',
          auto_post: false,
        });
        setLines([
          { account_id: '', description: '', debit_amount: '', credit_amount: '' },
          { account_id: '', description: '', debit_amount: '', credit_amount: '' },
        ]);
        fetchEntries();
        toastSuccess('Journal entry created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create journal entry');
      }
    } catch (error) {
      console.error('Create journal entry error:', error);
      toastError('Failed to create journal entry');
    }

    setCreating(false);
  };

  const viewEntryDetails = async (entry: FinJournalEntry) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/finance/journal/${entry.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedEntry(data.entry);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch entry details:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: Column<FinJournalEntry>[] = [
    {
      key: 'entry_number',
      header: 'Entry #',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'entry_date',
      header: 'Date',
      width: 100,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <span style={{ fontSize: 13 }}>
          {value && value.length > 60 ? value.substring(0, 60) + '...' : value}
        </span>
      ),
    },
    {
      key: 'total_debit',
      header: 'Debit',
      align: 'right',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(value || 0)}</span>
      ),
    },
    {
      key: 'total_credit',
      header: 'Credit',
      align: 'right',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace' }}>{formatCurrency(value || 0)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
          draft: 'warning',
          posted: 'success',
          voided: 'error',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'id',
      header: '',
      width: 80,
      render: (_, row) => (
        <Button variant="ghost" size="sm" onClick={() => viewEntryDetails(row)}>
          View
        </Button>
      ),
    },
  ];

  const totals = getTotals();

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Journal Entries
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Record and manage general ledger transactions
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Entry
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 200 }}>
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
                { value: 'posted', label: 'Posted' },
                { value: 'voided', label: 'Voided' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Entries Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={entries}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No journal entries found"
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

      {/* Create Entry Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Journal Entry"
        description="Create a double-entry journal transaction"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEntry}
              loading={creating}
              disabled={!newEntry.description || !totals.balanced}
            >
              {newEntry.auto_post ? 'Create & Post' : 'Create Draft'}
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Input
            label="Entry Date"
            type="date"
            required
            value={newEntry.entry_date}
            onChange={(e) => setNewEntry({ ...newEntry, entry_date: e.target.value })}
          />
          <Input
            label="Reference"
            value={newEntry.reference}
            onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })}
            placeholder="e.g., INV-001"
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newEntry.auto_post}
                onChange={(e) => setNewEntry({ ...newEntry, auto_post: e.target.checked })}
              />
              <span style={{ color: tokens.colors.textSecondary }}>Auto-post entry</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Textarea
            label="Description"
            required
            value={newEntry.description}
            onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
            placeholder="Describe the transaction..."
            rows={2}
          />
        </div>

        {/* Journal Lines */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
              Journal Lines
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
                gridTemplateColumns: '1fr 1fr 120px 120px 40px',
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Account</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Description</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Debit</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Credit</span>
              <span></span>
            </div>

            {/* Lines */}
            {lines.map((line, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 120px 120px 40px',
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

                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(index, 'description', e.target.value)}
                  placeholder="Line description..."
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                  }}
                />

                <input
                  type="number"
                  value={line.debit_amount}
                  onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
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
                  type="number"
                  value={line.credit_amount}
                  onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
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

                <button
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 2}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: lines.length > 2 ? 'pointer' : 'not-allowed',
                    color: lines.length > 2 ? tokens.colors.error : tokens.colors.textMuted,
                    padding: 4,
                    opacity: lines.length > 2 ? 1 : 0.3,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Totals */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px 120px 40px',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                gap: 8,
              }}
            >
              <span></span>
              <span style={{ fontWeight: 600, color: tokens.colors.textPrimary, textAlign: 'right' }}>
                Totals:
              </span>
              <span
                style={{
                  fontWeight: 600,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  color: totals.balanced ? tokens.colors.success : tokens.colors.error,
                }}
              >
                {formatCurrency(totals.totalDebit)}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  color: totals.balanced ? tokens.colors.success : tokens.colors.error,
                }}
              >
                {formatCurrency(totals.totalCredit)}
              </span>
              <span
                style={{
                  color: totals.balanced ? tokens.colors.success : tokens.colors.error,
                  textAlign: 'center',
                }}
              >
                {totals.balanced ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Entry Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Journal Entry ${selectedEntry?.entry_number || ''}`}
        description={selectedEntry?.description || ''}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
        }
      >
        {selectedEntry && (
          <div>
            <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Date</div>
                <div style={{ color: tokens.colors.textPrimary }}>
                  {new Date(selectedEntry.entry_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Reference</div>
                <div style={{ color: tokens.colors.textPrimary }}>
                  {selectedEntry.reference || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Status</div>
                <Badge
                  variant={
                    selectedEntry.status === 'posted'
                      ? 'success'
                      : selectedEntry.status === 'voided'
                      ? 'error'
                      : 'warning'
                  }
                >
                  {selectedEntry.status}
                </Badge>
              </div>
            </div>

            {selectedEntry.lines && (
              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 120px 120px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Account</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Description</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Debit</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Credit</span>
                </div>

                {selectedEntry.lines.map((line: any) => (
                  <div
                    key={line.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 120px 120px',
                      padding: '12px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>
                      {line.code}
                    </span>
                    <span style={{ color: tokens.colors.textSecondary }}>
                      {line.account_name}
                      {line.description && (
                        <span style={{ color: tokens.colors.textMuted }}> - {line.description}</span>
                      )}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
