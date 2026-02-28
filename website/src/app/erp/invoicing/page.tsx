'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, StatCard, StatCardGrid, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { Invoice } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

interface InvoiceItem {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
}

export default function InvoicingPage() {
  const { toastError, toastSuccess } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalInvoiced: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [newInvoice, setNewInvoice] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    terms: 'Payment due within 30 days.',
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: '1', unit_price: '', tax_rate: '0' },
  ]);

  const [payment, setPayment] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  const fetchInvoices = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/invoicing?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setInvoices(data.items);
        setTotalPages(data.pagination.totalPages);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }

    setLoading(false);
  };

  const fetchCustomers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/companies?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: '1', unit_price: '', tax_rate: '0' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    for (const item of items) {
      const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += lineTotal;
      tax += lineTotal * ((parseFloat(item.tax_rate) || 0) / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleCreateInvoice = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/invoicing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newInvoice,
          customer_id: parseInt(newInvoice.customer_id),
          items: items.filter(i => i.description && i.unit_price),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewInvoice({
          customer_id: '',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: '',
          notes: '',
          terms: 'Payment due within 30 days.',
        });
        setItems([{ description: '', quantity: '1', unit_price: '', tax_rate: '0' }]);
        fetchInvoices();
        toastSuccess('Invoice created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Create invoice error:', error);
      toastError('Failed to create invoice');
    }

    setCreating(false);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;

    setRecordingPayment(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/invoicing/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payment,
          invoice_id: selectedInvoice.id,
          amount: parseFloat(payment.amount),
        }),
      });

      if (res.ok) {
        setShowPaymentModal(false);
        setSelectedInvoice(null);
        setPayment({
          amount: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'bank_transfer',
          reference: '',
          notes: '',
        });
        fetchInvoices();
        toastSuccess('Payment recorded');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Record payment error:', error);
      toastError('Failed to record payment');
    }

    setRecordingPayment(false);
  };

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const remaining = invoice.total_amount - (invoice.amount_paid || 0);
    setPayment({
      ...payment,
      amount: remaining.toFixed(2),
    });
    setShowPaymentModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const totals = calculateTotals();

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'Date',
      width: 100,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'due_date',
      header: 'Due',
      width: 100,
      render: (value, row) => {
        const isOverdue = new Date(value) < new Date() && row.status !== 'paid';
        return (
          <span style={{ color: isOverdue ? tokens.colors.error : tokens.colors.textSecondary }}>
            {new Date(value).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'total_amount',
      header: 'Amount',
      width: 120,
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'amount_paid',
      header: 'Paid',
      width: 120,
      align: 'right',
      render: (value) => (
        <span style={{ color: tokens.colors.success, fontFamily: 'monospace' }}>
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
          draft: 'default',
          sent: 'info',
          partial: 'warning',
          paid: 'success',
          overdue: 'error',
          cancelled: 'error',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'id',
      header: '',
      width: 100,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {row.status !== 'paid' && row.status !== 'cancelled' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openPaymentModal(row)}
            >
              Pay
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Calculate stats
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const overdueInvoices = invoices.filter(i => {
    return i.status !== 'paid' && i.status !== 'cancelled' && new Date(i.due_date) < new Date();
  }).length;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Invoicing
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Create invoices and track payments
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Invoice
        </Button>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Invoiced"
            value={formatCurrency(summary.totalInvoiced)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
          <StatCard
            title="Paid Invoices"
            value={paidInvoices}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
          <StatCard
            title="Overdue"
            value={overdueInvoices}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            color={tokens.colors.error}
            loading={loading}
          />
        </StatCardGrid>
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
                { value: 'sent', label: 'Sent' },
                { value: 'partial', label: 'Partial' },
                { value: 'paid', label: 'Paid' },
                { value: 'overdue', label: 'Overdue' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No invoices found"
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

      {/* Create Invoice Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Invoice"
        description="Create a new invoice for a customer"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateInvoice}
              loading={creating}
              disabled={!newInvoice.customer_id || !newInvoice.due_date || items.every(i => !i.description)}
            >
              Create Invoice
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Select
            label="Customer"
            required
            value={newInvoice.customer_id}
            onChange={(e) => setNewInvoice({ ...newInvoice, customer_id: e.target.value })}
            options={[
              { value: '', label: 'Select customer...' },
              ...customers.map(c => ({ value: c.id.toString(), label: c.name })),
            ]}
          />

          <Input
            label="Invoice Date"
            type="date"
            required
            value={newInvoice.invoice_date}
            onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
          />

          <Input
            label="Due Date"
            type="date"
            required
            value={newInvoice.due_date}
            onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
          />
        </div>

        {/* Line Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
              Line Items
            </span>
            <Button variant="ghost" size="sm" onClick={addItem}>
              + Add Item
            </Button>
          </div>

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
                gridTemplateColumns: '1fr 80px 120px 80px 40px',
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Description</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Qty</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Price</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Tax %</span>
              <span></span>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 120px 80px 40px',
                  padding: '8px 12px',
                  borderBottom: index < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Description"
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
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                    textAlign: 'right',
                  }}
                />

                <input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                    textAlign: 'right',
                  }}
                />

                <input
                  type="number"
                  value={item.tax_rate}
                  onChange={(e) => updateItem(index, 'tax_rate', e.target.value)}
                  placeholder="0"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 13,
                    textAlign: 'right',
                  }}
                />

                <button
                  onClick={() => removeItem(index)}
                  disabled={items.length <= 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: items.length > 1 ? 'pointer' : 'not-allowed',
                    color: items.length > 1 ? tokens.colors.error : tokens.colors.textMuted,
                    padding: 4,
                    opacity: items.length > 1 ? 1 : 0.3,
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
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Subtotal</div>
                  <div style={{ fontFamily: 'monospace' }}>{formatCurrency(totals.subtotal)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Tax</div>
                  <div style={{ fontFamily: 'monospace' }}>{formatCurrency(totals.tax)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: tokens.colors.success }}>
                    {formatCurrency(totals.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Textarea
          label="Notes"
          value={newInvoice.notes}
          onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={2}
        />
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        description={`Record payment for invoice ${selectedInvoice?.invoice_number || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              loading={recordingPayment}
              disabled={!payment.amount || parseFloat(payment.amount) <= 0}
            >
              Record Payment
            </Button>
          </>
        }
      >
        {selectedInvoice && (
          <div
            style={{
              padding: 12,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: tokens.colors.textMuted }}>Invoice Total</span>
              <span style={{ fontFamily: 'monospace' }}>{formatCurrency(selectedInvoice.total_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: tokens.colors.textMuted }}>Already Paid</span>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.success }}>
                {formatCurrency(selectedInvoice.amount_paid || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span style={{ color: tokens.colors.textPrimary }}>Remaining</span>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.warning }}>
                {formatCurrency(selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0))}
              </span>
            </div>
          </div>
        )}

        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Amount"
            type="number"
            required
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
            leftIcon={<span>$</span>}
          />

          <Input
            label="Payment Date"
            type="date"
            required
            value={payment.payment_date}
            onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })}
          />

          <Select
            label="Payment Method"
            value={payment.payment_method}
            onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}
            options={[
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'credit_card', label: 'Credit Card' },
              { value: 'check', label: 'Check' },
              { value: 'cash', label: 'Cash' },
              { value: 'other', label: 'Other' },
            ]}
          />

          <Input
            label="Reference"
            value={payment.reference}
            onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
            placeholder="Transaction ID, check #, etc."
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Notes"
              value={payment.notes}
              onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
              placeholder="Payment notes..."
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
