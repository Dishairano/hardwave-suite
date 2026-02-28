import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRPayrollRun } from '@/lib/erp-types';

// GET /api/erp/hr/payroll/runs - List payroll runs
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND pr.status = ?';
      params.push(status);
    }

    if (year) {
      whereClause += ' AND YEAR(pr.pay_period_start) = ?';
      params.push(parseInt(year));
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_payroll_runs pr ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        pr.*,
        u.display_name as created_by_name,
        a.display_name as approved_by_name,
        (SELECT COUNT(*) FROM hr_payroll_items WHERE payroll_run_id = pr.id) as item_count,
        (SELECT SUM(net_pay) FROM hr_payroll_items WHERE payroll_run_id = pr.id) as total_net_pay
      FROM hr_payroll_runs pr
      JOIN users u ON pr.created_by = u.id
      LEFT JOIN users a ON pr.approved_by = a.id
      ${whereClause}
      ORDER BY pr.pay_period_start DESC LIMIT ? OFFSET ?
    `;

    const runs = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(runs, total, page, limit));
  } catch (error: any) {
    console.error('Get payroll runs error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/payroll/runs - Create payroll run
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const {
      payroll_number,
      pay_period_start,
      pay_period_end,
      payment_date,
      department_id,
      notes,
    } = body;

    if (!pay_period_start || !pay_period_end || !payment_date) {
      return NextResponse.json(
        { error: 'Pay period and payment date are required' },
        { status: 400 }
      );
    }

    // Generate payroll number if not provided
    let payNumber = payroll_number;
    if (!payNumber) {
      const lastRun = await queryOne<{ payroll_number: string }>(
        `SELECT payroll_number FROM hr_payroll_runs ORDER BY id DESC LIMIT 1`
      );
      const lastNum = lastRun?.payroll_number
        ? parseInt(lastRun.payroll_number.replace('PAY', ''))
        : 0;
      payNumber = `PAY${String(lastNum + 1).padStart(5, '0')}`;
    }

    const result = await query<any>(`
      INSERT INTO hr_payroll_runs (
        payroll_number, pay_period_start, pay_period_end, payment_date,
        status, created_by, notes
      ) VALUES (?, ?, ?, ?, 'draft', ?, ?)
    `, [payNumber, pay_period_start, pay_period_end, payment_date, auth.userId, notes || null]);

    const runId = result.insertId;

    // Auto-generate payroll items for active employees
    let employeeSql = `
      SELECT id, salary, currency
      FROM hr_employees
      WHERE employment_status = 'active' AND salary IS NOT NULL
    `;
    const empParams: any[] = [];

    if (department_id) {
      employeeSql += ' AND department_id = ?';
      empParams.push(parseInt(department_id));
    }

    const employees = await query<any[]>(employeeSql, empParams);

    for (const emp of employees) {
      // Calculate gross pay (simplified: monthly salary)
      const grossPay = emp.salary / 12;
      const federalTax = grossPay * 0.12;
      const stateTax = grossPay * 0.05;
      const socialSecurity = grossPay * 0.062;
      const medicare = grossPay * 0.0145;
      const totalDeductions = federalTax + stateTax + socialSecurity + medicare;
      const netPay = grossPay - totalDeductions;

      await query(`
        INSERT INTO hr_payroll_items (
          payroll_run_id, employee_id, base_salary, gross_pay,
          federal_tax, state_tax, social_security, medicare,
          total_deductions, net_pay
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [runId, emp.id, emp.salary, grossPay, federalTax, stateTax, socialSecurity, medicare, totalDeductions, netPay]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'payroll_run',
      entity_id: runId,
      new_values: { payroll_number: payNumber, pay_period_start, pay_period_end, employees: employees.length },
      ip_address: getClientIP(request),
    });

    const payrollRun = await queryOne<HRPayrollRun>(`
      SELECT pr.*, (SELECT COUNT(*) FROM hr_payroll_items WHERE payroll_run_id = pr.id) as item_count
      FROM hr_payroll_runs pr
      WHERE pr.id = ?
    `, [runId]);

    return NextResponse.json({ success: true, payroll_run: payrollRun }, { status: 201 });
  } catch (error: any) {
    console.error('Create payroll run error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
