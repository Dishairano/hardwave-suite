'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Select } from '@/components/erp';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    brandBlue: '#3B82F6',
    brandPurple: '#8B5CF6',
  },
};

interface ReportAccount {
  id?: number;
  code: string;
  name: string;
  balance?: number;
  amount?: number;
  total_debits?: number;
  total_credits?: number;
}

interface BalanceSheetData {
  report: string;
  as_of_date: string;
  sections: {
    assets: { accounts: ReportAccount[]; total: number };
    liabilities: { accounts: ReportAccount[]; total: number };
    equity: { accounts: ReportAccount[]; total: number };
  };
  totals: {
    total_assets: number;
    total_liabilities_equity: number;
    balanced: boolean;
  };
}

interface IncomeStatementData {
  report: string;
  period: { start_date: string; end_date: string };
  sections: {
    revenue: { accounts: ReportAccount[]; total: number };
    expenses: { accounts: ReportAccount[]; total: number };
  };
  totals: {
    gross_revenue: number;
    total_expenses: number;
    net_income: number;
    profit_margin: number;
  };
}

interface TrialBalanceData {
  report: string;
  as_of_date: string;
  accounts: ReportAccount[];
  totals: {
    total_debits: number;
    total_credits: number;
    balanced: boolean;
  };
}

