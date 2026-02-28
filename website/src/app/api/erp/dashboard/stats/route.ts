import { NextRequest, NextResponse } from 'next/server';
import { verifyERPAuth } from '@/lib/erp';
import { query } from '@/lib/db';
import type { DashboardStats } from '@/lib/erp-types';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats: DashboardStats = {};

    // Finance stats (if user has access)
    if (auth.permissions.finance?.length > 0) {
      try {
        // Get current month revenue (from posted journal entries to revenue accounts)
        const revenueResult = await query<any[]>(`
          SELECT COALESCE(SUM(jl.credit - jl.debit), 0) as total
          FROM fin_journal_lines jl
          JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
          JOIN fin_accounts a ON jl.account_id = a.id
          WHERE je.status = 'posted'
            AND a.account_type = 'revenue'
            AND MONTH(je.entry_date) = MONTH(CURRENT_DATE)
            AND YEAR(je.entry_date) = YEAR(CURRENT_DATE)
        `);

        // Get current month expenses
        const expensesResult = await query<any[]>(`
          SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as total
          FROM fin_journal_lines jl
          JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
          JOIN fin_accounts a ON jl.account_id = a.id
          WHERE je.status = 'posted'
            AND a.account_type = 'expense'
            AND MONTH(je.entry_date) = MONTH(CURRENT_DATE)
            AND YEAR(je.entry_date) = YEAR(CURRENT_DATE)
        `);

        // Get pending expense count
        const pendingExpenses = await query<any[]>(`
          SELECT COUNT(*) as count FROM fin_expenses WHERE status = 'submitted'
        `);

        stats.finance = {
          totalRevenue: Number(revenueResult[0]?.total || 0),
          totalExpenses: Number(expensesResult[0]?.total || 0),
          netIncome: Number(revenueResult[0]?.total || 0) - Number(expensesResult[0]?.total || 0),
          pendingExpenses: Number(pendingExpenses[0]?.count || 0),
        };
      } catch {
        stats.finance = { totalRevenue: 0, totalExpenses: 0, netIncome: 0, pendingExpenses: 0 };
      }
    }

    // Projects stats
    if (auth.permissions.projects?.length > 0) {
      try {
        const projectStats = await query<any[]>(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
          FROM prj_projects
        `);

        const overdueTasks = await query<any[]>(`
          SELECT COUNT(*) as count FROM prj_tasks
          WHERE status NOT IN ('done', 'cancelled')
            AND due_date < CURRENT_DATE
        `);

        const hoursThisWeek = await query<any[]>(`
          SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) as hours
          FROM prj_time_entries
          WHERE start_time >= DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) DAY)
        `);

        stats.projects = {
          totalProjects: Number(projectStats[0]?.total || 0),
          activeProjects: Number(projectStats[0]?.active || 0),
          completedProjects: Number(projectStats[0]?.completed || 0),
          overdueTask: Number(overdueTasks[0]?.count || 0),
          hoursLoggedThisWeek: Number(hoursThisWeek[0]?.hours || 0),
        };
      } catch {
        stats.projects = { totalProjects: 0, activeProjects: 0, completedProjects: 0, overdueTask: 0, hoursLoggedThisWeek: 0 };
      }
    }

    // HR stats
    if (auth.permissions.hr?.length > 0) {
      try {
        const employeeStats = await query<any[]>(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active
          FROM hr_employees
        `);

        const pendingLeave = await query<any[]>(`
          SELECT COUNT(*) as count FROM hr_leave_requests WHERE status = 'pending'
        `);

        const upcomingPayroll = await query<any[]>(`
          SELECT COUNT(*) as count FROM hr_payroll_runs
          WHERE status IN ('draft', 'processing')
        `);

        stats.hr = {
          totalEmployees: Number(employeeStats[0]?.total || 0),
          activeEmployees: Number(employeeStats[0]?.active || 0),
          pendingLeaveRequests: Number(pendingLeave[0]?.count || 0),
          upcomingPayroll: Number(upcomingPayroll[0]?.count || 0),
        };
      } catch {
        stats.hr = { totalEmployees: 0, activeEmployees: 0, pendingLeaveRequests: 0, upcomingPayroll: 0 };
      }
    }

    // CRM stats
    if (auth.permissions.crm?.length > 0) {
      try {
        const contactsCount = await query<any[]>(`SELECT COUNT(*) as count FROM crm_contacts`);
        const companiesCount = await query<any[]>(`SELECT COUNT(*) as count FROM crm_companies`);

        const dealStats = await query<any[]>(`
          SELECT
            COUNT(*) as open_deals,
            COALESCE(SUM(amount), 0) as pipeline_value,
            SUM(CASE WHEN ps.is_won = TRUE AND MONTH(d.actual_close_date) = MONTH(CURRENT_DATE) THEN 1 ELSE 0 END) as won_this_month
          FROM crm_deals d
          JOIN crm_pipeline_stages ps ON d.stage_id = ps.id
          WHERE ps.is_won = FALSE AND ps.is_lost = FALSE
        `);

        stats.crm = {
          totalContacts: Number(contactsCount[0]?.count || 0),
          totalCompanies: Number(companiesCount[0]?.count || 0),
          openDeals: Number(dealStats[0]?.open_deals || 0),
          pipelineValue: Number(dealStats[0]?.pipeline_value || 0),
          dealsWonThisMonth: Number(dealStats[0]?.won_this_month || 0),
        };
      } catch {
        stats.crm = { totalContacts: 0, totalCompanies: 0, openDeals: 0, pipelineValue: 0, dealsWonThisMonth: 0 };
      }
    }

    // Inventory stats
    if (auth.permissions.inventory?.length > 0) {
      try {
        const productsCount = await query<any[]>(`
          SELECT COUNT(*) as count FROM inv_products WHERE is_active = TRUE
        `);

        const lowStock = await query<any[]>(`
          SELECT COUNT(DISTINCT p.id) as count
          FROM inv_products p
          JOIN inv_stock s ON p.id = s.product_id
          WHERE p.is_active = TRUE
            AND p.track_inventory = TRUE
            AND s.quantity_available <= p.reorder_point
        `);

        const pendingPO = await query<any[]>(`
          SELECT COUNT(*) as count FROM inv_purchase_orders
          WHERE status IN ('draft', 'submitted', 'confirmed')
        `);

        const stockValue = await query<any[]>(`
          SELECT COALESCE(SUM(s.quantity_on_hand * p.cost_price), 0) as value
          FROM inv_stock s
          JOIN inv_products p ON s.product_id = p.id
          WHERE p.is_active = TRUE
        `);

        stats.inventory = {
          totalProducts: Number(productsCount[0]?.count || 0),
          lowStockItems: Number(lowStock[0]?.count || 0),
          pendingPurchaseOrders: Number(pendingPO[0]?.count || 0),
          totalStockValue: Number(stockValue[0]?.value || 0),
        };
      } catch {
        stats.inventory = { totalProducts: 0, lowStockItems: 0, pendingPurchaseOrders: 0, totalStockValue: 0 };
      }
    }

    // Invoicing stats
    if (auth.permissions.invoicing?.length > 0) {
      try {
        const invoiceStats = await query<any[]>(`
          SELECT
            SUM(CASE WHEN status IN ('sent', 'viewed', 'partial') THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'overdue' OR (status IN ('sent', 'viewed', 'partial') AND due_date < CURRENT_DATE) THEN 1 ELSE 0 END) as overdue,
            SUM(CASE WHEN status = 'paid' AND MONTH(paid_at) = MONTH(CURRENT_DATE) THEN total_amount ELSE 0 END) as paid_this_month,
            SUM(CASE WHEN status IN ('sent', 'viewed', 'partial', 'overdue') THEN amount_due ELSE 0 END) as outstanding
          FROM erp_invoices
        `);

        stats.invoicing = {
          pendingInvoices: Number(invoiceStats[0]?.pending || 0),
          overdueInvoices: Number(invoiceStats[0]?.overdue || 0),
          paidThisMonth: Number(invoiceStats[0]?.paid_this_month || 0),
          outstandingAmount: Number(invoiceStats[0]?.outstanding || 0),
        };
      } catch {
        stats.invoicing = { pendingInvoices: 0, overdueInvoices: 0, paidThisMonth: 0, outstandingAmount: 0 };
      }
    }

    // Recent activity (from audit log)
    let recentActivity: any[] = [];
    try {
      const activity = await query<any[]>(`
        SELECT
          al.action,
          al.entity_type,
          al.module,
          al.created_at,
          u.display_name as user_name,
          u.email as user_email
        FROM erp_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `);

      recentActivity = activity.map((a) => ({
        user: a.user_name || a.user_email?.split('@')[0] || 'Unknown',
        description: `${a.action} ${a.entity_type} in ${a.module}`,
        timestamp: formatRelativeTime(a.created_at),
        module: a.module,
      }));
    } catch {
      recentActivity = [];
    }

    return NextResponse.json({ stats, recentActivity });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return then.toLocaleDateString();
}
