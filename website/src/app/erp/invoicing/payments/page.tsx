'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Select, DataTable, Badge, StatCard, StatCardGrid } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { ERPPayment } from '@/lib/erp-types';

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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<ERPPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [methodFilter, setMethodFilter] = useState('');
  const [summary, setSummary] = useState({ totalReceived: 0 });

  const fetchPayments = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/invoicing/payments?page=${page}&limit=20`;
      if (methodFilter) url += `&payment_method=${methodFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPayments(data.items);
        setTotalPages(data.pagination.totalPages);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [page, methodFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: Column<ERPPayment>[] = [
    {
      key: 'payment_number',
      header: 'Payment #',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'invoice_number',
      header: 'Invoice',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 120,
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: tokens.colors.success }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      width: 100,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'payment_method',
      header: 'Method',
      width: 120,
      render: (value) => {
        const labels: Record<string, string> = {
          bank_transfer: 'Bank Transfer',
          credit_card: 'Credit Card',
          check: 'Check',
          cash: 'Cash',
          paypal: 'PayPal',
          stripe: 'Stripe',
          other: 'Other',
        };
        return <span style={{ color: tokens.colors.textSecondary }}>{labels[value] || value}</span>;
      },
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'received_by_name',
      header: 'Received By',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          completed: 'success',
          pending: 'warning',
          failed: 'error',
          refunded: 'error',
          cancelled: 'default',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Payments
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Track all payment transactions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Received"
            value={formatCurrency(summary.totalReceived)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <Select
              label="Payment Method"
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Methods' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'check', label: 'Check' },
                { value: 'cash', label: 'Cash' },
                { value: 'stripe', label: 'Stripe' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No payments recorded"
        />

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
    </div>
  );
}
