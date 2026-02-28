import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRLeaveType } from '@/lib/erp-types';

// GET /api/erp/hr/leave/types/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const typeId = parseInt(id);

    const leaveType = await queryOne<HRLeaveType>(`
      SELECT lt.*,
        (SELECT COUNT(*) FROM hr_leave_requests WHERE leave_type_id = lt.id) as request_count
      FROM hr_leave_types lt
      WHERE lt.id = ?
    `, [typeId]);

    if (!leaveType) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
    }

    return NextResponse.json({ type: leaveType });
  } catch (error: any) {
    console.error('Get leave type error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/leave/types/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const typeId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<HRLeaveType>('SELECT * FROM hr_leave_types WHERE id = ?', [typeId]);
    if (!existing) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'code', 'description', 'default_days_per_year', 'is_paid', 'requires_approval', 'is_active', 'color'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(typeId);
    await query(`UPDATE hr_leave_types SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'update',
      entity_type: 'leave_type',
      entity_id: typeId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<HRLeaveType>('SELECT * FROM hr_leave_types WHERE id = ?', [typeId]);
    return NextResponse.json({ success: true, type: updated });
  } catch (error: any) {
    console.error('Update leave type error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/leave/types/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const typeId = parseInt(id);

    const existing = await queryOne<HRLeaveType>('SELECT * FROM hr_leave_types WHERE id = ?', [typeId]);
    if (!existing) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });
    }

    // Check for existing leave requests
    const requests = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_leave_requests WHERE leave_type_id = ?', [typeId]);
    if (requests && requests.count > 0) {
      return NextResponse.json({ error: 'Cannot delete leave type with existing leave requests' }, { status: 400 });
    }

    // Check for existing leave balances
    const balances = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_leave_balances WHERE leave_type_id = ?', [typeId]);
    if (balances && balances.count > 0) {
      return NextResponse.json({ error: 'Cannot delete leave type with existing leave balances' }, { status: 400 });
    }

    await query('DELETE FROM hr_leave_types WHERE id = ?', [typeId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'leave_type',
      entity_id: typeId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete leave type error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
