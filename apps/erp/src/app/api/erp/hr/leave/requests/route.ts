import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRLeaveRequest } from '@/lib/erp-types';

// GET /api/erp/hr/leave/requests - List leave requests
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employee_id');
    const leaveTypeId = searchParams.get('leave_type_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }

    if (employeeId) {
      if (employeeId === 'me') {
        whereClause += ` AND lr.employee_id = (SELECT id FROM hr_employees WHERE user_id = ? LIMIT 1)`;
        params.push(auth.userId);
      } else {
        whereClause += ' AND lr.employee_id = ?';
        params.push(parseInt(employeeId));
      }
    }

    if (leaveTypeId) {
      whereClause += ' AND lr.leave_type_id = ?';
      params.push(parseInt(leaveTypeId));
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_leave_requests lr ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        lr.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.employee_number,
        lt.name as leave_type_name,
        lt.color as leave_type_color,
        a.first_name as approver_first_name,
        a.last_name as approver_last_name
      FROM hr_leave_requests lr
      JOIN hr_employees e ON lr.employee_id = e.id
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN hr_employees a ON lr.approved_by = a.id
      ${whereClause}
      ORDER BY lr.start_date DESC LIMIT ? OFFSET ?
    `;

    const requests = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(requests, total, page, limit));
  } catch (error: any) {
    console.error('Get leave requests error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/leave/requests - Submit leave request
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      days_requested,
      reason,
    } = body;

    if (!employee_id || !leave_type_id || !start_date || !end_date || !days_requested) {
      return NextResponse.json(
        { error: 'Employee, leave type, dates, and days are required' },
        { status: 400 }
      );
    }

    // Check employee has sufficient balance
    const balance = await queryOne<{ balance: number }>(`
      SELECT balance FROM hr_leave_balances
      WHERE employee_id = ? AND leave_type_id = ? AND year = YEAR(?)
    `, [employee_id, leave_type_id, start_date]);

    if (!balance || balance.balance < days_requested) {
      return NextResponse.json(
        { error: 'Insufficient leave balance' },
        { status: 400 }
      );
    }

    // Check for overlapping requests
    const overlapping = await queryOne<{ id: number }>(`
      SELECT id FROM hr_leave_requests
      WHERE employee_id = ?
        AND status IN ('pending', 'approved')
        AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))
    `, [employee_id, end_date, start_date, start_date, end_date]);

    if (overlapping) {
      return NextResponse.json(
        { error: 'You have an overlapping leave request for these dates' },
        { status: 400 }
      );
    }

    const result = await query<any>(`
      INSERT INTO hr_leave_requests (
        employee_id, leave_type_id, start_date, end_date, days_requested, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [employee_id, leave_type_id, start_date, end_date, days_requested, reason || null]);

    const requestId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'leave_request',
      entity_id: requestId,
      new_values: { employee_id, leave_type_id, days_requested },
      ip_address: getClientIP(request),
    });

    const leaveRequest = await queryOne<HRLeaveRequest>(`
      SELECT lr.*, lt.name as leave_type_name
      FROM hr_leave_requests lr
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = ?
    `, [requestId]);

    return NextResponse.json({ success: true, request: leaveRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Create leave request error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
