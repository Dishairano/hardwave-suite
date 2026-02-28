import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports/finance - Finance analytics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const groupBy = searchParams.get('group_by') || 'month'; // day, week, month, quarter, year

    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-%u',
      month: '%Y-%m',
      quarter: "CONCAT(YEAR(invoice_date), '-Q', QUARTER(invoice_date))",
      year: '%Y',
    }[groupBy] || '%Y-%m';

    // Revenue over time
    const revenueParams: any[] = [];
    let revenueSql = `
      SELECT
        DATE_FORMAT(invoice_date, '${dateFormat}') as period,
        COUNT(*) as invoice_count,
        SUM(total_amount) as revenue,
        SUM(paid_amount) as collected
      FROM inv_invoices
      WHERE 1=1
    `;
    revenueSql += buildDateRangeFilter('invoice_date', startDate, endDate, revenueParams);
    revenueSql += ` GROUP BY period ORDER BY period`;
    const revenueOverTime = await query<any[]>(revenueSql, revenueParams);

    // Expenses by category
    const expenseParams: any[] = [];
    let expenseSql = `
      SELECT
        c.name as category,
        COUNT(*) as count,
        SUM(e.amount) as total
      FROM fin_expenses e
      LEFT JOIN fin_expense_categories c ON e.category_id = c.id
      WHERE e.status = 'approved'
    `;
    expenseSql += buildDateRangeFilter('e.expense_date', startDate, endDate, expenseParams);
    expenseSql += ` GROUP BY e.category_id, c.name ORDER BY total DESC`;
    const expensesByCategory = await query<any[]>(expenseSql, expenseParams);

    // Accounts receivable aging
    const arAging = await query<any[]>(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'current'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30 days'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60 days'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN '61-90 days'
          ELSE '90+ days'
        END as aging_bucket,
        COUNT(*) as invoice_count,
        SUM(total_amount - paid_amount) as outstanding
      FROM inv_invoices
      WHERE status IN ('sent', 'partial', 'overdue')
      GROUP BY aging_bucket
      ORDER BY FIELD(aging_bucket, 'current', '1-30 days', '31-60 days', '61-90 days', '90+ days')
    `);

    // Budget vs actual
    const budgetParams: any[] = [];
    let budgetSql = `
      SELECT
        b.name as budget_name,
        b.amount as budgeted,
        COALESCE(SUM(e.amount), 0) as actual,
        b.amount - COALESCE(SUM(e.amount), 0) as variance
      FROM fin_budgets b
      LEFT JOIN fin_expenses e ON e.category_id = b.category_id AND e.status = 'approved'
    `;
    if (startDate && endDate) {
      budgetSql += ` AND e.expense_date BETWEEN ? AND ?`;
      budgetParams.push(startDate, endDate);
    }
    budgetSql += ` WHERE b.is_active = TRUE GROUP BY b.id, b.name, b.amount ORDER BY variance`;
    const budgetVsActual = await query<any[]>(budgetSql, budgetParams);

    // Top customers by revenue
    const topCustomers = await query<any[]>(`
      SELECT
        c.name as company,
        COUNT(i.id) as invoice_count,
        SUM(i.total_amount) as total_revenue
      FROM inv_invoices i
      JOIN crm_companies c ON i.company_id = c.id
      WHERE i.status = 'paid'
      GROUP BY i.company_id, c.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    // Monthly P&L summary
    const plParams: any[] = [];
    let plSql = `
      SELECT
        DATE_FORMAT(CURDATE(), '%Y-%m') as period,
        (SELECT COALESCE(SUM(total_amount), 0) FROM inv_invoices WHERE status = 'paid' ${startDate ? 'AND paid_at >= ?' : ''} ${endDate ? 'AND paid_at <= ?' : ''}) as revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM fin_expenses WHERE status = 'approved' ${startDate ? 'AND expense_date >= ?' : ''} ${endDate ? 'AND expense_date <= ?' : ''}) as expenses
    `;
    if (startDate) plParams.push(startDate, startDate);
    if (endDate) plParams.push(endDate, endDate);
    const pl = await queryOne<any>(plSql, plParams);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate, group_by: groupBy },
      revenue_over_time: revenueOverTime.map(r => ({
        ...r,
        revenue: parseFloat(r.revenue || 0),
        collected: parseFloat(r.collected || 0),
      })),
      expenses_by_category: expensesByCategory.map(e => ({
        ...e,
        total: parseFloat(e.total || 0),
      })),
      ar_aging: arAging.map(a => ({
        ...a,
        outstanding: parseFloat(a.outstanding || 0),
      })),
      budget_vs_actual: budgetVsActual.map(b => ({
        ...b,
        budgeted: parseFloat(b.budgeted || 0),
        actual: parseFloat(b.actual || 0),
        variance: parseFloat(b.variance || 0),
      })),
      top_customers: topCustomers.map(c => ({
        ...c,
        total_revenue: parseFloat(c.total_revenue || 0),
      })),
      profit_loss: {
        revenue: parseFloat(pl?.revenue || 0),
        expenses: parseFloat(pl?.expenses || 0),
        net_income: parseFloat(pl?.revenue || 0) - parseFloat(pl?.expenses || 0),
      },
    });
  } catch (error: any) {
    console.error('Get finance reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