export default function FinancialReportsPage() {
  const [reportType, setReportType] = useState('balance_sheet');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/finance/reports?type=${reportType}`;
      if (reportType === 'balance_sheet' || reportType === 'trial_balance') {
        url += `&as_of_date=${asOfDate}`;
      } else {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, asOfDate, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const renderBalanceSheet = (data: BalanceSheetData) => (
    <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Assets */}
      <div>
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.brandBlue, marginBottom: 16 }}>
            Assets
          </h3>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {data.sections.assets.accounts.map((account, i) => (
              <div
                key={account.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ color: tokens.colors.textSecondary }}>
                  {account.code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{account.code}</span>}
                  {account.name}
                </span>
                <span style={{ fontFamily: 'monospace', color: tokens.colors.textPrimary }}>
                  {formatCurrency(account.balance || 0)}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: tokens.colors.brandBlue + '15',
                fontWeight: 600,
              }}
            >
              <span style={{ color: tokens.colors.brandBlue }}>Total Assets</span>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.brandBlue }}>
                {formatCurrency(data.sections.assets.total)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Liabilities & Equity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Liabilities */}
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.error, marginBottom: 16 }}>
            Liabilities
          </h3>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {data.sections.liabilities.accounts.length === 0 ? (
              <div style={{ padding: '12px', color: tokens.colors.textMuted, textAlign: 'center' }}>
                No liabilities
              </div>
            ) : (
              data.sections.liabilities.accounts.map((account, i) => (
                <div
                  key={account.id || i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ color: tokens.colors.textSecondary }}>
                    {account.code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{account.code}</span>}
                    {account.name}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: tokens.colors.textPrimary }}>
                    {formatCurrency(account.balance || 0)}
                  </span>
                </div>
              ))
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: tokens.colors.error + '15',
                fontWeight: 600,
              }}
            >
              <span style={{ color: tokens.colors.error }}>Total Liabilities</span>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.error }}>
                {formatCurrency(data.sections.liabilities.total)}
              </span>
            </div>
          </div>
        </Card>

        {/* Equity */}
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.brandPurple, marginBottom: 16 }}>
            Equity
          </h3>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {data.sections.equity.accounts.map((account, i) => (
              <div
                key={account.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ color: tokens.colors.textSecondary }}>
                  {account.code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{account.code}</span>}
                  {account.name}
                </span>
                <span style={{ fontFamily: 'monospace', color: tokens.colors.textPrimary }}>
                  {formatCurrency(account.balance || 0)}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: tokens.colors.brandPurple + '15',
                fontWeight: 600,
              }}
            >
              <span style={{ color: tokens.colors.brandPurple }}>Total Equity</span>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPurple }}>
                {formatCurrency(data.sections.equity.total)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Balance Check */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Card style={{ backgroundColor: data.totals.balanced ? tokens.colors.success + '10' : tokens.colors.error + '10' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 4 }}>Balance Check</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: data.totals.balanced ? tokens.colors.success : tokens.colors.error }}>
                {data.totals.balanced ? 'Balanced ✓' : 'Not Balanced ✗'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Total Assets</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', color: tokens.colors.textPrimary }}>
                  {formatCurrency(data.totals.total_assets)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Liabilities + Equity</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', color: tokens.colors.textPrimary }}>
                  {formatCurrency(data.totals.total_liabilities_equity)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderIncomeStatement = (data: IncomeStatementData) => (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Revenue */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.success, marginBottom: 16 }}>
          Revenue
        </h3>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {data.sections.revenue.accounts.length === 0 ? (
            <div style={{ padding: '12px', color: tokens.colors.textMuted, textAlign: 'center' }}>
              No revenue recorded
            </div>
          ) : (
            data.sections.revenue.accounts.map((account, i) => (
              <div
                key={account.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ color: tokens.colors.textSecondary }}>
                  {account.code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{account.code}</span>}
                  {account.name}
                </span>
                <span style={{ fontFamily: 'monospace', color: tokens.colors.success }}>
                  {formatCurrency(account.amount || 0)}
                </span>
              </div>
            ))
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: tokens.colors.success + '15',
              fontWeight: 600,
            }}
          >
            <span style={{ color: tokens.colors.success }}>Total Revenue</span>
            <span style={{ fontFamily: 'monospace', color: tokens.colors.success }}>
              {formatCurrency(data.sections.revenue.total)}
            </span>
          </div>
        </div>
      </Card>

      {/* Expenses */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.warning, marginBottom: 16 }}>
          Expenses
        </h3>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {data.sections.expenses.accounts.length === 0 ? (
            <div style={{ padding: '12px', color: tokens.colors.textMuted, textAlign: 'center' }}>
              No expenses recorded
            </div>
          ) : (
            data.sections.expenses.accounts.map((account, i) => (
              <div
                key={account.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ color: tokens.colors.textSecondary }}>
                  {account.code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{account.code}</span>}
                  {account.name}
                </span>
                <span style={{ fontFamily: 'monospace', color: tokens.colors.warning }}>
                  {formatCurrency(account.amount || 0)}
                </span>
              </div>
            ))
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: tokens.colors.warning + '15',
              fontWeight: 600,
            }}
          >
            <span style={{ color: tokens.colors.warning }}>Total Expenses</span>
            <span style={{ fontFamily: 'monospace', color: tokens.colors.warning }}>
              {formatCurrency(data.sections.expenses.total)}
            </span>
          </div>
        </div>
      </Card>

      {/* Net Income */}
      <Card style={{ backgroundColor: data.totals.net_income >= 0 ? tokens.colors.success + '10' : tokens.colors.error + '10' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 4 }}>Net Income</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: data.totals.net_income >= 0 ? tokens.colors.success : tokens.colors.error,
              }}
            >
              {formatCurrency(data.totals.net_income)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 4 }}>Profit Margin</div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: data.totals.profit_margin >= 0 ? tokens.colors.success : tokens.colors.error,
              }}
            >
              {data.totals.profit_margin.toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderTrialBalance = (data: TrialBalanceData) => (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card padding={false}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 120px 120px 120px',
            padding: '12px 16px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Account #</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted }}>Name</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Debits</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Credits</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textAlign: 'right' }}>Balance</span>
        </div>

        {data.accounts.length === 0 ? (
          <div style={{ padding: '24px', color: tokens.colors.textMuted, textAlign: 'center' }}>
            No transactions recorded
          </div>
        ) : (
          data.accounts.map((account, i) => (
            <div
              key={account.id || i}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 120px 120px 120px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>
                {account.code}
              </span>
              <span style={{ color: tokens.colors.textPrimary }}>{account.name}</span>
              <span style={{ fontFamily: 'monospace', textAlign: 'right', color: tokens.colors.textSecondary }}>
                {formatCurrency(account.total_debits || 0)}
              </span>
              <span style={{ fontFamily: 'monospace', textAlign: 'right', color: tokens.colors.textSecondary }}>
                {formatCurrency(account.total_credits || 0)}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  textAlign: 'right',
                  color: (account.balance || 0) >= 0 ? tokens.colors.success : tokens.colors.error,
                }}
              >
                {formatCurrency(account.balance || 0)}
              </span>
            </div>
          ))
        )}

        {/* Totals */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 120px 120px 120px',
            padding: '12px 16px',
            backgroundColor: data.totals.balanced ? tokens.colors.success + '10' : tokens.colors.error + '10',
            borderTop: '2px solid rgba(255,255,255,0.1)',
          }}
        >
          <span></span>
          <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>Totals</span>
          <span style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: tokens.colors.textPrimary }}>
            {formatCurrency(data.totals.total_debits)}
          </span>
          <span style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: tokens.colors.textPrimary }}>
            {formatCurrency(data.totals.total_credits)}
          </span>
          <span
            style={{
              fontWeight: 600,
              textAlign: 'right',
              color: data.totals.balanced ? tokens.colors.success : tokens.colors.error,
            }}
          >
            {data.totals.balanced ? '✓ Balanced' : '✗ Unbalanced'}
          </span>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Financial Reports
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Generate balance sheet, income statement, and trial balance reports
          </p>
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Report'}
        </Button>
      </div>

      {/* Report Selection */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 200 }}>
            <Select
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              options={[
                { value: 'balance_sheet', label: 'Balance Sheet' },
                { value: 'income_statement', label: 'Income Statement' },
                { value: 'trial_balance', label: 'Trial Balance' },
                { value: 'cash_flow', label: 'Cash Flow Statement' },
              ]}
            />
          </div>

          {(reportType === 'balance_sheet' || reportType === 'trial_balance') && (
            <div style={{ width: 180 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                As of Date
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: '#101018',
                  color: tokens.colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </div>
          )}

          {(reportType === 'income_statement' || reportType === 'cash_flow') && (
            <>
              <div style={{ width: 180 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ width: 180 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: tokens.colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Report Content */}
      {loading ? (
        <Card>
          <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
            Generating report...
          </div>
        </Card>
      ) : reportData ? (
        <>
          {reportType === 'balance_sheet' && renderBalanceSheet(reportData)}
          {reportType === 'income_statement' && renderIncomeStatement(reportData)}
          {reportType === 'trial_balance' && renderTrialBalance(reportData)}
          {reportType === 'cash_flow' && (
            <Card>
              <div style={{ textAlign: 'center', padding: 24 }}>
                <h3 style={{ color: tokens.colors.textPrimary, marginBottom: 8 }}>Cash Flow Statement</h3>
                <p style={{ color: tokens.colors.textMuted }}>
                  Opening Balance: {formatCurrency(reportData.totals?.opening_balance || 0)}
                </p>
                <p style={{ color: reportData.totals?.net_cash_flow >= 0 ? tokens.colors.success : tokens.colors.error }}>
                  Net Cash Flow: {formatCurrency(reportData.totals?.net_cash_flow || 0)}
                </p>
                <p style={{ color: tokens.colors.textPrimary, fontWeight: 600 }}>
                  Closing Balance: {formatCurrency(reportData.totals?.closing_balance || 0)}
                </p>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
            Select report parameters and click Refresh to generate
          </div>
        </Card>
      )}
    </div>
  );
}
