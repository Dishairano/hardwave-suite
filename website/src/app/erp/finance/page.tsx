'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard, StatCardGrid, Card, Button, DataTable, Badge } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { FinExpense, FinJournalEntry } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    brandGreen: '#00FF00',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

export default function FinanceDashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    pendingExpenses: 0,
    cashBalance: 0,
  });
  const [recentExpenses, setRecentExpenses] = useState<FinExpense[]>([]);
  const [recentJournals, setRecentJournals] = useState<FinJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');

      try {
        // Fetch expenses
        const expensesRes = await fetch('/api/erp/finance/expenses?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (expensesRes.ok) {
          const data = await expensesRes.json();
          setRecentExpenses(data.items);
        }

        // Fetch pending expenses count
        const pendingRes = await fetch('/api/erp/finance/expenses?status=pending&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pendingRes.ok) {
          const data = await pendingRes.json();
          setStats(prev => ({ ...prev, pendingExpenses: data.pagination.total }));
        }

        // Fetch journal entries
        const journalRes = await fetch('/api/erp/finance/journal?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (journalRes.ok) {
          const data = await journalRes.json();
          setRecentJournals(data.items);
        }

        // Fetch P&L summary
        const today = new Date().toISOString().split('T')[0];
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const reportRes = await fetch(`/api/erp/finance/reports?type=income_statement&start_date=${yearStart}&end_date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (reportRes.ok) {
          const data = await reportRes.json();
          setStats(prev => ({
            ...prev,
            totalRevenue: data.totals.gross_revenue,
            totalExpenses: data.totals.total_expenses,
            netIncome: data.totals.net_income,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch finance dashboard data:', error);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const expenseColumns: Column<FinExpense>[] = [
    {
      key: 'expense_number',
      header: 'Expense',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.expense_number}
          </div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {row.category_name}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.warning }}>
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
          pending: 'warning',
          approved: 'success',
          rejected: 'error',
          paid: 'success',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
  ];

  const journalColumns: Column<FinJournalEntry>[] = [
    {
      key: 'entry_number',
      header: 'Entry',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.entry_number}
          </div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {new Date(row.entry_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <span style={{ fontSize: 13 }}>
          {value && value.length > 40 ? value.substring(0, 40) + '...' : value}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 80,
      render: (value) => {
        const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
          draft: 'warning',
          posted: 'success',
          voided: 'error',
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
            Finance Dashboard
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage accounts, expenses, and financial reports
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/erp/finance/expenses" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Expense
            </Button>
          </Link>
          <Link href="/erp/finance/journal" style={{ textDecoration: 'none' }}>
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Journal Entry
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Revenue (YTD)"
            value={loading ? '...' : formatCurrency(stats.totalRevenue)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
          <StatCard
            title="Total Expenses (YTD)"
            value={loading ? '...' : formatCurrency(stats.totalExpenses)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            color={tokens.colors.warning}
            loading={loading}
          />
          <StatCard
            title="Net Income (YTD)"
            value={loading ? '...' : formatCurrency(stats.netIncome)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            }
            color={stats.netIncome >= 0 ? tokens.colors.success : tokens.colors.error}
            loading={loading}
          />
          <StatCard
            title="Pending Expenses"
            value={loading ? '...' : stats.pendingExpenses}
            subtitle="Awaiting approval"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Quick Access Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { href: '/erp/finance/accounts', label: 'Chart of Accounts', icon: 'list' },
          { href: '/erp/finance/journal', label: 'Journal Entries', icon: 'book' },
          { href: '/erp/finance/expenses', label: 'Expenses', icon: 'receipt' },
          { href: '/erp/finance/budgets', label: 'Budgets', icon: 'target' },
          { href: '/erp/finance/reports', label: 'Reports', icon: 'chart' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              backgroundColor: '#101018',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.brandPink + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: tokens.colors.brandPink + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.brandPink,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {item.icon === 'list' && (
                  <>
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </>
                )}
                {item.icon === 'book' && (
                  <>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </>
                )}
                {item.icon === 'receipt' && (
                  <>
                    <path d="M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2-4-2z" />
                    <path d="M8 10h8M8 14h4" />
                  </>
                )}
                {item.icon === 'target' && (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </>
                )}
                {item.icon === 'chart' && (
                  <>
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </>
                )}
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: tokens.colors.textPrimary }}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Tables Row */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Expenses */}
        <Card
          title="Recent Expenses"
          actions={
            <Link href="/erp/finance/expenses" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={expenseColumns}
            data={recentExpenses}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No expenses submitted yet"
          />
        </Card>

        {/* Recent Journal Entries */}
        <Card
          title="Recent Journal Entries"
          actions={
            <Link href="/erp/finance/journal" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={journalColumns}
            data={recentJournals}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No journal entries yet"
          />
        </Card>
      </div>
    </div>
  );
}
