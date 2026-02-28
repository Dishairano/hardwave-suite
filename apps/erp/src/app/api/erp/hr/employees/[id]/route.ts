import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HREmployee } from '@/lib/erp-types';

// GET /api/erp/hr/employees/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const employeeId = parseInt(id);

    const employee = await queryOne<HREmployee>(`
      SELECT e.*,
        d.name as department_name,
        p.title as position_title,
        CONCAT(mgr.first_name, ' ', mgr.last_name) as manager_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON e.department_id = d.id
      LEFT JOIN hr_positions p ON e.position_id = p.id
      LEFT JOIN hr_employees mgr ON e.manager_id = mgr.id
      WHERE e.id = ?
    `, [employeeId]);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get leave balances
    const leaveBalances = await query<any[]>(`
      SELECT lb.*, lt.name as leave_type_name
      FROM hr_leave_balances lb
      JOIN hr_leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = YEAR(CURDATE())
    `, [employeeId]);

    return NextResponse.json({ employee, leaveBalances });
  } catch (error: any) {
    console.error('Get employee error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/employees/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<HREmployee>('SELECT * FROM hr_employees WHERE id = ?', [employeeId]);
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone', 'personal_email', 'date_of_birth', 'gender',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
      'department_id', 'position_id', 'manager_id', 'employment_type', 'employment_status',
      'hire_date', 'termination_date', 'probation_end_date', 'work_location',
      'salary', 'salary_frequency', 'currency', 'bank_name', 'bank_account_number', 'bank_routing_number', 'tax_id',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
      'notes', 'profile_photo_url'
    ];
    const dateFields = ['date_of_birth', 'hire_date', 'termination_date', 'probation_end_date'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        // Convert empty strings to null for date fields
        if (dateFields.includes(field) && body[field] === '') {
          values.push(null);
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(employeeId);
    await query(`UPDATE hr_employees SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'update',
      entity_type: 'employee',
      entity_id: employeeId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<HREmployee>('SELECT * FROM hr_employees WHERE id = ?', [employeeId]);
    return NextResponse.json({ success: true, employee: updated });
  } catch (error: any) {
    console.error('Update employee error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/employees/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const employeeId = parseInt(id);

    const existing = await queryOne<HREmployee>('SELECT * FROM hr_employees WHERE id = ?', [employeeId]);
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check for pending leave requests
    const pendingLeave = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM hr_leave_requests
      WHERE employee_id = ? AND status = 'pending'
    `, [employeeId]);
    if (pendingLeave && pendingLeave.count > 0) {
      return NextResponse.json({ error: 'Cannot delete employee with pending leave requests' }, { status: 400 });
    }

    await query('DELETE FROM hr_employees WHERE id = ?', [employeeId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'employee',
      entity_id: employeeId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
