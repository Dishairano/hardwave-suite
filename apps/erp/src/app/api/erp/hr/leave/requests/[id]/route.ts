import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRLeaveRequest } from '@/lib/erp-types';

// GET /api/erp/hr/leave/requests/[id] - Get leave request details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const requestId = parseInt(id);

    const leaveRequest = await queryOne<any>(`
      SELECT
        lr.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.employee_number,
        lt.name as leave_type_name,
        lt.color as leave_type_color,
        a.first_name as approver_first_name,
        a.last_name as approver_last_name,
        lb.balance as leave_balance
      FROM hr_leave_requests lr
      JOIN hr_employees e ON lr.employee_id = e.id
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN hr_employees a ON lr.approved_by = a.id
      LEFT JOIN hr_leave_balances lb ON lb.employee_id = lr.employee_id
        AND lb.leave_type_id = lr.leave_type_id
        AND lb.year = YEAR(lr.start_date)
      WHERE lr.id = ?
    `, [requestId]);

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: leaveRequest });
  } catch (error: any) {
    console.error('Get leave request error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/leave/requests/[id] - Approve/reject leave request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'approve');
    const { id } = await params;
    const requestId = parseInt(id);
    const body = await request.json();

    const leaveRequest = await queryOne<HRLeaveRequest>(
      'SELECT * FROM hr_leave_requests WHERE id = ?',
      [requestId]
    );

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be approved or rejected' },
        { status: 400 }
      );
    }

    const { action, rejection_reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get approver's employee record
    const approver = await queryOne<{ id: number }>(
      'SELECT id FROM hr_employees WHERE user_id = ?',
      [auth.userId]
    );

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await query(`
      UPDATE hr_leave_requests
      SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ?
      WHERE id = ?
    `, [newStatus, approver?.id || null, rejection_reason || null, requestId]);

    // If approved, update leave balance
    if (action === 'approve') {
      await query(`
        UPDATE hr_leave_balances
        SET used = used + ?, balance = balance - ?
        WHERE employee_id = ? AND leave_type_id = ? AND year = YEAR(?)
      `, [
        leaveRequest.days_requested,
        leaveRequest.days_requested,
        leaveRequest.employee_id,
        leaveRequest.leave_type_id,
        leaveRequest.start_date,
      ]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action,
      entity_type: 'leave_request',
      entity_id: requestId,
      old_values: { status: 'pending' },
      new_values: { status: newStatus },
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<HRLeaveRequest>(
      'SELECT * FROM hr_leave_requests WHERE id = ?',
      [requestId]
    );

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    console.error('Update leave request error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/leave/requests/[id] - Cancel/delete leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const requestId = parseInt(id);

    const leaveRequest = await queryOne<HRLeaveRequest>(
      'SELECT * FROM hr_leave_requests WHERE id = ?',
      [requestId]
    );

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Only pending requests can be cancelled
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      );
    }

    await query('DELETE FROM hr_leave_requests WHERE id = ?', [requestId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'leave_request',
      entity_id: requestId,
      old_values: leaveRequest,
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete leave request error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
