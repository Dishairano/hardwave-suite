import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports/hr - HR analytics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');
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

    // Headcount overview
    const headcount = await queryOne<any>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN employment_status = 'on_leave' THEN 1 ELSE 0 END) as on_leave,
        SUM(CASE WHEN employment_status = 'terminated' THEN 1 ELSE 0 END) as terminated
      FROM hr_employees
    `);

    // Employees by department
    const byDepartment = await query<any[]>(`
      SELECT
        d.name as department,
        COUNT(e.id) as count,
        COALESCE(AVG(e.salary), 0) as avg_salary
      FROM hr_departments d
      LEFT JOIN hr_employees e ON e.department_id = d.id AND e.employment_status = 'active'
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `);

    // Employees by employment type
    const byEmploymentType = await query<any[]>(`
      SELECT
        employment_type as type,
        COUNT(*) as count
      FROM hr_employees
      WHERE employment_status = 'active'
      GROUP BY employment_type
    `);

    // Hiring trend
    const hiringParams: any[] = [];
    let hiringSql = `
      SELECT
        DATE_FORMAT(hire_date, '${dateFormat}') as period,
        COUNT(*) as hired
      FROM hr_employees
      WHERE 1=1
    `;
    hiringSql += buildDateRangeFilter('hire_date', startDate, endDate, hiringParams);
    hiringSql += ` GROUP BY period ORDER BY period`;
    const hiringTrend = await query<any[]>(hiringSql, hiringParams);

    // Turnover trend
    const turnoverParams: any[] = [];
    let turnoverSql = `
      SELECT
        DATE_FORMAT(termination_date, '${dateFormat}') as period,
        COUNT(*) as terminated
      FROM hr_employees
      WHERE termination_date IS NOT NULL
    `;
    turnoverSql += buildDateRangeFilter('termination_date', startDate, endDate, turnoverParams);
    turnoverSql += ` GROUP BY period ORDER BY period`;
    const turnoverTrend = await query<any[]>(turnoverSql, turnoverParams);

    // Leave requests summary
    const leaveParams: any[] = [];
    let leaveSql = `
      SELECT
        lt.name as leave_type,
        COUNT(*) as request_count,
        SUM(DATEDIFF(lr.end_date, lr.start_date) + 1) as total_days,
        SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM hr_leave_requests lr
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      WHERE 1=1
    `;
    leaveSql += buildDateRangeFilter('lr.start_date', startDate, endDate, leaveParams);
    leaveSql += ` GROUP BY lr.leave_type_id, lt.name ORDER BY request_count DESC`;
    const leaveRequests = await query<any[]>(leaveSql, leaveParams);

    // Tenure distribution
    const tenureDistribution = await query<any[]>(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), hire_date) < 365 THEN '< 1 year'
          WHEN DATEDIFF(CURDATE(), hire_date) < 730 THEN '1-2 years'
          WHEN DATEDIFF(CURDATE(), hire_date) < 1825 THEN '2-5 years'
          WHEN DATEDIFF(CURDATE(), hire_date) < 3650 THEN '5-10 years'
          ELSE '10+ years'
        END as tenure_bucket,
        COUNT(*) as count
      FROM hr_employees
      WHERE employment_status = 'active'
      GROUP BY tenure_bucket
      ORDER BY FIELD(tenure_bucket, '< 1 year', '1-2 years', '2-5 years', '5-10 years', '10+ years')
    `);

    // Salary distribution
    const salaryDistribution = await query<any[]>(`
      SELECT
        CASE
          WHEN salary < 50000 THEN '< $50k'
          WHEN salary < 75000 THEN '$50k-$75k'
          WHEN salary < 100000 THEN '$75k-$100k'
          WHEN salary < 150000 THEN '$100k-$150k'
          ELSE '$150k+'
        END as salary_range,
        COUNT(*) as count,
        AVG(salary) as avg_salary
      FROM hr_employees
      WHERE employment_status = 'active' AND salary IS NOT NULL
      GROUP BY salary_range
      ORDER BY FIELD(salary_range, '< $50k', '$50k-$75k', '$75k-$100k', '$100k-$150k', '$150k+')
    `);

    // Payroll summary
    const payrollParams: any[] = [];
    let payrollSql = `
      SELECT
        DATE_FORMAT(pr.pay_period_end, '${dateFormat}') as period,
        SUM(pi.gross_pay) as total_gross,
        SUM(pi.net_pay) as total_net,
        COUNT(DISTINCT pi.employee_id) as employee_count
      FROM hr_payroll_runs pr
      JOIN hr_payroll_items pi ON pi.payroll_run_id = pr.id
      WHERE pr.status = 'paid'
    `;
    payrollSql += buildDateRangeFilter('pr.pay_period_end', startDate, endDate, payrollParams);
    payrollSql += ` GROUP BY period ORDER BY period`;
    const payrollSummary = await query<any[]>(payrollSql, payrollParams);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate, group_by: groupBy },
      headcount,
      by_department: byDepartment.map(d => ({
        ...d,
        avg_salary: parseFloat(d.avg_salary || 0),
      })),
      by_employment_type: byEmploymentType,
      hiring_trend: hiringTrend,
      turnover_trend: turnoverTrend,
      leave_requests: leaveRequests,
      tenure_distribution: tenureDistribution,
      salary_distribution: salaryDistribution.map(s => ({
        ...s,
        avg_salary: parseFloat(s.avg_salary || 0),
      })),
      payroll_summary: payrollSummary.map(p => ({
        ...p,
        total_gross: parseFloat(p.total_gross || 0),
        total_net: parseFloat(p.total_net || 0),
      })),
    });
  } catch (error: any) {
    console.error('Get HR reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
