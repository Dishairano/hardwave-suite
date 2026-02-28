import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports - Get overall ERP metrics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Revenue metrics
    const revenueParams: any[] = [];
    let revenueSql = `
      SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(*) as invoice_count,
        COALESCE(AVG(total_amount), 0) as avg_invoice_value
      FROM erp_invoices
      WHERE status = 'paid'
    `;
    revenueSql += buildDateRangeFilter('paid_at', startDate, endDate, revenueParams);
    const revenue = await queryOne<any>(revenueSql, revenueParams);

    // Expense metrics
    const expenseParams: any[] = [];
    let expenseSql = `
      SELECT
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as expense_count
      FROM fin_expenses
      WHERE status = 'approved'
    `;
    expenseSql += buildDateRangeFilter('expense_date', startDate, endDate, expenseParams);
    const expenses = await queryOne<any>(expenseSql, expenseParams);

    // CRM metrics
    const crmParams: any[] = [];
    let crmSql = `
      SELECT
        (SELECT COUNT(*) FROM crm_companies) as total_companies,
        (SELECT COUNT(*) FROM crm_contacts) as total_contacts,
        (SELECT COUNT(*) FROM crm_deals WHERE actual_close_date IS NULL) as open_deals,
        (SELECT COALESCE(SUM(d.amount), 0) FROM crm_deals d JOIN crm_pipeline_stages ps ON d.stage_id = ps.id WHERE ps.is_won = TRUE ${startDate ? 'AND d.actual_close_date >= ?' : ''} ${endDate ? 'AND d.actual_close_date <= ?' : ''}) as won_deal_value
    `;
    if (startDate) crmParams.push(startDate);
    if (endDate) crmParams.push(endDate);
    const crm = await queryOne<any>(crmSql, crmParams);

    // HR metrics
    const hr = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM hr_employees WHERE status = 'active') as active_employees,
        (SELECT COUNT(*) FROM hr_departments WHERE is_active = TRUE) as departments,
        (SELECT COUNT(*) FROM hr_leave_requests WHERE status = 'pending') as pending_leave_requests
    `);

    // Inventory metrics
    const inventory = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM inv_products WHERE is_active = TRUE) as active_products,
        (SELECT COUNT(*) FROM inv_products p WHERE (SELECT COALESCE(SUM(quantity), 0) FROM inv_stock WHERE product_id = p.id) <= p.reorder_point) as low_stock_items,
        (SELECT COALESCE(SUM(quantity * p.cost_price), 0) FROM inv_stock s JOIN inv_products p ON s.product_id = p.id) as inventory_value
    `);

    // Project metrics
    const projectParams: any[] = [];
    let projectSql = `
      SELECT
        (SELECT COUNT(*) FROM prj_projects WHERE status = 'active') as active_projects,
        (SELECT COUNT(*) FROM prj_tasks WHERE status NOT IN ('done', 'cancelled')) as open_tasks,
        (SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) FROM prj_time_entries WHERE 1=1 ${startDate ? 'AND start_time >= ?' : ''} ${endDate ? 'AND start_time <= ?' : ''}) as total_hours
    `;
    if (startDate) projectParams.push(startDate);
    if (endDate) projectParams.push(endDate);
    const projects = await queryOne<any>(projectSql, projectParams);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate },
      finance: {
        total_revenue: parseFloat(revenue?.total_revenue || 0),
        invoice_count: revenue?.invoice_count || 0,
        avg_invoice_value: parseFloat(revenue?.avg_invoice_value || 0),
        total_expenses: parseFloat(expenses?.total_expenses || 0),
        expense_count: expenses?.expense_count || 0,
        net_income: parseFloat(revenue?.total_revenue || 0) - parseFloat(expenses?.total_expenses || 0),
      },
      crm: {
        total_companies: crm?.total_companies || 0,
        total_contacts: crm?.total_contacts || 0,
        open_deals: crm?.open_deals || 0,
        won_deal_value: parseFloat(crm?.won_deal_value || 0),
      },
      hr: {
        active_employees: hr?.active_employees || 0,
        departments: hr?.departments || 0,
        pending_leave_requests: hr?.pending_leave_requests || 0,
      },
      inventory: {
        active_products: inventory?.active_products || 0,
        low_stock_items: inventory?.low_stock_items || 0,
        inventory_value: parseFloat(inventory?.inventory_value || 0),
      },
      projects: {
        active_projects: projects?.active_projects || 0,
        open_tasks: projects?.open_tasks || 0,
        total_hours: parseFloat(projects?.total_hours || 0),
      },
    });
  } catch (error: any) {
    console.error('Get reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
