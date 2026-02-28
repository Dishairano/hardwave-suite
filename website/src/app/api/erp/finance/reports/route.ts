import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/finance/reports - Generate financial reports
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const reportType = searchParams.get('type') || 'balance_sheet';
    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date') || asOfDate;

    switch (reportType) {
      case 'balance_sheet':
        return await generateBalanceSheet(asOfDate);
      case 'income_statement':
        return await generateIncomeStatement(startDate || getYearStart(asOfDate), endDate);
      case 'trial_balance':
        return await generateTrialBalance(asOfDate);
      case 'cash_flow':
        return await generateCashFlow(startDate || getYearStart(asOfDate), endDate);
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Generate report error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getYearStart(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-01-01`;
}

async function generateBalanceSheet(asOfDate: string) {
  // Get account balances grouped by type
  const accounts = await query<any[]>(`
    SELECT
      a.id,
      a.code,
      a.name,
      a.account_type,
      COALESCE(SUM(
        CASE WHEN a.account_type IN ('asset', 'expense') THEN jl.debit - jl.credit
             ELSE jl.credit - jl.debit END
      ), 0) as balance
    FROM fin_accounts a
    LEFT JOIN fin_journal_lines jl ON jl.account_id = a.id
    LEFT JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
      AND je.status = 'posted'
      AND je.entry_date <= ?
    WHERE a.is_active = 1
      AND a.account_type IN ('asset', 'liability', 'equity')
    GROUP BY a.id
    ORDER BY a.account_type, a.code
  `, [asOfDate]);

  const assets = accounts.filter(a => a.account_type === 'asset');
  const liabilities = accounts.filter(a => a.account_type === 'liability');
  const equity = accounts.filter(a => a.account_type === 'equity');

  // Calculate retained earnings (net income for all time)
  const retainedEarnings = await queryOne<{ amount: number }>(`
    SELECT COALESCE(SUM(
      CASE WHEN a.account_type = 'revenue' THEN jl.credit - jl.debit
           WHEN a.account_type = 'expense' THEN jl.debit - jl.credit
           ELSE 0 END
    ), 0) as amount
    FROM fin_accounts a
    JOIN fin_journal_lines jl ON jl.account_id = a.id
    JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.status = 'posted' AND je.entry_date <= ?
      AND a.account_type IN ('revenue', 'expense')
  `, [asOfDate]);

  const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const totalEquity = equity.reduce((sum, a) => sum + parseFloat(a.balance), 0) + (retainedEarnings?.amount || 0);

  return NextResponse.json({
    report: 'balance_sheet',
    as_of_date: asOfDate,
    sections: {
      assets: {
        accounts: assets,
        total: totalAssets,
      },
      liabilities: {
        accounts: liabilities,
        total: totalLiabilities,
      },
      equity: {
        accounts: [
          ...equity,
          { code: '', name: 'Retained Earnings', balance: retainedEarnings?.amount || 0 }
        ],
        total: totalEquity,
      },
    },
    totals: {
      total_assets: totalAssets,
      total_liabilities_equity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    },
  });
}

async function generateIncomeStatement(startDate: string, endDate: string) {
  const accounts = await query<any[]>(`
    SELECT
      a.id,
      a.code,
      a.name,
      a.account_type,
      COALESCE(SUM(
        CASE WHEN a.account_type = 'revenue' THEN jl.credit - jl.debit
             ELSE jl.debit - jl.credit END
      ), 0) as amount
    FROM fin_accounts a
    LEFT JOIN fin_journal_lines jl ON jl.account_id = a.id
    LEFT JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
      AND je.status = 'posted'
      AND je.entry_date BETWEEN ? AND ?
    WHERE a.is_active = 1
      AND a.account_type IN ('revenue', 'expense')
    GROUP BY a.id
    HAVING amount != 0
    ORDER BY a.account_type DESC, a.code
  `, [startDate, endDate]);

  const revenue = accounts.filter(a => a.account_type === 'revenue');
  const expenses = accounts.filter(a => a.account_type === 'expense');

  const totalRevenue = revenue.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const netIncome = totalRevenue - totalExpenses;

  return NextResponse.json({
    report: 'income_statement',
    period: { start_date: startDate, end_date: endDate },
    sections: {
      revenue: {
        accounts: revenue,
        total: totalRevenue,
      },
      expenses: {
        accounts: expenses,
        total: totalExpenses,
      },
    },
    totals: {
      gross_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome,
      profit_margin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    },
  });
}

async function generateTrialBalance(asOfDate: string) {
  const accounts = await query<any[]>(`
    SELECT
      a.id,
      a.code,
      a.name,
      a.account_type,
      COALESCE(SUM(jl.debit), 0) as total_debits,
      COALESCE(SUM(jl.credit), 0) as total_credits,
      COALESCE(SUM(
        CASE WHEN a.account_type IN ('asset', 'expense') THEN jl.debit - jl.credit
             ELSE jl.credit - jl.debit END
      ), 0) as balance
    FROM fin_accounts a
    LEFT JOIN fin_journal_lines jl ON jl.account_id = a.id
    LEFT JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
      AND je.status = 'posted'
      AND je.entry_date <= ?
    WHERE a.is_active = 1
    GROUP BY a.id
    HAVING total_debits != 0 OR total_credits != 0
    ORDER BY a.code
  `, [asOfDate]);

  const totalDebits = accounts.reduce((sum, a) => sum + parseFloat(a.total_debits), 0);
  const totalCredits = accounts.reduce((sum, a) => sum + parseFloat(a.total_credits), 0);

  return NextResponse.json({
    report: 'trial_balance',
    as_of_date: asOfDate,
    accounts,
    totals: {
      total_debits: totalDebits,
      total_credits: totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    },
  });
}

async function generateCashFlow(startDate: string, endDate: string) {
  // Get cash account transactions
  const cashTransactions = await query<any[]>(`
    SELECT
      je.entry_date,
      je.description,
      a.name as account_name,
      jl.debit - jl.credit as amount
    FROM fin_journal_lines jl
    JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
    JOIN fin_accounts a ON jl.account_id = a.id
    WHERE je.status = 'posted'
      AND je.entry_date BETWEEN ? AND ?
      AND a.account_type = 'asset'
      AND (a.name LIKE '%Cash%' OR a.code LIKE '1000%')
    ORDER BY je.entry_date
  `, [startDate, endDate]);

  // Opening balance
  const openingBalance = await queryOne<{ balance: number }>(`
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as balance
    FROM fin_journal_lines jl
    JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
    JOIN fin_accounts a ON jl.account_id = a.id
    WHERE je.status = 'posted'
      AND je.entry_date < ?
      AND a.account_type = 'asset'
      AND (a.name LIKE '%Cash%' OR a.code LIKE '1000%')
  `, [startDate]);

  const netCashFlow = cashTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const closingBalance = (openingBalance?.balance || 0) + netCashFlow;

  return NextResponse.json({
    report: 'cash_flow',
    period: { start_date: startDate, end_date: endDate },
    transactions: cashTransactions,
    totals: {
      opening_balance: openingBalance?.balance || 0,
      net_cash_flow: netCashFlow,
      closing_balance: closingBalance,
    },
  });
}
