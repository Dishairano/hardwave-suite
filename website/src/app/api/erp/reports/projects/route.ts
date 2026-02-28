import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports/projects - Project analytics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const groupBy = searchParams.get('group_by') || 'month';

    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-%u',
      month: '%Y-%m',
      year: '%Y',
    }[groupBy] || '%Y-%m';

    // Project overview
    const overview = await queryOne<any>(`
      SELECT
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        COALESCE(SUM(budget_amount), 0) as total_budget
      FROM prj_projects
    `);

    // Projects by status
    const byStatus = await query<any[]>(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(budget_amount), 0) as total_budget
      FROM prj_projects
      GROUP BY status
    `);

    // Tasks overview
    const tasksOverview = await queryOne<any>(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) as in_review,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue
      FROM prj_tasks
    `);

    // Time entries over time
    const timeParams: any[] = [];
    let timeSql = `
      SELECT
        DATE_FORMAT(date, '${dateFormat}') as period,
        SUM(hours) as total_hours,
        SUM(CASE WHEN billable = TRUE THEN hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN billable = TRUE AND billed = TRUE THEN hours ELSE 0 END) as billed_hours
      FROM prj_time_entries
      WHERE 1=1
    `;
    timeSql += buildDateRangeFilter('date', startDate, endDate, timeParams);
    timeSql += ` GROUP BY period ORDER BY period`;
    const timeOverTime = await query<any[]>(timeSql, timeParams);

    // Time by project
    const timeByProjectParams: any[] = [];
    let timeByProjectSql = `
      SELECT
        p.name as project,
        SUM(t.hours) as total_hours,
        SUM(CASE WHEN t.billable = TRUE THEN t.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN t.billable = TRUE THEN t.hours * COALESCE(p.hourly_rate, 0) ELSE 0 END) as billable_value
      FROM prj_time_entries t
      JOIN prj_projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    timeByProjectSql += buildDateRangeFilter('t.date', startDate, endDate, timeByProjectParams);
    timeByProjectSql += ` GROUP BY p.id, p.name ORDER BY total_hours DESC LIMIT 10`;
    const timeByProject = await query<any[]>(timeByProjectSql, timeByProjectParams);

    // Time by user
    const timeByUserParams: any[] = [];
    let timeByUserSql = `
      SELECT
        u.display_name as user,
        SUM(t.hours) as total_hours,
        SUM(CASE WHEN t.billable = TRUE THEN t.hours ELSE 0 END) as billable_hours,
        COUNT(DISTINCT t.project_id) as projects_worked
      FROM prj_time_entries t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    timeByUserSql += buildDateRangeFilter('t.date', startDate, endDate, timeByUserParams);
    timeByUserSql += ` GROUP BY t.user_id, u.display_name ORDER BY total_hours DESC`;
    const timeByUser = await query<any[]>(timeByUserSql, timeByUserParams);

    // Budget utilization
    const budgetUtilization = await query<any[]>(`
      SELECT
        p.name as project,
        p.budget_amount as budget,
        COALESCE(SUM(t.hours * COALESCE(p.hourly_rate, 0)), 0) as spent,
        p.budget_amount - COALESCE(SUM(t.hours * COALESCE(p.hourly_rate, 0)), 0) as remaining,
        ROUND(COALESCE(SUM(t.hours * COALESCE(p.hourly_rate, 0)), 0) * 100.0 / NULLIF(p.budget_amount, 0), 1) as utilization_pct
      FROM prj_projects p
      LEFT JOIN prj_time_entries t ON t.project_id = p.id
      WHERE p.status = 'active' AND p.budget_amount > 0
      GROUP BY p.id, p.name, p.budget_amount
      ORDER BY utilization_pct DESC
    `);

    // Milestones status
    const milestonesStatus = await query<any[]>(`
      SELECT
        CASE
          WHEN status = 'completed' THEN 'completed'
          WHEN due_date < CURDATE() THEN 'overdue'
          WHEN due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'due_soon'
          ELSE 'on_track'
        END as status,
        COUNT(*) as count
      FROM prj_milestones
      GROUP BY status
    `);

    // Task completion trend
    const completionParams: any[] = [];
    let completionSql = `
      SELECT
        DATE_FORMAT(completed_at, '${dateFormat}') as period,
        COUNT(*) as tasks_completed
      FROM prj_tasks
      WHERE status = 'completed' AND completed_at IS NOT NULL
    `;
    completionSql += buildDateRangeFilter('completed_at', startDate, endDate, completionParams);
    completionSql += ` GROUP BY period ORDER BY period`;
    const completionTrend = await query<any[]>(completionSql, completionParams);

    // Productivity metrics
    const productivity = await queryOne<any>(`
      SELECT
        (SELECT AVG(DATEDIFF(completed_at, created_at)) FROM prj_tasks WHERE status = 'completed' AND completed_at IS NOT NULL) as avg_task_duration,
        (SELECT COUNT(*) FROM prj_tasks WHERE status = 'completed' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) as tasks_completed_this_week,
        (SELECT COUNT(*) FROM prj_tasks WHERE status != 'completed' AND due_date < CURDATE()) as overdue_tasks
    `);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate, group_by: groupBy },
      overview: {
        ...overview,
        total_budget: parseFloat(overview?.total_budget || 0),
      },
      by_status: byStatus.map(s => ({
        ...s,
        total_budget: parseFloat(s.total_budget || 0),
      })),
      tasks_overview: tasksOverview,
      time_over_time: timeOverTime.map(t => ({
        ...t,
        total_hours: parseFloat(t.total_hours || 0),
        billable_hours: parseFloat(t.billable_hours || 0),
        billed_hours: parseFloat(t.billed_hours || 0),
      })),
      time_by_project: timeByProject.map(t => ({
        ...t,
        total_hours: parseFloat(t.total_hours || 0),
        billable_hours: parseFloat(t.billable_hours || 0),
        billable_value: parseFloat(t.billable_value || 0),
      })),
      time_by_user: timeByUser.map(t => ({
        ...t,
        total_hours: parseFloat(t.total_hours || 0),
        billable_hours: parseFloat(t.billable_hours || 0),
      })),
      budget_utilization: budgetUtilization.map(b => ({
        ...b,
        budget: parseFloat(b.budget || 0),
        spent: parseFloat(b.spent || 0),
        remaining: parseFloat(b.remaining || 0),
        utilization_pct: parseFloat(b.utilization_pct || 0),
      })),
      milestones_status: milestonesStatus,
      completion_trend: completionTrend,
      productivity: {
        avg_task_duration: parseFloat(productivity?.avg_task_duration || 0),
        tasks_completed_this_week: productivity?.tasks_completed_this_week || 0,
        overdue_tasks: productivity?.overdue_tasks || 0,
      },
    });
  } catch (error: any) {
    console.error('Get project reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
