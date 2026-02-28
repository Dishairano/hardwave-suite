import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRDepartment } from '@/lib/erp-types';

// GET /api/erp/hr/departments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const departmentId = parseInt(id);

    const department = await queryOne<HRDepartment>(`
      SELECT d.*,
        p.name as parent_name,
        m.display_name as manager_name
      FROM hr_departments d
      LEFT JOIN hr_departments p ON d.parent_id = p.id
      LEFT JOIN users m ON d.manager_id = m.id
      WHERE d.id = ?
    `, [departmentId]);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Get employees in this department
    const employees = await query<any[]>(`
      SELECT e.*, u.display_name, u.email
      FROM hr_employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.department_id = ? AND e.employment_status = 'active'
      ORDER BY u.display_name
    `, [departmentId]);

    // Get child departments
    const children = await query<HRDepartment[]>(
      'SELECT * FROM hr_departments WHERE parent_id = ? ORDER BY name',
      [departmentId]
    );

    return NextResponse.json({ department, employees, children });
  } catch (error: any) {
    console.error('Get department error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/departments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const departmentId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<HRDepartment>('SELECT * FROM hr_departments WHERE id = ?', [departmentId]);
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'code', 'description', 'parent_id', 'manager_id', 'is_active'];
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

    values.push(departmentId);
    await query(`UPDATE hr_departments SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'update',
      entity_type: 'department',
      entity_id: departmentId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<HRDepartment>('SELECT * FROM hr_departments WHERE id = ?', [departmentId]);
    return NextResponse.json({ success: true, department: updated });
  } catch (error: any) {
    console.error('Update department error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/departments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const departmentId = parseInt(id);

    const existing = await queryOne<HRDepartment>('SELECT * FROM hr_departments WHERE id = ?', [departmentId]);
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Check for child departments
    const children = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_departments WHERE parent_id = ?', [departmentId]);
    if (children && children.count > 0) {
      return NextResponse.json({ error: 'Cannot delete department with child departments' }, { status: 400 });
    }

    // Check for employees
    const employees = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_employees WHERE department_id = ? AND employment_status = "active"', [departmentId]);
    if (employees && employees.count > 0) {
      return NextResponse.json({ error: 'Cannot delete department with active employees' }, { status: 400 });
    }

    await query('DELETE FROM hr_departments WHERE id = ?', [departmentId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'department',
      entity_id: departmentId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete department error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
